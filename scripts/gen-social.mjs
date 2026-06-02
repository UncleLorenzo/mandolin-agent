// Renders media/social.png — the elite, coder-oriented link-preview card.
// 1280x640 (GitHub social-preview spec; also great for iMessage/Twitter/Slack).
//
// This is a build-time asset generator, kept OUT of the package's deps to honor
// the zero-runtime-dependency promise. To regenerate the card:
//
//   mkdir -p /tmp/og/fonts && cd /tmp/og && npm init -y && npm i @napi-rs/canvas
//   curl -sL -o fonts/Fraunces.ttf        "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
//   curl -sL -o fonts/Fraunces-Italic.ttf "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
//   curl -sL -o fonts/JetBrainsMono.ttf   "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
//   cp <repo>/scripts/gen-social.mjs . && node gen-social.mjs <repo>/media/social.png

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(join(here, "fonts/Fraunces.ttf"), "Fraunces");
GlobalFonts.registerFromPath(join(here, "fonts/Fraunces-Italic.ttf"), "FrauncesItalic");
GlobalFonts.registerFromPath(join(here, "fonts/JetBrainsMono.ttf"), "JBMono");

const W = 1280, H = 640;
const c = createCanvas(W, H);
const x = c.getContext("2d");

// palette
const BG = "#070a0e", BONE = "#efe7d6", CREAM = "#f3ecda", GOLD = "#e6c389",
      TEAL = "#39b8c4", ORANGE = "#ff8a3d", MAGENTA = "#ff3d77", ASH = "#8b8b93", DIM = "#4b525c";

// ---- base ----
x.fillStyle = BG;
x.fillRect(0, 0, W, H);

// corner glows (teal left, orange right) — the Miami-fluid energy, restrained
function glow(cx, cy, r, color, alpha) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.globalAlpha = alpha;
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.globalAlpha = 1;
}
glow(150, 300, 620, TEAL, 0.14);
glow(1180, 470, 520, ORANGE, 0.10);

// faint dot grid (coder texture)
x.fillStyle = "rgba(255,255,255,0.035)";
for (let gx = 40; gx < W; gx += 34) {
  for (let gy = 120; gy < H - 60; gy += 34) {
    x.beginPath();
    x.arc(gx, gy, 1, 0, Math.PI * 2);
    x.fill();
  }
}

// ---- right-side monogram: an oversized italic "i" (the signature mark) ----
// Low-opacity gradient watermark — balances the left-heavy composition and
// echoes the gradient-italic-i in the wordmark.
{
  const mgX = 1080, mgY = 470, mgSize = 520;
  const mg = x.createLinearGradient(mgX - 80, 120, mgX + 80, 520);
  mg.addColorStop(0, TEAL);
  mg.addColorStop(0.5, CREAM);
  mg.addColorStop(1, ORANGE);
  x.globalAlpha = 0.07;
  x.fillStyle = mg;
  x.font = `italic 600 ${mgSize}px FrauncesItalic`;
  x.textAlign = "center";
  x.fillText("i", mgX, mgY);
  x.globalAlpha = 1;
  x.textAlign = "left";
}

// ---- terminal chrome strip ----
const barH = 56;
x.fillStyle = "rgba(255,255,255,0.04)";
x.fillRect(0, 0, W, barH);
x.fillStyle = "rgba(255,255,255,0.08)";
x.fillRect(0, barH, W, 1);
const dots = [MAGENTA, GOLD, TEAL];
dots.forEach((col, i) => {
  x.beginPath();
  x.arc(40 + i * 26, barH / 2, 7, 0, Math.PI * 2);
  x.fillStyle = col;
  x.fill();
});
x.font = "16px JBMono";
x.fillStyle = ASH;
x.textAlign = "center";
x.fillText("mandolin — agent", W / 2, barH / 2 + 6);
x.textAlign = "right";
x.fillStyle = DIM;
x.fillText("zsh", W - 32, barH / 2 + 6);
x.textAlign = "left";

// ---- prompt line (mono) ----
const px = 80;
let py = 168;
x.font = "26px JBMono";
x.fillStyle = TEAL;
x.fillText("›", px, py);
x.fillStyle = ASH;
x.fillText(" mando", px + 26, py);
x.fillStyle = DIM;
x.fillText(" init", px + 26 + x.measureText(" mando").width, py);

// ---- the wordmark: Mandol·i·n, gradient, italic i ----
py = 300;
const wm = "Mandol";
const wmTail = "n";
const wmSize = 132;
x.textAlign = "left";

// build the gradient across the full word width first
x.font = `600 ${wmSize}px Fraunces`;
const wPre = x.measureText(wm).width;
x.font = `italic 600 ${wmSize}px FrauncesItalic`;
const wI = x.measureText("i").width;
x.font = `600 ${wmSize}px Fraunces`;
const wTail = x.measureText(wmTail).width;
const totalW = wPre + wI + wTail;
const startX = px - 4;

const grad = x.createLinearGradient(startX, 0, startX + totalW, 0);
grad.addColorStop(0, TEAL);
grad.addColorStop(0.5, CREAM);
grad.addColorStop(1, ORANGE);

// draw "Mandol"
x.fillStyle = grad;
x.font = `600 ${wmSize}px Fraunces`;
x.fillText(wm, startX, py);
// draw italic "i"
x.font = `italic 600 ${wmSize}px FrauncesItalic`;
x.fillText("i", startX + wPre, py);
// draw "n"
x.font = `600 ${wmSize}px Fraunces`;
x.fillText(wmTail, startX + wPre + wI, py);

// blinking-cursor block after the wordmark
x.fillStyle = ORANGE;
x.fillRect(startX + totalW + 14, py - wmSize * 0.62, 18, wmSize * 0.62);

// ---- tagline (serif, understated) ----
py = 388;
x.font = "italic 34px FrauncesItalic";
x.fillStyle = BONE;
x.fillText("The agent that learns ", px, py);
const tlW = x.measureText("The agent that learns ").width;
x.fillStyle = GOLD;
x.font = "italic 34px FrauncesItalic";
x.fillText("you.", px + tlW, py);

// ---- the proof line: the trust gate, as designed chips (the coder hook) ----
// Icons are drawn as vectors (mono fonts lack ✓✗✦ glyphs → tofu otherwise).
py = 462;
x.font = "20px JBMono";

function iconCheck(cx, cy, col) {
  x.strokeStyle = col; x.lineWidth = 2.6; x.lineCap = "round"; x.lineJoin = "round";
  x.beginPath(); x.moveTo(cx - 7, cy); x.lineTo(cx - 2, cy + 6); x.lineTo(cx + 8, cy - 7); x.stroke();
}
function iconCross(cx, cy, col) {
  x.strokeStyle = col; x.lineWidth = 2.6; x.lineCap = "round";
  x.beginPath(); x.moveTo(cx - 7, cy - 7); x.lineTo(cx + 7, cy + 7);
  x.moveTo(cx + 7, cy - 7); x.lineTo(cx - 7, cy + 7); x.stroke();
}
function iconSpark(cx, cy, col) {
  x.fillStyle = col;
  for (const a of [0, Math.PI / 2]) {
    x.save(); x.translate(cx, cy); x.rotate(a);
    x.beginPath(); x.moveTo(0, -9); x.quadraticCurveTo(1.6, -1.6, 9, 0);
    x.quadraticCurveTo(1.6, 1.6, 0, 9); x.quadraticCurveTo(-1.6, 1.6, -9, 0);
    x.quadraticCurveTo(-1.6, -1.6, 0, -9); x.fill(); x.restore();
  }
}

function chip(drawIcon, iconCol, text, cx) {
  const tw = x.measureText(text).width;
  const padL = 34, padR = 18, h = 40, w = padL + tw + padR;
  const cy = py - 7;
  // pill background
  x.fillStyle = "rgba(255,255,255,0.045)";
  const r = h / 2;
  x.beginPath();
  x.moveTo(cx + r, cy - h / 2);
  x.arcTo(cx + w, cy - h / 2, cx + w, cy + h / 2, r);
  x.arcTo(cx + w, cy + h / 2, cx, cy + h / 2, r);
  x.arcTo(cx, cy + h / 2, cx, cy - h / 2, r);
  x.arcTo(cx, cy - h / 2, cx + w, cy - h / 2, r);
  x.closePath(); x.fill();
  drawIcon(cx + 19, cy, iconCol);
  x.fillStyle = BONE;
  x.fillText(text, cx + padL, py);
  return cx + w + 14;
}

let cx = px;
cx = chip(iconCheck, TEAL, "reads, in scope", cx);
cx = chip(iconCross, MAGENTA, "rm -rf, refused", cx);
cx = chip(iconSpark, ORANGE, "every skill signed", cx);

// ---- footer strip: positioning in mono ----
py = 556;
x.font = "18px JBMono";
x.fillStyle = DIM;
const tags = "self-hosted · model-agnostic · zero deps · it earns every move";
x.fillText(tags, px, py);

// bottom accent rule (gradient)
const rule = x.createLinearGradient(0, 0, W, 0);
rule.addColorStop(0, "rgba(57,184,196,0)");
rule.addColorStop(0.5, ORANGE);
rule.addColorStop(1, "rgba(255,138,61,0)");
x.fillStyle = rule;
x.fillRect(0, H - 6, W, 6);

// right-side url mark
x.font = "18px JBMono";
x.fillStyle = ASH;
x.textAlign = "right";
x.fillText("github.com/UncleLorenzo/mandolin-agent", W - 80, 556);

const png = c.toBuffer("image/png");
const out = process.argv[2] || join(here, "social.png");
writeFileSync(out, png);
console.log(`wrote ${out} — ${(png.length / 1024).toFixed(0)} KB, ${W}x${H}`);
