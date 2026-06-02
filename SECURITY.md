# Security

Mandolin's whole premise is that an agent should be *trustworthy by construction*. This is
the threat model, not boilerplate.

## Reporting a vulnerability
Open a private [GitHub Security Advisory](https://github.com/UncleLorenzo/mandolin-agent/security/advisories/new),
or email security@gomandolin.com. Please don't file public issues for security reports. We
aim to acknowledge within a few days.

## The trust model
- **Capability gate.** Tools are classed by risk. Reads inside your project run freely;
  `write`, `exec`, and `network` are denied by default and require either a standing grant
  (`mando grant <cap>`) or an in-the-moment approval. There is no "yolo" mode.
- **Per-path write scoping.** A `write` grant is not a blank cheque. Writes only auto-proceed
  inside your write scope (`mando scope`); paths outside it fall back to asking, and a deny-list
  of high-value targets (`.ssh`, `.env`, shell rc, `.aws`, `.gnupg`, `.git` internals, launch
  agents) **always** asks — no standing grant can touch them. This blunts skill-poisoning and
  prompt-injection that aim to plant a backdoor or exfiltrate keys.
- **Command scanning on exec.** An `exec` grant covers ordinary commands, but the same scanner
  that quarantines poisoned skills inspects every shell command: a *dangerous* one (`rm -rf`,
  `sudo`, `curl … | sh`, reverse shells, key/credential access, history-wiping) **always** falls
  back to asking, grant or not. A grant is never a licence to wreck the box.
- **Audit log.** Every action — allowed *or* denied — is appended to `~/.mandolin/actions.md`.
- **No silent learning.** Distilled skills land in `skills/proposed/` and do nothing until
  you `mando promote` them. Promotion records a content digest; a trusted skill whose body
  no longer matches its digest is flagged as tampered.
- **Signed provenance.** Promotion also signs the skill body with your **Ed25519** identity key.
  `verifySignature` distinguishes `signed` (by a key you trust) from `untrusted-signer`,
  `bad-signature`, and `unsigned` — so a forged or stranger-signed skill can't pass as yours.
  The private key lives in `~/.mandolin/identity/key.pem` (mode 0600), is gitignored, and is
  never exported, logged, or sent anywhere.

## Secrets
- Model API keys are read from environment variables only. They are never written to the
  Signature, memory, skills, or the audit log.
- `.env` is gitignored. Your `~/.mandolin` home is yours — commit it to a *private* repo if
  you want history; never a public one.

## Known limitations (be aware)
- The command/skill scanner is a heuristic tripwire, not a sandbox: it catches the known-dangerous
  patterns it knows about and makes them visible, but a novel or heavily-obfuscated command could
  scan "clean." Your in-the-moment approval is the real gate; grant `exec` deliberately and revoke
  with `mando revoke exec`.
- A proposed skill is unreviewed input until you read and promote it. Treat it as such.
- `forget` records the *search term* in the audit receipt (proof of erasure); if the term itself
  is sensitive, scrub `actions.md` too.

## Scope
Mandolin is a personal, self-hosted tool. It is not yet hardened for multi-tenant or
regulated production use. Run it as you.
