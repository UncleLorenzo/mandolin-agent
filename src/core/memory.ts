// memory.ts — the agent's memory, as plain Markdown on your disk.
//
// No vector database, no opaque embeddings you can't audit. Session logs and
// distilled facts are files you can read, grep, diff, and delete. If you can't
// read what your agent "remembers," you don't own it.

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { paths } from "../home.ts";

export type Turn = { role: "you" | "mandolin"; text: string };

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Short, human-readable session id, e.g. 2026-05-30-9f3a. */
export function newSessionId(): string {
  return `${stamp()}-${randomUUID().slice(0, 4)}`;
}

export function sessionPath(id: string): string {
  return join(paths.sessions(), `${id}.md`);
}

export function openSession(id: string, title = "Rehearsal"): void {
  const p = sessionPath(id);
  if (!existsSync(p)) {
    writeFileSync(p, `# ${title}\n_session ${id} · ${new Date().toISOString()}_\n\n`, "utf8");
  }
}

export function record(id: string, turn: Turn): void {
  const who = turn.role === "you" ? "**you**" : "**mandolin**";
  appendFileSync(sessionPath(id), `${who}: ${turn.text}\n\n`, "utf8");
}

export function readSession(id: string): string {
  const p = sessionPath(id);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

/** Distilled, durable facts — the short list the agent always keeps in view. */
export function recordFact(line: string, provenance?: string): void {
  const p = paths.facts();
  if (!existsSync(p)) writeFileSync(p, `# Facts\n_What Mandolin keeps in view. Curated, not a dumping ground._\n\n`, "utf8");
  const stamped = provenance ? `- ${line}  _↳ ${provenance}_\n` : `- ${line}\n`;
  appendFileSync(p, stamped, "utf8");
}

export function readFacts(): string {
  const p = paths.facts();
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

export function listSessions(): string[] {
  const dir = paths.sessions();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();
}

/** Dead-simple keyword recall over session logs. Inspectable beats clever. */
export function searchMemory(query: string): { id: string; line: string }[] {
  const q = query.toLowerCase();
  const hits: { id: string; line: string }[] = [];
  for (const file of listSessions()) {
    const id = file.replace(/\.md$/, "");
    for (const line of readSession(id).split("\n")) {
      if (line.toLowerCase().includes(q)) hits.push({ id, line: line.trim() });
    }
  }
  return hits;
}
