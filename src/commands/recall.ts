// recall.ts (command) — ask your memory a question, get ranked answers.
//
// The demo makes the point grep can't: a query that shares NO words with the
// stored memory still surfaces the right passage, because recall ranks by
// meaning (synonym-bridged BM25 offline, embeddings online), not substring.

import { wordmark, rule, frame, tone, dim, bold, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { ensureHome, isInitialized } from "../home.ts";
import { scaffoldSignature } from "../core/signature.ts";
import { newSessionId, openSession, record } from "../core/memory.ts";
import { recall, rankedSearch, semanticAvailable } from "../core/recall.ts";
import type { Hit } from "../core/recall.ts";

export async function recallCmd(args: string[]): Promise<void> {
  ensureHome();
  if (!isInitialized()) scaffoldSignature();

  if (args[0] === "--demo" || args.length === 0) {
    recallDemo();
    return;
  }

  const query = args.join(" ");
  const { hits, mode } = await recall(query, 6);
  printResults(query, hits, mode);
}

function printResults(query: string, hits: Hit[], mode: "ranked" | "semantic"): void {
  const modeLabel =
    mode === "semantic"
      ? tone.teal("semantic") + dim(tone.ash(" · embeddings"))
      : tone.gold("ranked") + dim(tone.ash(" · BM25, offline"));
  const out: string[] = [
    "",
    `   ${wordmark()} ${dim(tone.ash("· recall"))}   ${modeLabel}`,
    `   ${rule(52)}`,
    "",
    `   ${tone.ash("?")}  ${tone.cream(query)}`,
    "",
  ];
  if (!hits.length) {
    out.push(`   ${dim(tone.ash("nothing in memory matches yet — give it some sessions first"))}`, "");
    process.stdout.write(out.join("\n") + "\n");
    return;
  }
  hits.forEach((h, i) => {
    const bar = scoreBar(h.score, hits[0].score);
    out.push(`   ${tone.teal(String(i + 1))} ${bar}  ${dim(tone.ash(h.source))}`);
    out.push(`     ${tone.bone(h.text)}`);
  });
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}

function scoreBar(score: number, max: number): string {
  const n = Math.max(1, Math.round((score / (max || 1)) * 8));
  return gradient("█".repeat(n).padEnd(8, " "), [palette.teal, palette.orange]);
}

// ---- offline demo: the grep-killer ----------------------------------------

const MEMORY_SEED: { role: "you" | "mandolin"; text: string }[] = [
  { role: "you", text: "When we ship, never use exclamation points or hype words. Lowercase, confident, discreet." },
  { role: "you", text: "Our customers are elite AI builders who hate influencer clickbait." },
  { role: "you", text: "We integrate Stripe for subscriptions; invoices go out on the 1st." },
  { role: "mandolin", text: "Noted — I'll keep the billing cadence monthly and the tone understated." },
  { role: "you", text: "The login flow was crashing on Safari last week; we patched the OAuth redirect." },
];

function recallDemo(): void {
  const id = newSessionId();
  openSession(id, "Recall demo seed");
  for (const t of MEMORY_SEED) record(id, t);

  const out: string[] = [
    "",
    `   ${wordmark()} ${dim(tone.ash("· recall, rehearsed"))}   ${dim(paint("offline — ranked, no key", palette.gold))}`,
    `   ${rule(58)}`,
    "",
    `   ${tone.cream("Five things were said in past sessions. Now we ask questions")}`,
    `   ${tone.cream("whose answers share ")}${italic_("no words")}${tone.cream(" with what was stored.")}`,
    `   ${dim(tone.ash("grep returns nothing here. recall ranks by meaning.")) }`,
    "",
  ];
  process.stdout.write(out.join("\n") + "\n");

  demoQuery("how do we handle payments?", "'payment' was never said — bridged to Stripe/billing");
  demoQuery("any recent defects?", "'defect' was never said — bridged to the Safari crash");
  demoQuery("who are our users?", "'users' was never said — bridged to customers");

  process.stdout.write(
    `   ${eyebrow(semanticAvailable() ? "an embeddings key is set — live recall will use semantic vectors" : "set OPENAI_API_KEY and recall upgrades to true semantic vectors")}\n` +
    `   ${tone.cream("Ask your own memory:")} ${gradient('mando recall "…"', [palette.teal, palette.orange])}\n\n`
  );
}

function demoQuery(query: string, note: string): void {
  const hits = rankedSearch(query, undefined, 1);
  const card: string[] = [];
  card.push(`${tone.ash("?")}  ${tone.cream(query)}`);
  if (hits.length) {
    card.push(`${mark.ok} ${tone.bone(hits[0].text)}`);
    card.push(`${dim(tone.ash(hits[0].source + "  " + note))}`);
  } else {
    card.push(`${paint("∅ no match", palette.magenta)}`);
  }
  process.stdout.write(frame(card).split("\n").map((l) => `   ${l}`).join("\n") + "\n\n");
}

function italic_(s: string): string {
  return tone.cream(s);
}
