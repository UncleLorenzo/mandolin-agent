// mcp.ts (command) — manage MCP servers and prove the connection works.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { wordmark, rule, frame, tone, dim, bold, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { ensureHome } from "../home.ts";
import { loadRegistry, addServer, removeServer, McpClient, mcpToolName } from "../core/mcp.ts";

export async function mcpCmd(args: string[]): Promise<void> {
  ensureHome();
  const [sub, ...rest] = args;

  if (sub === "add") return addCmd(rest);
  if (sub === "remove" || sub === "rm") return removeCmd(rest[0]);
  if (sub === "test") return testCmd(rest[0]);
  if (sub === "--demo" || sub === "demo") return demoCmd();
  return listCmd();
}

function listCmd(): void {
  const reg = loadRegistry();
  const names = Object.keys(reg);
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· mcp servers"))}`, `   ${rule(50)}`, ""];
  if (!names.length) {
    out.push(`   ${dim(tone.ash("no MCP servers configured yet"))}`);
    out.push("");
    out.push(`   ${eyebrow("connect the whole MCP tool ecosystem — every call through the gate")}`);
    out.push(`   ${tone.teal('mando mcp add github npx -y @modelcontextprotocol/server-github')}`);
    out.push(`   ${dim(tone.ash("see it work with no install:"))} ${gradient("mando mcp --demo", [palette.teal, palette.orange])}`);
  } else {
    for (const n of names) {
      const c = reg[n];
      out.push(`   ${mark.signed} ${tone.cream(n)}  ${dim(tone.ash([c.command, ...(c.args ?? [])].join(" ")))}`);
    }
    out.push("");
    out.push(`   ${dim(tone.ash("test one:"))} ${tone.teal("mando mcp test <name>")}   ${dim(tone.ash("remove:"))} ${tone.teal("mando mcp remove <name>")}`);
    out.push(`   ${dim(tone.ash("MCP tools are network-risk: denied by default, "))}${tone.teal("mando grant network")}${dim(tone.ash(" or approve per-call"))}`);
  }
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}

function addCmd(rest: string[]): void {
  const [name, command, ...cmdArgs] = rest;
  if (!name || !command) {
    process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream("usage: ")}${tone.teal("mando mcp add <name> <command> [args…]")}\n\n`);
    return;
  }
  addServer(name, { command, args: cmdArgs });
  process.stdout.write(
    `\n   ${mark.add} ${tone.cream(`added MCP server `)}${tone.teal(name)}\n` +
    `   ${dim(tone.ash([command, ...cmdArgs].join(" ")))}\n` +
    `   ${dim(tone.ash("test it: "))}${tone.teal(`mando mcp test ${name}`)}\n\n`
  );
}

function removeCmd(name?: string): void {
  if (!name) { process.stdout.write(`\n   ${tone.cream("which server? ")}${tone.teal("mando mcp remove <name>")}\n\n`); return; }
  const ok = removeServer(name);
  process.stdout.write(`\n   ${ok ? mark.ok + " " + tone.cream(`removed ${name}`) : mark.pending + " " + tone.cream(`no server named "${name}"`)}\n\n`);
}

async function testCmd(name?: string): Promise<void> {
  if (!name) { process.stdout.write(`\n   ${tone.cream("which server? ")}${tone.teal("mando mcp test <name>")}\n\n`); return; }
  const reg = loadRegistry();
  if (!reg[name]) { process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream(`no server named "${name}"`)}\n\n`); return; }
  await probe(name, new McpClient(name, reg[name]));
}

async function demoCmd(): Promise<void> {
  // Write a tiny mock MCP server to a temp file and connect to it — proves the
  // whole handshake → list → call flow with nothing to install.
  const mockPath = join(tmpdir(), `mandolin-mcp-mock-${process.pid}.mjs`);
  writeFileSync(mockPath, MOCK_SERVER, "utf8");

  process.stdout.write(
    `\n   ${wordmark()} ${dim(tone.ash("· mcp, rehearsed"))}   ${dim(paint("offline — a real handshake to a mock server", palette.gold))}\n` +
    `   ${rule(58)}\n\n` +
    `   ${tone.cream("Mandolin is an MCP client: it spawns a server, does the JSON-RPC")}\n` +
    `   ${tone.cream("handshake, lists its tools, and calls them — every call gated.")}\n\n`
  );
  await probe("mock", new McpClient("mock", { command: "node", args: [mockPath] }), true);
  process.stdout.write(
    `   ${eyebrow("real servers are one line away")}\n` +
    `   ${tone.teal("mando mcp add github npx -y @modelcontextprotocol/server-github")}\n\n`
  );
}

async function probe(name: string, client: McpClient, isDemo = false): Promise<void> {
  const card: string[] = [];
  try {
    await client.connect();
    card.push(`${mark.ok} ${bold(tone.cream("connected"))}  ${dim(tone.ash(`handshake with "${name}" ok`))}`);
    const tools = await client.listTools();
    card.push("");
    card.push(`${tone.cream(`${tools.length} tool(s) exposed:`)}`);
    for (const t of tools.slice(0, 8)) {
      card.push(`  ${mark.dot} ${tone.bone(mcpToolName(name, t.name))} ${dim(tone.ash("— " + (t.description || "")))}`);
    }
    if (isDemo && tools.length) {
      const first = tools[0];
      const out = await client.callTool(first.name, { text: "hello from mandolin" });
      card.push("");
      card.push(`${mark.arrow} ${dim(tone.ash(`called ${first.name} →`))} ${tone.bone(out.slice(0, 60))}`);
    }
    card.push("");
    card.push(`${dim(tone.ash("these tools are network-risk — the gate asks before the agent uses them"))}`);
  } catch (e) {
    card.push(`${paint("✗ failed", palette.magenta)}  ${tone.cream((e as Error).message)}`);
  } finally {
    client.close();
  }
  process.stdout.write(frame(card).split("\n").map((l) => `   ${l}`).join("\n") + "\n\n");
}

// A minimal but real MCP server (newline-delimited JSON-RPC over stdio).
const MOCK_SERVER = `let buf="";
process.stdin.on("data",d=>{buf+=d;let n;while((n=buf.indexOf("\\n"))!==-1){const l=buf.slice(0,n);buf=buf.slice(n+1);if(!l.trim())continue;const m=JSON.parse(l);
if(m.method==="initialize")r(m.id,{protocolVersion:"2024-11-05",serverInfo:{name:"mock",version:"1"},capabilities:{tools:{}}});
else if(m.method==="tools/list")r(m.id,{tools:[{name:"echo",description:"echo text back",inputSchema:{type:"object",properties:{text:{type:"string"}}}},{name:"now",description:"return a fixed timestamp",inputSchema:{type:"object",properties:{}}}]});
else if(m.method==="tools/call")r(m.id,{content:[{type:"text",text:m.params.name==="echo"?("echoed: "+(m.params.arguments?.text??"")):"2026-06-02T00:00:00Z"}]});
}});
function r(id,result){process.stdout.write(JSON.stringify({jsonrpc:"2.0",id,result})+"\\n")}
`;
