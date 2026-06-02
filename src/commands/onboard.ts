// onboard.ts — the first-run interview that makes the agent yours in 60 seconds.
//
// An empty agent is generic. The fastest path from "installed" to "this already
// sounds like me" is to ask four good questions on first run and seed the
// Signature from the answers. Every question is optional (Enter skips), it only
// runs on a fresh, interactive init, and it never blocks a script (non-TTY skips
// automatically). Nothing here leaves your machine — it's written to
// ~/.mandolin/signature.md, which is yours.

import { createInterface } from "node:readline";
import { tone, dim, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { learn } from "../core/signature.ts";
import type { SignatureSection } from "../core/signature.ts";

type Q = { section: SignatureSection; ask: string; hint: string };

const QUESTIONS: Q[] = [
  { section: "Voice", ask: "How should I sound when I write as you?", hint: "tone, cadence, words you'd never use" },
  { section: "Standards", ask: "What makes something good enough to ship?", hint: "the bar a thing has to clear" },
  { section: "Audience", ask: "Who are you building for?", hint: "and who you're emphatically not" },
  { section: "Context", ask: "What are you working on right now?", hint: "stack, project, brand, constraints" },
];

/** Should we run the guided interview? Only on a fresh, interactive run. */
export function shouldOnboard(args: string[]): boolean {
  if (args.includes("--quick") || args.includes("-q")) return false;
  if (process.env.MANDOLIN_NO_ONBOARD) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Run the interview, seeding the Signature. Returns how many answers were kept. */
export async function onboard(): Promise<number> {
  const out: string[] = [];
  out.push("");
  out.push(`   ${eyebrow("let's make this yours · four quick questions, skip any with Enter")}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Let Ctrl-C out of onboarding without killing the whole init.
  let bailed = false;
  rl.on("SIGINT", () => { bailed = true; rl.close(); });

  let kept = 0;
  try {
    for (const q of QUESTIONS) {
      if (bailed) break;
      process.stdout.write(`   ${tone.teal("mandolin")}  ${tone.cream(q.ask)}\n`);
      process.stdout.write(`   ${dim(tone.ash("           " + q.hint))}\n`);
      const answer = (await question(rl, `   ${tone.ash("you")}       `)).trim();
      process.stdout.write("\n");
      if (answer) {
        learn(q.section, answer, "onboarding");
        kept++;
      }
    }
  } finally {
    rl.close();
  }
  return kept;
}

/** Render the "here's what I already know about you" recap after onboarding. */
export function onboardRecap(kept: number): string[] {
  const out: string[] = [];
  if (kept === 0) {
    out.push(`   ${mark.pending} ${dim(tone.ash("skipped — the Signature will fill in as you work"))}`);
    return out;
  }
  out.push(`   ${mark.add} ${tone.cream(`Signature seeded with ${kept} thing${kept === 1 ? "" : "s"} about you`)}`);
  out.push(`   ${dim(tone.ash("read it any time: "))}${tone.teal("mando signature")}`);
  out.push(`   ${dim(tone.ash("it sharpens automatically after every session"))}`);
  return out;
}

function question(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((res) => rl.question(prompt, res));
}
