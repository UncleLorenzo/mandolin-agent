// chat.ts — put the agent to work. Live when a model is configured; otherwise
// it points you at the offline rehearsal so you can still see the loop.

import { createInterface } from "node:readline";
import { wordmark, rule, frame, tone, dim, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { ensureHome, isInitialized } from "../home.ts";
import { scaffoldSignature, readSignature } from "../core/signature.ts";
import { newSessionId, openSession, record } from "../core/memory.ts";
import { isLive, getConfig, setConfig } from "../core/provider.ts";
import { respondStream } from "../core/agent.ts";
import { reflect } from "../core/reflect.ts";
import { signatureDepth } from "../core/signature.ts";
import { list } from "../core/skills.ts";
import type { Message } from "../core/provider.ts";

function offlineNotice(): void {
  const card = [
    `${mark.pending} ${tone.gold("offline")} ${dim(tone.ash("— no model key set"))}`,
    "",
    `${tone.cream("Set a key to bring the agent live:")}`,
    `${tone.teal("export ANTHROPIC_API_KEY=sk-...")}`,
    "",
    `${dim(tone.ash("or watch the loop right now, no key needed:"))}`,
    `${gradient("mando demo", [palette.teal, palette.orange])}`,
  ];
  process.stdout.write("\n" + frame(card).split("\n").map((l) => `   ${l}`).join("\n") + "\n\n");
}

export async function chat(args: string[]): Promise<void> {
  ensureHome();
  if (!isInitialized()) scaffoldSignature();

  if (!isLive()) {
    offlineNotice();
    return;
  }

  const id = newSessionId();
  openSession(id, "Session");
  const history: Message[] = [];

  // One-shot: `mando chat "do the thing"`
  if (args.length) {
    const text = args.join(" ");
    record(id, { role: "you", text });
    history.push({ role: "user", content: text });
    process.stdout.write(`\n   ${tone.teal("mandolin")}  `);
    const reply = await respondStream(history, (chunk) => process.stdout.write(tone.cream(chunk)));
    process.stdout.write("\n\n");
    record(id, { role: "mandolin", text: reply });
    await closeOut(id);
    return;
  }

  // Interactive REPL.
  process.stdout.write(
    `\n   ${wordmark()} ${dim(tone.ash("· live"))}\n   ${rule(46)}\n` +
    `   ${eyebrow("operating from your Signature · /help for commands · /quit to end")}\n\n`
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(`   ${tone.ash("you")}  `);
  rl.prompt();

  // Ctrl-C: if a reply is streaming, abort just that reply and return to the
  // prompt; if we're idle at the prompt, bow out cleanly.
  let streaming: AbortController | null = null;
  rl.on("SIGINT", () => {
    if (streaming) {
      streaming.abort();
      process.stdout.write(`\n   ${dim(tone.ash("— stopped —"))}\n\n`);
    } else {
      process.stdout.write(`\n   ${dim(tone.ash("ending the session…"))}\n`);
      rl.close();
    }
  });

  for await (const lineRaw of rl) {
    const line = lineRaw.trim();
    if (line === "/quit" || line === "/q") break;
    if (!line) { rl.prompt(); continue; }
    // Slash-commands run locally, never go to the model.
    if (line.startsWith("/")) {
      const handled = slashCommand(line, history);
      if (handled) { rl.prompt(); continue; }
      // unknown slash → fall through is wrong; show hint and re-prompt
      process.stdout.write(`   ${dim(tone.ash(`unknown command — try `))}${tone.teal("/help")}\n\n`);
      rl.prompt();
      continue;
    }
    record(id, { role: "you", text: line });
    history.push({ role: "user", content: line });
    streaming = new AbortController();
    let streamed = "";
    try {
      process.stdout.write(`   ${tone.teal("mandolin")}  `);
      const reply = await respondStream(
        history,
        (chunk) => { streamed += chunk; process.stdout.write(tone.cream(chunk)); },
        streaming.signal,
      );
      process.stdout.write("\n\n");
      record(id, { role: "mandolin", text: reply });
      history.push({ role: "assistant", content: reply });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        // keep whatever streamed so the conversation stays coherent
        if (streamed) { record(id, { role: "mandolin", text: streamed + " …(stopped)" }); history.push({ role: "assistant", content: streamed }); }
      } else {
        process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream((e as Error).message)}\n\n`);
      }
    } finally {
      streaming = null;
    }
    rl.prompt();
  }
  rl.close();
  await closeOut(id);
}

/** End of session: reflect, and surface anything proposed. */
async function closeOut(id: string): Promise<void> {
  process.stdout.write(`   ${eyebrow("reflecting on the session")}\n`);
  const r = await reflect(id, readSignature());
  if (r.deltas.length) {
    process.stdout.write(`   ${mark.add} ${tone.cream(`${r.deltas.length} update(s) to your Signature`)}\n`);
  }
  if (r.proposed) {
    process.stdout.write(
      `   ${mark.pending} ${tone.gold("proposed instinct: ")}${tone.cream(r.proposed.name)} ` +
      `${dim(tone.ash(`— promote with `))}${tone.teal(`mando promote ${r.proposed.slug}`)}\n`
    );
  }
  if (!r.deltas.length && !r.proposed) {
    process.stdout.write(`   ${dim(tone.ash("nothing new to learn this time"))}\n`);
  }
  process.stdout.write("\n");
}

/**
 * Handle an in-REPL slash command. Returns true if it was a known command (so
 * the loop skips the model). These run locally and never hit the API.
 * Exported for testing.
 */
export function slashCommand(line: string, history: Message[]): boolean {
  const [cmd, ...rest] = line.slice(1).split(/\s+/);
  const arg = rest.join(" ").trim();
  const w = (s: string) => process.stdout.write(s);

  switch (cmd) {
    case "help": case "?": {
      const rows: [string, string][] = [
        ["/model [name]", "show or switch the model mid-chat"],
        ["/reset", "clear the conversation context (keep the Signature)"],
        ["/signature", "what the agent knows about you"],
        ["/skills", "your trusted instincts"],
        ["/quit", "end the session (also Ctrl-C at the prompt)"],
      ];
      w(`\n   ${eyebrow("in-chat commands")}\n`);
      for (const [c, d] of rows) w(`   ${tone.teal(c.padEnd(16))} ${dim(tone.ash(d))}\n`);
      w("\n");
      return true;
    }
    case "model": {
      const cfg = getConfig();
      if (!arg) { w(`\n   ${dim(tone.ash("model "))}${tone.cream(cfg.model)} ${dim(tone.ash("on "))}${tone.cream(cfg.provider)}\n\n`); return true; }
      const next = setConfig({ model: arg });
      w(`\n   ${mark.ok} ${tone.cream("now using ")}${tone.teal(next.model)}\n\n`);
      return true;
    }
    case "reset": case "new": {
      history.length = 0;
      w(`\n   ${mark.ok} ${tone.cream("context cleared")} ${dim(tone.ash("— your Signature still applies"))}\n\n`);
      return true;
    }
    case "signature": case "sig": {
      w(`\n   ${dim(tone.ash(`${signatureDepth()} things known about you · full text: `))}${tone.teal("mando signature")}\n\n`);
      return true;
    }
    case "skills": {
      const t = list("trusted");
      w(`\n   ${dim(tone.ash(`${t.length} trusted instinct(s)`))}\n`);
      for (const s of t.slice(0, 8)) w(`   ${mark.signed} ${tone.cream(s.name)}\n`);
      w("\n");
      return true;
    }
    default:
      return false;
  }
}
