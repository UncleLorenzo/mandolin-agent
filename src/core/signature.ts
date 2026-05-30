// signature.ts — the Signature is the whole point.
//
// Other agents accumulate *skills* (how to do tasks). Mandolin also keeps a
// Signature: a compounding, human-readable model of *you* — your voice, your
// standards, your audience, the context you operate in. It's loaded before
// every move and refined after. One builder, run like a studio.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { paths } from "../home.ts";

export type SignatureSection = "Voice" | "Standards" | "Audience" | "Context";

const STARTER = `# Signature
> The compounding model of you. Mandolin reads this before every move and
> sharpens it after each one. It is plain Markdown — edit it freely, commit it
> to git, take it anywhere. It's yours.

## Voice
_How you sound. Tone, cadence, the words you'd never use._
- (Mandolin will learn this as you work. Seed it if you like.)

## Standards
_What "good" means to you. The bar a thing has to clear before it ships._
- (Earned over time. Nothing here is assumed.)

## Audience
_Who you're building for. Who you're emphatically not._
-

## Context
_Recurring facts about your world: your brands, your stack, your constraints._
-
`;

export function readSignature(): string {
  const p = paths.signature();
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

/** Write a fresh Signature, optionally seeded with a few known facts. */
export function scaffoldSignature(seed?: Partial<Record<SignatureSection, string[]>>): void {
  let body = STARTER;
  if (seed) {
    for (const section of Object.keys(seed) as SignatureSection[]) {
      const lines = seed[section] ?? [];
      for (const line of lines) body = appendLine(body, section, line);
    }
  }
  writeFileSync(paths.signature(), body, "utf8");
}

/**
 * Append a learned line under a section, tagged with quiet provenance so you
 * can always trace why the agent believes what it believes.
 */
export function learn(section: SignatureSection, line: string, provenance?: string): void {
  const current = readSignature() || STARTER;
  const stamped = provenance ? `${line}  _↳ ${provenance}_` : line;
  writeFileSync(paths.signature(), appendLine(current, section, stamped), "utf8");
}

/** Insert a `- line` at the end of the named `## Section` block. */
function appendLine(doc: string, section: SignatureSection, line: string): string {
  const lines = doc.split("\n");
  const header = `## ${section}`;
  const start = lines.findIndex((l) => l.trim() === header);
  if (start === -1) {
    // Section missing — append it.
    return `${doc.trimEnd()}\n\n${header}\n- ${line}\n`;
  }
  // find end of this section (next `## ` or EOF)
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  // strip trailing empty placeholder bullets ("-" or "- (…)") and blank lines
  let insertAt = end;
  while (insertAt - 1 > start) {
    const prev = lines[insertAt - 1].trim();
    if (prev === "" || prev === "-" || /^- \(.*\)$/.test(prev)) {
      insertAt--;
      continue;
    }
    break;
  }
  lines.splice(insertAt, 0, `- ${line}`);
  return lines.join("\n");
}

/** Count of substantive (non-placeholder) bullets — a rough "how well does it know me" gauge. */
export function signatureDepth(): number {
  const doc = readSignature();
  return doc
    .split("\n")
    .filter((l) => /^- /.test(l.trim()))
    .filter((l) => !/^- \(.*\)$/.test(l.trim()) && l.trim() !== "-").length;
}
