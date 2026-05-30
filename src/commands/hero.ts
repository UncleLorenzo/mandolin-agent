// hero.ts — what you see when you type `mando` with no arguments.

import { wordmark, gradient, rule, frame, tone, dim, eyebrow, mark, palette, paint } from "../brand.ts";
import { isInitialized } from "../home.ts";
import { signatureDepth } from "../core/signature.ts";

export function hero(): void {
  const out: string[] = [];
  out.push("");
  out.push(`   ${wordmark()} ${dim(tone.ash("agent"))}`);
  out.push(`   ${rule(46)}`);
  out.push("");
  out.push(`   ${eyebrow("Most agents learn tasks · Mandolin learns you")}`);
  out.push("");
  out.push(`   ${tone.cream("An agent that compounds your voice, your standards, your taste —")}`);
  out.push(`   ${tone.cream("and earns every instinct before it acts on it.")}`);
  out.push("");
  out.push(`   ${dim(tone.bone("self-hosted"))}  ${mark.dot}  ${dim(tone.bone("model-agnostic"))}  ${mark.dot}  ${dim(tone.bone("yours"))}`);
  out.push("");

  const cmds = [
    [`mando init`, "establish your Signature"],
    [`mando demo`, "watch it learn, in 20 seconds"],
    [`mando chat`, "put it to work"],
    [`mando skills`, "review what it's proposing"],
  ];
  const box = cmds.map(([c, d]) => `${gradient(c.padEnd(13), [palette.teal, palette.cream])}  ${dim(tone.ash(d))}`);
  out.push(frame(box).split("\n").map((l) => `   ${l}`).join("\n"));
  out.push("");

  if (isInitialized()) {
    out.push(`   ${mark.ok} ${dim(tone.ash(`Signature established · ${signatureDepth()} things known about you`))}`);
  } else {
    out.push(`   ${mark.pending} ${dim(tone.ash("no Signature yet — run "))}${tone.teal("mando init")}`);
  }
  out.push(`   ${dim(tone.ash("v0.1 · gomandolin.com"))}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}
