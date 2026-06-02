// agent.ts — the live loop. Assemble who you are, then act as it.
//
// Every turn, Mandolin loads your Signature, your trusted instincts, and your
// facts into context before it answers. It doesn't start as a generic
// assistant and drift toward you — it starts as you.

import type { Message, RawMessage, ContentBlock } from "./provider.ts";
import { complete, completeRaw, streamComplete } from "./provider.ts";
import { toolSchemas, executeTool, findTool } from "./tools.ts";
import type { Approver, ToolCall } from "./tools.ts";
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

/** One turn of the live agent (no tools — plain conversation). */
export async function respond(history: Message[]): Promise<string> {
  return complete(buildSystem(), history, 1024);
}

/** One turn, streamed token-by-token. Returns the full text when done. */
export async function respondStream(history: Message[], onToken: (chunk: string) => void): Promise<string> {
  return streamComplete(buildSystem(), history, onToken, 1024);
}

export type AgentEvent =
  | { kind: "think"; text: string }
  | { kind: "tool"; call: ToolCall; risk: string }
  | { kind: "result"; tool: string; ok: boolean; decision: string };

const MAX_STEPS = 8;

/**
 * The agentic loop: operate as the Signature, act through gated tools, until the
 * task is done. Every action routes through `approver` + the trust gate.
 */
export async function runAgent(task: string, approver: Approver, onEvent?: (e: AgentEvent) => void): Promise<string> {
  const system =
    buildSystem() +
    "\n\n# Acting\nYou can act through tools. Reading inside the project is free; writing files, running commands, and " +
    "network access need the user's standing grant or in-the-moment approval. Take the smallest action that moves the " +
    "task forward. When you're finished, reply with a short summary and no tool call.";

  const messages: RawMessage[] = [{ role: "user", content: task }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const turn = await completeRaw(system, messages, toolSchemas(), 2048);
    if (turn.text) onEvent?.({ kind: "think", text: turn.text });
    messages.push({ role: "assistant", content: turn.content });

    if (turn.toolUses.length === 0) return turn.text || "(done)";

    const results: ContentBlock[] = [];
    for (const tu of turn.toolUses) {
      const call: ToolCall = { tool: tu.name, input: tu.input };
      onEvent?.({ kind: "tool", call, risk: findTool(tu.name)?.risk ?? "read" });
      const outcome = await executeTool(call, approver);
      onEvent?.({ kind: "result", tool: tu.name, ok: outcome.ok, decision: outcome.decision });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: outcome.output, is_error: !outcome.ok });
    }
    messages.push({ role: "user", content: results });
  }
  return "(stopped: reached the step limit without finishing)";
}
