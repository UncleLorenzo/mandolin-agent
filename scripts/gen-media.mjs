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
  [],
  [["— and the same gate guards every skill you import —", C.ash]],
  [],
  [["mando import ", C.bone], ["community-hub/totally-legit-helper", C.dim]],
  [["  ✗ ", C.magenta], ["DANGEROUS", C.magenta], [" · 6 findings · ", C.ash], ["quarantined in proposed/", C.gold]],
  [["    env | curl exfil · rm -rf · sudo · curl | bash", C.dim]],
  [["  their skills install trusted.  ", C.dim], ["ours arrive scanned and inert.", C.cream]],
  [],
  [["— and it recalls by meaning, not grep —", C.ash]],
  [],
  [["mando recall ", C.bone], ['"how do we handle payments?"', C.dim]],
  [["  → ", C.teal], ["We integrate Stripe for subscriptions; invoices on the 1st.", C.bone]],
  [['    "payment" was never written — ', C.dim], ["bridged by meaning.", C.cream]],
];

const W = 776;
const PADX = 26;
const TITLEH = 46;
const LINEH = 26;
const TOP = TITLEH + 30;
const H = TOP + lines.length * LINEH + 14;
const TOTAL = 14; // seconds per loop

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

// ---- banner.svg : the README hero wordmark ----
const BW = 1200, BH = 300, cx = BW / 2;
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="${BW}" height="${BH}" viewBox="0 0 ${BW} ${BH}" role="img" aria-label="Mandolin — the agent that learns you">
<defs>
<linearGradient id="wm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.teal}"/><stop offset="0.5" stop-color="${C.cream}"/><stop offset="1" stop-color="${C.orange}"/></linearGradient>
<linearGradient id="rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.teal}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.cream}"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></linearGradient>
<radialGradient id="glowL" cx="0.3" cy="0.5" r="0.65"><stop offset="0" stop-color="${C.teal}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></radialGradient>
<radialGradient id="glowR" cx="0.72" cy="0.5" r="0.65"><stop offset="0" stop-color="${C.orange}" stop-opacity="0.15"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${BW}" height="${BH}" rx="22" fill="#070a0e"/>
<rect width="${BW}" height="${BH}" rx="22" fill="url(#glowL)"/>
<rect width="${BW}" height="${BH}" rx="22" fill="url(#glowR)"/>
<rect x="0.75" y="0.75" width="${BW - 1.5}" height="${BH - 1.5}" rx="22" fill="none" stroke="#141b26"/>
<text x="${cx}" y="162" text-anchor="middle" fill="url(#wm)" font-family="'Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif" font-size="110" font-weight="700" letter-spacing="-1">Mandol<tspan font-style="italic">i</tspan>n</text>
<rect x="${cx - 160}" y="188" width="320" height="2" fill="url(#rule)"/>
<text x="${cx}" y="226" text-anchor="middle" fill="#9aa0a8" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="17" letter-spacing="7">THE AGENT THAT LEARNS YOU</text>
</svg>
`;

mkdirSync(join(root, "media"), { recursive: true });
writeFileSync(join(root, "media", "demo.svg"), svg, "utf8");
writeFileSync(join(root, "media", "banner.svg"), banner, "utf8");
console.log(`wrote media/demo.svg (${svg.length} bytes) and media/banner.svg (${banner.length} bytes)`);
