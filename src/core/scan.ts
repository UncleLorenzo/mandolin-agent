// scan.ts — the quarantine scanner.
//
// Hermes' single loudest criticism is skill-poisoning: community skills arrive
// installable, and elevating trust means a PR to their core repo. Mandolin's
// answer is to treat every imported skill as untrusted input — scan it for
// dangerous instructions, surface the verdict loudly, and keep it inert in
// `proposed/` until a human signs off.
//
// Honest framing: this is a heuristic tripwire, not a sandbox or a guarantee.
// Its job is to make danger *visible* before you promote. The human gate is the
// real defense; this just makes sure you're never deciding blind.

export type Severity = "clean" | "caution" | "dangerous";

export type Finding = {
  severity: "caution" | "dangerous";
  label: string;
  line: number;
  excerpt: string;
};

export type ScanResult = { verdict: Severity; findings: Finding[] };

type Rule = { re: RegExp; severity: "caution" | "dangerous"; label: string };

// Patterns a legitimate "how-to" skill almost never needs — and that a poisoned
// one reaches for. Ordered roughly by how loud they should be.
const RULES: Rule[] = [
  { re: /\brm\s+-[rf]{1,2}\b/i, severity: "dangerous", label: "recursive force delete (rm -rf)" },
  { re: /\bsudo\b/i, severity: "dangerous", label: "privilege escalation (sudo)" },
  { re: /(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i, severity: "dangerous", label: "pipe-to-shell installer (curl … | sh)" },
  { re: /base64\s+(-d|--decode)[^\n]*\|\s*(sh|bash|zsh)/i, severity: "dangerous", label: "obfuscated payload (base64 | sh)" },
  { re: />\s*\/dev\/(tcp|udp)\//i, severity: "dangerous", label: "reverse shell (/dev/tcp)" },
  { re: /\b(id_rsa|authorized_keys|\.ssh\/)/i, severity: "dangerous", label: "SSH key access" },
  { re: /(\.aws\/|aws_secret_access_key|\.netrc)/i, severity: "dangerous", label: "cloud credential access" },
  { re: /\/etc\/(passwd|shadow)\b/i, severity: "dangerous", label: "system credential file access" },
  { re: /\b(env|printenv)\b[^\n]*\|\s*(curl|wget|nc|netcat)/i, severity: "dangerous", label: "environment exfiltration" },
  { re: /(history\s+-c|rm\s+[^\n]*\.(bash|zsh)_history)/i, severity: "dangerous", label: "covers its tracks (clears shell history)" },
  { re: /\bdd\b[^\n]*\bof=\/dev\/(disk|sd|nvme|rdisk)/i, severity: "dangerous", label: "raw disk overwrite (dd of=/dev/…)" },
  { re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:/, severity: "dangerous", label: "fork bomb" },
  { re: /\bmkfs(\.\w+)?\b|\bdiskutil\s+(erase|reformat)/i, severity: "dangerous", label: "filesystem format/erase" },
  { re: /\bchmod\s+[ug]?\+s\b|\bchmod\s+[0-7]*[4-7][0-7]{3}\b/i, severity: "dangerous", label: "setuid bit (privilege backdoor)" },
  { re: /\beval\s+["']?\$\((curl|wget)/i, severity: "dangerous", label: "eval of remote output (eval $(curl …))" },
  { re: /(pip|pip3|npm|gem|cargo)\s+install\s+[^\n]*(--index-url|--extra-index-url|http:\/\/|git\+)/i, severity: "dangerous", label: "package install from an untrusted source" },
  { re: /\b(osascript|powershell|cmd\.exe)\b[^\n]*(-e|-enc|-c|hidden)/i, severity: "dangerous", label: "scripted OS automation (osascript/powershell)" },
  { re: /\b(spctl\s+--master-disable|csrutil\s+disable|defender|setenforce\s+0|ufw\s+disable|iptables\s+-F)/i, severity: "dangerous", label: "disables a security control" },
  { re: /\b(launchctl\s+(load|bootstrap)|systemctl\s+(start|enable))\b[^\n]*(\/tmp\/|\bcurl\b)/i, severity: "dangerous", label: "persists a fetched payload" },
  { re: /\bkeychain\b|\bsecurity\s+(find|dump)-(generic|internet)-password/i, severity: "dangerous", label: "macOS keychain credential access" },
  { re: /\b(ANTHROPIC|OPENAI|AWS|GITHUB|GOOGLE|GROQ|MISTRAL)_[A-Z_]*KEY\b/, severity: "caution", label: "references an API key by name" },
  { re: /\beval\s*\(|\beval\s+["'$]/i, severity: "caution", label: "dynamic eval of a string" },
  { re: /\bchmod\s+(-R\s+)?777\b/i, severity: "caution", label: "world-writable permissions (chmod 777)" },
  { re: /\b(nc|netcat)\s+-[a-z]*l/i, severity: "caution", label: "opens a raw network listener (netcat)" },
  { re: /\b(crontab|launchctl|systemctl\s+enable)\b/i, severity: "caution", label: "installs persistence (cron/launchd/systemd)" },
  { re: /\bgit\s+push\b[^\n]*--force/i, severity: "caution", label: "force-pushes to git" },
];

const rank: Record<Severity, number> = { clean: 0, caution: 1, dangerous: 2 };

/** Scan raw skill text. Returns the worst verdict found and every finding. */
export function scan(text: string): ScanResult {
  const findings: Finding[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        findings.push({
          severity: rule.severity,
          label: rule.label,
          line: i + 1,
          excerpt: line.trim().slice(0, 80),
        });
      }
    }
  });
  let verdict: Severity = "clean";
  for (const f of findings) if (rank[f.severity] > rank[verdict]) verdict = f.severity;
  return { verdict, findings };
}
