// inspect.ts — read what Mandolin knows. Everything here is also a plain file.

import { wordmark, rule, tone, dim, bold, mark, eyebrow, palette, paint } from "../brand.ts";
import { isInitialized, paths } from "../home.ts";
import { readSignature, signatureDepth } from "../core/signature.ts";
import { list, verify } from "../core/skills.ts";
import { readFacts } from "../core/memory.ts";
import { getConfig, isLive } from "../core/provider.ts";
import { footprint } from "../core/sovereignty.ts";
import { existsSync, readFileSync } from "node:fs";

function notInit(): boolean {
  if (!isInitialized()) {
    process.stdout.write(`\n   ${mark.pending} ${tone.cream("No Signature yet. Run ")}${tone.teal("mando init")}${tone.cream(".")}\n\n`);
    return true;
  }
  return false;
}

export function showSignature(): void {
  if (notInit()) return;
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· signature"))}`, `   ${rule(46)}`, ""];
  for (const line of readSignature().split("\n")) {
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) out.push(`   ${bold(tone.teal(line.slice(3)))}`);
    else if (line.startsWith(">")) out.push(`   ${dim(tone.ash(line.replace(/^>\s?/, "")))}`);
    else if (line.startsWith("_") && line.endsWith("_")) out.push(`   ${dim(tone.ash(line.replace(/_/g, "")))}`);
    else if (line.trim().startsWith("- ")) out.push(`   ${mark.dot} ${tone.bone(line.trim().slice(2))}`);
    else if (line.trim()) out.push(`   ${tone.cream(line)}`);
    else out.push("");
  }
  out.push(`   ${dim(tone.ash(`${signatureDepth()} things known · ${paths.signature()}`))}`, "");
  process.stdout.write(out.join("\n") + "\n");
}

export function showSkills(): void {
  if (notInit()) return;
  const trusted = list("trusted");
  const proposed = list("proposed");
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· instincts"))}`, `   ${rule(46)}`, ""];

  out.push(`   ${eyebrow(`Trusted · ${trusted.length}`)}`);
  if (!trusted.length) out.push(`   ${dim(tone.ash("none yet — promote a proposed instinct to begin"))}`);
  for (const s of trusted) {
    const intact = verify(s) ? mark.signed : paint("!", palette.magenta);
    out.push(`   ${intact} ${tone.cream(s.name)}  ${dim(tone.ash(`digest ${s.digest}`))}`);
    out.push(`     ${dim(tone.ash(s.description))}`);
  }
  out.push("");
  out.push(`   ${eyebrow(`Proposed · ${proposed.length} · awaiting your sign-off`)}`);
  if (!proposed.length) out.push(`   ${dim(tone.ash("nothing pending"))}`);
  for (const s of proposed) {
    const tag =
      s.scan === "dangerous" ? paint(" ⚠ DANGEROUS", palette.magenta) :
      s.scan === "caution" ? tone.gold(" · caution") :
      s.scan === "clean" ? tone.teal(" · clean") : "";
    out.push(`   ${mark.pending} ${tone.gold(s.name)}${tag}  ${dim(tone.ash(`from ${s.origin}`))}`);
    out.push(`     ${dim(tone.ash(s.description))}`);
    out.push(`     ${dim(tone.ash("promote with "))}${tone.teal(`mando promote ${slugOf(s.name)}`)}`);
  }
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}

export function showStatus(): void {
  const cfg = getConfig();
  const live = isLive();
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· status"))}`, `   ${rule(46)}`, ""];
  out.push(`   ${dim(tone.ash("home".padEnd(12)))}${tone.bone(paths.root())}`);
  out.push(`   ${dim(tone.ash("provider".padEnd(12)))}${tone.bone(cfg.provider)} ${dim(tone.ash("·"))} ${tone.bone(cfg.model)}`);
  out.push(`   ${dim(tone.ash("model".padEnd(12)))}${live ? mark.ok + " " + tone.teal("live") : mark.pending + " " + tone.gold("offline — set ANTHROPIC_API_KEY")}`);
  if (isInitialized()) {
    const fp = footprint();
    out.push(`   ${dim(tone.ash("signature".padEnd(12)))}${tone.bone(String(signatureDepth()))} ${dim(tone.ash("things known"))}`);
    out.push(`   ${dim(tone.ash("instincts".padEnd(12)))}${tone.bone(String(list("trusted").length))} ${dim(tone.ash("trusted, "))}${tone.bone(String(list("proposed").length))} ${dim(tone.ash("proposed"))}`);
    out.push(`   ${dim(tone.ash("memory".padEnd(12)))}${tone.bone(String(fp.sessions))} ${dim(tone.ash("session(s) · "))}${tone.bone(fp.bytes < 1024 ? `${fp.bytes} B` : `${(fp.bytes / 1024).toFixed(1)} KB`)} ${dim(tone.ash("on disk"))}`);
  } else {
    out.push(`   ${dim(tone.ash("signature".padEnd(12)))}${tone.gold("not established — run mando init")}`);
  }
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}

export function showLedger(): void {
  const p = paths.ledger();
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· ledger"))}`, `   ${rule(46)}`, ""];
  if (!existsSync(p)) {
    out.push(`   ${dim(tone.ash("Empty. Nothing has been trusted yet."))}`);
  } else {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      if (line.startsWith("# ")) continue;
      if (line.startsWith("- ")) out.push(`   ${mark.signed} ${tone.bone(line.slice(2).replace(/\*\*/g, ""))}`);
      else if (line.trim()) out.push(`   ${dim(tone.ash(line.replace(/_/g, "")))}`);
    }
  }
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}

function slugOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
