// gateway.ts (command) — start the always-on gateway; manage pairing.

import { wordmark, rule, frame, tone, dim, bold, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { ensureHome, isInitialized } from "../home.ts";
import { runTelegramGateway, remoteApprover } from "../core/gateway.ts";
import type { GatewayEvent } from "../core/gateway.ts";
import { approve, revokePairing, listPaired } from "../core/pairing.ts";
import { executeTool } from "../core/tools.ts";
import { isGranted } from "../core/provider.ts";

export async function gatewayCmd(args: string[]): Promise<void> {
  ensureHome();
  if (!isInitialized()) {
    process.stdout.write(`\n   ${mark.pending} ${tone.cream("Run ")}${tone.teal("mando init")}${tone.cream(" first.")}\n\n`);
    return;
  }
  if (args[0] === "--demo" || args.length === 0) {
    await gatewayDemo();
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    process.stdout.write(
      `\n   ${mark.pending} ${tone.gold("no TELEGRAM_BOT_TOKEN set")}\n` +
      `   ${dim(tone.ash("create a bot with @BotFather, then:"))} ${tone.teal("export TELEGRAM_BOT_TOKEN=…")}\n` +
      `   ${dim(tone.ash("preview the safety model offline:"))} ${tone.teal("mando gateway --demo")}\n\n`
    );
    return;
  }

  process.stdout.write(
    `\n   ${wordmark()} ${dim(tone.ash("· gateway"))}\n   ${rule(46)}\n` +
    `   ${eyebrow("remote is stricter · only paired chats · gated actions denied unless pre-granted")}\n\n`
  );
  const signal = { aborted: false };
  process.on("SIGINT", () => { signal.aborted = true; process.stdout.write(`\n   ${dim(tone.ash("gateway stopped."))}\n\n`); process.exit(0); });
  await runTelegramGateway(token, render, signal);
}

function render(e: GatewayEvent): void {
  if (e.kind === "listening") process.stdout.write(`   ${mark.ok} ${tone.teal("@" + e.bot)} ${dim(tone.ash("is live · Ctrl-C to stop"))}\n\n`);
  else if (e.kind === "pairing") process.stdout.write(`   ${mark.pending} ${tone.gold("pairing request")} ${dim(tone.ash(`chat ${e.from} · approve: `))}${tone.teal(`mando pair approve ${e.code}`)}\n`);
  else if (e.kind === "message") process.stdout.write(`   ${tone.ash("← " + e.from)}  ${tone.cream(e.text)}\n`);
  else if (e.kind === "denied") process.stdout.write(`   ${paint("✗", palette.magenta)} ${dim(tone.ash(`refused ${e.tool} from ${e.to} (remote, not granted)`))}\n`);
  else if (e.kind === "reply") process.stdout.write(`   ${tone.teal("→ " + e.to)}  ${dim(tone.ash(e.text.slice(0, 70)))}\n`);
  else if (e.kind === "error") process.stdout.write(`   ${paint("!", palette.gold)} ${dim(tone.ash(e.detail))}\n`);
}

// --- pairing management -----------------------------------------------------

export function pairCmd(args: string[]): void {
  ensureHome();
  const [sub, arg] = args;
  if (sub === "approve" && arg) {
    const r = approve(arg);
    process.stdout.write(
      r.ok
        ? `\n   ${mark.signed} ${tone.cream(`approved chat ${r.chatId} — it can now talk to your agent`)}\n\n`
        : `\n   ${paint("✗", palette.magenta)} ${tone.cream(`no pending request matching "${arg}"`)}\n\n`
    );
    return;
  }
  if (sub === "revoke" && arg) {
    const had = revokePairing(arg);
    process.stdout.write(`\n   ${had ? mark.ok + " " + tone.cream(`revoked ${arg}`) : mark.pending + " " + tone.cream(`${arg} wasn't paired`)}\n\n`);
    return;
  }
  // list
  const { approved, pending } = listPaired();
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· pairing"))}`, `   ${rule(46)}`, ""];
  out.push(`   ${eyebrow(`approved · ${approved.length}`)}`);
  if (!approved.length) out.push(`   ${dim(tone.ash("none yet — no one can talk to the gateway"))}`);
  for (const id of approved) out.push(`   ${mark.signed} ${tone.bone(id)}`);
  out.push("", `   ${eyebrow(`pending · ${Object.keys(pending).length}`)}`);
  if (!Object.keys(pending).length) out.push(`   ${dim(tone.ash("no requests waiting"))}`);
  for (const [id, code] of Object.entries(pending)) out.push(`   ${mark.pending} ${tone.gold(code)} ${dim(tone.ash(`chat ${id} · `))}${tone.teal(`mando pair approve ${code}`)}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}

// --- offline demo: prove "remote is stricter" -------------------------------

async function gatewayDemo(): Promise<void> {
  const out: string[] = [
    "",
    `   ${wordmark()} ${dim(tone.ash("· gateway, rehearsed"))}   ${dim(paint("offline — real trust posture", palette.gold))}`,
    `   ${rule(58)}`,
    "",
    `   ${tone.cream("Your agent lives on a server and answers DMs. The danger:")}`,
    `   ${tone.cream("someone messages it ")}${italic_('"delete my files"')}${tone.cream(". Here's what happens.")}`,
    "",
    `   ${eyebrow("a paired chat sends a destructive request")}`,
    "",
  ];
  process.stdout.write(out.join("\n") + "\n");

  // Simulate the remote approver against three escalating tool calls.
  const approver = remoteApprover();
  const trials = [
    { tool: "read_file", input: { path: "README.md" }, label: "read a project file" },
    { tool: "run_shell", input: { command: "rm -rf ~/work" }, label: "delete a directory" },
    { tool: "fetch_url", input: { url: "https://example.com" }, label: "hit the network" },
  ];

  for (const t of trials) {
    const outcome = await executeTool({ tool: t.tool, input: t.input }, approver);
    const ok = outcome.decision === "allow";
    const card = [
      `${tone.ash("DM →")} ${tone.cream(t.label)}  ${dim(tone.ash(`(${t.tool})`))}`,
      ok
        ? `${mark.ok} ${tone.teal("allowed")} ${dim(tone.ash("— reads are safe over chat"))}`
        : `${paint("✗", palette.magenta)} ${paint("refused", palette.magenta)} ${dim(tone.ash("— gated action, no keyboard to approve · logged"))}`,
    ];
    process.stdout.write(frame(card).split("\n").map((l) => `   ${l}`).join("\n") + "\n\n");
  }

  process.stdout.write(
    `   ${tone.cream("A message can read, but it ")}${bold(tone.cream("cannot"))}${tone.cream(" be talked into writing,")}\n` +
    `   ${tone.cream("running, or phoning home — unless ")}${tone.orange("you")}${tone.cream(" pre-granted it at the CLI.")}\n\n` +
    `   ${eyebrow("plus: only chats you've paired can talk to it at all")}\n` +
    `   ${dim(tone.ash("go live:"))} ${gradient("export TELEGRAM_BOT_TOKEN=… && mando gateway", [palette.teal, palette.orange])}\n\n`
  );
}

function italic_(s: string): string {
  return tone.cream(s);
}
