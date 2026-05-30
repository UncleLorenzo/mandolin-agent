// provider.ts — model-agnostic by design. Default to Claude, swap with one line.
// No SDK dependency: the API is just HTTPS, so we call it with fetch.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { paths } from "../home.ts";

export type Provider = "anthropic" | "ollama" | "openai";

/** Classes of action the agent can be trusted with. Off by default. */
export type Capability = "write" | "exec" | "network";

export type Config = {
  provider: Provider;
  model: string;
  baseUrl?: string;
  capabilities?: Partial<Record<Capability, boolean>>;
};

const DEFAULT: Config = { provider: "anthropic", model: "claude-sonnet-4-6", capabilities: {} };

export function getConfig(): Config {
  const p = paths.config();
  if (existsSync(p)) {
    try {
      return { ...DEFAULT, ...JSON.parse(readFileSync(p, "utf8")) };
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT;
}

export function setConfig(patch: Partial<Config>): Config {
  const next = { ...getConfig(), ...patch };
  writeFileSync(paths.config(), JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

/** Has the user pre-granted this class of action? */
export function isGranted(cap: Capability): boolean {
  return Boolean(getConfig().capabilities?.[cap]);
}

export function setCapability(cap: Capability, on: boolean): Config {
  const cfg = getConfig();
  return setConfig({ capabilities: { ...cfg.capabilities, [cap]: on } });
}

/** Resolve the API key for the active provider, if any. */
export function apiKey(provider: Provider): string | undefined {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || process.env.MANDOLIN_API_KEY;
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  return undefined; // ollama is keyless
}

/** Is there a live model behind the agent right now? If not, we rehearse offline. */
export function isLive(): boolean {
  const cfg = getConfig();
  if (cfg.provider === "ollama") return true;
  return Boolean(apiKey(cfg.provider));
}

export type Message = { role: "user" | "assistant"; content: string };

/**
 * Single completion against the configured model. Throws on transport error;
 * callers decide whether to fall back to offline rehearsal.
 */
export async function complete(system: string, messages: Message[], maxTokens = 1024): Promise<string> {
  const cfg = getConfig();
  if (cfg.provider === "anthropic") return anthropic(cfg, system, messages, maxTokens);
  if (cfg.provider === "openai") return openaiCompatible(cfg, system, messages, maxTokens);
  if (cfg.provider === "ollama") return ollama(cfg, system, messages, maxTokens);
  throw new Error(`Unknown provider: ${cfg.provider}`);
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type RawMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };
export type ToolSchema = { name: string; description: string; input_schema: Record<string, unknown> };
export type RawTurn = {
  text: string;
  toolUses: { id: string; name: string; input: Record<string, unknown> }[];
  stop: string;
  content: ContentBlock[];
};

/** A single model turn that may request tools. Anthropic-only for now. */
export async function completeRaw(system: string, messages: RawMessage[], tools: ToolSchema[], maxTokens = 2048): Promise<RawTurn> {
  const cfg = getConfig();
  if (cfg.provider !== "anthropic") throw new Error(`the tool-use loop currently supports anthropic only (configured: ${cfg.provider})`);
  const key = apiKey("anthropic");
  if (!key) throw new Error("offline");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, tools, messages }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: ContentBlock[]; stop_reason: string };
  const content = data.content ?? [];
  const text = content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
  const toolUses = content
    .filter((b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
  return { text, toolUses, stop: data.stop_reason, content };
}

async function anthropic(cfg: Config, system: string, messages: Message[], maxTokens: number): Promise<string> {
  const key = apiKey("anthropic");
  if (!key) throw new Error("offline");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

async function openaiCompatible(cfg: Config, system: string, messages: Message[], maxTokens: number): Promise<string> {
  const key = apiKey("openai");
  const base = cfg.baseUrl || "https://api.openai.com/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key ?? ""}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

async function ollama(cfg: Config, system: string, messages: Message[], _maxTokens: number): Promise<string> {
  const base = cfg.baseUrl || "http://localhost:11434";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      stream: false,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content: string } };
  return data.message?.content ?? "";
}
