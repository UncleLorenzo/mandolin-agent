// promote.ts — the moment of consent. A proposed instinct becomes trusted only
// here, by your hand. This is the whole trust model in one command.

import { wordmark, rule, frame, tone, dim, bold, mark, palette, paint } from "../brand.ts";
import { list, promote, DangerousSkillError } from "../core/skills.ts";

export function promoteCmd(args: string[]): void {
  const force = args.includes("--force");
  const slug = args.find((a) => !a.startsWith("--"));
  const proposed = list("proposed");
  if (!proposed.length) {
    process.stdout.write(`\n   ${mark.pending} ${tone.cream("Nothing proposed right now.")}\n\n`);
    return;
  }
  if (!slug) {
    const out: string[] = ["", `   ${wordmark()} ${dim(tone.ash("· promote"))}`, `   ${rule(46)}`, ""];
    out.push(`   ${tone.cream("Which instinct should become trusted?")}`, "");
    for (const s of proposed) {
      const tag = s.scan === "dangerous" ? paint(" ⚠ dangerous", palette.magenta) : s.scan === "caution" ? tone.gold(" · caution") : "";
      out.push(`   ${mark.pending} ${tone.gold(slugOf(s.name))}${tag}  ${dim(tone.ash(s.description))}`);
    }
    out.push("", `   ${dim(tone.ash("then:"))} ${tone.teal("mando promote <name>")}`, "");
    process.stdout.write(out.join("\n") + "\n");
    return;
  }

  try {
    const s = promote(slug, force);
    const card = [
      `${mark.signed} ${bold(paint("TRUSTED", palette.orange))}  ${dim(tone.ash(`signed ${s.promoted}`))}`,
      "",
      `${tone.cream(s.name)}`,
      `${dim(tone.ash(`digest ${s.digest} · logged to ledger.md`))}`,
    ];
    process.stdout.write(
      "\n" + frame(card).split("\n").map((l) => `   ${l}`).join("\n") +
      `\n\n   ${dim(tone.ash("Mandolin will now act on this instinct. Revoke any time by deleting the file."))}\n\n`
    );
  } catch (e) {
    if (e instanceof DangerousSkillError) {
      const card = [
        `${paint("✗ BLOCKED", palette.magenta)}  ${dim(tone.ash("the scanner flagged this as dangerous"))}`,
        "",
        `${tone.cream(`"${slug}" contains instructions Mandolin won't trust on your say-so alone.`)}`,
        `${dim(tone.ash("Read it: "))}${tone.teal(`~/.mandolin/skills/proposed/${slug}/SKILL.md`)}`,
        "",
        `${dim(tone.ash("If you've read it and accept the risk:"))}`,
        `${tone.gold(`mando promote ${slug} --force`)}`,
      ];
      process.stdout.write("\n" + frame(card).split("\n").map((l) => `   ${l}`).join("\n") + "\n\n");
    } else {
      process.stdout.write(`\n   ${paint("✗", palette.magenta)} ${tone.cream((e as Error).message)}\n\n`);
    }
  }
}

function slugOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
