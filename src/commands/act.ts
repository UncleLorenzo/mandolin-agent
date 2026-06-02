// act.ts — put the agent to work with tools, through the trust gate.
//
// Live (model key set): the real agentic loop. Every gated action asks you first.
// Offline (no key): a scripted rehearsal that still runs the real gate and really
// executes the safe tools — and really refuses the dangerous one.

import { createInterface } from "node:readline";
import { wordmark, rule, frame, tone, dim, bold, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { ensureHome, isInitialized } from "../home.ts";
import { scaffoldSignature } from "../core/signature.ts";
import { isLive } from "../core/provider.ts";
import { runAgent } from "../core/agent.ts";
import type { AgentEvent } from "../core/agent.ts";
import { executeTool, decide, findTool } from "../core/tools.ts";
import type { Approver, ToolCall } from "../core/tools.ts";
import { spinner } from "../core/spinner.ts";
import type { Spinner } from "../core/spinner.ts";

export async function act(args: string[]): Promise<void> {
  ensureHome();
  if (!isInitialized()) scaffoldSignature();
  const task = args.join(" ").trim();

  if (!isLive()) {
    await rehearse();
    return;
  }
  if (!task) {
    process.stdout.write(`\n   ${tone.cream('Give it something to do:')} ${tone.teal('mando act "summarize the README"')}\n\n`);
    return;
  }

  process.stdout.write(
    `\n   ${wordmark()} ${dim(tone.ash("· acting"))}\n   ${rule(46)}\n` +
    `   ${eyebrow("operating as your Signature · every gated action asks first")}\n\n` +
    `   ${tone.ash("task")}  ${tone.cream(task)}\n\n`
  );
  // A live spinner shows the agent is working between visible steps; it pauses
  // around approval prompts and rendered events so output never collides.
  let spin: Spinner | null = spinner("thinking");
  const stopSpin = () => { spin?.stop(); spin = null; };
  const liveApprover: Approver = async (call, why) => { stopSpin(); const ok = await interactiveApprover(call, why); spin = spinner("working"); return ok; };
  const liveRender = (e: AgentEvent) => {
    stopSpin();
    renderEvent(e);
    spin = spinner(e.kind === "tool" ? `running ${e.call.tool}` : "thinking");
  };
  let summary: string;
  try {
    summary = await runAgent(task, liveApprover, liveRender);
  } finally {
    stopSpin();
  }
  process.stdout.write(`\n   ${mark.ok} ${tone.cream(summary)}\n\n`);
}

const interactiveApprover: Approver = async (call, why) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt =
    `   ${mark.pending} ${bold(tone.gold("approval needed"))} ${dim(tone.ash("— " + why))}\n` +
    `   ${tone.cream(call.tool)} ${dim(tone.ash(summarize(call)))}\n` +
    `   ${tone.teal("[a]llow")} ${dim(tone.ash("/"))} ${paint("[d]eny", palette.magenta)}: `;
  const ans = await new Promise<string>((res) => rl.question(prompt, res));
  rl.close();
  return /^a/i.test(ans.trim());
};

function renderEvent(e: AgentEvent): void {
  if (e.kind === "think" && e.text.trim()) {
    process.stdout.write(`   ${tone.teal("mandolin")}  ${tone.cream(e.text.trim())}\n`);
  } else if (e.kind === "tool") {
    process.stdout.write(`   ${mark.arrow} ${dim(tone.ash(`${e.call.tool} (${e.risk}) — ${summarize(e.call)}`))}\n`);
  } else if (e.kind === "result") {
    const glyph = e.decision === "deny" ? paint("✗", palette.magenta) : e.ok ? mark.ok : paint("!", palette.gold);
    process.stdout.write(`   ${glyph} ${dim(tone.ash(`${e.tool} · ${e.decision}`))}\n`);
  }
}

// ---- offline rehearsal -----------------------------------------------------

async function rehearse(): Promise<void> {
  const out: string[] = [];
  out.push("");
  out.push(`   ${wordmark()} ${dim(tone.ash("· act, rehearsed"))}   ${dim(paint("offline — real gate, real execution", palette.gold))}`);
  out.push(`   ${rule(56)}`);
  out.push("");
  out.push(`   ${tone.cream("Watch the agent reach for three tools. Reading is free.")}`);
  out.push(`   ${tone.cream("Running and deleting are earned — one you grant, one it can't have.")}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");

  // 1) read inside the project — free
  await step({ tool: "list_dir", input: { path: "." } }, null, "show me what's here");
  // 2) run a command — not granted, so it asks; you say yes; it really runs
  await step({ tool: "run_shell", input: { command: "echo hello from your agent" } }, true, "run something harmless");
  // 3) delete something — not granted; you say no; it's blocked, for real
  await step({ tool: "run_shell", input: { command: "rm -rf ~/important-project" } }, false, "delete a directory");

  process.stdout.write(
    `\n   ${eyebrow("every line above was written to ~/.mandolin/actions.md")}\n` +
    `   ${tone.cream("Grant a standing capability when you trust it:")} ${gradient("mando grant exec", [palette.teal, palette.orange])}\n` +
    `   ${dim(tone.ash("With a model key set, "))}${tone.teal("mando act \"<task>\"")}${dim(tone.ash(" runs the real loop."))}\n\n`
  );
}

async function step(call: ToolCall, scriptedAllow: boolean | null, intent: string): Promise<void> {
  const tool = findTool(call.tool)!;
  const { decision, why } = decide(tool, call.input);
  process.stdout.write(`   ${tone.teal("mandolin")}  ${tone.cream(intent)}\n`);
  process.stdout.write(`   ${mark.arrow} ${dim(tone.ash(`wants: ${call.tool} (${tool.risk}) — ${summarize(call)}`))}\n`);

  let approver: Approver | undefined;
  if (decision === "ask") {
    const allow = scriptedAllow === true;
    process.stdout.write(`   ${mark.pending} ${tone.gold("gate")} ${dim(tone.ash("— " + why))}  ${dim(tone.ash("you:"))} ${allow ? tone.teal("allow") : paint("deny", palette.magenta)}\n`);
    approver = async () => allow;
  } else {
    process.stdout.write(`   ${mark.ok} ${dim(tone.ash("gate — " + why))}\n`);
  }

  const outcome = await executeTool(call, approver);
  if (outcome.ok) {
    const preview = outcome.output.split("\n").slice(0, 4).join("\n      ");
    process.stdout.write(`   ${mark.signed} ${dim(tone.ash("ran:"))}\n      ${tone.bone(preview)}\n\n`);
  } else {
    process.stdout.write(`   ${paint("✗", palette.magenta)} ${tone.cream(outcome.output)}\n\n`);
  }
}

function summarize(call: ToolCall): string {
  const v = call.input.command ?? call.input.url ?? call.input.path ?? "";
  const s = String(v);
  return s.length > 60 ? s.slice(0, 59) + "…" : s;
}
