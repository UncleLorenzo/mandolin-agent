// grant.ts — standing capabilities. A grant lets the agent act in a class
// without asking each time. It's a trust decision, so it's logged like one.

import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { wordmark, rule, tone, dim, mark, eyebrow, palette, paint } from "../brand.ts";
import { ensureHome, paths } from "../home.ts";
import { getConfig, setCapability } from "../core/provider.ts";
import type { Capability } from "../core/provider.ts";

const CAPS: Capability[] = ["write", "exec", "network"];
const BLURB: Record<Capability, string> = {
  write: "create and overwrite files without asking each time",
  exec: "run shell commands without asking each time",
  network: "fetch URLs without asking each time",
};

export function grant(cap?: string): void {
  setCap(cap, true);
}
export function revoke(cap?: string): void {
  setCap(cap, false);
}

function setCap(cap: string | undefined, on: boolean): void {
  ensureHome();
  if (!cap) return showCaps(on ? "grant" : "revoke");
  if (!CAPS.includes(cap as Capability)) {
    process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream(`Unknown capability "${cap}". One of: ${CAPS.join(", ")}.`)}\n\n`);
    return;
  }
  setCapability(cap as Capability, on);
  logTrust(cap as Capability, on);
  const verb = on ? tone.teal("granted") : paint("revoked", palette.magenta);
  process.stdout.write(
    `\n   ${on ? mark.signed : mark.dot} ${verb} ${tone.cream(cap)} ${dim(tone.ash("— " + BLURB[cap as Capability]))}\n` +
    `   ${dim(tone.ash(on ? "the agent will no longer ask before " + cap + " actions" : "the agent will ask again before " + cap + " actions"))}\n\n`
  );
}

function showCaps(mode: string): void {
  const caps = getConfig().capabilities ?? {};
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· capabilities"))}`, `   ${rule(46)}`, ""];
  for (const c of CAPS) {
    const on = Boolean(caps[c]);
    const badge = on ? mark.signed + " " + tone.teal("granted ") : mark.pending + " " + tone.gold("asks each time");
    out.push(`   ${badge}  ${tone.cream(c.padEnd(8))} ${dim(tone.ash(BLURB[c]))}`);
  }
  out.push("", `   ${eyebrow("reads inside your project are always free")}`);
  out.push(`   ${dim(tone.ash("even when "))}${tone.cream("write")}${dim(tone.ash(" is granted, writes stay in scope and never touch secrets — "))}${tone.teal("mando scope")}`);
  out.push(`   ${tone.teal(`mando ${mode} <write|exec|network>`)}`, "");
  process.stdout.write(out.join("\n") + "\n");
}

function logTrust(cap: Capability, on: boolean): void {
  const p = paths.actions();
  if (!existsSync(p)) writeFileSync(p, `# Actions\n_Every action the agent took, or was stopped from taking. Your audit trail._\n\n`, "utf8");
  appendFileSync(p, `- [${new Date().toISOString()}] **${on ? "grant" : "revoke"}** · capability · \`${cap}\`\n`, "utf8");
}
