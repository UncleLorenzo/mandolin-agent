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
npm install            # dev tooling only (typecheck + tests)
node src/cli.ts demo   # see the loop, no API key needed
npm run typecheck      # tsc --noEmit
npm test               # node --test
```

> On Node 22.6–23.5, prefix test/run commands with `--experimental-strip-types`. On Node 24+
> it's the default. CI runs on Node 24.

## Pull requests
- Keep the diff focused and match the surrounding style.
- `npm run typecheck` and `npm test` must pass.
- Any new behavior that touches files, the shell, or the network goes through
  `src/core/tools.ts` so it's gated and audited like everything else.
