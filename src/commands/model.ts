// model.ts — swap the brain. No code changes, no lock-in.

import { wordmark, rule, tone, dim, mark, eyebrow, palette, paint } from "../brand.ts";
import { getConfig, setConfig, apiKey, PROVIDERS } from "../core/provider.ts";
import type { Provider } from "../core/provider.ts";

const PROVIDER_KEYS = Object.keys(PROVIDERS) as Provider[];

export function modelCmd(args: string[]): void {
  if (args.length === 0 || args[0] === "list") {
    const cfg = getConfig();
    const out = [
      "",
      `   ${wordmark()} ${dim(tone.ash("· model"))}`,
      `   ${rule(46)}`,
      "",
      `   ${dim(tone.ash("provider".padEnd(11)))}${tone.bone(cfg.provider)}`,
      `   ${dim(tone.ash("model".padEnd(11)))}${tone.bone(cfg.model)}`,
      "",
      `   ${eyebrow(`providers · ${PROVIDER_KEYS.length} supported`)}`,
    ];
    for (const p of PROVIDER_KEYS) {
      const ready = p === "ollama" || apiKey(p);
      const badge = ready ? mark.ok + " " + tone.teal("ready ") : mark.pending + " " + dim(tone.ash("no key"));
      out.push(`   ${badge}  ${tone.bone(p.padEnd(11))} ${dim(tone.ash(PROVIDERS[p].label))}`);
    }
    out.push(
      "",
      `   ${eyebrow("swap it")}`,
      `   ${tone.teal("mando model claude-opus-4-8")}     ${dim(tone.ash("change model"))}`,
      `   ${tone.teal("mando model groq llama-3.3-70b")}  ${dim(tone.ash("change provider + model"))}`,
      ""
    );
    process.stdout.write(out.join("\n") + "\n");
    return;
  }

  let provider: Provider | undefined;
  let model: string;
  if (args.length >= 2 && PROVIDER_KEYS.includes(args[0] as Provider)) {
    provider = args[0] as Provider;
    model = args[1];
  } else if (PROVIDER_KEYS.includes(args[0] as Provider) && args.length === 1) {
    process.stdout.write(
      `\n   ${paint("✗", palette.magenta)} ${tone.cream(`"${args[0]}" is a provider — give a model too, e.g. `)}${tone.teal(`mando model ${args[0]} <model>`)}\n\n`
    );
    return;
  } else {
    model = args[0];
  }
  const next = setConfig(provider ? { provider, model } : { model });
  const ready = next.provider === "ollama" || apiKey(next.provider);
  const warn = ready ? "" : `\n   ${mark.pending} ${tone.gold(`set ${PROVIDERS[next.provider].envKey} to bring it live`)}`;
  process.stdout.write(
    `\n   ${mark.ok} ${tone.cream("now running ")}${tone.teal(next.model)}${tone.cream(" on ")}${tone.teal(next.provider)}${warn}\n\n`
  );
}
