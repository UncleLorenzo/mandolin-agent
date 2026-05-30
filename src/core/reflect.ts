// reflect.ts — the closed loop, pointed somewhere new.
//
// Hermes reflects a finished task into a *skill*. Mandolin reflects every
// session two ways: it sharpens your Signature (who you are) AND it drafts a
// proposed skill (how you work) — but the skill lands inert in `proposed/`,
// awaiting your promotion. Nothing is trusted until you say so.

import type { SignatureSection } from "./signature.ts";
import { learn } from "./signature.ts";
import { readSession } from "./memory.ts";
import { propose } from "./skills.ts";
import { isLive, complete } from "./provider.ts";

export type Delta = { section: SignatureSection; line: string };

export type Reflection = {
  mode: "live" | "offline";
  deltas: Delta[];
  proposed?: { slug: string; name: string };
};

export type Interview = Partial<Record<"voice" | "standards" | "audience" | "context", string>>;

const SECTION_OF: Record<keyof Interview, SignatureSection> = {
  voice: "Voice",
  standards: "Standards",
  audience: "Audience",
  context: "Context",
};

/**
 * Distill a structured onboarding interview into Signature deltas + one proposed
 * skill. Deterministic and honest: every line traces back to something you said.
 */
export function reflectFromInterview(sessionId: string, answers: Interview): Reflection {
  const deltas: Delta[] = [];
  const provenance = `session ${sessionId}`;
  for (const key of Object.keys(answers) as (keyof Interview)[]) {
    const value = answers[key]?.trim();
    if (!value) continue;
    const section = SECTION_OF[key];
    learn(section, value, provenance);
    deltas.push({ section, line: value });
  }
  const slug = propose({
    name: "Hold the signature",
    description: "Before producing anything, load the Signature and match it; ship only what clears the standard.",
    whenToUse: "Any time Mandolin writes, names, designs, or decides on your behalf.",
    procedure: [
      "Read the Signature (Voice, Standards, Audience, Context) before drafting.",
      "Draft in the loaded voice — not a generic one.",
      "Check the draft against Standards. If it doesn't clear the bar, revise, don't ship.",
      "After shipping, note anything new you learned about the voice back into the Signature.",
    ],
    origin: provenance,
  });
  return { mode: "offline", deltas, proposed: { slug, name: "Hold the signature" } };
}

/**
 * Reflect a real session. With a live model, the model reads the transcript and
 * proposes structured deltas + a skill. Offline, we fall back to a light
 * heuristic so the loop still turns.
 */
export async function reflect(sessionId: string, currentSignature: string): Promise<Reflection> {
  const transcript = readSession(sessionId);
  if (!transcript.trim()) return { mode: isLive() ? "live" : "offline", deltas: [] };

  if (isLive()) {
    try {
      return await reflectLive(sessionId, transcript, currentSignature);
    } catch {
      /* fall through to heuristic */
    }
  }
  return reflectHeuristic(sessionId, transcript);
}

async function reflectLive(sessionId: string, transcript: string, signature: string): Promise<Reflection> {
  const system =
    "You are the reflection pass of the Mandolin agent. Read a session transcript and the user's current Signature. " +
    "Extract only durable, reusable truths about how this person sounds, what they consider good, who they serve, and " +
    "their recurring context. Then draft ONE reusable skill capturing the working pattern. " +
    'Reply with STRICT JSON: {"deltas":[{"section":"Voice|Standards|Audience|Context","line":"..."}],' +
    '"skill":{"name":"...","description":"...","whenToUse":"...","procedure":["...","..."]}}. No prose.';
  const user = `CURRENT SIGNATURE:\n${signature}\n\nSESSION TRANSCRIPT:\n${transcript}`;
  const raw = await complete(system, [{ role: "user", content: user }], 1200);
  const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  const provenance = `session ${sessionId}`;
  const deltas: Delta[] = [];
  for (const d of json.deltas ?? []) {
    if (d?.section && d?.line) {
      learn(d.section, d.line, provenance);
      deltas.push({ section: d.section, line: d.line });
    }
  }
  let proposed: Reflection["proposed"];
  if (json.skill?.name && Array.isArray(json.skill.procedure)) {
    const slug = propose({ ...json.skill, origin: provenance });
    proposed = { slug, name: json.skill.name };
  }
  return { mode: "live", deltas, proposed };
}

function reflectHeuristic(sessionId: string, transcript: string): Reflection {
  const provenance = `session ${sessionId}`;
  const youLines = transcript
    .split("\n")
    .filter((l) => l.startsWith("**you**:"))
    .map((l) => l.replace("**you**:", "").trim())
    .filter(Boolean);
  const deltas: Delta[] = [];
  for (const line of youLines) {
    const section = routeLine(line);
    if (section) {
      learn(section, line, provenance);
      deltas.push({ section, line });
    }
  }
  return { mode: "offline", deltas };
}

function routeLine(line: string): SignatureSection | null {
  const l = line.toLowerCase();
  if (/\b(voice|tone|sound|write|say|never use|cadence)\b/.test(l)) return "Voice";
  if (/\b(never|always|bar|quality|ship|standard|good means|must)\b/.test(l)) return "Standards";
  if (/\b(audience|for builders|customers|members|who we|fans)\b/.test(l)) return "Audience";
  return null; // be conservative offline — don't pollute the Signature with noise
}
