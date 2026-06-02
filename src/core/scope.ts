// scope.ts — where the agent is allowed to write.
//
// A capability grant shouldn't be a blank cheque. Granting `write` so the agent
// can edit your project must NOT also let it drop a backdoor in ~/.ssh or rewrite
// your ~/.zshrc. So writes are confined two ways:
//
//   • SCOPE: a write only auto-proceeds inside your write roots (your project by
//     default). Outside them, even a standing grant falls back to asking.
//   • SENSITIVE: a short deny-list of high-value targets (.ssh, .env, shell rc,
//     cloud creds, .git internals…) ALWAYS requires a fresh yes — no standing
//     grant can touch them silently, anywhere.
//
// This is the per-path scoping the dominant agent doesn't have: there, write
// access is all-or-nothing over your whole home.

import { resolve, basename } from "node:path";
import { homedir } from "node:os";
import { getConfig } from "./provider.ts";

/** Roots a granted write may proceed in without asking. Default: the project. */
export function writeScopes(): string[] {
  const extra = getConfig().writeScope ?? [];
  return [process.cwd(), ...extra.map((p) => resolve(expandHome(p)))];
}

function expandHome(p: string): string {
  return p.startsWith("~") ? p.replace(/^~/, homedir()) : p;
}

function withinAny(abs: string, roots: string[]): boolean {
  return roots.some((r) => abs === r || abs.startsWith(r + "/"));
}

// High-value targets a poisoned skill or injected instruction would aim for.
// Matched against the absolute path; a hit means "always ask," grant or not.
const SENSITIVE: { re: RegExp; what: string }[] = [
  { re: /\/\.ssh(\/|$)/, what: "SSH keys/config" },
  { re: /(^|\/)id_rsa|\/authorized_keys$/, what: "SSH key material" },
  { re: /\/\.aws(\/|$)/, what: "AWS credentials" },
  { re: /\/\.gnupg(\/|$)/, what: "GPG keys" },
  { re: /\/\.config\/gh(\/|$)/, what: "GitHub CLI auth" },
  { re: /\/\.(env)(\.|$)/, what: "environment secrets (.env)" },
  { re: /\/\.(z|ba)shrc$|\/\.zprofile$|\/\.bash_profile$|\/\.profile$/, what: "shell startup file" },
  { re: /\/\.git(\/|$)/, what: "git internals" },
  { re: /\/\.netrc$/, what: "netrc credentials" },
  { re: /\/(crontab|\.crontab)$|\/Library\/LaunchAgents\//, what: "scheduled-task persistence" },
];

export type WriteVerdict =
  | { kind: "sensitive"; what: string; abs: string }
  | { kind: "in-scope"; abs: string }
  | { kind: "out-of-scope"; abs: string };

/** Classify a write target. Pure — no IO, no side effects. */
export function classifyWrite(path: string): WriteVerdict {
  const abs = resolve(expandHome(path));
  for (const s of SENSITIVE) if (s.re.test(abs)) return { kind: "sensitive", what: s.what, abs };
  return withinAny(abs, writeScopes()) ? { kind: "in-scope", abs } : { kind: "out-of-scope", abs };
}
