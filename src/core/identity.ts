// identity.ts — who vouched for this, provably.
//
// The digest already makes a trusted skill tamper-evident: change the body and
// the hash no longer matches. But a digest answers "was this altered?", not "who
// stood behind it?" Provenance needs a signature.
//
// On first use Mandolin mints an Ed25519 keypair — your identity. Promoting a
// skill signs its body with your private key. Anyone with your public key can
// then verify a skill is byte-for-byte what you signed AND that you (not a
// poisoned hub, not a man-in-the-middle) signed it. Forgery needs your private
// key, which never leaves `~/.mandolin/identity/`.
//
// Real cryptography, zero dependencies — Ed25519 is built into node:crypto.

import { generateKeyPairSync, sign as edSign, verify as edVerify, createPublicKey, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { paths } from "../home.ts";

/** Ensure an identity keypair exists; mint one on first use. Returns the public PEM. */
export function ensureIdentity(): string {
  if (!existsSync(paths.identity())) mkdirSync(paths.identity(), { recursive: true });
  if (!existsSync(paths.privateKey())) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    writeFileSync(paths.privateKey(), privateKey.export({ type: "pkcs8", format: "pem" }) as string, "utf8");
    writeFileSync(paths.publicKey(), publicKey.export({ type: "spki", format: "pem" }) as string, "utf8");
    try {
      chmodSync(paths.privateKey(), 0o600); // private key: owner-only
    } catch {
      /* best effort on platforms without POSIX perms */
    }
  }
  return readFileSync(paths.publicKey(), "utf8");
}

export function hasIdentity(): boolean {
  return existsSync(paths.privateKey());
}

export function publicKeyPem(): string {
  return ensureIdentity();
}

/** A short, human-readable fingerprint of a public key. */
export function fingerprint(pubPem: string): string {
  return createHash("sha256").update(pubPem.trim()).digest("hex").slice(0, 16);
}

/** Your own identity fingerprint. */
export function myFingerprint(): string {
  return fingerprint(publicKeyPem());
}

/** Sign a message with your private key. Returns base64. */
export function signMessage(message: string): string {
  ensureIdentity();
  const key = readFileSync(paths.privateKey(), "utf8");
  return edSign(null, Buffer.from(message, "utf8"), key).toString("base64");
}

/** Verify a signature against a given public key PEM. */
export function verifyMessage(message: string, signatureB64: string, pubPem: string): boolean {
  try {
    const pub = createPublicKey(pubPem);
    return edVerify(null, Buffer.from(message, "utf8"), pub, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

// ---- trusted keys (for skills signed by others) ----------------------------

type TrustedKeys = Record<string, { pem: string; label: string; added: string }>; // fingerprint -> key

function loadTrusted(): TrustedKeys {
  if (existsSync(paths.trustedKeys())) {
    try {
      return JSON.parse(readFileSync(paths.trustedKeys(), "utf8"));
    } catch {
      /* fall through */
    }
  }
  return {};
}

function saveTrusted(t: TrustedKeys): void {
  writeFileSync(paths.trustedKeys(), JSON.stringify(t, null, 2) + "\n", "utf8");
}

/** Trust a public key so skills signed by it verify. (Your own key is always trusted.) */
export function trustKey(pubPem: string, label: string, today: string): string {
  const fp = fingerprint(pubPem);
  const t = loadTrusted();
  t[fp] = { pem: pubPem.trim(), label, added: today };
  saveTrusted(t);
  return fp;
}

/** Resolve a public key PEM for a fingerprint — your own, or a trusted one. */
export function resolveKey(fp: string): string | undefined {
  if (hasIdentity() && fp === myFingerprint()) return publicKeyPem();
  return loadTrusted()[fp]?.pem;
}

export function listTrustedKeys(): { fingerprint: string; label: string; added: string }[] {
  const t = loadTrusted();
  const mine = hasIdentity() ? [{ fingerprint: myFingerprint(), label: "you (this machine)", added: "—" }] : [];
  return [...mine, ...Object.entries(t).map(([fingerprint, v]) => ({ fingerprint, label: v.label, added: v.added }))];
}
