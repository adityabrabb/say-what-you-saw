import { computeFrame, type FrameObject } from "./engine";
import { ICON_GROUPS } from "./icons";
import type { Animation, ObjectType, Scene } from "./scene";

// Deterministic Recall scoring: greedy object matching, then five categories worth 20 points each.

export type Category = "objects" | "colour" | "position" | "size" | "motion";

export const CATEGORY_LABELS: Record<Category, string> = {
  objects: "Objects & count",
  colour: "Colour",
  position: "Position",
  size: "Size",
  motion: "Motion",
};

export const POINTS_PER_CATEGORY = 20;

export interface ScoreResult {
  total: number; // 0-100
  categories: Record<Category, number>; // each 0-20
  matches: { target: string; player: string }[];
  missed: string[]; // target ids with no match
  extra: string[]; // player ids with no match
}

// ---------- Colour ----------

type ColourName = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "brown" | "white" | "grey" | "black";

const NAMED: Record<string, string> = {
  red: "#ff0000", orange: "#ffa500", yellow: "#ffff00", gold: "#ffd700", green: "#008000", lime: "#00ff00",
  blue: "#0000ff", navy: "#000080", cyan: "#00ffff", teal: "#008080", purple: "#800080", violet: "#ee82ee",
  pink: "#ffc0cb", magenta: "#ff00ff", brown: "#a52a2a", white: "#ffffff", grey: "#808080", gray: "#808080",
  black: "#000000", silver: "#c0c0c0",
};

function toRgb(colour: string | undefined): [number, number, number] | null {
  if (!colour || colour === "none") return null;
  let c = colour.trim().toLowerCase();
  c = NAMED[c] ?? c;
  const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].split("").map((ch) => ch + ch).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function colourName(colour: string | undefined): ColourName {
  const rgb = toRgb(colour);
  if (!rgb) return "grey";
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;

  if (l > 0.88) return "white";
  if (l < 0.13) return "black";
  if (s < 0.15) return l > 0.7 ? "white" : l < 0.25 ? "black" : "grey";
  if (h >= 10 && h < 45 && l < 0.42) return "brown";
  if (h < 12 || h >= 345) return "red";
  if (h < 42) return "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

const NEIGHBOURS: [ColourName, ColourName][] = [
  ["red", "orange"], ["orange", "yellow"], ["red", "pink"], ["pink", "purple"], ["purple", "blue"],
  ["blue", "green"], ["yellow", "green"], ["orange", "brown"], ["red", "brown"], ["white", "grey"], ["grey", "black"],
];

function colourSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  return NEIGHBOURS.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) ? 0.4 : 0;
}

// ---------- Geometry ----------

const SHAPES: ObjectType[] = ["circle", "rect", "star", "image"];
const PICTURES: ObjectType[] = ["icon", "art"];
const pictureName = (o: { icon?: string; art?: string }) => o.icon ?? o.art ?? "";
const pictureGroup = (n: string) => ICON_GROUPS[n] ?? n;

function canMatch(a: ObjectType, b: ObjectType): boolean {
  return a === b || (SHAPES.includes(a) && SHAPES.includes(b)) || (PICTURES.includes(a) && PICTURES.includes(b));
}

function sizeOf(o: FrameObject): number {
  const s = o.scale;
  switch (o.type) {
    case "circle":
    case "star":
      return 2 * (o.r ?? 20) * s;
    case "rect":
    case "image":
      return Math.sqrt((o.w ?? 60) * (o.h ?? 40)) * s;
    case "text":
      return (o.fontSize ?? 16) * s * Math.max(1, (o.text ?? "").length) * 0.6;
    case "icon":
      return (o.w ?? 80) * s;
    case "art":
      return Math.sqrt((o.w ?? 120) * (o.h ?? o.w ?? 120)) * s;
    case "arrow":
      return Math.hypot((o.x2 ?? o.x + 60) - o.x, (o.y2 ?? o.y) - o.y);
  }
}

const fillOf = (o: FrameObject) => (o.fill && o.fill !== "none" ? o.fill : o.stroke);

// ---------- Motion ----------

interface Motion {
  kinds: Set<Animation["action"]>;
  moveDir?: [number, number];
  fadeOut?: boolean;
  orbitDir?: number;
  growDir?: number;
}

function motionOf(scene: Scene, o: FrameObject): Motion {
  const anims = scene.timeline.filter((a) => a.target === o.id);
  const m: Motion = { kinds: new Set(anims.map((a) => a.action)) };
  for (const a of anims) {
    if (a.action === "move") {
      const len = Math.hypot(a.to.x - o.x, a.to.y - o.y) || 1;
      m.moveDir = [(a.to.x - o.x) / len, (a.to.y - o.y) / len];
    } else if (a.action === "fade") m.fadeOut = a.to < (scene.objects.find((x) => x.id === o.id)?.opacity ?? 1);
    else if (a.action === "orbit") m.orbitDir = Math.sign(a.turns);
    else if (a.action === "grow") m.growDir = Math.sign(a.to - (scene.objects.find((x) => x.id === o.id)?.scale ?? 1));
  }
  return m;
}

function motionSimilarity(a: Motion, b: Motion): number {
  const union = new Set([...a.kinds, ...b.kinds]);
  if (union.size === 0) return 1;
  let sum = 0;
  for (const k of union) {
    if (!a.kinds.has(k) || !b.kinds.has(k)) continue;
    let s = 1;
    if (k === "move" && a.moveDir && b.moveDir) {
      const cos = a.moveDir[0] * b.moveDir[0] + a.moveDir[1] * b.moveDir[1];
      s = cos > 0.7 ? 1 : cos > 0 ? 0.5 : 0.2;
    }
    if (k === "fade" && a.fadeOut !== b.fadeOut) s = 0.4;
    if (k === "orbit" && a.orbitDir !== b.orbitDir) s = 0.7; // direction is hard to tell in 2 seconds
    if (k === "grow" && a.growDir !== b.growDir) s = 0.4;
    sum += s;
  }
  return sum / union.size;
}

// ---------- Position ----------

const DEADZONE = 40;
const rel = (d: number) => (Math.abs(d) < DEADZONE ? 0 : Math.sign(d));
const relAgreement = (a: number, b: number) => (a === b ? 1 : a === 0 || b === 0 ? 0.5 : 0);

// ---------- Main ----------

export function scoreScenes(target: Scene, player: Scene): ScoreResult {
  const T = computeFrame(target, 0);
  const P = computeFrame(player, 0);
  const tColour = new Map(T.map((o) => [o.id, colourName(fillOf(o))]));
  const pColour = new Map(P.map((o) => [o.id, colourName(fillOf(o))]));

  // Greedy matching: best type, then colour, then closest position.
  // A different shape only counts as the same object if the colour is exactly right,
  // so a pink star can't pass itself off as a red circle.
  const candidates: { t: FrameObject; p: FrameObject; type: number; colour: number; dist: number }[] = [];
  for (const t of T)
    for (const p of P) {
      if (!canMatch(t.type, p.type)) continue;
      // Icons have no fill colour; compare what they depict instead.
      const colour = PICTURES.includes(t.type)
        ? pictureName(t) === pictureName(p)
          ? 1
          : pictureGroup(pictureName(t)) === pictureGroup(pictureName(p))
            ? 0.6
            : 0
        : colourSimilarity(tColour.get(t.id)!, pColour.get(p.id)!);
      if (t.type !== p.type && colour < 1) continue; // a different kind of thing must at least be the same name/colour
      candidates.push({ t, p, type: t.type === p.type ? 1 : 0, colour, dist: Math.hypot(t.x - p.x, t.y - p.y) });
    }
  candidates.sort((a, b) => b.type - a.type || b.colour - a.colour || a.dist - b.dist);

  const usedT = new Set<string>();
  const usedP = new Set<string>();
  const pairs: (typeof candidates[number] & { weight: number })[] = [];
  for (const c of candidates) {
    if (usedT.has(c.t.id) || usedP.has(c.p.id)) continue;
    usedT.add(c.t.id);
    usedP.add(c.p.id);
    // How confident we are this is "the same object": right shape and right colour = 1.
    const typeFactor = c.type ? 1 : 0.6;
    pairs.push({ ...c, weight: typeFactor * (0.25 + 0.75 * c.colour) });
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  // Sum of per-target-object credit, divided by how many objects the target has. Misses count as 0.
  const perTarget = (xs: number[]) => (T.length ? xs.reduce((a, b) => a + b, 0) / T.length : 0);
  const quality = perTarget(pairs.map((c) => c.weight));

  // Objects & count: F1 of matches, so both misses and extras cost points.
  // Right shape in the wrong colour is only half-remembered.
  const typeCredit = pairs.reduce((sum, c) => sum + (c.type ? 0.5 + 0.5 * c.colour : 0.3), 0);
  const objects = T.length + P.length ? (2 * typeCredit) / (T.length + P.length) : 1;

  const colour = perTarget(pairs.map((c) => c.colour * (c.type ? 1 : 0.6)));

  const size = perTarget(
    pairs.map((c) => {
      const a = sizeOf(c.t);
      const b = sizeOf(c.p);
      const ratio = Math.min(a, b) / Math.max(a, b, 1);
      return Math.min(1, ratio / 0.85) ** 2 * c.weight; // within 15% is full marks
    })
  );

  // Position: mostly "is A above/left of B" agreement, a little absolute placement.
  const absolute = avg(pairs.map((c) => 1 - Math.min(1, c.dist / 300)));
  let relative = absolute;
  if (pairs.length >= 2) {
    const agreements: number[] = [];
    for (let i = 0; i < pairs.length; i++)
      for (let j = i + 1; j < pairs.length; j++) {
        const [a, b] = [pairs[i], pairs[j]];
        const h = relAgreement(rel(b.t.x - a.t.x), rel(b.p.x - a.p.x));
        const v = relAgreement(rel(b.t.y - a.t.y), rel(b.p.y - a.p.y));
        agreements.push((h + v) / 2);
      }
    relative = 0.75 * avg(agreements) + 0.25 * absolute;
  }
  const position = relative * quality;

  // Motion: judged on every target object that moves, plus matched ones the player made move.
  const pairByT = new Map(pairs.map((c) => [c.t.id, c]));
  const motionScores: number[] = [];
  for (const t of T) {
    const tm = motionOf(target, t);
    const pair = pairByT.get(t.id);
    if (!pair) {
      if (tm.kinds.size) motionScores.push(0);
      continue;
    }
    const pm = motionOf(player, pair.p);
    if (tm.kinds.size || pm.kinds.size) motionScores.push(motionSimilarity(tm, pm) * pair.weight);
  }
  // A still scene earns motion points only for objects genuinely recalled.
  const motion = motionScores.length ? avg(motionScores) : quality;

  const pts = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * POINTS_PER_CATEGORY);
  const categories: Record<Category, number> = {
    objects: pts(objects),
    colour: pts(colour),
    position: pts(position),
    size: pts(size),
    motion: pts(motion),
  };

  return {
    total: Object.values(categories).reduce((a, b) => a + b, 0),
    categories,
    matches: pairs.map((c) => ({ target: c.t.id, player: c.p.id })),
    missed: T.filter((o) => !usedT.has(o.id)).map((o) => o.id),
    extra: P.filter((o) => !usedP.has(o.id)).map((o) => o.id),
  };
}

// ---------- Verdicts ----------

const VERDICTS: [number, string[]][] = [
  [95, ["Photographic memory. Are you a camera?", "Flawless. The scene called, it wants its pixels back.", "Did you screenshot that? Be honest."]],
  [80, ["Sharp eyes, silver tongue.", "Nearly perfect. Your brain has good RAM.", "Witnesses like you win court cases."]],
  [60, ["Solid. A little blurry around the edges.", "You saw it. You mostly said it.", "Good effort. Your memory needs a firmware update."]],
  [40, ["You were there. Spiritually.", "Half right, which is also half wrong.", "Impressionist art. Monet would approve."]],
  [20, ["Did you blink for the whole thing?", "That's a scene. Just not THE scene.", "Bold reinterpretation of the source material."]],
  [0, ["Were your eyes even open?", "Absolute fiction. Have you considered writing novels?", "The scene is filing a missing persons report."]],
];

export function verdictFor(score: number, seed: number): string {
  const lines = VERDICTS.find(([min]) => score >= min)![1];
  return lines[Math.abs(seed) % lines.length];
}

// Human name for an object, used to list misses on the reveal ("robot", "red circle", "text HELLO").
export function describeObject(o: { type: string; icon?: string; art?: string; fill?: string; stroke?: string; text?: string }): string {
  if (o.type === "icon" || o.type === "art") return (o.icon ?? o.art ?? "thing").replace(/-/g, " ");
  if (o.type === "text") return `“${o.text ?? ""}”`;
  const colour = colourName(o.fill && o.fill !== "none" ? o.fill : o.stroke);
  const shape = o.type === "rect" ? "square" : o.type;
  return `${colour} ${shape}`;
}
