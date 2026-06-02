// mcp.ts — speak the Model Context Protocol, so the agent can use the whole
// MCP tool ecosystem (GitHub, Postgres, Slack, browsers, filesystems, …).
//
// MCP is the industry standard: a server is a subprocess that speaks JSON-RPC
// 2.0 over stdio. Mandolin is the *client* — it spawns a configured server,
// does the initialize handshake, lists its tools, and calls them. Crucially,
// every MCP tool the model invokes still routes through Mandolin's trust gate
// (classed as a network-risk action: denied by default, audited) — so Mandolin
// is *safer* with MCP than a client that wires these tools in raw.
//
// Zero dependencies: node:child_process + JSON over pipes.

import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { paths } from "../home.ts";

export type McpServerConfig = {
  command: string;        // e.g. "npx"
  args?: string[];        // e.g. ["-y", "@modelcontextprotocol/server-github"]
  env?: Record<string, string>;
};

export type McpRegistry = Record<string, McpServerConfig>; // name -> config

export type McpTool = { server: string; name: string; description: string; inputSchema: Record<string, unknown> };

// ---- registry (~/.mandolin/mcp.json) ---------------------------------------

export function loadRegistry(): McpRegistry {
  if (existsSync(paths.mcp())) {
    try {
      const j = JSON.parse(readFileSync(paths.mcp(), "utf8"));
      return j.servers && typeof j.servers === "object" ? j.servers : {};
    } catch {
      /* fall through */
    }
  }
  return {};
}

export function saveRegistry(reg: McpRegistry): void {
  writeFileSync(paths.mcp(), JSON.stringify({ servers: reg }, null, 2) + "\n", "utf8");
}

export function addServer(name: string, cfg: McpServerConfig): void {
  const reg = loadRegistry();
  reg[name] = cfg;
  saveRegistry(reg);
}

export function removeServer(name: string): boolean {
  const reg = loadRegistry();
  if (!(name in reg)) return false;
  delete reg[name];
  saveRegistry(reg);
  return true;
}

// ---- a single MCP client connection ----------------------------------------

export class McpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = "";
  private idc = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  readonly name: string;
  private cfg: McpServerConfig;

  constructor(name: string, cfg: McpServerConfig) {
    this.name = name;
    this.cfg = cfg;
  }

  /** Spawn the server process and run the initialize handshake. */
  async connect(timeoutMs = 15000): Promise<void> {
    this.proc = spawn(this.cfg.command, this.cfg.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...(this.cfg.env ?? {}) },
    }) as ChildProcessWithoutNullStreams;

    this.proc.stdout.on("data", (d: Buffer) => this.onData(d.toString()));
    this.proc.on("error", (e) => this.failAll(new Error(`mcp "${this.name}" failed to start: ${e.message}`)));
    this.proc.on("exit", (code) => { if (code) this.failAll(new Error(`mcp "${this.name}" exited (${code})`)); });

    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mandolin", version: "0.1" },
    }, timeoutMs);
    // notify initialized (one-way notification, no id)
    this.notify("notifications/initialized", {});
  }

  /** List the tools this server exposes, namespaced as mcp__<server>__<tool>. */
  async listTools(): Promise<McpTool[]> {
    const res = await this.request("tools/list", {});
    const tools = Array.isArray(res?.tools) ? res.tools : [];
    return tools.map((t: any) => ({
      server: this.name,
      name: t.name,
      description: t.description ?? "",
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    }));
  }

  /** Call a tool. Returns its text content flattened to a string. */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    const res = await this.request("tools/call", { name: toolName, arguments: args });
    const content = Array.isArray(res?.content) ? res.content : [];
    const text = content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    return text || JSON.stringify(res);
  }

  close(): void {
    this.proc?.kill();
    this.proc = null;
    this.failAll(new Error("connection closed"));
  }

  // --- JSON-RPC plumbing ---

  private onData(chunk: string): void {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      if (!line.trim()) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // ignore non-JSON log noise on stdout
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message ?? "mcp error"));
        else p.resolve(msg.result);
      }
    }
  }

  private request(method: string, params: unknown, timeoutMs = 15000): Promise<any> {
    if (!this.proc) return Promise.reject(new Error("not connected"));
    const id = ++this.idc;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`mcp "${this.name}" ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc!.stdin.write(payload);
    });
  }

  private notify(method: string, params: unknown): void {
    this.proc?.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  private failAll(err: Error): void {
    for (const { reject } of this.pending.values()) reject(err);
    this.pending.clear();
  }
}

/** The wire-name the agent sees for an MCP tool. */
export function mcpToolName(server: string, tool: string): string {
  return `mcp__${server}__${tool}`;
}

/** Parse a wire-name back into {server, tool}; null if not an MCP tool. */
export function parseMcpToolName(wire: string): { server: string; tool: string } | null {
  const m = wire.match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/);
  return m ? { server: m[1], tool: m[2] } : null;
}
