// provider.ts — model-agnostic by design. Default to Claude, swap with one line.
// No SDK dependency: the API is just HTTPS, so we call it with fetch.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { paths } from "../home.ts";

export type Provider =
  | "anthropic"
  | "openai"
  | "ollama"
  | "google"
  | "groq"
  | "mistral"
  | "deepseek"
  | "together"
  | "openrouter"
  | "xai";

/**
 * Provider registry. Everything except Anthropic and Ollama speaks the
 * OpenAI-compatible Chat Completions API — so adding a provider is a base URL
 * and an env var, not a new SDK. Model-agnostic, no lock-in, zero deps.
 */
export const PROVIDERS: Record<Provider, { label: string; baseUrl?: string; envKey?: string; openaiCompatible: boolean }> = {
  anthropic: { label: "Anthropic (Claude)", envKey: "ANTHROPIC_API_KEY", openaiCompatible: false },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", envKey: "OPENAI_API_KEY", openaiCompatible: true },
  ollama: { label: "Ollama (local)", baseUrl: "http://localhost:11434", openaiCompatible: false },
  google: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", envKey: "GEMINI_API_KEY", openaiCompatible: true },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", envKey: "GROQ_API_KEY", openaiCompatible: true },
  mistral: { label: "Mistral", baseUrl: "https://api.mistral.ai/v1", envKey: "MISTRAL_API_KEY", openaiCompatible: true },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", envKey: "DEEPSEEK_API_KEY", openaiCompatible: true },
  together: { label: "Together AI", baseUrl: "https://api.together.xyz/v1", envKey: "TOGETHER_API_KEY", openaiCompatible: true },
  openrouter: { label: "OpenRouter (200+ models)", baseUrl: "https://openrouter.ai/api/v1", envKey: "OPENROUTER_API_KEY", openaiCompatible: true },
  xai: { label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", envKey: "XAI_API_KEY", openaiCompatible: true },
};

/** Classes of action the agent can be trusted with. Off by default. */
export type Capability = "write" | "exec" | "network";

export type Config = {
  provider: Provider;
  model: string;
  baseUrl?: string;
  capabilities?: Partial<Record<Capability, boolean>>;
  writeScope?: string[]; // extra roots (beyond cwd) a granted write may touch
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
  const envKey = PROVIDERS[provider]?.envKey;
  return envKey ? process.env[envKey] : undefined; // ollama is keyless
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
  if (cfg.provider === "ollama") return ollama(cfg, system, messages, maxTokens);
  if (PROVIDERS[cfg.provider]?.openaiCompatible) return openaiCompatible(cfg, system, messages, maxTokens);
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
  const key = apiKey(cfg.provider);
  const base = cfg.baseUrl || PROVIDERS[cfg.provider]?.baseUrl || "https://api.openai.com/v1";
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
