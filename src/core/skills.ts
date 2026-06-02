// skills.ts — learned instincts, and the trust gate around them.
//
// Hermes' loudest criticism: it auto-writes skills nobody vetted, then trusts
// them. Mandolin's answer is provenance + a promotion gate. Distilled skills
// land in `proposed/` — visible, inspectable, inert. Nothing becomes a trusted
// instinct until *you* promote it. Your promotion is the signature; the digest
// makes sure a trusted skill can't be altered behind your back.
//
// The SKILL.md format is intentionally agentskills.io-compatible: an instinct
// you teach Mandolin still reads in Claude Code, Cursor, or Codex.

import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { paths } from "../home.ts";
import { scan } from "./scan.ts";
import type { Severity } from "./scan.ts";
import { signMessage, verifyMessage, myFingerprint, resolveKey, hasIdentity } from "./identity.ts";

export type Trust = "proposed" | "trusted";

export type Skill = {
  name: string;
  description: string;
  trust: Trust;
  origin: string;
  digest: string;
  promoted?: string;
  scan?: Severity;
  signer?: string;    // fingerprint of the key that signed this
  signature?: string; // base64 Ed25519 signature over the body
  body: string;
};

export type SkillDraft = {
  name: string;
  description: string;
  whenToUse: string;
  procedure: string[];
  origin: string;
};

function dirFor(trust: Trust): string {
  return trust === "trusted" ? paths.trusted() : paths.proposed();
}

function digest(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

function renderBody(d: SkillDraft): string {
  const steps = d.procedure.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `# ${d.name}

## When to use
${d.whenToUse}

## Procedure
${steps}

## Provenance
Distilled from ${d.origin}. Proposed, not trusted — review before promoting.
`;
}

function frontmatter(s: Omit<Skill, "body">): string {
  const lines = [
    "---",
    `name: ${s.name}`,
    `description: ${s.description}`,
    `trust: ${s.trust}`,
    `origin: ${s.origin}`,
    `digest: ${s.digest}`,
  ];
  if (s.scan) lines.push(`scan: ${s.scan}`);
  if (s.promoted) lines.push(`promoted: ${s.promoted}`);
  if (s.signer) lines.push(`signer: ${s.signer}`);
  if (s.signature) lines.push(`signature: ${s.signature}`);
  lines.push("---", "");
  return lines.join("\n");
}

/** Write a distilled skill into `proposed/`. Returns its name. */
export function propose(d: SkillDraft): string {
  const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const dir = join(paths.proposed(), slug);
  mkdirSync(dir, { recursive: true });
  const body = renderBody(d);
  const meta = { name: d.name, description: d.description, trust: "proposed" as Trust, origin: d.origin, digest: digest(body) };
  writeFileSync(join(dir, "SKILL.md"), frontmatter(meta) + body, "utf8");
  return slug;
}

export class DangerousSkillError extends Error {
  slug: string;
  constructor(slug: string) {
    super(`"${slug}" tripped the scanner as DANGEROUS. Review it, then re-run with --force to promote anyway.`);
    this.slug = slug;
  }
}

/**
 * Import a foreign skill (agentskills.io / Hermes / Claude / Cursor format) into
 * `proposed/`. It is scanned on the way in and lands inert — never trusted by
 * import alone. This is how Mandolin consumes the whole ecosystem *and* stays
 * safer with it than the source: their skills arrive trusted; ours arrive
 * quarantined with the verdict on the label.
 */
export function importSkill(raw: string, origin: string): { slug: string; name: string; scan: Severity; findings: number } {
  const parsed = parse(raw);
  const result = scan(raw);
  const name = parsed.name !== "untitled" ? parsed.name : firstHeading(raw) ?? "imported-skill";
  const slug = slugify(name);
  const dir = join(paths.proposed(), slug);
  mkdirSync(dir, { recursive: true });
  // Preserve the original body verbatim; re-stamp our trust frontmatter around it.
  const body = parsed.body.trim() + "\n";
  const meta = {
    name,
    description: parsed.description || (firstHeading(raw) ?? "imported skill"),
    trust: "proposed" as Trust,
    origin,
    digest: digest(body),
    scan: result.verdict,
  };
  writeFileSync(join(dir, "SKILL.md"), frontmatter(meta) + body, "utf8");
  return { slug, name, scan: result.verdict, findings: result.findings.length };
}

/** Promote a proposed skill to trusted. This is the moment of consent. */
export function promote(slug: string, force = false): Skill {
  const from = join(paths.proposed(), slug, "SKILL.md");
  if (!existsSync(from)) throw new Error(`No proposed skill named "${slug}".`);
  const raw = readFileSync(from, "utf8");
  const skill = parse(raw);
  // Re-scan at promotion time — never trust a stale verdict.
  const verdict = scan(raw).verdict;
  if (verdict === "dangerous" && !force) throw new DangerousSkillError(slug);
  const promotedAt = new Date().toISOString().slice(0, 10);
  // Sign the body with your identity — provenance, not just tamper-evidence.
  const signature = signMessage(skill.body);
  const meta = {
    ...skill,
    trust: "trusted" as Trust,
    promoted: promotedAt,
    digest: digest(skill.body),
    scan: verdict,
    signer: myFingerprint(),
    signature,
  };
  const dir = join(paths.trusted(), slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), frontmatter(meta) + skill.body, "utf8");
  rmSync(join(paths.proposed(), slug), { recursive: true, force: true });
  appendLedger(meta, force && verdict === "dangerous");
  return { ...meta, body: skill.body };
}

function firstHeading(raw: string): string | undefined {
  const m = raw.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim();
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "imported-skill";
}

/** The audit trail. Every promotion leaves a receipt you can read. */
function appendLedger(s: Omit<Skill, "body">, overrodeDanger = false): void {
  const p = paths.ledger();
  if (!existsSync(p)) {
    writeFileSync(p, `# Ledger\n_Every instinct Mandolin was trusted with, and when. Earned, not assumed._\n\n`, "utf8");
  }
  const scanNote = s.scan && s.scan !== "clean" ? ` · scan ${s.scan}` : "";
  const override = overrodeDanger ? ` · ⚠ DANGEROUS, force-promoted` : "";
  const signed = s.signer ? ` · signed ${s.signer}` : "";
  const line = `- **${s.name}** — promoted ${s.promoted} · digest \`${s.digest}\`${signed}${scanNote}${override} · from ${s.origin}\n`;
  writeFileSync(p, readFileSync(p, "utf8") + line, "utf8");
}

export function list(trust: Trust): Skill[] {
  const dir = dirFor(trust);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const f = join(dir, e.name, "SKILL.md");
      return existsSync(f) ? parse(readFileSync(f, "utf8")) : null;
    })
    .filter((s): s is Skill => s !== null);
}

/**
 * Frontmatter parser — tolerant enough to read foreign SKILL.md files
 * (agentskills.io / Hermes / Claude) without a YAML dependency. Handles quoted
 * values and ignores nested keys we don't model. Accepts CRLF too.
 */
function parse(raw: string): Skill {
  const normalized = raw.replace(/\r\n/g, "\n");
  const m = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  let body = normalized;
  if (m) {
    for (const line of m[1].split("\n")) {
      if (/^\s/.test(line)) continue; // skip nested/indented keys (metadata trees, lists)
      const i = line.indexOf(":");
      if (i > 0) {
        const key = line.slice(0, i).trim();
        let val = line.slice(i + 1).trim();
        val = val.replace(/^["']|["']$/g, ""); // unquote
        meta[key] = val;
      }
    }
    body = m[2];
  }
  return {
    name: meta.name ?? "untitled",
    description: meta.description ?? "",
    trust: (meta.trust as Trust) ?? "proposed",
    origin: meta.origin ?? "unknown",
    digest: meta.digest ?? "",
    scan: meta.scan as Severity | undefined,
    promoted: meta.promoted,
    signer: meta.signer,
    signature: meta.signature,
    body,
  };
}

/** Has the trusted copy been tampered with since you signed it? (digest check) */
export function verify(s: Skill): boolean {
  return s.digest === digest(s.body);
}

export type SigStatus = "signed" | "untrusted-signer" | "bad-signature" | "unsigned";

/**
 * Cryptographic verification: is the body signed by a key we trust, and does the
 * signature hold? Distinguishes "no signature" from "signed by a stranger" from
 * "signature doesn't match" — so the UI can tell the user exactly what it means.
 */
export function verifySignature(s: Skill): SigStatus {
  if (!s.signature || !s.signer) return "unsigned";
  const pem = resolveKey(s.signer);
  if (!pem) return "untrusted-signer";
  return verifyMessage(s.body, s.signature, pem) ? "signed" : "bad-signature";
}
