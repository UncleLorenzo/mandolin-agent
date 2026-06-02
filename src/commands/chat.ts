// chat.ts — put the agent to work. Live when a model is configured; otherwise
// it points you at the offline rehearsal so you can still see the loop.

import { createInterface } from "node:readline";
import { wordmark, rule, frame, tone, dim, mark, eyebrow, palette, paint, gradient } from "../brand.ts";
import { ensureHome, isInitialized } from "../home.ts";
import { scaffoldSignature, readSignature } from "../core/signature.ts";
import { newSessionId, openSession, record } from "../core/memory.ts";
import { isLive } from "../core/provider.ts";
import { respondStream } from "../core/agent.ts";
import { reflect } from "../core/reflect.ts";
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
    `   ${eyebrow("operating from your Signature · /quit to end the session")}\n\n`
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(`   ${tone.ash("you")}  `);
  rl.prompt();

  for await (const lineRaw of rl) {
    const line = lineRaw.trim();
    if (line === "/quit" || line === "/q") break;
    if (!line) { rl.prompt(); continue; }
    record(id, { role: "you", text: line });
    history.push({ role: "user", content: line });
    try {
      process.stdout.write(`   ${tone.teal("mandolin")}  `);
      const reply = await respondStream(history, (chunk) => process.stdout.write(tone.cream(chunk)));
      process.stdout.write("\n\n");
      record(id, { role: "mandolin", text: reply });
      history.push({ role: "assistant", content: reply });
    } catch (e) {
      process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream((e as Error).message)}\n\n`);
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
