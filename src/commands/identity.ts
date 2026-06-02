// identity.ts (command) — your cryptographic identity, and whose skills you trust.

import { readFileSync, existsSync } from "node:fs";
import { wordmark, rule, frame, tone, dim, bold, mark, eyebrow, palette, paint } from "../brand.ts";
import { ensureHome } from "../home.ts";
import { ensureIdentity, publicKeyPem, myFingerprint, trustKey, listTrustedKeys, fingerprint } from "../core/identity.ts";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function identityCmd(args: string[]): void {
  ensureHome();
  const [sub, arg] = args;

  if (sub === "trust" && arg) {
    if (!existsSync(arg)) {
      process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream(`No such key file: ${arg}`)}\n\n`);
      return;
    }
    const pem = readFileSync(arg, "utf8");
    if (!/BEGIN PUBLIC KEY/.test(pem)) {
      process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream("That doesn't look like a public key PEM.")}\n\n`);
      return;
    }
    const label = args.slice(2).join(" ") || arg;
    const fp = trustKey(pem, label, today());
    process.stdout.write(`\n   ${mark.signed} ${tone.cream("now trusting ")}${tone.teal(fp)} ${dim(tone.ash(`(${label}) — skills it signed will verify`))}\n\n`);
    return;
  }

  if (sub === "export") {
    ensureIdentity();
    // Print the public key PEM to stdout so it can be piped/shared. Never the private key.
    process.stdout.write(publicKeyPem());
    return;
  }

  // default: show identity + trusted keys
  ensureIdentity();
  const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· identity"))}`, `   ${rule(50)}`, ""];
  const card = [
    `${bold(tone.cream("your signing key"))}  ${dim(tone.ash("Ed25519"))}`,
    "",
    `${mark.signed} ${tone.teal(myFingerprint())}`,
    `${dim(tone.ash("every instinct you promote is signed with this — provenance, not just a hash"))}`,
  ];
  out.push(...frame(card).split("\n").map((l) => `   ${l}`));
  out.push("");

  const keys = listTrustedKeys();
  out.push(`   ${eyebrow(`trusted signers · ${keys.length}`)}`);
  for (const k of keys) {
    out.push(`   ${mark.signed} ${tone.bone(k.fingerprint)}  ${dim(tone.ash(k.label))}`);
  }
  out.push("");
  out.push(`   ${dim(tone.ash("share your public key:"))} ${tone.teal("mando identity export > my.pub")}`);
  out.push(`   ${dim(tone.ash("trust someone's key:"))}  ${tone.teal("mando identity trust their.pub \"their name\"")}`);
  out.push(`   ${dim(tone.ash("private key stays in ~/.mandolin/identity/ — never shared, never leaves"))}`);
  out.push("");
  process.stdout.write(out.join("\n") + "\n");
}
