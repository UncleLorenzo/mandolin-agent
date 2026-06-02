// gateway.ts — your agent, living on a server, reachable over chat.
//
// The dominant agent's wedge is "runs off your laptop, texts you on Telegram."
// We match it — but with a sharper trust posture, because a remote message is
// not you-at-the-keyboard:
//
//   • PAIRING: only chat ids you've approved get through. First contact gets a
//     one-time code you approve from the trusted CLI. No open mic.
//   • REMOTE IS STRICTER: there's no keyboard to approve a risky action over a
//     DM, so the remote approver DENIES every gated action (write/shell/network)
//     unless you pre-granted that capability. A message can't talk your agent
//     into wrecking your box — the gate is closed by construction.
//   • EVERY remote action (and every denial) still lands in actions.md.
//
// Zero dependencies: Telegram's Bot API is just HTTPS (getUpdates long-poll +
// sendMessage). No SDK.

import { runAgent } from "./agent.ts";
import type { Approver, ToolCall } from "./tools.ts";
import { isGranted } from "./provider.ts";
import { isApproved, requestPairing } from "./pairing.ts";
import { newSessionId, openSession, record } from "./memory.ts";

export type GatewayEvent =
  | { kind: "listening"; bot: string }
  | { kind: "message"; from: string; text: string; paired: boolean }
  | { kind: "pairing"; from: string; code: string }
  | { kind: "reply"; to: string; text: string }
  | { kind: "denied"; to: string; tool: string }
  | { kind: "error"; detail: string };

/**
 * The remote approver. A DM cannot grant a gated action in the moment — so we
 * only allow what the user PRE-granted from the trusted CLI. Everything else is
 * denied. This is the heart of "remote is stricter."
 */
export function remoteApprover(onDeny?: (call: ToolCall) => void): Approver {
  return async (call) => {
    const risk = riskOf(call.tool);
    if (risk && isGranted(risk)) return true; // honored standing grant
    onDeny?.(call);
    return false; // no keyboard out here — deny by default
  };
}

function riskOf(tool: string): "write" | "exec" | "network" | null {
  if (tool === "write_file") return "write";
  if (tool === "run_shell") return "exec";
  if (tool === "fetch_url") return "network";
  return null; // reads aren't gated by capability
}

// ---- Telegram transport (HTTPS only) ---------------------------------------

type TgUpdate = {
  update_id: number;
  message?: { chat: { id: number }; text?: string; from?: { username?: string } };
};

async function tg(token: string, method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`telegram ${method} ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

export async function getMe(token: string): Promise<{ username: string }> {
  return tg(token, "getMe", {});
}

/**
 * Run the Telegram gateway loop until `signal` aborts. Pure long-poll; each
 * approved message runs the gated agent with the remote (stricter) approver.
 */
export async function runTelegramGateway(
  token: string,
  onEvent: (e: GatewayEvent) => void,
  signal: { aborted: boolean }
): Promise<void> {
  const me = await getMe(token);
  onEvent({ kind: "listening", bot: me.username });

  let offset = 0;
  while (!signal.aborted) {
    let updates: TgUpdate[];
    try {
      updates = await tg(token, "getUpdates", { offset, timeout: 25 });
    } catch (e) {
      onEvent({ kind: "error", detail: (e as Error).message });
      await sleep(2000);
      continue;
    }

    for (const u of updates) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (!msg?.text) continue;
      const chatId = String(msg.chat.id);
      const text = msg.text.trim();

      if (!isApproved(chatId)) {
        // First contact → mint a pairing code, tell them to wait for approval.
        const code = requestPairing(chatId, `${chatId}${u.update_id}`);
        onEvent({ kind: "pairing", from: chatId, code });
        await reply(token, chatId, `🔒 This agent is private. Pairing code: ${code}\nThe owner must approve you with: mando pair approve ${code}`);
        continue;
      }

      onEvent({ kind: "message", from: chatId, text, paired: true });

      // Run the gated agent with the remote (deny-by-default) approver.
      const sessionId = newSessionId();
      openSession(sessionId, `Telegram ${chatId}`);
      record(sessionId, { role: "you", text });
      try {
        const answer = await runAgent(
          text,
          remoteApprover((call) => onEvent({ kind: "denied", to: chatId, tool: call.tool })),
        );
        record(sessionId, { role: "mandolin", text: answer });
        onEvent({ kind: "reply", to: chatId, text: answer });
        await reply(token, chatId, answer);
      } catch (e) {
        const detail = (e as Error).message;
        onEvent({ kind: "error", detail });
        await reply(token, chatId, `⚠️ ${detail}`);
      }
    }
  }
}

async function reply(token: string, chatId: string, text: string): Promise<void> {
  try {
    await tg(token, "sendMessage", { chat_id: chatId, text });
  } catch {
    /* best-effort; the loop continues */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
