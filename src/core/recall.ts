// recall.ts — memory that's smarter than grep.
//
// Hermes' recall is keyword FTS5 — its own reviewers say "the agent should be
// smarter than grep." Mandolin has two tiers, and is honest about which is which:
//
//   • RANKED (offline, zero deps): BM25 relevance over stemmed terms, with a
//     small synonym bridge so "release" finds "deploy/ship/launch". This is
//     genuine ranked retrieval — not substring matching — and needs no key.
//   • SEMANTIC (with an embeddings key): true vector search over cached
//     embeddings stored as plain JSON on disk (inspectable, like everything else).
//
// Both return ranked passages with provenance. Nothing leaves your machine in
// ranked mode; in semantic mode only the text you embed does.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { paths } from "../home.ts";
import { listSessions, readSession, readFacts } from "./memory.ts";
import { readSignature } from "./signature.ts";

export type Passage = { id: string; source: string; text: string };
export type Hit = Passage & { score: number; mode: "ranked" | "semantic" };

// ---- corpus -----------------------------------------------------------------

/** Break all memory into retrievable passages with provenance. */
export function corpus(): Passage[] {
  const out: Passage[] = [];
  let n = 0;
  const push = (source: string, text: string) => {
    const t = text.trim();
    if (t.length >= 8) out.push({ id: `${source}#${n++}`, source, text: t });
  };

  // Signature lines (skip headers/placeholders)
  for (const line of readSignature().split("\n")) {
    const t = line.trim();
    if (t.startsWith("- ") && !/^- \(.*\)$/.test(t)) push("signature", t.slice(2));
  }
  // Facts
  for (const line of readFacts().split("\n")) {
    const t = line.trim();
    if (t.startsWith("- ")) push("facts", t.slice(2).replace(/_↳.*_$/, "").trim());
  }
  // Session turns
  for (const file of listSessions()) {
    const id = file.replace(/\.md$/, "");
    for (const line of readSession(id).split("\n")) {
      const m = line.match(/^\*\*(you|mandolin)\*\*:\s*(.+)$/);
      if (m) push(`session ${id}`, m[2]);
    }
  }
  return out;
}

// ---- tokenization + light stemming -----------------------------------------

const STOP = new Set(
  "a an the of to in on at for and or but is are was were be been being it its this that these those i you we they he she my your our their with as by from how what when where why do does did so if then than too very can will just".split(" ")
);

// Tiny synonym bridge — maps domain words to a shared concept token so ranked
// mode crosses vocabulary gaps the way semantic search would. Deliberately small
// and readable; extend freely.
const SYNONYMS: Record<string, string> = {
  payment: "billing", pay: "billing", invoice: "billing", invoicing: "billing",
  stripe: "billing", checkout: "billing", subscription: "billing", charge: "billing",
  auth: "authentication", login: "authentication", signin: "authentication",
  signup: "authentication", oauth: "authentication", token: "authentication",
  bug: "defect", error: "defect", crash: "defect", broken: "defect", fail: "defect",
  ship: "release", deploy: "release", launch: "release", publish: "release",
  voice: "tone", style: "tone", cadence: "tone", wording: "tone",
  client: "customer", user: "customer", member: "customer", audience: "customer",
  fast: "performance", slow: "performance", latency: "performance", speed: "performance",
};

function stem(w: string): string {
  // crude but effective Porter-lite: strip common suffixes
  return w
    .replace(/(ization|izations)$/, "ize")
    .replace(/(ing|edly|edly)$/, "")
    .replace(/(ed|ly|es|s)$/, "")
    .replace(/(ies)$/, "y");
}

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (const w of raw) {
    if (STOP.has(w) || w.length < 2) continue;
    const s = stem(w);
    // Bridge on the raw word AND its stem, so "payments"→"payment"→"billing"
    // and "crashing"→"crash"→"defect" both cross the vocabulary gap. Stem the
    // synonym value too, so a query's bridged "billing" matches a document's
    // literal "billing" (both land on the same stem).
    const syn = SYNONYMS[w] ?? SYNONYMS[s];
    if (syn) out.push(stem(syn));
    out.push(s);
  }
  return out;
}

// ---- BM25 ranked recall (offline) ------------------------------------------

const K1 = 1.5;
const B = 0.75;

export function rankedSearch(query: string, docs = corpus(), limit = 6): Hit[] {
  if (!docs.length) return [];
  const docTokens = docs.map((d) => tokenize(d.text));
  const avgLen = docTokens.reduce((s, t) => s + t.length, 0) / docTokens.length || 1;

  // document frequency per term
  const df = new Map<string, number>();
  docTokens.forEach((toks) => {
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  });
  const N = docs.length;
  const qTerms = [...new Set(tokenize(query))];

  const scored = docs.map((d, i) => {
    const toks = docTokens[i];
    const len = toks.length || 1;
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const qt of qTerms) {
      const f = tf.get(qt);
      if (!f) continue;
      const n = df.get(qt) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * len) / avgLen)));
    }
    return { ...d, score, mode: "ranked" as const };
  });

  return scored.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---- semantic recall (embeddings, cached on disk) --------------------------

type EmbedCache = { model: string; vectors: Record<string, number[]> };

function cachePath(): string {
  return join(paths.memory(), "embeddings.json");
}

function loadCache(model: string): EmbedCache {
  const p = cachePath();
  if (existsSync(p)) {
    try {
      const c = JSON.parse(readFileSync(p, "utf8")) as EmbedCache;
      if (c.model === model) return c;
    } catch {
      /* rebuild */
    }
  }
  return { model, vectors: {} };
}

function saveCache(c: EmbedCache): void {
  writeFileSync(cachePath(), JSON.stringify(c, null, 2) + "\n", "utf8");
}

function keyFor(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Embed an array of texts via an OpenAI-compatible embeddings endpoint. */
async function embed(texts: string[], key: string, model: string, baseUrl: string): Promise<number[][]> {
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

/** True semantic recall. Requires OPENAI_API_KEY (or a compatible endpoint). */
export async function semanticSearch(query: string, docs = corpus(), limit = 6): Promise<Hit[]> {
  const key = process.env.OPENAI_API_KEY || process.env.MANDOLIN_EMBED_KEY;
  if (!key) throw new Error("no embeddings key (set OPENAI_API_KEY) — use ranked recall instead");
  const model = process.env.MANDOLIN_EMBED_MODEL || "text-embedding-3-small";
  const baseUrl = process.env.MANDOLIN_EMBED_BASEURL || "https://api.openai.com/v1";

  const cache = loadCache(model);
  // Embed any passages we haven't seen before (cached by content hash).
  const missing = docs.filter((d) => !cache.vectors[keyFor(d.text)]);
  for (let i = 0; i < missing.length; i += 64) {
    const batch = missing.slice(i, i + 64);
    const vecs = await embed(batch.map((d) => d.text), key, model, baseUrl);
    batch.forEach((d, j) => (cache.vectors[keyFor(d.text)] = vecs[j]));
  }
  if (missing.length) saveCache(cache);

  const [qVec] = await embed([query], key, model, baseUrl);
  return docs
    .map((d) => ({ ...d, score: cosine(qVec, cache.vectors[keyFor(d.text)]), mode: "semantic" as const }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Is true semantic recall available right now? */
export function semanticAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.MANDOLIN_EMBED_KEY);
}

/** Recall the best passages — semantic if a key is present, ranked otherwise. */
export async function recall(query: string, limit = 6): Promise<{ hits: Hit[]; mode: "ranked" | "semantic" }> {
  const docs = corpus();
  if (semanticAvailable()) {
    try {
      return { hits: await semanticSearch(query, docs, limit), mode: "semantic" };
    } catch {
      /* fall back to ranked */
    }
  }
  return { hits: rankedSearch(query, docs, limit), mode: "ranked" };
}
