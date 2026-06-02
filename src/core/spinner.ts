// spinner.ts — a tiny live "working" indicator. Zero deps, TTY-aware.
//
// Agentic turns (think → call tools → think) can't always stream partial text,
// so the next best "this is alive" signal is a spinner that shows the agent is
// working and on what. Honors non-TTY (CI, pipes) by going silent.

import { dim, paint, palette } from "../brand.ts";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export type Spinner = { update: (label: string) => void; stop: (final?: string) => void };

export function spinner(initial = "thinking"): Spinner {
  const tty = process.stdout.isTTY && !process.env.MANDOLIN_NO_SPINNER;
  let label = initial;
  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const draw = () => {
    const frame = paint(FRAMES[i = (i + 1) % FRAMES.length], palette.teal);
    process.stdout.write(`\r   ${frame} ${dim(paint(label, palette.ash))}\x1b[K`);
  };

  if (tty) {
    draw();
    timer = setInterval(draw, 80);
  }

  return {
    update(next: string) {
      label = next;
      if (!tty) return;
    },
    stop(final?: string) {
      if (timer) clearInterval(timer);
      if (tty) process.stdout.write("\r\x1b[K"); // clear the spinner line
      if (final) process.stdout.write(final);
    },
  };
}
