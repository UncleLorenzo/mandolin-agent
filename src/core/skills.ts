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

export type Trust = "proposed" | "trusted";

export type Skill = {
  name: string;
  description: string;
  trust: Trust;
  origin: string;
  digest: string;
  promoted?: string;
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
  if (s.promoted) lines.push(`promoted: ${s.promoted}`);
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

/** Promote a proposed skill to trusted. This is the moment of consent. */
export function promote(slug: string): Skill {
  const from = join(paths.proposed(), slug, "SKILL.md");
  if (!existsSync(from)) throw new Error(`No proposed skill named "${slug}".`);
  const skill = parse(readFileSync(from, "utf8"));
  const promotedAt = new Date().toISOString().slice(0, 10);
  const meta = { ...skill, trust: "trusted" as Trust, promoted: promotedAt, digest: digest(skill.body) };
  const dir = join(paths.trusted(), slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), frontmatter(meta) + skill.body, "utf8");
  rmSync(join(paths.proposed(), slug), { recursive: true, force: true });
  appendLedger(meta);
  return { ...meta, body: skill.body };
}

/** The audit trail. Every promotion leaves a receipt you can read. */
function appendLedger(s: Omit<Skill, "body">): void {
  const p = paths.ledger();
  if (!existsSync(p)) {
    writeFileSync(p, `# Ledger\n_Every instinct Mandolin was trusted with, and when. Earned, not assumed._\n\n`, "utf8");
  }
  const line = `- **${s.name}** — promoted ${s.promoted} · digest \`${s.digest}\` · from ${s.origin}\n`;
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

/** Minimal frontmatter parser — just enough, no YAML dependency. */
function parse(raw: string): Skill {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  let body = raw;
  if (m) {
    for (const line of m[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    body = m[2];
  }
  return {
    name: meta.name ?? "untitled",
    description: meta.description ?? "",
    trust: (meta.trust as Trust) ?? "proposed",
    origin: meta.origin ?? "unknown",
    digest: meta.digest ?? "",
    promoted: meta.promoted,
    body,
  };
}

/** Has the trusted copy been tampered with since you signed it? */
export function verify(s: Skill): boolean {
  return s.digest === digest(s.body);
}
