# Changelog

All notable changes to the Mandolin Agent. Format follows
[Keep a Changelog](https://keepachangelog.com); this project uses [SemVer](https://semver.org).

## [Unreleased]

### Added
- **MCP client (`mando mcp`).** Mandolin now speaks the Model Context Protocol — connect any MCP
  server (`mando mcp add <name> <command> [args…]`) and the agent can use its tools. Built on
  JSON-RPC over a stdio subprocess (`node:child_process`, zero deps): spawn → initialize → list →
  call. Every MCP tool the agent invokes is classed **network-risk** and routes through the trust
  gate (denied by default; grant or approve) and the `actions.md` audit log — safer than wiring
  tools in raw. Offline `mando mcp --demo` does a real handshake to a bundled mock server.
- **Session resume.** `mando chat --continue` (`-c`) rehydrates your most recent conversation into
  context, so you pick up where you left off instead of starting cold every time. Built on the
  plain-text session logs — `loadSessionHistory` parses a log back into a message history.
- **In-chat slash-commands.** Inside `mando chat`: `/help`, `/model [name]` (swap models
  mid-conversation), `/reset` (clear context, keep the Signature), `/signature`, `/skills`,
  `/quit`. They run locally and never hit the API; unknown commands show a hint instead of being
  sent to the model.
- **First-run onboarding.** On a fresh, interactive `mando init`, a 60-second four-question
  interview seeds the Signature (Voice / Standards / Audience / Context) so the agent sounds like
  you from session one. Every question is skippable (Enter), Ctrl-C bails out of the interview
  without aborting init, and it auto-skips with `--quick` or in non-interactive shells (CI, pipes).
  Answers are stamped with `onboarding` provenance.
- **Graceful Ctrl-C.** Interrupting a streaming reply aborts just that answer (keeping what
  streamed) and returns to the prompt; Ctrl-C at an idle prompt ends the session cleanly. Abort
  is plumbed through `streamComplete` → `resilientFetch` via `AbortSignal` and is never retried.
- **Config validation on load.** `validateConfig` sanitizes `config.json` — unknown provider,
  bad model/baseUrl/writeScope are dropped (not trusted), and `mando doctor` names each problem
  instead of failing mysteriously later.
- **Live spinner in `mando act`.** A TTY-aware working indicator shows the agent thinking and
  which tool is running between visible steps (silent in non-TTY/CI).
- **Live streaming in `mando chat`.** Replies print token-by-token via SSE (Anthropic +
  OpenAI-compatible), with a graceful one-shot fallback for non-streaming providers — the chat
  feels alive instead of frozen.
- **Resilient network layer** (`src/core/net.ts`). Every model call retries rate limits (429) and
  transient failures (5xx, dropped sockets) with exponential backoff + jitter, honoring
  `Retry-After`; permanent errors (401/400) fail fast. A blip mid-task is a hiccup, not a crash.
- **Expanded scanner ruleset.** The danger scanner (which now guards skill imports, shell
  commands, *and* write targets) gained coverage: raw-disk overwrite (`dd of=/dev/…`), fork bombs,
  `mkfs`/erase, setuid backdoors, `eval $(curl …)`, package installs from untrusted sources,
  scripted OS automation, disabling security controls (SIP/firewall/SELinux), fetched-payload
  persistence, and keychain access — with a false-positive guard test so ordinary dev commands
  (`npm install`, `git commit`, `chmod +x`) stay clean.
- **CI now builds and smoke-runs the binary** (build job): every push compiles `dist/mando.mjs`
  and runs every offline rehearsal through it, so the *install path* can't silently break.
- **Signed-skill provenance (Ed25519).** On first run Mandolin mints a keypair — your identity.
  Promoting a skill signs its body; `mando skills` shows `✦ signed` / `⚠ unknown signer` /
  `✗ tampered`. Exchange public keys (`mando identity export` / `trust`) to share instincts that
  can't be forged. Private key is mode-0600, gitignored, never leaves the machine. Real crypto via
  `node:crypto`, zero deps. New `mando identity` command.
- **Command scanning on `exec`.** The same scanner that quarantines poisoned skills now inspects
  every shell command. An `exec` grant covers ordinary commands, but a *dangerous* one (`rm -rf`,
  `sudo`, `curl … | sh`, reverse shells, credential access, history-wiping) always falls back to
  asking — grant or not. Verified: a granted `rm -rf` is denied. The trust model is now
  defense-in-depth across read, write, *and* exec.
- **Per-path write scoping** (`mando scope`). A `write` grant no longer lets the agent write
  anywhere in your home. Writes only auto-proceed inside your write scope (the project by
  default); a deny-list of high-value targets — `.ssh`, `.env`, shell rc, `.aws`, `.gnupg`,
  `.git` internals, launch agents — **always** asks, grant or not. Verified: a granted write to
  `~/.ssh/authorized_keys` is denied and nothing hits disk. `mando scope add/remove/check`.
- **Installable build.** `npm run build` bundles the whole agent into a single ~90KB
  dependency-free `dist/mando.mjs`; `npm link` (or `npm install -g`) puts a real `mando` command
  on your PATH. `prepack` builds automatically, and a `files` allowlist keeps the published
  package lean (binary + docs only — no source, no tests).
- **`mando doctor`** — a real preflight: checks the Node version, a writable home, valid config,
  the model provider/key, the Signature, and your trust posture (standing grants) — with a clear
  fix for anything that's wrong. (Previously an alias of `status`.)
- **Graceful failure.** Every command runs behind a top-level handler — unexpected errors render
  as a clean one-line message with a hint, never a raw stack trace. A corrupt `config.json` falls
  back to defaults instead of crashing.

### Changed
- `dev`/`build`/`check`/`prepack` npm scripts; `bin` now points at the built binary.

### Added (earlier in this cycle)
- **`mando gateway`** — the always-on gateway: run on a server, reach the agent over Telegram
  (zero-dep, HTTPS long-poll). Two safety guarantees baked in: **pairing** (only approved chat IDs
  may talk to it; first contact gets a one-time code you approve from the CLI) and **remote-is-
  stricter** (gated write/shell/network actions are denied over chat unless pre-granted, since
  there's no keyboard to approve). Every remote action/denial is audited. Offline `--demo`.
- **`mando pair [approve|revoke]`** — manage who may DM the agent.
- **`mando export [file]`** — your agent's entire self (Signature, facts, instincts, ledger,
  sessions) as one portable, readable Markdown bundle.
- **`mando forget <term>`** — true data erasure: preview every matching line, confirm, then
  scrub it from disk and rebuild the embeddings cache. Logged to `actions.md`.
- **Memory footprint** in `mando status` (session count + bytes on disk).
- `ARCHITECTURE.md`, `CHANGELOG.md`, and README status badges.

## [0.1.0] — 2026-06-01

### Added
- **The Signature** — a compounding, human-readable model of you (voice, standards, audience,
  context), loaded before every move, refined after every session, with per-line provenance.
- **The trust gate for skills** — distilled instincts land in `proposed/` and do nothing until
  you `mando promote` them; promotion records a content digest and a ledger entry.
- **Gated tool execution** — `read`/`write`/`shell`/`fetch` behind a capability gate; reads
  inside your project are free, everything else is denied by default, all of it audited.
- **`mando import`** — pull any agentskills.io / Hermes / Claude / Cursor `SKILL.md` in, scanned
  by a quarantine scanner and held inert; a `dangerous` skill can't be promoted without `--force`.
- **Recall smarter than grep** — BM25 + stemming + a synonym bridge offline; true semantic
  vectors with an embeddings key, cached on disk as inspectable JSON.
- **10 model providers** via an OpenAI-compatible registry — Anthropic, OpenAI, Ollama, Google,
  Groq, Mistral, DeepSeek, Together, OpenRouter, xAI.
- **The reflection loop** — LLM-driven with a key, deterministic offline.
- Offline-first rehearsals: `demo`, `act`, `import`, `recall` — all run with no API key.
- Zero runtime dependencies; runs off the source on Node ≥ 22.6. MIT.
