// doctor.ts — a real preflight. Confirms the install is healthy and tells you
// exactly what to fix when it isn't. Infrastructure you can trust starts with
// being able to ask "am I okay?" and get a straight answer.

import { existsSync, accessSync, constants, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { wordmark, rule, tone, dim, mark, eyebrow, palette, paint } from "../brand.ts";
import { paths, home, isInitialized } from "../home.ts";
import { getConfig, apiKey, isLive, PROVIDERS } from "../core/provider.ts";

type Check = { label: string; status: "ok" | "warn" | "fail"; detail: string };

const NODE_MIN = [22, 6];

function checkNode(): Check {
  const m = process.version.slice(1).split(".").map(Number);
  const ok = m[0] > NODE_MIN[0] || (m[0] === NODE_MIN[0] && m[1] >= NODE_MIN[1]);
  return {
    label: "Node runtime",
    status: ok ? "ok" : "fail",
    detail: ok ? `${process.version} (needs ≥ 22.6)` : `${process.version} — too old, needs ≥ 22.6 for native TypeScript`,
  };
}

function checkHomeWritable(): Check {
  try {
    if (!existsSync(home())) return { label: "Home directory", status: "warn", detail: `${home()} — not created yet, run mando init` };
    const probe = join(home(), ".doctor-probe");
    writeFileSync(probe, "ok", "utf8");
    rmSync(probe, { force: true });
    return { label: "Home directory", status: "ok", detail: `${home()} — writable` };
  } catch {
    return { label: "Home directory", status: "fail", detail: `${home()} — NOT writable (check permissions)` };
  }
}

function checkConfig(): Check {
  const p = paths.config();
  if (!existsSync(p)) return { label: "Config", status: "ok", detail: "using defaults (no config.json yet)" };
  try {
    JSON.parse(readFileSync(p, "utf8"));
    return { label: "Config", status: "ok", detail: `${p} — valid JSON` };
  } catch {
    return { label: "Config", status: "fail", detail: `${p} — corrupt JSON; delete it to reset to defaults` };
  }
}

function checkProvider(): Check {
  const cfg = getConfig();
  const meta = PROVIDERS[cfg.provider];
  if (cfg.provider === "ollama") {
    return { label: "Model provider", status: "ok", detail: `ollama (local) · ${cfg.model} — no key needed` };
  }
  if (apiKey(cfg.provider)) {
    return { label: "Model provider", status: "ok", detail: `${cfg.provider} · ${cfg.model} — key present, live` };
  }
  return {
    label: "Model provider",
    status: "warn",
    detail: `${cfg.provider} · ${cfg.model} — no key (set ${meta?.envKey ?? "the API key"}); offline rehearsals still work`,
  };
}

function checkSignature(): Check {
  return isInitialized()
    ? { label: "Signature", status: "ok", detail: "established" }
    : { label: "Signature", status: "warn", detail: "not established — run mando init" };
}

function checkWritePosture(): Check {
  // Security posture: are dangerous capabilities standing-granted? Not a failure,
  // but worth surfacing so the user knows their exposure.
  const caps = getConfig().capabilities ?? {};
  const on = (["write", "exec", "network"] as const).filter((c) => caps[c]);
  return on.length
    ? { label: "Trust posture", status: "warn", detail: `standing grants: ${on.join(", ")} — the agent acts unprompted here. mando revoke <cap> to tighten.` }
    : { label: "Trust posture", status: "ok", detail: "no standing grants — every gated action asks first" };
}

export function doctor(): void {
  const checks = [checkNode(), checkHomeWritable(), checkConfig(), checkProvider(), checkSignature(), checkWritePosture()];
  const glyph = { ok: mark.ok, warn: paint("•", palette.gold), fail: paint("✗", palette.magenta) };
  const color = { ok: tone.teal, warn: tone.gold, fail: (s: string) => paint(s, palette.magenta) };

  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· doctor"))}`, `   ${rule(50)}`, ""];
  for (const c of checks) {
    out.push(`   ${glyph[c.status]} ${color[c.status](c.label.padEnd(16))} ${dim(tone.ash(c.detail))}`);
  }
  out.push("");

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  if (fails) out.push(`   ${paint("✗", palette.magenta)} ${tone.cream(`${fails} problem(s) to fix above.`)}`);
  else if (warns) out.push(`   ${mark.ok} ${tone.cream("healthy — ")}${dim(tone.ash(`${warns} note(s) above, nothing blocking`))}`);
  else out.push(`   ${mark.ok} ${tone.cream("all systems green.")}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
  if (fails) process.exitCode = 1;
}
