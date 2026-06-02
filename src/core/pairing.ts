// pairing.ts — who is allowed to talk to your agent when it lives on a server.
//
// An always-on agent answering DMs is a new attack surface: anyone who finds the
// bot could message it. Pairing is the allowlist. Until you approve a chat id,
// the gateway will not even pass its messages to the agent — it replies with a
// one-time code you approve from the trusted CLI. No open mic, ever.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { paths } from "../home.ts";

type PairingState = {
  approved: string[];               // chat ids allowed to talk
  pending: Record<string, string>;  // chat id -> one-time code
};

function file(): string {
  return join(paths.root(), "pairing.json");
}

function load(): PairingState {
  if (existsSync(file())) {
    try {
      return { approved: [], pending: {}, ...JSON.parse(readFileSync(file(), "utf8")) };
    } catch {
      /* reset on corruption */
    }
  }
  return { approved: [], pending: {} };
}

function save(s: PairingState): void {
  writeFileSync(file(), JSON.stringify(s, null, 2) + "\n", "utf8");
}

export function isApproved(chatId: string): boolean {
  return load().approved.includes(String(chatId));
}

/** First contact from an unknown chat: mint (or reuse) a short pairing code. */
export function requestPairing(chatId: string, codeSeed: string): string {
  const s = load();
  const id = String(chatId);
  if (s.approved.includes(id)) return "already-approved";
  if (!s.pending[id]) {
    // deterministic short code from a caller-supplied seed (no Math.random)
    s.pending[id] = codeSeed.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "PAIR01";
    save(s);
  }
  return s.pending[id];
}

/** Approve by code (what you type at the CLI) or directly by chat id. */
export function approve(codeOrId: string): { ok: boolean; chatId?: string } {
  const s = load();
  const needle = codeOrId.toUpperCase();
  const entry = Object.entries(s.pending).find(([id, code]) => code === needle || id === codeOrId);
  if (!entry) {
    // allow approving a raw chat id that never had a pending code
    if (/^\d+$/.test(codeOrId) && !s.approved.includes(codeOrId)) {
      s.approved.push(codeOrId);
      save(s);
      return { ok: true, chatId: codeOrId };
    }
    return { ok: false };
  }
  const [id] = entry;
  delete s.pending[id];
  if (!s.approved.includes(id)) s.approved.push(id);
  save(s);
  return { ok: true, chatId: id };
}

export function revokePairing(chatId: string): boolean {
  const s = load();
  const id = String(chatId);
  const had = s.approved.includes(id);
  s.approved = s.approved.filter((x) => x !== id);
  delete s.pending[id];
  save(s);
  return had;
}

export function listPaired(): { approved: string[]; pending: Record<string, string> } {
  const s = load();
  return { approved: s.approved, pending: s.pending };
}
