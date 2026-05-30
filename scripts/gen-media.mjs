// gen-media.mjs — generates media/demo.svg: an animated terminal that renders
// (and animates) inline in the GitHub README. No GIF tooling required.
//
// Design notes: each line fades in on a staggered, looping schedule. Base
// opacity is 1, so if a viewer doesn't run CSS animation, it degrades to a
// complete static frame rather than a blank one. Run: node scripts/gen-media.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const C = {
  teal: "#39b8c4",
  gold: "#e6c389",
  orange: "#ff8a3d",
  magenta: "#ff3d77",
  bone: "#efe7d6",
  cream: "#f3ecda",
  ash: "#8b8b93",
  dim: "#5b6068",
};

// Each line is a list of [text, color] segments. [] is a blank spacer line.
const lines = [
  [],
  [["mandolin  ", C.teal], ["show me what's here", C.cream]],
  [["  → ", C.ash], ["list_dir ", C.bone], ["(read) · .", C.dim]],
  [["  ✓ ", C.teal], ["allowed", C.teal], [" — reads inside your project are free", C.ash]],
  [],
  [["mandolin  ", C.teal], ["run something harmless", C.cream]],
  [["  → ", C.ash], ["run_shell ", C.bone], ["(exec) ", C.gold], ["· echo hello from your agent", C.dim]],
  [["  · ", C.gold], ["needs approval        ", C.ash], ["you ▸ ", C.ash], ["allow", C.teal]],
  [["  ✓ ", C.teal], ["ran: ", C.ash], ["hello from your agent", C.bone]],
  [],
  [["mandolin  ", C.teal], ["delete a directory", C.cream]],
  [["  → ", C.ash], ["run_shell ", C.bone], ["(exec) ", C.gold], ["· rm -rf ~/important-project", C.dim]],
  [["  · ", C.gold], ["needs approval        ", C.ash], ["you ▸ ", C.ash], ["deny", C.magenta]],
  [["  ✗ ", C.magenta], ["blocked", C.magenta], [" — and logged to actions.md", C.ash]],
  [],
  [["most agents will run that last command.  ", C.dim], ["Mandolin won't.", C.cream]],
];

const W = 776;
const PADX = 26;
const TITLEH = 46;
const LINEH = 26;
const TOP = TITLEH + 30;
const H = TOP + lines.length * LINEH + 14;
const TOTAL = 8.6; // seconds per loop

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const css = [
  `text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;font-size:15px}`,
  `.dot{}`,
];
const texts = [];
let k = 0;
lines.forEach((segs, i) => {
  if (!segs.length) return;
  const y = TOP + i * LINEH;
  const cls = "l" + k;
  const appear = k * 0.34;
  const p0 = ((appear / TOTAL) * 100).toFixed(2);
  const p1 = (((appear + 0.5) / TOTAL) * 100).toFixed(2);
  css.push(`@keyframes ${cls}{0%{opacity:0}${p0}%{opacity:0}${p1}%{opacity:1}100%{opacity:1}}`);
  css.push(`.${cls}{opacity:1;animation:${cls} ${TOTAL}s linear infinite}`);
  const tspans = segs.map(([t, c]) => `<tspan fill="${c}">${esc(t)}</tspan>`).join("");
  texts.push(`<text x="${PADX}" y="${y}" class="${cls}" xml:space="preserve">${tspans}</text>`);
  k++;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-size="15" role="img" aria-label="Mandolin agent: the trust gate in action">
<defs>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${C.teal}"/><stop offset="0.5" stop-color="${C.cream}"/><stop offset="1" stop-color="${C.orange}"/>
</linearGradient>
<style>${css.join("")}</style>
</defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13" fill="#0a0d12" stroke="#1b2230" stroke-width="1.5"/>
<circle class="dot" cx="26" cy="24" r="6" fill="${C.magenta}"/>
<circle class="dot" cx="46" cy="24" r="6" fill="${C.gold}"/>
<circle class="dot" cx="66" cy="24" r="6" fill="${C.teal}"/>
<text x="92" y="29" fill="${C.ash}" font-size="13" xml:space="preserve">mando act</text>
<text x="${W - 26}" y="29" fill="${C.dim}" font-size="13" text-anchor="end" xml:space="preserve">~/.mandolin</text>
<rect x="1" y="${TITLEH}" width="${W - 2}" height="1.5" fill="url(#accent)" opacity="0.55"/>
${texts.join("\n")}
</svg>
`;

mkdirSync(join(root, "media"), { recursive: true });
writeFileSync(join(root, "media", "demo.svg"), svg, "utf8");
console.log(`wrote media/demo.svg (${svg.length} bytes, ${H}px tall, ${k} animated lines)`);
