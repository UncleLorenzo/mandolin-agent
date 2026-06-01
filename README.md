<div align="center">

<img src="media/banner.svg" alt="Mandolin — the agent that learns you" width="820">

**The agent that learns *you*.**

Most agents learn tasks. Mandolin learns your voice, your standards, your taste —
and earns every instinct before it acts on it.

`self-hosted` · `model-agnostic` · `zero runtime dependencies` · `yours`

<br>

<img src="media/demo.svg" alt="Mandolin's trust gate: it runs the harmless command, and refuses to delete a directory" width="760">

</div>

---

## The idea

The open-source agent wave proved something: memory should be a **file you can read**,
and an agent should get **better the longer it runs**. Good. We took those ideas somewhere
they hadn't gone.

Every other agent compounds *skills* — recipes for tasks. Mandolin compounds a **Signature**:
a living, human-readable model of *who you are*. Your cadence. The words you'd never use. The
bar a thing has to clear before it ships. Who you're building for. It loads that before every
move, so it doesn't start generic and drift toward you — **it starts as you.** One builder,
run like a studio.

And it never trusts itself by default. When it learns a new way of working, that becomes a
**proposed** instinct — visible, inspectable, inert — until *you* promote it. Your sign-off is
the signature; a content digest makes a trusted instinct tamper-evident. Nothing your agent
believes got there without your consent, and you can read every line of it.

> Inspectable file-based learning, plus a trust model. That's the whole pitch.

---

## See it in 20 seconds — no API key needed

```bash
git clone https://github.com/UncleLorenzo/mandolin-agent
cd mandolin-agent
node src/cli.ts demo
```

```
   Mandolin · first rehearsal              offline — no model key needed
   ──────────────────────────────────────────────────────

   mandolin  How should I sound when I write as you?
   you       Discreet and elite. Lowercase confidence. Suggest, never explain.

   mandolin  What does 'good' have to clear before it ships?
   you       If it could've come from anyone, it's not done. Taste over volume.

   reflecting — distilling this into who you are

   ╭──────────────────────────────────────────────────────────╮
   │ Signature  ~/.mandolin/signature.md                        │
   │ Voice      + Discreet and elite. Lowercase confidence…     │
   │ Standards  + If it could've come from anyone, it's not…    │
   ╰──────────────────────────────────────────────────────────╯

   · PROPOSED   awaiting your promotion
     Hold the signature — a reusable instinct, distilled from this session

   nothing is trusted until you sign off:
   mando promote hold-the-signature
```

It wrote real files. Go read them: `~/.mandolin/signature.md`. That diff is the loop you'd
otherwise wait days to watch — compressed into one rehearsal.

---

## Quickstart (live)

```bash
export ANTHROPIC_API_KEY=sk-...      # or any model — see "Model-agnostic" below
node src/cli.ts init                 # establish your Signature + local home
node src/cli.ts chat                 # put it to work; it operates from your Signature
```

> v0.1 runs straight off the source on **Node ≥ 22.6** (native TypeScript, no build step).
> `npm link` to get the `mando` command globally.

---

## How it works

**The Signature** — `~/.mandolin/signature.md`
A Markdown file with four sections: Voice, Standards, Audience, Context. Loaded into context
before every turn, refined after every session. Each learned line is stamped with the session
it came from, so you can always trace *why* the agent believes what it believes.

**Memory + recall that's smarter than grep** — `~/.mandolin/memory/`
Plain-text session logs and a short, curated facts file — no opaque vector database you can't
read. But recall isn't dumb substring matching. `mando recall "<question>"` ranks your whole
memory by *meaning*: offline it's **BM25 relevance with stemming and a synonym bridge** (so
"payments" finds the line about Stripe, even though the word "payment" was never written); with an
embeddings key it upgrades to **true semantic vectors**, cached on disk as plain JSON you can still
inspect. Most agents in this wave recall by keyword — the kind their own users call "dumber than it
should be." This one bridges the vocabulary gap.

```
$ mando recall --demo     # no key needed

  ? how do we handle payments?
    → We integrate Stripe for subscriptions; invoices go out on the 1st.
      ('payment' was never said — bridged to Stripe/billing)

  ? any recent defects?
    → The login flow was crashing on Safari; we patched the OAuth redirect.
      ('defect' was never said — bridged to the crash)
```

**Instincts + the trust gate** — `~/.mandolin/skills/`
Distilled, reusable procedures in the `agentskills.io`-compatible `SKILL.md` format (so an
instinct you teach Mandolin still reads in Claude Code, Cursor, or Codex). New ones land in
`proposed/`. They do nothing until you `mando promote` them into `trusted/`. Promotion records
a digest and writes a line to `ledger.md` — your audit trail of what you trusted, and when.

**Import the whole ecosystem — safely** — `mando import <url|file>`
`SKILL.md` is an open standard, so Mandolin runs skills written for Hermes, Claude Code, or
Cursor — pull any of them in by URL or path. The difference is what happens on arrival.
Elsewhere, an installed skill is trusted by default. In Mandolin, every import is **scanned**
for dangerous instructions (pipe-to-shell installers, `rm -rf`, credential exfiltration,
history-wiping…), lands **inert in `proposed/`** with the verdict on the label, and a skill the
scanner flags `dangerous` **cannot be promoted** without an explicit `--force` that gets recorded
in the ledger. You get the entire ecosystem's library — and you're safer with it than at the source.

```
$ mando import --demo     # no network needed — watch two skills arrive

  ✓ Clean Formatter         scan verdict: CLEAN       → proposed/clean-formatter
  ✗ Totally Legit Helper    scan verdict: DANGEROUS · 6 findings
      • environment exfiltration (line 9):  env | curl -X POST https://…
      • recursive force delete (rm -rf)   · privilege escalation (sudo)
      • pipe-to-shell installer (curl … | sh)
    This skill is quarantined. promote refuses it unless you --force.

  their skills install trusted. ours arrive scanned and inert.
```

**The loop**
```
   perceive → act → reflect → propose → (you) promote
       ↑___________________ Signature ___________________↓
```
After each session, Mandolin reflects: it sharpens your Signature *and* drafts an instinct.
The Signature update is automatic — it's just learning who you are. The instinct waits for you.

**Acting, through a gate** — `mando act "<task>"`
The same trust model, applied to actions. Mandolin can read files, list directories, write files,
run shell commands, and fetch URLs — but **reading inside your project is the only thing it does
freely.** Writing, running, and network access are denied by default; each one either needs a
standing grant (`mando grant exec`) or your in-the-moment yes. Every action it takes — and every
one you stop — is written to `actions.md`. Run `mando act` with no model key to watch the gate
work offline: it really runs the harmless command, and really refuses the destructive one.

---

## The command surface

Deliberately small. Depth over breadth.

| command | what it does |
|---|---|
| `mando` | the lay of the land |
| `mando init` | establish your Signature + local home |
| `mando demo` | watch the loop turn — offline, 20 seconds |
| `mando act <task>` | put it to work with tools, through the gate |
| `mando chat [msg]` | talk to it — operates from your Signature |
| `mando signature` | read the compounding model of you |
| `mando recall <query>` | ask your memory — ranked by meaning, not grep |
| `mando skills` | trusted instincts + what's proposed |
| `mando import <url\|file>` | pull in any ecosystem skill — scanned, quarantined |
| `mando promote <name>` | sign off — make a proposed instinct trusted |
| `mando grant <cap>` | let it act unprompted (write/exec/network) |
| `mando reflect` | distill the latest session by hand |
| `mando model [name]` | swap the model / provider |
| `mando status` | where things stand |
| `mando ledger` | the audit trail of what you trusted |

---

## Model-agnostic

Default is Claude. **10 providers** out of the box — swap with one line, no code changes, no
lock-in. Everything except Anthropic and Ollama speaks the OpenAI-compatible API, so adding a
provider is a base URL, not a new SDK.

```bash
mando model claude-opus-4-8          # a different Claude
mando model groq llama-3.3-70b       # Groq
mando model google gemini-2.5-pro    # Google Gemini
mando model openrouter <any-model>   # OpenRouter — 200+ models
mando model ollama llama3.3          # fully local, no key, nothing leaves the machine
mando model list                     # see all providers + which have keys
```

Anthropic · OpenAI · Ollama · Google Gemini · Groq · Mistral · DeepSeek · Together · OpenRouter · xAI

---

## Everything is yours

- **Self-hosted.** It lives in `~/.mandolin`. No account, no cloud, no telemetry.
- **Inspectable.** Signature, memory, instincts, ledger — all plain text. `cat` it, `grep` it,
  `git` it, delete it.
- **Portable.** Commit `~/.mandolin` to a private repo and your agent's whole self moves with you.
- **Lean.** Zero runtime dependencies. The model API is just HTTPS; we call it with `fetch`.

---

## Status

v0.1, honest about itself:

- **Live:** the Signature, file-based memory, the proposed→trusted instinct gate with digests +
  ledger, **ecosystem skill import with a quarantine scanner** (`mando import`), the reflection
  loop (LLM-driven with a key; deterministic offline), **gated tool execution**
  (read/write/shell/fetch behind a capability gate + `actions.md` audit log) with a real agentic
  loop, model-agnostic providers (Anthropic / OpenAI-compatible / Ollama), and the offline `demo`,
  `act`, and `import` rehearsals.
- **Next:** the always-on gateway for messaging channels (Telegram/Discord/Slack/…), richer
  semantic recall (re-ranking, larger synonym corpus), per-tool path scoping for writes, and a
  published `npm` / `npx mando` build.

---

## Prior art

Mandolin stands on ideas the open-source community made normal: agents whose memory is a file
you can read, and that distill their own experience into reusable skills. We're grateful for
that wave — and we pointed it somewhere new: at *taste*, and at *trust*. This is original code,
not a fork.

## License

MIT. Build on it, ship it, make it yours.

<div align="center">
<sub>made by <a href="https://gomandolin.com">Mandolin</a> · the smallest cut, the largest upside</sub>
</div>
