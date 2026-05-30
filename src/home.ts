// home.ts — where Mandolin keeps what it knows. On your disk. In plain text.
// Sovereignty is a feature: everything here is greppable, git-versionable, yours.

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

/** Root of the agent's memory. Override with MANDOLIN_HOME. */
export function home(): string {
  return process.env.MANDOLIN_HOME || join(homedir(), ".mandolin");
}

export const paths = {
  root: () => home(),
  signature: () => join(home(), "signature.md"),
  config: () => join(home(), "config.json"),
  memory: () => join(home(), "memory"),
  sessions: () => join(home(), "memory", "sessions"),
  facts: () => join(home(), "memory", "facts.md"),
  skills: () => join(home(), "skills"),
  proposed: () => join(home(), "skills", "proposed"),
  trusted: () => join(home(), "skills", "trusted"),
  ledger: () => join(home(), "ledger.md"),
};

/** Make sure the whole tree exists. Idempotent. */
export function ensureHome(): void {
  for (const dir of [
    paths.root(),
    paths.memory(),
    paths.sessions(),
    paths.proposed(),
    paths.trusted(),
  ]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export function isInitialized(): boolean {
  return existsSync(paths.signature());
}
