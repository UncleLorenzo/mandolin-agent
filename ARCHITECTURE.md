# Architecture

Mandolin is small on purpose. The whole agent is a few hundred lines of dependency-free
TypeScript that runs straight off the source. This document is the map.

## The one idea

Two agents in the wild compound *skills* — recipes for tasks. Mandolin compounds two things
instead, and gates them both:

1. **A Signature** — a living, human-readable model of *you* (voice, standards, audience,
   context), loaded before every move.
2. **Trust** — nothing the agent learns or does is trusted by default. Skills are proposed,
   then promoted. Actions are denied, then granted. Everything leaves a receipt.

Everything below serves those two ideas.

## Build & run

Two modes, one source of truth:

- **Dev:** `npm run dev -- <cmd>` runs the TypeScript directly on Node ≥ 22.6 (native type
  stripping, no build step) — fast iteration.
- **Ship:** `npm run build` uses esbuild to bundle `src/cli.ts` and everything it imports into a
  single, dependency-free `dist/mando.mjs` (~90KB) with the shebang preserved. `npm link` /
  `npm install -g` puts that on your PATH as `mando`. `prepack` runs the build automatically, and
  a `files` allowlist means a published package is just the binary + docs.

`mando doctor` is the preflight: Node version, writable home, valid config, provider/key,
Signature, and trust posture — each with a fix if it's wrong. Every command runs behind a
top-level handler, so failures are clean one-liners, never stack traces.

## Layout

```
src/
  cli.ts              # the command router — one small switch behind a graceful error handler
  brand.ts            # zero-dep truecolor ANSI: the house palette in your terminal
  home.ts             # where state lives (~/.mandolin), all paths in one place
  core/
    signature.ts      # the Signature: read, learn (with provenance), measure depth
    memory.ts         # plain-Markdown sessions + curated facts
    recall.ts         # ranked recall (BM25 + stemming + synonyms) → semantic (embeddings)
    skills.ts         # SKILL.md format, the proposed→trusted gate, digests, the ledger
    scan.ts           # the quarantine scanner for imported skills
    tools.ts          # the capability gate: read/write/shell/fetch + the actions.md audit log
    scope.ts          # per-path write scoping — a grant can't touch secrets or wander off-project
    identity.ts       # Ed25519 identity: sign promoted skills, verify signatures, trusted keys
    provider.ts       # model-agnostic registry (10 providers); complete + streamComplete (SSE)
    net.ts            # resilient fetch: retry 429/5xx/network with backoff+jitter, fail fast on 4xx; AbortSignal-aware
    spinner.ts        # tiny TTY-aware "working" indicator for the agentic act loop
    agent.ts          # the live loop: assemble the system prompt, run tools through the gate
    reflect.ts        # the closed loop: a session → Signature deltas + a proposed instinct
    sovereignty.ts    # export the whole self; forget anything, for real
    gateway.ts        # always-on Telegram gateway (HTTPS); the remote (stricter) approver
    pairing.ts        # the chat allowlist: nobody talks to the gateway until you approve them
    mcp.ts            # MCP client (JSON-RPC over stdio); connect external tool servers
  commands/           # one file per command, presentation only — logic lives in core/
test/
  core.test.ts        # node:test over the trust-critical paths
```

## Design rules

- **Inspectable by default.** Every piece of state is plain text on your disk: the Signature,
  memory, skills, the ledger, the audit log. If you can't read what your agent knows, you don't
  own it. There is no database and no binary format.
- **Trust is a gate, not a setting.** Two gates, same shape: skills (`proposed → promoted`) and
  actions (`denied → granted`). Both default closed. Both leave an auditable receipt. A trusted
  skill carries a content digest, so tampering is detectable.
- **Zero runtime dependencies.** Model and embedding APIs are just HTTPS; we call them with
  `fetch`. This keeps the install trivial and the supply-chain attack surface near zero.
- **Offline-first demos.** `demo`, `act`, `import`, and `recall` all run with no API key, doing
  real work on real files — so the behavior is verifiable, not a marketing claim.
- **Presentation ≠ logic.** `commands/` only renders. All behavior lives in `core/` and is what
  the tests exercise.

## The two loops

**Reflection (learning).** After a session, `reflect.ts` reads the transcript and produces
(a) deltas to the Signature — applied automatically, since they only describe *you* — and
(b) one *proposed* skill, which sits inert until you promote it. With a model key this is
LLM-driven; offline it falls back to a deterministic heuristic so the loop still turns.

**Action (doing).** `agent.ts` builds a system prompt from the Signature + trusted instincts +
facts, then runs a tool-use loop. Every tool call passes through `tools.ts`: reads inside your
project are free; writes, shell, and network are denied unless granted or approved in the moment.
Each decision is appended to `actions.md`.

## Trust model & limits

See [SECURITY.md](SECURITY.md) for the threat model. Writes are both capability-gated *and*
per-path scoped (`scope.ts`): a grant can't reach secrets or wander off-project. Honest remaining
limits: the scanner in `scan.ts` is a heuristic tripwire, not a sandbox; a standing `exec` grant
is not path-scoped the way writes are; and `forget` records the *search term* in the audit receipt
(proof of erasure), so if the term itself is sensitive you'll want to scrub `actions.md` too.
These are documented, not hidden.
