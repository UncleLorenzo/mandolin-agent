// scope.ts (command) — see and shape where the agent may write.

import { resolve } from "node:path";
import { wordmark, rule, frame, tone, dim, bold, mark, eyebrow, palette, paint } from "../brand.ts";
import { ensureHome } from "../home.ts";
import { getConfig, setConfig } from "../core/provider.ts";
import { writeScopes, classifyWrite } from "../core/scope.ts";

export function scopeCmd(args: string[]): void {
  ensureHome();
  const [sub, arg] = args;

  if (sub === "add" && arg) {
    const abs = resolve(arg);
    const cfg = getConfig();
    const extra = new Set(cfg.writeScope ?? []);
    extra.add(abs);
    setConfig({ writeScope: [...extra] });
    process.stdout.write(`\n   ${mark.add} ${tone.cream("write scope now includes ")}${tone.bone(abs)}\n\n`);
    return;
  }
  if (sub === "remove" && arg) {
    const abs = resolve(arg);
    const cfg = getConfig();
    setConfig({ writeScope: (cfg.writeScope ?? []).filter((p) => p !== abs) });
    process.stdout.write(`\n   ${mark.ok} ${tone.cream("removed ")}${tone.bone(abs)}${tone.cream(" from write scope")}\n\n`);
    return;
  }
  if (sub === "check" && arg) {
    const v = classifyWrite(arg);
    const line =
      v.kind === "sensitive" ? `${paint("✗ sensitive", palette.magenta)} ${dim(tone.ash(`(${v.what}) — always asks, grant or not`))}` :
      v.kind === "out-of-scope" ? `${tone.gold("• out of scope")} ${dim(tone.ash("— would ask, even if write is granted"))}` :
      `${mark.ok} ${tone.teal("in scope")} ${dim(tone.ash("— a granted write proceeds here"))}`;
    process.stdout.write(`\n   ${dim(tone.ash(v.abs))}\n   ${line}\n\n`);
    return;
  }

  // default: show current scope
  const roots = writeScopes();
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· write scope"))}`, `   ${rule(50)}`, ""];
  out.push(`   ${eyebrow("a granted write only proceeds inside these roots")}`);
  for (const r of roots) out.push(`   ${mark.signed} ${tone.bone(r)}`);
  out.push("");
  out.push(`   ${tone.cream("Everything else asks first — and these always ask, grant or not:")}`);
  out.push(`   ${dim(tone.ash(".ssh · .env · shell rc · .aws · .gnupg · .git internals · launch agents"))}`);
  out.push("");
  out.push(`   ${dim(tone.ash("add a root:"))}   ${tone.teal("mando scope add <dir>")}`);
  out.push(`   ${dim(tone.ash("test a path:"))} ${tone.teal("mando scope check <path>")}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}
