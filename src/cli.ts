#!/usr/bin/env node
// cli.ts — Mandolin. The agent that learns you.
// A deliberately small command surface. Depth over breadth.

import { hero } from "./commands/hero.ts";
import { init } from "./commands/init.ts";
import { demo } from "./commands/demo.ts";
import { chat } from "./commands/chat.ts";
import { showSignature, showSkills, showStatus, showLedger } from "./commands/inspect.ts";
import { promoteCmd } from "./commands/promote.ts";
import { modelCmd } from "./commands/model.ts";
import { wordmark, rule, tone, dim, mark, eyebrow, gradient, palette } from "./brand.ts";
import { readSignature } from "./core/signature.ts";
import { reflect } from "./core/reflect.ts";
import { listSessions } from "./core/memory.ts";

const VERSION = "0.1.0";

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case undefined:
    hero();
    break;
  case "init":
    init();
    break;
  case "demo":
    demo();
    break;
  case "chat":
  case "run":
    await chat(rest);
    break;
  case "signature":
  case "sig":
    showSignature();
    break;
  case "skills":
  case "instincts":
    showSkills();
    break;
  case "promote":
    promoteCmd(rest[0]);
    break;
  case "reflect":
    await reflectLatest();
    break;
  case "model":
    modelCmd(rest);
    break;
  case "status":
  case "doctor":
    showStatus();
    break;
  case "ledger":
    showLedger();
    break;
  case "version":
  case "--version":
  case "-v":
    process.stdout.write(`mando ${VERSION}\n`);
    break;
  case "help":
  case "--help":
  case "-h":
    help();
    break;
  default:
    process.stdout.write(`\n   ${tone.cream(`Unknown command: ${cmd}`)}\n`);
    help();
}

async function reflectLatest(): Promise<void> {
  const latest = listSessions()[0];
  if (!latest) {
    process.stdout.write(`\n   ${mark.pending} ${tone.cream("No sessions yet. Try ")}${tone.teal("mando demo")}${tone.cream(".")}\n\n`);
    return;
  }
  const id = latest.replace(/\.md$/, "");
  const r = await reflect(id, readSignature());
  process.stdout.write(
    `\n   ${mark.ok} ${tone.cream(`Reflected on ${id} (${r.mode}) — `)}` +
    `${tone.bone(String(r.deltas.length))}${dim(tone.ash(" signature update(s)"))}` +
    (r.proposed ? `, ${tone.gold("1 proposed instinct")}` : "") + "\n\n"
  );
}

function help(): void {
  const rows: [string, string][] = [
    ["init", "establish your Signature + local home"],
    ["demo", "watch the loop turn — offline, 20 seconds"],
    ["chat [msg]", "put the agent to work (needs a model key)"],
    ["signature", "read the compounding model of you"],
    ["skills", "trusted instincts + what's proposed"],
    ["promote <name>", "sign off — make a proposed instinct trusted"],
    ["reflect", "distill the latest session by hand"],
    ["model [name]", "swap the model / provider"],
    ["status", "where things stand"],
    ["ledger", "the audit trail of what you trusted"],
  ];
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("agent · v" + VERSION))}`, `   ${rule(46)}`, ""];
  out.push(`   ${eyebrow("Most agents learn tasks · Mandolin learns you")}`, "");
  for (const [c, d] of rows) {
    out.push(`   ${gradient(("mando " + c).padEnd(22), [palette.teal, palette.cream])} ${dim(tone.ash(d))}`);
  }
  out.push("", `   ${dim(tone.ash("self-hosted · model-agnostic · yours · gomandolin.com"))}`, "");
  process.stdout.write(out.join("\n") + "\n");
}
