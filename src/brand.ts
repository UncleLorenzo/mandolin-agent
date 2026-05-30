// brand.ts — the Mandolin aesthetic, rendered in the terminal.
// Zero dependencies. Hand-rolled truecolor ANSI so the agent wears the house
// colors on every surface. If the terminal can't do color, everything degrades
// to clean monochrome.

const NO_COLOR =
  process.env.NO_COLOR != null ||
  process.env.MANDOLIN_NO_COLOR != null ||
  !process.stdout.isTTY;

/** The Mandolin palette (see the house brand). */
export const palette = {
  bg: [5, 6, 8],
  bone: [239, 231, 214],
  cream: [243, 236, 218],
  gold: [230, 195, 137],
  teal: [57, 184, 196],
  orange: [255, 138, 61],
  magenta: [255, 61, 119],
  ash: [122, 122, 130],
} as const;

type RGB = readonly [number, number, number];

const ESC = "\x1b[";
const RESET = NO_COLOR ? "" : `${ESC}0m`;

function fg([r, g, b]: RGB): string {
  return NO_COLOR ? "" : `${ESC}38;2;${r};${g};${b}m`;
}

/** Paint a string a single color. */
export function paint(text: string, color: RGB): string {
  return NO_COLOR ? text : `${fg(color)}${text}${RESET}`;
}

export function bold(text: string): string {
  return NO_COLOR ? text : `${ESC}1m${text}${RESET}`;
}

export function dim(text: string): string {
  return NO_COLOR ? text : `${ESC}2m${text}${RESET}`;
}

export function italic(text: string): string {
  return NO_COLOR ? text : `${ESC}3m${text}${RESET}`;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Smear a gradient across a string, character by character, through an
 * arbitrary list of color stops. This is the signature flourish — used on the
 * wordmark and the rules.
 */
export function gradient(text: string, stops: RGB[] = [palette.teal, palette.cream, palette.orange]): string {
  if (NO_COLOR || stops.length === 0) return text;
  const chars = [...text];
  const n = chars.length;
  if (n === 1) return paint(text, stops[0]);
  const segments = stops.length - 1;
  return chars
    .map((ch, i) => {
      if (ch === " ") return ch;
      const p = i / (n - 1);
      const scaled = p * segments;
      const idx = Math.min(Math.floor(scaled), segments - 1);
      const t = scaled - idx;
      const a = stops[idx];
      const b = stops[idx + 1];
      const c: RGB = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
      return `${fg(c)}${ch}`;
    })
    .join("") + RESET;
}

/** The house wordmark: Mandol·i·n, gradient teal→cream→orange, the i italic. */
export function wordmark(): string {
  // gradient the whole word, italicize the single i to echo the web wordmark.
  const word = "Mandolin";
  const g = gradient(word);
  // The italic-i trick is subtle in a terminal; we lean on the gradient + weight.
  return bold(g);
}

/** A monospace eyebrow label, JetBrains-Mono energy. */
export function eyebrow(text: string): string {
  return dim(paint(`  ${text.toUpperCase()}`, palette.ash));
}

/** A thin gradient rule across the given width. */
export function rule(width = 56): string {
  return gradient("─".repeat(width));
}

/** Right-aligned key/value line, used in status surfaces. */
export function kv(key: string, value: string, keyWidth = 14): string {
  const k = dim(paint(key.padEnd(keyWidth), palette.ash));
  return `  ${k}${value}`;
}

/** A soft-cornered box around a block of (already-colored) lines. */
export function frame(lines: string[], pad = 1): string {
  const width = Math.max(...lines.map(visibleLength));
  const top = paint("╭" + "─".repeat(width + pad * 2) + "╮", palette.ash);
  const bottom = paint("╰" + "─".repeat(width + pad * 2) + "╯", palette.ash);
  const bar = paint("│", palette.ash);
  const body = lines.map((l) => {
    const gap = " ".repeat(width - visibleLength(l));
    return `${bar}${" ".repeat(pad)}${l}${gap}${" ".repeat(pad)}${bar}`;
  });
  return [top, ...body, bottom].join("\n");
}

/** Length of a string ignoring ANSI escape codes. */
export function visibleLength(s: string): number {
  return [...s.replace(/\x1b\[[0-9;]*m/g, "")].length;
}

/** Semantic helpers used throughout the CLI. */
export const tone = {
  teal: (s: string) => paint(s, palette.teal),
  gold: (s: string) => paint(s, palette.gold),
  orange: (s: string) => paint(s, palette.orange),
  magenta: (s: string) => paint(s, palette.magenta),
  cream: (s: string) => paint(s, palette.cream),
  bone: (s: string) => paint(s, palette.bone),
  ash: (s: string) => paint(s, palette.ash),
};

/** Status glyphs, colored. */
export const mark = {
  ok: paint("✓", palette.teal),
  add: paint("+", palette.teal),
  pending: paint("·", palette.gold),
  signed: paint("✦", palette.orange),
  arrow: paint("→", palette.ash),
  dot: paint("•", palette.ash),
};
