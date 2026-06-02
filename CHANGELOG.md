# Changelog

All notable changes to the Mandolin Agent. Format follows
[Keep a Changelog](https://keepachangelog.com); this project uses [SemVer](https://semver.org).

## [Unreleased]

### Added
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
