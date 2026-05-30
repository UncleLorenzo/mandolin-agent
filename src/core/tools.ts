// tools.ts — what the agent can DO, and the gate every action passes through.
//
// Same philosophy as the skill ledger, applied to actions: reading is cheap and
// stays inside your project; anything that writes, runs, or reaches the network
// is denied by default and needs either a standing grant (`mando grant`) or your
// in-the-moment yes. Every decision — allowed or denied — is written to
// actions.md. Your agent can act, but never behind your back.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { paths } from "../home.ts";
import { isGranted } from "./provider.ts";

export type Risk = "read" | "write" | "exec" | "network";
export type Decision = "allow" | "ask" | "deny";

export type ToolCall = { tool: string; input: Record<string, unknown> };
export type ToolOutcome = { ok: boolean; output: string; decision: Decision; risk: Risk };

/** Decide ungranted/ambiguous calls. Return true to allow. */
export type Approver = (call: ToolCall, why: string) => Promise<boolean>;

export type Tool = {
  name: string;
  risk: Risk;
  description: string;
  input: Record<string, { type: string; description: string }>;
  run: (input: Record<string, any>) => Promise<string>;
};

const MAX_OUTPUT = 4000;
const clip = (s: string) => (s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + `\n…(${s.length - MAX_OUTPUT} more chars)` : s);

/** Reads are free inside these roots; outside, they require a yes. */
function roots(): string[] {
  return [process.cwd(), homedir()];
}
function withinRoots(p: string): boolean {
  const abs = resolve(p);
  return roots().some((r) => abs === r || abs.startsWith(r + "/"));
}

export const TOOLS: Tool[] = [
  {
    name: "read_file",
    risk: "read",
    description: "Read the contents of a text file.",
    input: { path: { type: "string", description: "File path to read." } },
    run: async ({ path }) => {
      if (!existsSync(path)) return `(no such file: ${path})`;
      return clip(readFileSync(path, "utf8"));
    },
  },
  {
    name: "list_dir",
    risk: "read",
    description: "List the entries in a directory.",
    input: { path: { type: "string", description: "Directory path to list." } },
    run: async ({ path }) => {
      if (!existsSync(path)) return `(no such directory: ${path})`;
      return clip(
        readdirSync(path)
          .map((e) => (statSync(resolve(path, e)).isDirectory() ? e + "/" : e))
          .join("\n")
      );
    },
  },
  {
    name: "write_file",
    risk: "write",
    description: "Create or overwrite a file with the given contents.",
    input: {
      path: { type: "string", description: "File path to write." },
      content: { type: "string", description: "Full contents to write." },
    },
    run: async ({ path, content }) => {
      writeFileSync(path, String(content ?? ""), "utf8");
      return `wrote ${String(content ?? "").length} chars to ${path}`;
    },
  },
  {
    name: "run_shell",
    risk: "exec",
    description: "Run a shell command and return its output.",
    input: { command: { type: "string", description: "The shell command to execute." } },
    run: async ({ command }) => {
      try {
        return clip(execSync(String(command), { encoding: "utf8", timeout: 15000, maxBuffer: 8 * 1024 * 1024 }));
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; message: string };
        return clip(`(command failed)\n${err.stdout ?? ""}${err.stderr ?? ""}${err.message}`);
      }
    },
  },
  {
    name: "fetch_url",
    risk: "network",
    description: "Fetch a URL over HTTPS and return the response body as text.",
    input: { url: { type: "string", description: "The URL to fetch." } },
    run: async ({ url }) => {
      const res = await fetch(String(url));
      return clip(`HTTP ${res.status}\n${await res.text()}`);
    },
  },
];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** The trust gate. Reads inside your roots are free; everything else is earned. */
export function decide(tool: Tool, input: Record<string, unknown>): { decision: Decision; why: string } {
  if (tool.risk === "read") {
    const p = (input.path as string) ?? ".";
    return withinRoots(p)
      ? { decision: "allow", why: "read inside your project" }
      : { decision: "ask", why: `read outside your project (${resolve(p)})` };
  }
  const cap = tool.risk; // "write" | "exec" | "network" map 1:1 to capabilities
  if (isGranted(cap)) return { decision: "allow", why: `${cap} is a standing grant` };
  return { decision: "ask", why: `${cap} action — not granted` };
}

/** Run a tool through the gate. Logs every decision to actions.md. */
export async function executeTool(call: ToolCall, approver?: Approver): Promise<ToolOutcome> {
  const tool = findTool(call.tool);
  if (!tool) {
    recordAction("deny", "read", call.tool, "unknown tool");
    return { ok: false, output: `unknown tool: ${call.tool}`, decision: "deny", risk: "read" };
  }

  let { decision, why } = decide(tool, call.input);
  if (decision === "ask") {
    const allowed = approver ? await approver(call, why) : false;
    decision = allowed ? "allow" : "deny";
  }

  if (decision === "deny") {
    recordAction("deny", tool.risk, tool.name, summarize(call));
    return { ok: false, output: `denied: ${tool.name} (${why})`, decision: "deny", risk: tool.risk };
  }

  try {
    const output = await tool.run(call.input as Record<string, any>);
    recordAction("allow", tool.risk, tool.name, summarize(call));
    return { ok: true, output, decision: "allow", risk: tool.risk };
  } catch (e) {
    recordAction("error", tool.risk, tool.name, (e as Error).message);
    return { ok: false, output: `error: ${(e as Error).message}`, decision: "allow", risk: tool.risk };
  }
}

function summarize(call: ToolCall): string {
  const v = call.input.command ?? call.input.url ?? call.input.path ?? "";
  const s = String(v);
  const digest = call.tool === "run_shell" ? ` · sha ${createHash("sha256").update(s).digest("hex").slice(0, 8)}` : "";
  return (s.length > 80 ? s.slice(0, 79) + "…" : s) + digest;
}

function recordAction(decision: string, risk: Risk, tool: string, summary: string): void {
  const p = paths.actions();
  if (!existsSync(p)) {
    writeFileSync(p, `# Actions\n_Every action the agent took, or was stopped from taking. Your audit trail._\n\n`, "utf8");
  }
  const t = new Date().toISOString();
  appendFileSync(p, `- [${t}] **${decision}** · ${risk} · \`${tool}\` · ${summary}\n`, "utf8");
}

/** Anthropic tool-use schema for the live agent loop. */
export function toolSchemas(): { name: string; description: string; input_schema: Record<string, unknown> }[] {
  return TOOLS.map((t) => ({
    name: t.name,
    description: `${t.description} (risk: ${t.risk})`,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(Object.entries(t.input).map(([k, v]) => [k, { type: v.type, description: v.description }])),
      required: Object.keys(t.input),
    },
  }));
}
