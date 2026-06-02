# Changelog

All notable changes to the Mandolin Agent. Format follows
[Keep a Changelog](https://keepachangelog.com); this project uses [SemVer](https://semver.org).

## [Unreleased]

### Added
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
