// init.ts — establish the Signature and the local home. No cloud, no account.
// On a fresh, interactive run it offers a quick guided interview so the agent
// sounds like you from the very first session.

import { wordmark, rule, frame, tone, dim, mark, eyebrow } from "../brand.ts";
import { ensureHome, isInitialized, paths } from "../home.ts";
import { scaffoldSignature } from "../core/signature.ts";
import { ensureIdentity, myFingerprint } from "../core/identity.ts";
import { shouldOnboard, onboard, onboardRecap } from "./onboard.ts";

export async function init(args: string[] = []): Promise<void> {
  ensureHome();
  const already = isInitialized();
  if (!already) scaffoldSignature();
  ensureIdentity(); // mint the Ed25519 signing key on first run

  process.stdout.write(`\n   ${wordmark()} ${dim(tone.ash("· established"))}\n   ${rule(46)}\n`);

  // First-run interview — only on a fresh, interactive init.
  let recap: string[] = [];
  if (!already && shouldOnboard(args)) {
    const kept = await onboard();
    recap = onboardRecap(kept);
  }

  const out: string[] = [];
  out.push("");
  out.push(`   ${already ? mark.ok + " " + dim(tone.ash("already initialized")) : mark.add + " " + tone.cream("Signature created")}`);
  out.push("");

  const tree = [
    `${tone.cream("~/.mandolin/")}              ${dim(tone.ash("everything Mandolin knows — yours, on disk"))}`,
    `${tone.bone("├─ signature.md")}          ${dim(tone.ash("the compounding model of you"))}`,
    `${tone.bone("├─ memory/")}               ${dim(tone.ash("session logs + distilled facts, plain text"))}`,
    `${tone.bone("├─ skills/proposed/")}      ${dim(tone.ash("instincts it's drafted, awaiting your sign-off"))}`,
    `${tone.bone("├─ skills/trusted/")}       ${dim(tone.ash("instincts you've promoted (signed)"))}`,
    `${tone.bone("├─ identity/")}             ${dim(tone.ash("your Ed25519 signing key — private, owner-only"))}`,
    `${tone.bone("└─ ledger.md")}             ${dim(tone.ash("the audit trail of what you trusted, and when"))}`,
  ];
  out.push(frame(tree).split("\n").map((l) => `   ${l}`).join("\n"));
  out.push("");
  out.push(`   ${mark.signed} ${dim(tone.ash("signing identity "))}${tone.teal(myFingerprint())}`);
  if (recap.length) {
    out.push("");
    out.push(...recap);
  }
  out.push("");
  out.push(`   ${eyebrow("It's all greppable. Commit it to git. (Except the private key.)")}`);
  out.push("");
  out.push(`   ${dim(tone.ash("next:"))}  ${tone.teal("mando demo")}   ${dim(tone.ash("watch the loop turn"))}`);
  out.push(`          ${tone.teal("mando chat")}   ${dim(tone.ash("put it to work (set ANTHROPIC_API_KEY first)"))}`);
  if (!already && !recap.length) {
    out.push(`          ${tone.teal("mando init")}   ${dim(tone.ash("re-run anytime to seed your Signature by interview"))}`);
  }
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}
