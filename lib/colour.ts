// Tiny colour helpers for shading shapes (highlights, shadows, glows).

const NAMED: Record<string, string> = {
  red: "#e5484d", orange: "#f76b15", yellow: "#f5c518", gold: "#ffd700", green: "#30a46c", lime: "#7cff4f",
  blue: "#3e7bfa", navy: "#1b2a6b", cyan: "#00d2e6", teal: "#12a594", purple: "#8e4ec6", violet: "#a06cf0",
  pink: "#e93d82", magenta: "#ff2bd6", brown: "#8d5b3e", white: "#f2f4f8", grey: "#9ba1a6", gray: "#9ba1a6",
  black: "#1c2024", silver: "#c0c0c0",
};

export function parseColour(c: string | undefined): [number, number, number] | null {
  if (!c) return null;
  let s = c.trim().toLowerCase();
  s = NAMED[s] ?? s;
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].split("").map((ch) => ch + ch).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = ([r, g, b]: number[]) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

// Mix towards white (amount > 0) or black (amount < 0).
export function shade(c: string | undefined, amount: number): string {
  const rgb = parseColour(c);
  if (!rgb) return c ?? "#cccccc";
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  return toHex(rgb.map((v) => v + (target - v) * a));
}

export function normalise(c: string | undefined, fallback = "#cccccc"): string {
  const rgb = parseColour(c);
  return rgb ? toHex(rgb) : c ?? fallback;
}
