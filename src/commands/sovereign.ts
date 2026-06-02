// sovereign.ts — export and forget. The two directions of "your memory is yours."

import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { wordmark, rule, frame, tone, dim, bold, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { ensureHome, isInitialized } from "../home.ts";
import { writeExport, findForgettable, forget, footprint } from "../core/sovereignty.ts";

function notInit(): boolean {
  if (!isInitialized()) {
    process.stdout.write(`\n   ${mark.pending} ${tone.cream("No Signature yet. Run ")}${tone.teal("mando init")}${tone.cream(".")}\n\n`);
    return true;
  }
  return false;
}

export function exportCmd(args: string[]): void {
  if (notInit()) return;
  const target = resolve(args[0] || "mandolin-export.md");
  const { path, bytes } = writeExport(target);
  const fp = footprint();
  const card = [
    `${mark.ok} ${bold(tone.cream("exported"))}  ${dim(tone.ash(`${kb(bytes)}`))}`,
    "",
    `${tone.bone(path)}`,
    "",
    `${dim(tone.ash(`${fp.sessions} session(s) · ${fp.trusted} trusted instinct(s) · signature · facts · ledger`))}`,
    `${dim(tone.ash("one readable file. carry it, diff it, restore it anywhere."))}`,
  ];
  process.stdout.write("\n" + frame(card).split("\n").map((l) => `   ${l}`).join("\n") + "\n\n");
}

export async function forgetCmd(args: string[]): Promise<void> {
  if (notInit()) return;
  const force = args.includes("--yes") || args.includes("-y");
  const query = args.filter((a) => !a.startsWith("-")).join(" ").trim();

  if (!query) {
    process.stdout.write(
      `\n   ${tone.cream("Tell me what to forget:")} ${tone.teal('mando forget "<term or phrase>"')}\n` +
      `   ${dim(tone.ash("every line containing it is previewed, then erased on your confirmation."))}\n\n`
    );
    return;
  }

  const hits = findForgettable(query);
  if (!hits.length) {
    process.stdout.write(`\n   ${mark.ok} ${tone.cream(`Nothing in memory mentions "${query}". Nothing to forget.`)}\n\n`);
    return;
  }

  // Preview — show exactly what will be erased.
  const out: string[] = [
    "",
    `   ${wordmark()} ${dim(tone.ash("· forget"))}`,
    `   ${rule(50)}`,
    "",
    `   ${tone.cream(`${hits.length} line(s) mention `)}${bold(tone.gold(`"${query}"`))}${tone.cream(" — these will be ")}${paint("permanently erased", palette.magenta)}${tone.cream(":")}`,
    "",
  ];
  for (const h of hits.slice(0, 12)) {
    out.push(`   ${paint("−", palette.magenta)} ${dim(tone.ash(h.relPath + ":" + h.line))}  ${tone.bone(trim(h.text, 56))}`);
  }
  if (hits.length > 12) out.push(`   ${dim(tone.ash(`… and ${hits.length - 12} more`))}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");

  const go = force || (await confirm(`   ${paint("erase", palette.magenta)} ${tone.cream("these and rebuild the index? ")}${dim(tone.ash("[y/N]: "))}`));
  if (!go) {
    process.stdout.write(`   ${dim(tone.ash("left untouched."))}\n\n`);
    return;
  }

  const { removed, files } = forget(query);
  process.stdout.write(
    `   ${mark.ok} ${tone.cream(`erased ${removed} line(s) across ${files} file(s). `)}` +
    `${dim(tone.ash("logged to actions.md · embeddings cache rebuilt next recall."))}\n\n`
  );
}

function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(prompt, (a) => {
    rl.close();
    res(/^y(es)?$/i.test(a.trim()));
  }));
}

function trim(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
