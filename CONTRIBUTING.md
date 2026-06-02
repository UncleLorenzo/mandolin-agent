# Contributing

Mandolin is small on purpose. The bar for new surface area is high; the bar for depth on
the core ideas — the Signature and the trust gate — is low. **Depth over breadth.**

## Principles
- **Every action stays gated.** Nothing the agent does to your machine should bypass the
  capability gate or the audit log in `src/core/tools.ts`.
- **Inspectable by default.** State is plain text you can read, diff, and delete.
- **Lean.** Zero runtime dependencies. If you reach for one, make the case first.

## Develop
Requires **Node ≥ 22.6** — it runs TypeScript with no build step.

```bash
git clone https://github.com/UncleLorenzo/mandolin-agent
cd mandolin-agent
npm install                # dev tooling (typecheck, tests, bundler)
npm run dev -- demo        # run off source, no build, no API key
npm run check              # typecheck + tests in one shot
npm run build              # bundle → dist/mando.mjs
```

- `npm run dev -- <cmd>` runs straight off the TypeScript source (fast iteration).
- `npm run build` produces the single-file binary users actually install.

> On Node 22.6–23.5, prefix run commands with `--experimental-strip-types`. On Node 24+ it's the
> default. CI runs on Node 24.

## Pull requests
- Keep the diff focused and match the surrounding style.
- `npm run check` (typecheck + tests) must pass.
- Any new behavior that touches files, the shell, or the network goes through
  `src/core/tools.ts` so it's gated and audited like everything else.
- TS note: Node's strip-only mode rejects `enum` and parameter properties
  (`constructor(public x)`) — use plain field assignments.
