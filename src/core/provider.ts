// provider.ts — model-agnostic by design. Default to Claude, swap with one line.
// No SDK dependency: the API is just HTTPS, so we call it with fetch.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { paths } from "../home.ts";
import { resilientFetch } from "./net.ts";

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

/**
 * Validate + sanitize a raw config object into a safe Config. Bad values are
 * dropped (not trusted), and every correction is collected so `doctor` can show
 * them. Never throws — a broken config degrades to sane defaults, loudly.
 */
export function validateConfig(raw: unknown): { config: Config; problems: string[] } {
  const problems: string[] = [];
  const out: Config = { ...DEFAULT, capabilities: {} };
  if (!raw || typeof raw !== "object") {
    if (raw !== undefined) problems.push("config is not an object — using defaults");
    return { config: out, problems };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.provider === "string") {
    if (r.provider in PROVIDERS) out.provider = r.provider as Provider;
    else problems.push(`unknown provider "${r.provider}" — falling back to ${DEFAULT.provider}`);
  }
  if (typeof r.model === "string" && r.model.trim()) out.model = r.model.trim();
  else if (r.model !== undefined) problems.push("invalid model — using the default");

  if (typeof r.baseUrl === "string") {
    if (/^https?:\/\//.test(r.baseUrl) || r.baseUrl.startsWith("http://localhost")) out.baseUrl = r.baseUrl;
    else problems.push("baseUrl must be an http(s) URL — ignored");
  }
  if (r.capabilities && typeof r.capabilities === "object") {
    const caps: Partial<Record<Capability, boolean>> = {};
    for (const k of ["write", "exec", "network"] as Capability[]) {
      if (typeof (r.capabilities as Record<string, unknown>)[k] === "boolean") caps[k] = (r.capabilities as Record<string, boolean>)[k];
    }
    out.capabilities = caps;
  }
  if (Array.isArray(r.writeScope)) {
    const scope = r.writeScope.filter((s): s is string => typeof s === "string");
    if (scope.length !== r.writeScope.length) problems.push("writeScope had non-string entries — dropped");
    out.writeScope = scope;
  } else if (r.writeScope !== undefined) {
    problems.push("writeScope must be an array of paths — ignored");
  }
  return { config: out, problems };
}

export function getConfig(): Config {
  const p = paths.config();
  if (existsSync(p)) {
    try {
      return validateConfig(JSON.parse(readFileSync(p, "utf8"))).config;
    } catch {
      /* unparseable JSON — fall through to default */
    }
  }
  return DEFAULT;
}

/** Surface config problems (used by `doctor`). Returns [] if clean or absent. */
export function configProblems(): string[] {
  const p = paths.config();
  if (!existsSync(p)) return [];
  try {
    return validateConfig(JSON.parse(readFileSync(p, "utf8"))).problems;
  } catch {
    return ["config.json is not valid JSON — delete it to reset to defaults"];
  }
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

/**
 * Streaming completion. Calls `onToken` with each text chunk as it arrives, and
 * returns the full text at the end. Anthropic + OpenAI-compatible providers
 * stream via SSE; anything else (or any failure) falls back to a single
 * non-streaming call so callers always get an answer.
 */
export async function streamComplete(
  system: string,
  messages: Message[],
  onToken: (chunk: string) => void,
  maxTokens = 1024,
  signal?: AbortSignal
): Promise<string> {
  const cfg = getConfig();
  try {
    if (cfg.provider === "anthropic") return await streamAnthropic(cfg, system, messages, onToken, maxTokens, signal);
    if (PROVIDERS[cfg.provider]?.openaiCompatible) return await streamOpenAI(cfg, system, messages, onToken, maxTokens, signal);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e; // a Ctrl-C is not a fallback case
    /* otherwise fall through to non-streaming */
  }
  const full = await complete(system, messages, maxTokens);
  onToken(full); // deliver in one shot so the caller's render path is uniform
  return full;
}

/** Iterate Server-Sent-Event `data:` payloads from a Response body stream. */
async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

async function streamAnthropic(cfg: Config, system: string, messages: Message[], onToken: (c: string) => void, maxTokens: number, signal?: AbortSignal): Promise<string> {
  const key = apiKey("anthropic");
  if (!key) throw new Error("offline");
  const res = await resilientFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages, stream: true }),
  }, { signal });
  let full = "";
  for await (const data of sseLines(res)) {
    if (data === "[DONE]") break;
    try {
      const ev = JSON.parse(data);
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
        full += ev.delta.text;
        onToken(ev.delta.text);
      }
    } catch {
      /* ignore keepalive/non-JSON lines */
    }
  }
  return full;
}

async function streamOpenAI(cfg: Config, system: string, messages: Message[], onToken: (c: string) => void, maxTokens: number, signal?: AbortSignal): Promise<string> {
  const key = apiKey(cfg.provider);
  const base = cfg.baseUrl || PROVIDERS[cfg.provider]?.baseUrl || "https://api.openai.com/v1";
  const res = await resilientFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key ?? ""}`, "content-type": "application/json" },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, stream: true, messages: [{ role: "system", content: system }, ...messages] }),
  }, { signal });
  let full = "";
  for await (const data of sseLines(res)) {
    if (data === "[DONE]") break;
    try {
      const ev = JSON.parse(data);
      const chunk = ev.choices?.[0]?.delta?.content;
      if (chunk) {
        full += chunk;
        onToken(chunk);
      }
    } catch {
      /* ignore */
    }
  }
  return full;
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
  const res = await resilientFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, tools, messages }),
  });
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
  const res = await resilientFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages }),
  });
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

async function openaiCompatible(cfg: Config, system: string, messages: Message[], maxTokens: number): Promise<string> {
  const key = apiKey(cfg.provider);
  const base = cfg.baseUrl || PROVIDERS[cfg.provider]?.baseUrl || "https://api.openai.com/v1";
  const res = await resilientFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key ?? ""}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

async function ollama(cfg: Config, system: string, messages: Message[], _maxTokens: number): Promise<string> {
  const base = cfg.baseUrl || "http://localhost:11434";
  const res = await resilientFetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      stream: false,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = (await res.json()) as { message?: { content: string } };
  return data.message?.content ?? "";
}
