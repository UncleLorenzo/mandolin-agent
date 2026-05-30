// agent.ts — the live loop. Assemble who you are, then act as it.
//
// Every turn, Mandolin loads your Signature, your trusted instincts, and your
// facts into context before it answers. It doesn't start as a generic
// assistant and drift toward you — it starts as you.

import type { Message } from "./provider.ts";
import { complete } from "./provider.ts";
import { readSignature } from "./signature.ts";
import { readFacts } from "./memory.ts";
import { list, verify } from "./skills.ts";

/** Compose the system prompt from everything Mandolin has earned the right to know. */
export function buildSystem(): string {
  const signature = readSignature();
  const facts = readFacts();
  const trusted = list("trusted").filter(verify);

  const instincts = trusted.length
    ? trusted.map((s) => `- ${s.name}: ${s.description}`).join("\n")
    : "(none promoted yet — operate from the Signature alone)";

  return [
    "You are Mandolin — a personal agent that operates as an extension of one specific person.",
    "You are not a generic assistant. Before anything else, you embody the Signature below: their voice,",
    "their standards, their audience, their context. Match it precisely. When unsure, ask in their voice.",
    "Only invoke a trusted instinct if it genuinely fits; never act on a procedure you weren't trusted with.",
    "",
    "# Signature",
    signature || "(not yet established)",
    "",
    "# Trusted instincts",
    instincts,
    "",
    "# Facts in view",
    facts || "(none yet)",
  ].join("\n");
}

/** One turn of the live agent. */
export async function respond(history: Message[]): Promise<string> {
  return complete(buildSystem(), history, 1024);
}
