// demo.ts — the 20-second showcase. Fully offline, fully real: it writes actual
// files. This is the loop you'd otherwise have to watch happen over days,
// compressed into one rehearsal.

import { wordmark, rule, frame, tone, dim, bold, eyebrow, mark, palette, paint, gradient } from "../brand.ts";
import { ensureHome, isInitialized } from "../home.ts";
import { scaffoldSignature } from "../core/signature.ts";
import { newSessionId, openSession, record } from "../core/memory.ts";
import { reflectFromInterview } from "../core/reflect.ts";
import type { Interview } from "../core/reflect.ts";

const SCRIPT: { q: string; a: string; field: keyof Interview }[] = [
  { q: "How should I sound when I write as you?", field: "voice",
    a: "Discreet and elite. Lowercase confidence. Suggest, never explain. Never hype, never clickbait." },
  { q: "What does 'good' have to clear before it ships?", field: "standards",
    a: "If it could've come from anyone, it's not done. Taste over volume. Mystery over disclosure." },
  { q: "Who are you building for?", field: "audience",
    a: "Elite AI builders drowned out by influencer noise, who have nowhere worthy to belong." },
];

export function demo(): void {
  ensureHome();
  if (!isInitialized()) scaffoldSignature();

  const out: string[] = [];
  out.push("");
  out.push(`   ${wordmark()} ${dim(tone.ash("· first rehearsal"))}   ${dim(paint("offline — no model key needed", palette.gold))}`);
  out.push(`   ${rule(52)}`);
  out.push("");

  const id = newSessionId();
  openSession(id, "First rehearsal");
  const answers: Interview = {};

  for (const step of SCRIPT) {
    out.push(`   ${tone.teal("mandolin")}  ${tone.cream(step.q)}`);
    out.push(`   ${tone.ash("you")}       ${dim(tone.bone(step.a))}`);
    out.push("");
    record(id, { role: "mandolin", text: step.q });
    record(id, { role: "you", text: step.a });
    answers[step.field] = step.a;
  }

  out.push(`   ${eyebrow("reflecting — distilling this into who you are")}`);
  out.push("");

  const r = reflectFromInterview(id, answers);

  // The Signature diff — the compounding made visible.
  const diff: string[] = [];
  diff.push(bold(tone.cream("Signature  ")) + dim(tone.ash("~/.mandolin/signature.md")));
  diff.push("");
  for (const d of r.deltas) {
    diff.push(`${dim(tone.ash(d.section.padEnd(10)))} ${mark.add} ${tone.bone(trim(d.line, 48))}`);
  }
  out.push(frame(diff).split("\n").map((l) => `   ${l}`).join("\n"));
  out.push("");

  // The proposed skill — drafted, signed with a digest, but NOT trusted.
  if (r.proposed) {
    const card: string[] = [];
    card.push(`${mark.pending} ${bold(tone.gold("PROPOSED"))}  ${dim(tone.ash("awaiting your promotion"))}`);
    card.push("");
    card.push(`${tone.cream(r.proposed.name)}`);
    card.push(dim(tone.ash("a reusable instinct, distilled from this session")));
    card.push(dim(tone.ash(`skills/proposed/${r.proposed.slug}/SKILL.md`)));
    out.push(frame(card).split("\n").map((l) => `   ${l}`).join("\n"));
    out.push("");
  }

  out.push(`   ${tone.cream("That's the loop. It learned you, and proposed an instinct —")}`);
  out.push(`   ${tone.cream("but nothing is trusted until ")}${tone.orange("you")}${tone.cream(" sign off:")}`);
  out.push("");
  out.push(`   ${gradient("mando promote " + (r.proposed?.slug ?? ""), [palette.teal, palette.orange])}   ${dim(tone.ash("make it a trusted instinct"))}`);
  out.push(`   ${tone.teal("mando signature")}${" ".repeat(Math.max(1, 14 - 15 + (r.proposed?.slug.length ?? 0)))}  ${dim(tone.ash("read what it now knows about you"))}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}

function trim(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
