// net.ts — the network layer that doesn't fall over.
//
// Real model APIs rate-limit (429) and blip (500/502/503/504, dropped sockets).
// A toy agent dies on the first hiccup; an elite one retries transient failures
// with exponential backoff + jitter, honors Retry-After, and only ever surfaces
// a clean error after it has genuinely given up. Permanent failures (401 bad
// key, 400 bad request) are NOT retried — retrying them is just slow failure.
//
// Zero dependencies: this wraps the built-in fetch.

export type RetryOptions = {
  retries?: number;        // max retry attempts after the first try (default 4)
  baseDelayMs?: number;    // first backoff step (default 500)
  maxDelayMs?: number;     // cap on any single backoff (default 8000)
  sleep?: (ms: number) => Promise<void>; // injectable for tests
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
  signal?: AbortSignal;    // abort an in-flight request (e.g. Ctrl-C)
};

/** Thrown when a request is aborted by the caller's signal. */
export class AbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class HttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Is this worth retrying, or is it a permanent error we should surface now? */
export function isTransientStatus(status: number): boolean {
  return TRANSIENT_STATUS.has(status);
}

/** Backoff with full jitter, clamped to maxDelay. Honors a Retry-After hint. */
function backoff(attempt: number, base: number, max: number, retryAfterMs: number | null, rand: number): number {
  if (retryAfterMs != null) return Math.min(retryAfterMs, max);
  const exp = Math.min(base * 2 ** attempt, max);
  return Math.round(exp * (0.5 + rand * 0.5)); // full jitter in [exp/2, exp]
}

/** Parse a Retry-After header (seconds, or an HTTP date) into ms, if present. */
function parseRetryAfter(res: Response, nowMs: number): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const secs = Number(h);
  if (!Number.isNaN(secs)) return secs * 1000;
  const when = Date.parse(h);
  return Number.isNaN(when) ? null : Math.max(0, when - nowMs);
}

/**
 * fetch, but resilient. Retries transient HTTP statuses and network errors;
 * throws HttpError on a permanent HTTP failure, or the underlying error if the
 * network never recovers. Returns the successful Response otherwise.
 */
export async function resilientFetch(url: string, init: RequestInit, opts: RetryOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 4;
  const base = opts.baseDelayMs ?? 500;
  const max = opts.maxDelayMs ?? 8000;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) throw new AbortError();
    try {
      const res = await fetch(url, { ...init, signal: opts.signal });
      if (res.ok) return res;
      // Non-OK: retry only if transient and we have attempts left.
      if (isTransientStatus(res.status) && attempt < retries) {
        const bodyPeek = await res.clone().text().catch(() => "");
        const retryAfter = parseRetryAfter(res, Date.now());
        const delay = backoff(attempt, base, max, retryAfter, Math.random());
        opts.onRetry?.(attempt + 1, delay, `HTTP ${res.status}`);
        await sleep(delay);
        lastErr = new HttpError(res.status, bodyPeek);
        continue;
      }
      // Permanent, or out of attempts: surface it.
      throw new HttpError(res.status, await res.text().catch(() => ""));
    } catch (err) {
      // Caller aborted (Ctrl-C) — stop immediately, never retry.
      if (opts.signal?.aborted || (err as Error)?.name === "AbortError") throw new AbortError();
      // A thrown HttpError above for a permanent status should propagate as-is.
      if (err instanceof HttpError && !isTransientStatus(err.status)) throw err;
      // Network-level error (DNS, reset, timeout) — retry if attempts remain.
      if (attempt < retries) {
        const delay = backoff(attempt, base, max, null, Math.random());
        opts.onRetry?.(attempt + 1, delay, (err as Error).message || "network error");
        await sleep(delay);
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("request failed after retries");
}
