// sovereignty.ts — your memory is yours, including the right to take it and the
// right to erase it.
//
// Most agents are happy to remember forever and have no clean way to forget. The
// dominant open-source agent's own audit flags it has no data-erasure story.
// Mandolin treats both directions as first-class: export the whole self to one
// readable bundle, or forget — really forget — anything, with a preview first
// and a receipt after.

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, appendFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../home.ts";
import { readSignature } from "./signature.ts";
import { readFacts, listSessions, readSession } from "./memory.ts";
import { list } from "./skills.ts";

// ---- export -----------------------------------------------------------------

/** Everything Mandolin knows, as one portable Markdown bundle. */
export function exportBundle(): string {
  const parts: string[] = [];
  parts.push(`# Mandolin — exported self`);
  parts.push(`_A complete, portable snapshot. Plain Markdown — read it, diff it, carry it._\n`);

  parts.push(`\n## Signature\n`);
  parts.push(readSignature() || "_(none)_");

  parts.push(`\n## Facts\n`);
  parts.push(readFacts() || "_(none)_");

  const trusted = list("trusted");
  parts.push(`\n## Trusted instincts (${trusted.length})\n`);
  for (const s of trusted) {
    parts.push(`### ${s.name}`);
    parts.push(`_digest ${s.digest}${s.promoted ? ` · promoted ${s.promoted}` : ""}${s.scan ? ` · scan ${s.scan}` : ""}_\n`);
    parts.push(s.body.trim());
  }

  const ledger = paths.ledger();
  if (existsSync(ledger)) {
    parts.push(`\n## Ledger\n`);
    parts.push(readFileSync(ledger, "utf8").trim());
  }

  const sessions = listSessions();
  parts.push(`\n## Sessions (${sessions.length})\n`);
  for (const file of sessions) {
    const id = file.replace(/\.md$/, "");
    parts.push(`\n### session ${id}\n`);
    parts.push(readSession(id).trim());
  }

  return parts.join("\n") + "\n";
}

export function writeExport(toPath: string): { path: string; bytes: number } {
  const bundle = exportBundle();
  writeFileSync(toPath, bundle, "utf8");
  return { path: toPath, bytes: Buffer.byteLength(bundle) };
}

// ---- forget -----------------------------------------------------------------

export type ForgetHit = { file: string; relPath: string; line: number; text: string };

/** Find everywhere a term appears across memory — the preview before erasure. */
export function findForgettable(query: string): ForgetHit[] {
  const q = query.toLowerCase();
  const hits: ForgetHit[] = [];
  const scan = (absPath: string, relPath: string) => {
    if (!existsSync(absPath)) return;
    const lines = readFileSync(absPath, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(q)) hits.push({ file: absPath, relPath, line: i + 1, text: line.trim() });
    });
  };
  scan(paths.signature(), "signature.md");
  scan(paths.facts(), "memory/facts.md");
  scan(paths.ledger(), "ledger.md");
  for (const file of listSessions()) scan(join(paths.sessions(), file), `memory/sessions/${file}`);
  return hits;
}

/**
 * Erase every line containing the term. Returns how many lines were removed,
 * per file. This rewrites the files in place — the data is gone, not hidden.
 */
export function forget(query: string): { removed: number; files: number } {
  const q = query.toLowerCase();
  const files = new Set<string>();
  let removed = 0;
  const scrub = (absPath: string) => {
    if (!existsSync(absPath)) return;
    const lines = readFileSync(absPath, "utf8").split("\n");
    const kept = lines.filter((line) => {
      if (line.toLowerCase().includes(q)) {
        removed++;
        files.add(absPath);
        return false;
      }
      return true;
    });
    if (files.has(absPath)) writeFileSync(absPath, kept.join("\n"), "utf8");
  };
  scrub(paths.signature());
  scrub(paths.facts());
  scrub(paths.ledger());
  for (const file of listSessions()) scrub(join(paths.sessions(), file));

  // Invalidate the embeddings cache — it may hold vectors for erased text.
  const cache = join(paths.memory(), "embeddings.json");
  if (existsSync(cache)) rmSync(cache, { force: true });

  if (removed) recordErasure(query, removed, files.size);
  return { removed, files: files.size };
}

/** A forget is an action too — it leaves a receipt in the audit log. */
function recordErasure(query: string, lines: number, fileCount: number): void {
  const p = paths.actions();
  if (!existsSync(p)) {
    writeFileSync(p, `# Actions\n_Every action the agent took, or was stopped from taking. Your audit trail._\n\n`, "utf8");
  }
  appendFileSync(p, `- [${new Date().toISOString()}] **forget** · erased ${lines} line(s) across ${fileCount} file(s) matching "${query}"\n`, "utf8");
}

// ---- footprint --------------------------------------------------------------

/** A quick tally of what's on disk — used by `mando status` and export headers. */
export function footprint(): { sessions: number; trusted: number; proposed: number; bytes: number } {
  let bytes = 0;
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else bytes += statSync(full).size;
    }
  };
  walk(paths.root());
  return {
    sessions: listSessions().length,
    trusted: list("trusted").length,
    proposed: list("proposed").length,
    bytes,
  };
}
