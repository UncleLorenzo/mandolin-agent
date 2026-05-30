// init.ts — establish the Signature and the local home. No cloud, no account.

import { wordmark, rule, frame, tone, dim, mark, eyebrow } from "../brand.ts";
import { ensureHome, isInitialized, paths } from "../home.ts";
import { scaffoldSignature } from "../core/signature.ts";

export function init(): void {
  ensureHome();
  const already = isInitialized();
  if (!already) scaffoldSignature();

  const out: string[] = [];
  out.push("");
  out.push(`   ${wordmark()} ${dim(tone.ash("· established"))}`);
  out.push(`   ${rule(46)}`);
  out.push("");
  out.push(`   ${already ? mark.ok + " " + dim(tone.ash("already initialized")) : mark.add + " " + tone.cream("Signature created")}`);
  out.push("");

  const tree = [
    `${tone.cream("~/.mandolin/")}              ${dim(tone.ash("everything Mandolin knows — yours, on disk"))}`,
    `${tone.bone("├─ signature.md")}          ${dim(tone.ash("the compounding model of you"))}`,
    `${tone.bone("├─ memory/")}               ${dim(tone.ash("session logs + distilled facts, plain text"))}`,
    `${tone.bone("├─ skills/proposed/")}      ${dim(tone.ash("instincts it's drafted, awaiting your sign-off"))}`,
    `${tone.bone("├─ skills/trusted/")}       ${dim(tone.ash("instincts you've promoted"))}`,
    `${tone.bone("└─ ledger.md")}             ${dim(tone.ash("the audit trail of what you trusted, and when"))}`,
  ];
  out.push(frame(tree).split("\n").map((l) => `   ${l}`).join("\n"));
  out.push("");
  out.push(`   ${eyebrow("It's all greppable. Commit it to git. Take it anywhere.")}`);
  out.push("");
  out.push(`   ${dim(tone.ash("next:"))}  ${tone.teal("mando demo")}   ${dim(tone.ash("watch the loop turn"))}`);
  out.push(`          ${tone.teal("mando chat")}   ${dim(tone.ash("put it to work (set ANTHROPIC_API_KEY first)"))}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}
