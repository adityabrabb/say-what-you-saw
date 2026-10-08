import { ICON_GROUPS } from "./icons";
import { SYNONYMS } from "./iconMatch";
import type { Patch, PatchOp } from "./patch";
import type { Animation, Scene, SceneObject, Video } from "./scene";

// Offline scene builder: turns a description into a scene with plain keyword parsing, no AI.
// It's the last fallback when every LLM provider is unavailable, so the game and Studio keep working.

const NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, pair: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, few: 3, several: 3,
};
const COLOURS: Record<string, string> = {
  red: "#E5484D", blue: "#3E7BFA", yellow: "#F5C518", green: "#30A46C", orange: "#F76B15", purple: "#8E4EC6", violet: "#8E4EC6",
  pink: "#E93D82", white: "#F2F4F8", grey: "#9BA1A6", gray: "#9BA1A6", silver: "#9BA1A6", brown: "#8D5B3E", black: "#1C2024",
  cyan: "#00D2E6", teal: "#12A594", gold: "#FFD700", golden: "#FFD700",
};
const SHAPES: Record<string, SceneObject["type"]> = {
  circle: "circle", circles: "circle", dot: "circle", dots: "circle", disc: "circle", orb: "circle", ball: "circle", balls: "circle",
  square: "rect", squares: "rect", rectangle: "rect", rectangles: "rect", box: "rect", boxes: "rect", block: "rect", blocks: "rect", cube: "rect",
  star: "star", stars: "star", triangle: "star", triangles: "star", arrow: "arrow", arrows: "arrow",
};
const BACKDROPS: [RegExp, string][] = [
  [/\b(space|galaxy|outer space|universe|cosmos)\b/, "space"],
  [/\b(neon|grid|arcade|synthwave|retro)\b/, "grid"],
  [/\b(city|town|skyline|buildings|night)\b/, "city"],
  [/\b(ocean|sea|beach|underwater|waves)\b/, "ocean"],
  [/\b(sky|sunny|park|outside|outdoors|field|garden|day)\b/, "sky"],
];
// Best backdrop preset for a piece of text, if any keyword fits.
export function guessBackdrop(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/(planet|moon|star|orbit|eclipse|astronaut|rocket|galaxy|solar|comet)/.test(t)) return "space";
  return BACKDROPS.find(([re]) => re.test(t))?.[1];
}

const NOT_THINGS = new Set(["sunny", "stormy", "rainy", "snowy", "starry", "cloudy", "windy", "sky", "space", "sea", "ocean", "city", "night", "grid", "neon", "background", "scene", "picture", "screen", "thing", "things", "one", "side", "top", "bottom", "middle", "centre", "center", "corner"]);
const BIG = new Set(["big", "large", "huge", "giant", "massive", "bigger", "larger"]);
const SMALL = new Set(["small", "tiny", "little", "mini", "smaller"]);
const MOVE = /^(move|moves|moving|slide|slides|sliding|fly|flies|flying|run|runs|running|chase|chases|chasing|go|goes|going|drive|drives|driving|swim|swims|swimming|roll|rolls|rolling|walk|walks|walking|zoom|zooms|travels|travelling|traveling|race|races|racing)$/;
const ORBIT = /^(orbit|orbits|orbiting|circling|circles|spinning|spins|revolves|revolving)$/;
const FADE = /^(fade|fades|fading|disappear|disappears|disappearing|vanish|vanishes|vanishing)$/;
const GROW = /^(grow|grows|growing|expand|expands|expanding|swell|swells)$/;
const FALL = /^(fall|falls|falling|drop|drops|dropping|bounce|bounces|bouncing|land|lands)$/;

interface Thing {
  kind: SceneObject["type"];
  icon?: string;
  colour?: string;
  count: number;
  size: number;
  h?: "left" | "center" | "right";
  v?: "top" | "middle" | "bottom";
  motion?: "left" | "right" | "up" | "down" | "orbit" | "fade" | "grow" | "fall";
  relation?: { kind: "above" | "below" | "left" | "right" | "around"; other: number };
}

const singular = (w: string) => w.replace(/ies$/, "y").replace(/(ses|xes|ches|shes)$/, (m) => m.slice(0, -2)).replace(/s$/, "");

// A word (or two-word phrase) that names a listed icon, without guessing at random words.
function iconFor(word: string, next?: string): { icon: string; used: number } | null {
  if (next) {
    const pair = `${word}-${next}`;
    if (pair in ICON_GROUPS) return { icon: pair, used: 2 };
    if (SYNONYMS[pair]) return { icon: SYNONYMS[pair], used: 2 };
  }
  for (const w of [word, singular(word)]) {
    if (NOT_THINGS.has(w)) return null;
    if (w in ICON_GROUPS) return { icon: w, used: 1 };
    if (SYNONYMS[w]) return { icon: SYNONYMS[w], used: 1 };
  }
  return null;
}

function parse(description: string) {
  const text = description.toLowerCase().replace(/[“”]/g, '"');
  const quoted = [...text.matchAll(/"([^"]{1,30})"|(?:saying|says|labelled|labeled|reading|written)\s+([a-z0-9!? ]{1,24})/g)].map((m) => (m[1] ?? m[2]).trim().toUpperCase());
  const words = text.replace(/"[^"]*"/g, " ").split(/[^a-z0-9-]+/).filter(Boolean);
  const things: Thing[] = [];
  let count = 1;
  let colour: string | undefined;
  let size = 1;
  let pendingRelation: NonNullable<Thing["relation"]>["kind"] | null = null;
  let pendingH: Thing["h"];
  let pendingV: Thing["v"];

  const last = () => things[things.length - 1];
  const add = (t: Omit<Thing, "count" | "size" | "colour">) => {
    const thing: Thing = { ...t, count, size, colour, h: pendingH, v: pendingV };
    if (pendingRelation && things.length) thing.relation = { kind: invert(pendingRelation), other: things.length - 1 };
    things.push(thing);
    count = 1;
    colour = undefined;
    size = 1;
    pendingRelation = null;
    pendingH = undefined;
    pendingV = undefined;
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const nx = words[i + 1];
    if (/^\d+$/.test(w)) count = Math.min(8, Number(w));
    else if (NUMBERS[w] && !(w === "one" && nx === "side")) count = NUMBERS[w];
    else if (COLOURS[w]) colour = COLOURS[w];
    else if (BIG.has(w)) size = 1.45;
    else if (SMALL.has(w)) size = 0.65;
    else if (SHAPES[w]) add({ kind: SHAPES[w] });
    else if (iconFor(w, nx)) {
      const hit = iconFor(w, nx)!;
      add({ kind: "icon", icon: hit.icon });
      i += hit.used - 1;
    } else if (w === "left" || w === "right") {
      // "left of X" is a relation; "on the left" places the last thing.
      if (nx === "of" && things.length) pendingRelation = w;
      else if (last() && !last().h) last().h = w;
      else pendingH = w;
    } else if (w === "top" || w === "above" || w === "over" || w === "up") {
      if (w === "up" && last() && words.slice(Math.max(0, i - 2), i).some((x) => MOVE.test(x))) last().motion = "up";
      else if ((w === "above" || w === "over") && things.length) pendingRelation = "above";
      else if (last() && !last().v) last().v = "top";
      else pendingV = "top";
    } else if (w === "bottom" || w === "below" || w === "under" || w === "beneath" || w === "underneath") {
      if (w !== "bottom" && things.length) pendingRelation = "below";
      else if (last() && !last().v) last().v = "bottom";
      else pendingV = "bottom";
    } else if (w === "middle" || w === "centre" || w === "center") {
      if (last() && !last().h) last().h = "center";
      else pendingH = "center";
    } else if (MOVE.test(w) && last()) {
      const dir = words.slice(i + 1, i + 5).find((x) => ["left", "right", "up", "down", "across"].includes(x));
      last().motion = dir === "left" ? "left" : dir === "up" ? "up" : dir === "down" ? "down" : "right";
    } else if ((ORBIT.test(w) || (w === "around" && last())) && last()) {
      last().motion = "orbit";
      pendingRelation = "around";
    } else if (FADE.test(w) && last()) last().motion = "fade";
    else if (GROW.test(w) && last()) last().motion = "grow";
    else if (FALL.test(w) && last()) last().motion = "fall";
  }

  const backdrop = BACKDROPS.find(([re]) => re.test(text))?.[1];
  const particles = /\b(rain|raining|rainy|storm)\b/.test(text) ? "rain" : /\b(snow|snowing|snowy)\b/.test(text) ? "snow" : /\b(sparkle|sparkles|sparkly|glitter|twinkl)/.test(text) ? "sparkle" : undefined;
  return { things, quoted, backdrop, particles: particles as Scene["particles"] };
}

// "A above B" was read when B arrived; store it on B as "B below A" so layout can place B.
function invert(kind: "above" | "below" | "left" | "right" | "around"): "above" | "below" | "left" | "right" | "around" {
  return kind === "above" ? "below" : kind === "below" ? "above" : kind === "left" ? "right" : kind === "right" ? "left" : "around";
}

const H = { left: 180, center: 400, right: 620 };
const V = { top: 115, middle: 230, bottom: 345 };

function layout(things: Thing[], textCount: number): { anchors: { x: number; y: number }[] } {
  const anchors: { x: number; y: number }[] = [];
  const free = things.filter((t) => !t.h && !t.v && !t.relation).length;
  let freeIndex = 0;
  things.forEach((t, i) => {
    let x = t.h ? H[t.h] : NaN;
    let y = t.v ? V[t.v] : NaN;
    if (t.relation && anchors[t.relation.other]) {
      const o = anchors[t.relation.other];
      const k = t.relation.kind;
      // This thing is "k" relative to the other one ("A above B": A is above).
      if (k === "below") [x, y] = [isNaN(x) ? o.x : x, Math.min(370, o.y + 180)];
      if (k === "above") {
        // Make room: push the earlier thing down and put this one on top.
        o.y = Math.max(o.y, 300);
        [x, y] = [isNaN(x) ? o.x : x, 120];
      }
      if (k === "left") [x, y] = [o.x - 220, isNaN(y) ? o.y : y];
      if (k === "right") [x, y] = [o.x + 220, isNaN(y) ? o.y : y];
      if (k === "around") [x, y] = [o.x + 150, o.y];
    }
    if (isNaN(x)) x = free ? 120 + ((freeIndex + 0.5) * 560) / free : 400;
    if (isNaN(y)) y = textCount ? 260 : 235;
    if (!t.h && !t.v && !t.relation) freeIndex++;
    anchors[i] = { x: Math.max(70, Math.min(730, x)), y: Math.max(70, Math.min(390, y)) };
  });
  return { anchors };
}

export function buildOfflineScene(description: string, mode: "recall" | "studio"): Scene {
  const { things, quoted, backdrop, particles } = parse(description);
  const { anchors } = layout(things, quoted.length);
  const objects: SceneObject[] = [];
  const timeline: Animation[] = [];
  const studio = mode === "studio";
  const t0 = studio ? 1.2 : 0.3;

  things.forEach((t, i) => {
    const a = anchors[i];
    const n = Math.max(1, t.count);
    const spacing = Math.min(130, 560 / n);
    for (let k = 0; k < n; k++) {
      const id = `${t.icon ?? t.kind}${i}${n > 1 ? `-${k}` : ""}`;
      const x = Math.max(60, Math.min(740, a.x + (k - (n - 1) / 2) * spacing));
      const y = a.y;
      const s = t.size * (n > 3 ? 0.75 : 1);
      if (t.kind === "icon") objects.push({ id, type: "icon", icon: t.icon, x, y, w: Math.round(100 * s) });
      else if (t.kind === "circle") objects.push({ id, type: "circle", x, y, r: Math.round(45 * s), fill: t.colour ?? "#3E7BFA" });
      else if (t.kind === "rect") objects.push({ id, type: "rect", x, y, w: Math.round(100 * s), h: Math.round(100 * s), fill: t.colour ?? "#E5484D" });
      else if (t.kind === "star") objects.push({ id, type: "star", x, y, r: Math.round(40 * s), fill: t.colour ?? "#F5C518" });
      else if (t.kind === "arrow") objects.push({ id, type: "arrow", x: x - 70, y, x2: x + 70, y2: y, stroke: t.colour ?? "#F2F4F8", strokeWidth: 5 });
      if (t.colour && t.kind === "icon") objects[objects.length - 1].fill = t.colour;

      const start = t0 + i * (studio ? 0.6 : 0.1);
      const dur = studio ? 3 : 1.6;
      if (t.motion === "left" || t.motion === "right") timeline.push({ target: id, action: "move", start, duration: dur, to: { x: Math.max(70, Math.min(730, x + (t.motion === "right" ? 300 : -300))), y } });
      if (t.motion === "up" || t.motion === "down") timeline.push({ target: id, action: "move", start, duration: dur, to: { x, y: t.motion === "up" ? 90 : 380 } });
      if (t.motion === "fall") timeline.push({ target: id, action: "move", start, duration: dur, to: { x, y: 380 }, ease: "bounce" });
      if (t.motion === "fade") timeline.push({ target: id, action: "fade", start, duration: dur, to: 0 });
      if (t.motion === "grow") timeline.push({ target: id, action: "grow", start, duration: dur, to: 1.5, ease: "back" });
      if (t.motion === "orbit") {
        const centre = t.relation ? objects.find((o) => o.id.startsWith(`${things[t.relation!.other].icon ?? things[t.relation!.other].kind}${t.relation!.other}`)) : objects.find((o) => o.id !== id);
        timeline.push({ target: id, action: "orbit", start: 0, duration: studio ? 8 : 4, around: centre ? centre.id : { x: 400, y: 225 }, radius: 140, turns: 1.5 });
      }
    }
  });

  quoted.forEach((q, i) => objects.push({ id: `text${i}`, type: "text", text: q, x: 400, y: 50 + i * 40, fontSize: 30, fill: "#FFE600" }));

  if (studio) {
    // Dress it up a little: title, labels on pictures, staggered entrance, camera drift.
    const title = description.split(/[.,;!?]/)[0].trim().slice(0, 42).toUpperCase();
    if (!quoted.length && title) objects.push({ id: "title", type: "text", text: title, x: 400, y: 40, fontSize: 24, fill: "#FFE600" });
    objects
      .filter((o) => o.type === "icon")
      .slice(0, 6)
      .forEach((o, i) => {
        objects.push({ id: `${o.id}-label`, type: "text", text: (o.icon ?? "").toUpperCase().replace(/-/g, " "), x: 0, y: (o.w ?? 100) / 2 + 18, fontSize: 16, fill: "#F2F4F8", follow: o.id, opacity: 0 });
        timeline.push({ target: `${o.id}-label`, action: "fade", start: 0.8 + i * 0.4, duration: 0.6, to: 1 });
      });
    if (!things.length) objects.push({ id: "idea", type: "icon", icon: "lightbulb", x: 400, y: 240, w: 130, glow: true });
  } else if (!objects.length) {
    objects.push({ id: "nothing", type: "text", text: "?", x: 400, y: 225, fontSize: 60, fill: "#9BA1A6" });
  }

  return {
    id: "offline",
    title: studio ? description.slice(0, 60) : "Your scene",
    duration: studio ? 10 : 5,
    background: backdrop ?? (studio ? "space" : undefined),
    particles,
    ...(studio && { entrance: "stagger" as const, camera: { zoom: 1.08 }, caption: description.slice(0, 160) }),
    objects,
    timeline,
  };
}

// ---------- Offline voice edits ----------

const resize = (o: SceneObject, k: number): Partial<SceneObject> => {
  const r = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * k));
  if (o.type === "text") return { fontSize: r(o.fontSize ?? 18) };
  if (o.type === "circle" || o.type === "star") return { r: r(o.r ?? 30) };
  return { w: r(o.w ?? 80), ...(o.h !== undefined && { h: r(o.h) }) };
};

// Find the object an instruction refers to ("the moon", "red circle", "label").
function findTarget(scene: Scene, phrase: string): SceneObject | undefined {
  const words = phrase.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w && !["the", "a", "an", "it", "that", "this"].includes(w));
  let best: SceneObject | undefined;
  let bestScore = 0;
  for (const o of scene.objects) {
    const name = [o.id, o.icon, o.art, o.text, o.type === "rect" ? "square box rectangle" : o.type].filter(Boolean).join(" ").toLowerCase();
    const colourWord = Object.entries(COLOURS).find(([, hex]) => hex.toLowerCase() === (o.fill ?? "").toLowerCase())?.[0];
    let score = 0;
    for (const w of words) {
      if (name.includes(w) || name.includes(singular(w))) score += 2;
      if (SYNONYMS[w] && name.includes(SYNONYMS[w])) score += 2;
      if (colourWord === w) score += 1;
    }
    if (score > bestScore) [best, bestScore] = [o, score];
  }
  return best;
}

export function offlineEditPatch(video: Video, instruction: string, currentScene: number): Patch {
  const sceneIndex = Math.min(currentScene, video.scenes.length - 1);
  const scene = video.scenes[sceneIndex];
  const text = instruction.toLowerCase().trim();
  const ops: PatchOp[] = [];
  let m: RegExpMatchArray | null;

  if ((m = text.match(/add (?:a |an )?(?:label|text|caption|title)(?: that)? (?:saying|says|reading|that reads)?\s*"?([^"]+)"?/))) {
    const label = m[1].trim().toUpperCase().slice(0, 30);
    ops.push({ op: "addObject", scene: sceneIndex, object: { id: `label${Date.now() % 10000}`, type: "text", text: label, x: 400, y: 410, fontSize: 24, fill: "#FFE600" } });
  } else if ((m = text.match(/(?:remove|delete|get rid of|hide) (.+)/))) {
    const target = findTarget(scene, m[1]);
    if (target) ops.push({ op: "removeObject", scene: sceneIndex, id: target.id });
  } else if ((m = text.match(/(?:make|turn) (.+?) (bigger|larger|huge|smaller|tiny|tinier)$/))) {
    const target = findTarget(scene, m[1]);
    if (target) ops.push({ op: "updateObject", scene: sceneIndex, id: target.id, set: resize(target, /bigger|larger|huge/.test(m[2]) ? 1.5 : 0.65) });
  } else if ((m = text.match(/(?:make|turn|colou?r|paint) (.+?) (red|blue|yellow|green|orange|purple|pink|white|grey|gray|brown|black|cyan|gold)$/))) {
    const target = findTarget(scene, m[1]);
    if (target) ops.push({ op: "updateObject", scene: sceneIndex, id: target.id, set: { fill: COLOURS[m[2]] } });
  } else if ((m = text.match(/(slow down|speed up|slower|faster) (.+)|(.+?) (slower|faster)$/))) {
    const slow = /slow/.test(m[1] ?? m[4] ?? "");
    const target = findTarget(scene, m[2] ?? m[3] ?? "");
    if (target)
      for (const a of scene.timeline.filter((x) => x.target === target.id))
        ops.push(
          a.action === "orbit"
            ? { op: "updateAnimation", scene: sceneIndex, target: a.target, action: "orbit", set: { turns: Number((a.turns * (slow ? 0.6 : 1.6)).toFixed(2)) } }
            : { op: "updateAnimation", scene: sceneIndex, target: a.target, action: a.action, set: { duration: Number((a.duration * (slow ? 1.6 : 0.6)).toFixed(2)) } }
        );
  } else if ((m = text.match(/add (?:a |an |some |two |three )?(.+)/))) {
    const built = buildOfflineScene(m[1], "recall").objects.filter((o) => o.id !== "nothing");
    built.forEach((o, i) => ops.push({ op: "addObject", scene: sceneIndex, object: { ...o, id: `${o.id}-new${i}`, x: 160 + ((i * 160) % 480), y: 120 } }));
  }

  if (!ops.length) throw new Error(`Offline mode couldn't work out "${instruction}". Try "make the X bigger", "make the X red", "slow down the X", "add a label saying …" or "remove the X".`);
  return { summary: `${instruction} (offline)`, ops };
}
