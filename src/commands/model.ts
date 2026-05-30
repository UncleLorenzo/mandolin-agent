// model.ts — swap the brain. No code changes, no lock-in.

import { wordmark, rule, tone, dim, mark, eyebrow } from "../brand.ts";
import { getConfig, setConfig } from "../core/provider.ts";
import type { Provider } from "../core/provider.ts";

const PROVIDERS: Provider[] = ["anthropic", "openai", "ollama"];

export function modelCmd(args: string[]): void {
  if (args.length === 0) {
    const cfg = getConfig();
    const out = [
      "",
      `   ${wordmark()} ${dim(tone.ash("· model"))}`,
      `   ${rule(46)}`,
      "",
      `   ${dim(tone.ash("provider".padEnd(11)))}${tone.bone(cfg.provider)}`,
      `   ${dim(tone.ash("model".padEnd(11)))}${tone.bone(cfg.model)}`,
      "",
      `   ${eyebrow("swap it")}`,
      `   ${tone.teal("mando model claude-opus-4-8")}        ${dim(tone.ash("change model"))}`,
      `   ${tone.teal("mando model ollama llama3.3")}        ${dim(tone.ash("change provider + model"))}`,
      "",
    ];
    process.stdout.write(out.join("\n") + "\n");
    return;
  }

  let provider: Provider | undefined;
  let model: string;
  if (args.length >= 2 && PROVIDERS.includes(args[0] as Provider)) {
    provider = args[0] as Provider;
    model = args[1];
  } else {
    model = args[0];
  }
  const next = setConfig(provider ? { provider, model } : { model });
  process.stdout.write(
    `\n   ${mark.ok} ${tone.cream("now running ")}${tone.teal(next.model)}${tone.cream(" on ")}${tone.teal(next.provider)}\n\n`
  );
}
