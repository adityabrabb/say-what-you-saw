"use client";

// The 37.5-second trailer, drawn on a 1280x720 canvas as a pure function of time: draw(g, t).
// Nothing here owns a clock, so it plays live, records to WebM and can be scrubbed in a test.
// Look: film noir (near-black, aged paper, one blood-red accent, typewriter type, 2.39:1 letterbox, no grain).

export const W = 1280;
export const H = 720;
export const DURATION = 37.5;
const BAR = 92; // 2.39:1 letterbox: 1280 x 536 picture, 92px bars
const PIC_H = H - BAR * 2;

// The cut list (seconds). The audio score in score.ts is scheduled on exactly the same marks.
export const CUTS = {
  open: [0, 5.0],
  target: [5.0, 7.4],
  said: [7.4, 16.4],
  title2: [16.4, 19.0],
  slam: [19.0, 21.6],
  takes: [21.6, 27.6],
  montage: [27.6, 31.6],
  poster: [31.6, 34.6],
  silence: [34.6, 35.2],
  final: [35.2, 37.5],
} as const;
export const BEAT = 0.4; // the montage cuts on this beat

export interface TrailerSession {
  name: string;
  score: number | null; // witness score, or null if they never testified
  max: number;
  rounds: { title: string; truth: string; said: string; score: number }[];
  directorLines: string[];
  takes: number;
  alias: string;
  crime: string;
  lines: [string, string, string, string];
}

export interface TrailerAssets {
  frames: CanvasImageSource[]; // the takes (from the photo strip)
  freeze: CanvasImageSource | null;
  poster: CanvasImageSource | null;
}

export interface TrailerFonts {
  serif: string;
  type: string;
  mono: string;
}

// Reduced motion: no flashes, shakes or slams (the same cuts, calmly).
let calm = false;
export const setCalm = (c: boolean) => {
  calm = c;
};

export function readFonts(): TrailerFonts {
  const css = getComputedStyle(document.documentElement);
  const get = (v: string, fb: string) => css.getPropertyValue(v).trim() || fb;
  return {
    serif: get("--font-serif", "Georgia, serif"),
    type: get("--font-type", "'Courier New', monospace"),
    mono: get("--font-body", "'Courier New', monospace"),
  };
}

const CREAM = "#e8dfcc";
const PAPER = "#f1e9d6";
const BLOOD = "#b3161c";
const BLOOD_HOT = "#d4262d";
const DIM = "rgba(232,223,204,0.55)";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const env = (t: number, a: number, b: number, c: number, d: number) => ramp(t, a, b) * (1 - ramp(t, c, d));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const inside = (t: number, [a, b]: readonly [number, number]) => t >= a && t < b;

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  if (out.length > maxLines) {
    out.length = maxLines;
    out[maxLines - 1] = out[maxLines - 1].replace(/[.,;:]?\s*\S*$/, "") + "…";
  }
  return out;
}

function typed(text: string, t: number, start: number, cps = 32) {
  return text.slice(0, Math.max(0, Math.floor((t - start) * cps)));
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// ---------- Shared pieces ----------

function vignette(g: CanvasRenderingContext2D, strength = 0.7) {
  const v = g.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, 760);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = v;
  g.fillRect(0, BAR, W, PIC_H);
}

// Dust in the projector beam: a handful of slow specks. (Specks, not grain.)
function dust(g: CanvasRenderingContext2D, t: number, alpha = 0.35) {
  for (let i = 0; i < 46; i++) {
    const x = (rnd(i) * W + Math.sin(t * (0.3 + rnd(i + 9)) + i) * 18 + t * 4) % W;
    const y = BAR + ((rnd(i + 50) * PIC_H + t * (6 + rnd(i + 3) * 12)) % PIC_H);
    g.fillStyle = `rgba(232,223,204,${alpha * (0.25 + rnd(i + 20) * 0.75)})`;
    g.fillRect(x, y, 1 + rnd(i + 7) * 1.6, 1 + rnd(i + 7) * 1.6);
  }
}

function bars(g: CanvasRenderingContext2D) {
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, BAR);
  g.fillRect(0, H - BAR, W, BAR);
}

// A title card line: serif italic, centred, light blooms up then fades.
function titleLine(g: CanvasRenderingContext2D, f: TrailerFonts, text: string, t: number, a: number, b: number, c: number, d: number, size = 54) {
  const alpha = env(t, a, b, c, d);
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `italic 600 ${size}px ${f.serif}`;
  g.fillStyle = CREAM;
  g.shadowColor = "rgba(232,223,204,0.25)";
  g.shadowBlur = 22;
  const lines = wrap(g, text, W - 220, 3);
  const lh = size * 1.18;
  const zoom = 1 + (t - a) * 0.012;
  g.translate(W / 2, H / 2);
  g.scale(zoom, zoom);
  lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
  g.restore();
}

function flash(g: CanvasRenderingContext2D, alpha: number) {
  if (alpha <= 0 || calm) return;
  g.fillStyle = `rgba(255,250,238,${clamp01(alpha)})`;
  g.fillRect(0, BAR, W, PIC_H);
}

function shake(g: CanvasRenderingContext2D, t: number, at: number, amp: number, dur = 0.45) {
  const k = 1 - ramp(t, at, at + dur);
  if (calm || t < at || k <= 0) return;
  g.translate((rnd(Math.floor(t * 60)) - 0.5) * amp * k, (rnd(Math.floor(t * 60) + 99) - 0.5) * amp * k);
}

function coverDraw(g: CanvasRenderingContext2D, img: CanvasImageSource, zoom: number, panX: number, panY: number) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || W;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || H;
  const s = Math.max(W / iw, PIC_H / ih) * zoom;
  const dw = iw * s;
  const dh = ih * s;
  const ox = (W - dw) / 2 + panX * (dw - W);
  const oy = BAR + (PIC_H - dh) / 2 + panY * (dh - PIC_H);
  g.drawImage(img, ox, oy, dw, dh);
}

// ---------- Scenes ----------

function sceneOpen(g: CanvasRenderingContext2D, s: TrailerSession, f: TrailerFonts, t: number) {
  // A thin projector cone settles from the top while the first line lights.
  const cone = ramp(t, 0.1, 1.6) * (1 - ramp(t, 4.6, 5.0));
  const grad = g.createLinearGradient(0, BAR, 0, H - BAR);
  grad.addColorStop(0, `rgba(232,223,204,${0.12 * cone})`);
  grad.addColorStop(1, "rgba(232,223,204,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(W / 2 - 40, BAR);
  g.lineTo(W / 2 + 40, BAR);
  g.lineTo(W / 2 + 420, H - BAR);
  g.lineTo(W / 2 - 420, H - BAR);
  g.fill();
  titleLine(g, f, s.lines[0], t, 1.0, 2.0, 4.4, 4.95);
  dust(g, t, 0.4 * cone);
}

function sceneTarget(g: CanvasRenderingContext2D, s: TrailerSession, f: TrailerFonts, t: number) {
  const u = t - CUTS.target[0];
  flash(g, 1 - ramp(u, 0, 0.22));
  const r = s.rounds[0];
  // CCTV frame
  g.save();
  const zoom = 1 + u * 0.05;
  g.translate(W / 2, H / 2);
  g.scale(zoom, zoom);
  g.translate(-W / 2, -H / 2);
  g.strokeStyle = "rgba(232,223,204,0.5)";
  g.lineWidth = 2;
  g.strokeRect(150, BAR + 44, W - 300, PIC_H - 88);
  g.strokeStyle = "rgba(232,223,204,0.8)";
  for (const [x, y, dx, dy] of [
    [150, BAR + 44, 1, 1],
    [W - 150, BAR + 44, -1, 1],
    [150, H - BAR - 44, 1, -1],
    [W - 150, H - BAR - 44, -1, -1],
  ] as const) {
    g.beginPath();
    g.moveTo(x, y + dy * 28);
    g.lineTo(x, y);
    g.lineTo(x + dx * 28, y);
    g.stroke();
  }
  g.font = `700 20px ${f.mono}`;
  g.textAlign = "left";
  g.fillStyle = Math.floor(u * 3) % 2 === 0 ? BLOOD_HOT : "rgba(212,38,45,0.25)";
  g.beginPath();
  g.arc(188, BAR + 82, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = CREAM;
  g.fillText("REC   CAM 3", 206, BAR + 89);
  g.textAlign = "right";
  g.fillText("EXHIBIT A", W - 188, BAR + 89);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const text = r ? r.truth || r.title : "Footage not filed";
  g.font = `400 40px ${f.type}`;
  g.fillStyle = PAPER;
  const lines = wrap(g, clip(text, 120), W - 460, 3);
  lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * 54));
  g.restore();
  // Scanlines
  g.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = BAR; y < H - BAR; y += 4) g.fillRect(0, y, W, 1);
  vignette(g, 0.6);
}

function sceneSaid(g: CanvasRenderingContext2D, s: TrailerSession, f: TrailerFonts, t: number) {
  const quotes = s.rounds.filter((r) => r.said.trim()).slice(0, 3);
  const list = quotes.length ? quotes.map((q, i) => ({ text: q.said, label: `Round ${s.rounds.indexOf(q) + 1}`, score: q.score, i })) : [{ text: "(silence)", label: "Statement on file", score: 0, i: 0 }];
  const slot = (CUTS.said[1] - CUTS.said[0]) / list.length;
  const idx = Math.min(list.length - 1, Math.floor((t - CUTS.said[0]) / slot));
  const q = list[idx];
  const u = t - CUTS.said[0] - idx * slot;

  // Slow push in on a dark desk-lamp pool
  const pool = g.createRadialGradient(W / 2, H / 2 + 40, 20, W / 2, H / 2 + 40, 520);
  pool.addColorStop(0, "rgba(120,100,70,0.22)");
  pool.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = pool;
  g.fillRect(0, BAR, W, PIC_H);

  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  const a = env(u, 0.05, 0.25, slot - 0.25, slot);
  g.globalAlpha = a;
  g.font = `700 18px ${f.mono}`;
  g.fillStyle = BLOOD_HOT;
  g.fillText(`WITNESS STATEMENT · ${q.label.toUpperCase()}`, W / 2, BAR + 110);
  g.font = `400 46px ${f.type}`;
  g.fillStyle = PAPER;
  g.shadowColor = "rgba(0,0,0,0.9)";
  g.shadowBlur = 10;
  const shown = typed(`“${clip(q.text, 110)}”`, u, 0.1, 70);
  const lines = wrap(g, shown, W - 300, 4);
  lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + 6 + (i - (lines.length - 1) / 2) * 62));
  g.restore();
  dust(g, t, 0.25);
  vignette(g, 0.65);
}

function sceneTitle2(g: CanvasRenderingContext2D, s: TrailerSession, f: TrailerFonts, t: number) {
  const [a] = CUTS.title2;
  titleLine(g, f, s.lines[1], t, a + 0.15, a + 0.6, a + 2.3, a + 2.6);
  dust(g, t, 0.3);
}

function sceneSlam(g: CanvasRenderingContext2D, s: TrailerSession, f: TrailerFonts, t: number) {
  const [a] = CUTS.slam;
  const u = t - a;
  g.save();
  shake(g, t, a, 26, 0.5);
  flash(g, 0.8 * (1 - ramp(u, 0, 0.18)));
  g.textAlign = "center";
  g.textBaseline = "middle";
  const k = calm ? 1 : 1 + (1 - easeOut(u / 0.22)) * 1.6;
  const alpha = clamp01(u / 0.05) * (1 - ramp(t, CUTS.slam[1] - 0.2, CUTS.slam[1]));
  g.globalAlpha = alpha;
  g.font = `700 22px ${f.mono}`;
  g.fillStyle = BLOOD_HOT;
  g.fillText(s.score === null ? "NO TESTIMONY" : "WITNESS SCORE", W / 2, H / 2 - 150);
  g.save();
  g.translate(W / 2, H / 2 - 10);
  g.scale(k, k);
  g.fillStyle = CREAM;
  g.shadowColor = "rgba(232,223,204,0.3)";
  g.shadowBlur = 30;
  g.font = `700 210px ${f.serif}`;
  g.fillText(s.score === null ? "—" : String(s.score), 0, 0);
  g.restore();
  g.font = `400 38px ${f.type}`;
  g.fillStyle = DIM;
  if (s.score !== null) g.fillText(`out of ${s.max}`, W / 2, H / 2 + 120);
  // The stamp
  const st = ramp(u, 0.55, 0.7);
  if (st > 0) {
    g.save();
    g.translate(W / 2 + 330, H / 2 + 70);
    g.rotate(-0.18);
    const sc = 1 + (1 - easeOut(st)) * 0.8;
    g.scale(sc, sc);
    g.globalAlpha = alpha * st;
    g.strokeStyle = BLOOD_HOT;
    g.fillStyle = BLOOD_HOT;
    g.lineWidth = 5;
    g.strokeRect(-150, -34, 300, 68);
    g.font = `700 34px ${f.mono}`;
    g.fillText("ON THE RECORD", 0, 3);
    g.restore();
  }
  g.restore();
  dust(g, t, 0.2);
}

function sceneTakes(g: CanvasRenderingContext2D, s: TrailerSession, assets: TrailerAssets, f: TrailerFonts, t: number) {
  const [a, b] = CUTS.takes;
  const frames = assets.frames.length ? assets.frames : assets.freeze ? [assets.freeze, assets.freeze, assets.freeze, assets.freeze] : [];
  const slot = (b - a) / 4;
  const i = Math.min(3, Math.floor((t - a) / slot));
  const u = (t - a - i * slot) / slot;
  g.save();
  g.beginPath();
  g.rect(0, BAR, W, PIC_H);
  g.clip();
  if (frames.length) {
    const img = frames[i % frames.length];
    // Ken Burns: alternate push-ins and pull-outs with different pans
    const dir = i % 2 === 0 ? 1 : -1;
    const zoom = 1.08 + (dir > 0 ? u : 1 - u) * 0.2;
    coverDraw(g, img, zoom, (i % 3 === 0 ? -1 : 1) * (u - 0.5) * 0.8, (u - 0.5) * 0.6 * dir);
  } else {
    // No stills (demo subject): a lit wall and the director's own words
    const bg = g.createLinearGradient(0, BAR, W, H - BAR);
    bg.addColorStop(0, "#1b1a18");
    bg.addColorStop(1, "#0a0a09");
    g.fillStyle = bg;
    g.fillRect(0, BAR, W, PIC_H);
    g.fillStyle = "rgba(232,223,204,0.07)";
    g.beginPath();
    g.ellipse(W / 2 + (u - 0.5) * 120, H / 2, 200, 270, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Hard cut flash on each new take
  flash(g, 0.5 * (1 - ramp(u, 0, 0.08)));
  g.restore();
  vignette(g, 0.75);
  // TAKE counter and the third line
  g.save();
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  g.font = `700 22px ${f.mono}`;
  g.fillStyle = BLOOD_HOT;
  g.fillText(`● TAKE ${Math.max(1, Math.min(s.takes || 4, i + 1 + Math.max(0, (s.takes || 4) - 4)))}`, 70, BAR + 52);
  g.restore();
  const textAlpha = env(t, a + 0.35, a + 0.8, b - 0.3, b);
  if (textAlpha > 0) {
    g.save();
    g.globalAlpha = textAlpha;
    g.textAlign = "center";
    g.font = `italic 600 46px ${f.serif}`;
    g.fillStyle = CREAM;
    g.shadowColor = "rgba(0,0,0,0.95)";
    g.shadowBlur = 18;
    const lines = wrap(g, s.lines[2], W - 260, 2);
    lines.forEach((l, k) => g.fillText(l, W / 2, H - BAR - 52 - (lines.length - 1 - k) * 54));
    g.restore();
  }
}

function sceneMontage(g: CanvasRenderingContext2D, s: TrailerSession, f: TrailerFonts, t: number) {
  const [a] = CUTS.montage;
  const FALL = ["ACTION", "MORE DRAMA", "ONE MORE TAKE", "NO NOTES", "CUT"];
  const lines = s.directorLines.length ? s.directorLines.slice(-5) : FALL;
  const beat = Math.floor((t - a) / BEAT);
  const u = ((t - a) % BEAT) / BEAT;
  const text = lines[beat % lines.length];
  g.save();
  g.translate(0, 0);
  shake(g, t, a + beat * BEAT, 18, 0.18);
  // A hard cut on the beat: alternate paper and black cards
  const light = beat % 3 === 2;
  g.fillStyle = light ? PAPER : "#050505";
  g.fillRect(0, BAR, W, PIC_H);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = light ? "#141210" : PAPER;
  const size = beat % 2 === 0 ? 74 : 56;
  g.font = `400 ${size}px ${f.type}`;
  const zoom = 1 + u * 0.06;
  g.translate(W / 2, H / 2);
  g.scale(zoom, zoom);
  const out = wrap(g, `“${clip(text, 70)}”`, W - 320, 3);
  out.forEach((l, i) => g.fillText(l, 0, (i - (out.length - 1) / 2) * size * 1.25));
  g.restore();
  // The beat marker: a red bar slams across the picture's bottom edge
  g.fillStyle = BLOOD;
  g.fillRect(0, H - BAR - 8, W * (1 - u), 8);
  g.fillStyle = "rgba(232,223,204,0.8)";
  g.font = `700 16px ${f.mono}`;
  g.textAlign = "left";
  g.fillStyle = light ? "#141210" : DIM;
  g.fillText(`DIRECTION ${String(beat + 1).padStart(2, "0")}`, 70, BAR + 40);
}

function scenePoster(g: CanvasRenderingContext2D, s: TrailerSession, assets: TrailerAssets, f: TrailerFonts, t: number) {
  const [a, b] = CUTS.poster;
  const u = t - a;
  g.save();
  shake(g, t, a + 0.62, 24, 0.5);
  const bg = g.createRadialGradient(W * 0.68, H / 2, 20, W * 0.68, H / 2, 480);
  bg.addColorStop(0, "rgba(140,115,75,0.28)");
  bg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = bg;
  g.fillRect(0, BAR, W, PIC_H);

  // The fourth line on the left
  const a1 = env(t, a + 0.7, a + 1.1, b - 0.25, b);
  g.save();
  g.globalAlpha = a1;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.font = `italic 600 50px ${f.serif}`;
  g.fillStyle = CREAM;
  g.shadowColor = "rgba(0,0,0,0.9)";
  g.shadowBlur = 16;
  const lines = wrap(g, s.lines[3], 560, 4);
  lines.forEach((l, i) => g.fillText(l, 100, H / 2 + (i - (lines.length - 1) / 2) * 62));
  g.restore();

  // The poster slams in from large to size, then settles
  const k = calm ? 1 : 1 + (1 - easeOut(u / 0.28)) * 0.7;
  const alpha = clamp01(u / 0.1);
  g.globalAlpha = alpha;
  g.translate(W * 0.73, H / 2);
  g.rotate(-0.025);
  g.scale(k, k);
  const ph = PIC_H - 36;
  if (assets.poster) {
    const iw = (assets.poster as HTMLImageElement).naturalWidth || (assets.poster as HTMLCanvasElement).width || 1200;
    const ih = (assets.poster as HTMLImageElement).naturalHeight || (assets.poster as HTMLCanvasElement).height || 1600;
    const pw = ph * (iw / ih);
    g.shadowColor = "rgba(0,0,0,0.8)";
    g.shadowBlur = 30;
    g.drawImage(assets.poster, -pw / 2, -ph / 2, pw, ph);
  } else {
    // No poster in the saved session: a bare wanted card with the alias
    const pw = ph * 0.75;
    g.fillStyle = PAPER;
    g.shadowColor = "rgba(0,0,0,0.8)";
    g.shadowBlur = 30;
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.shadowBlur = 0;
    g.textAlign = "center";
    g.fillStyle = "#1a1612";
    g.font = `700 64px ${f.serif}`;
    g.fillText("WANTED", 0, -ph / 2 + 90);
    g.font = `italic 600 28px ${f.serif}`;
    g.fillText(`a.k.a. ${clip(s.alias || s.name || "The Witness", 26)}`, 0, 0);
    g.font = `400 18px ${f.type}`;
    const cl = wrap(g, clip(s.crime || "Crimes against memory", 90), pw - 50, 3);
    cl.forEach((l, i) => g.fillText(l, 0, 50 + i * 26));
  }
  // GUILTY stamp slam
  const st = ramp(u, 0.6, 0.72);
  if (st > 0) {
    g.save();
    g.rotate(-0.22);
    const sc = 1 + (1 - easeOut(st)) * 1.1;
    g.scale(sc, sc);
    g.globalAlpha = st * 0.92;
    g.strokeStyle = BLOOD_HOT;
    g.fillStyle = BLOOD_HOT;
    g.lineWidth = 7;
    g.shadowBlur = 0;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 70px ${f.mono}`;
    const w = g.measureText("GUILTY").width + 44;
    g.strokeRect(-w / 2, -48, w, 96);
    g.fillText("GUILTY", 0, 4);
    g.restore();
  }
  g.restore();
  flash(g, 0.35 * (1 - ramp(u, 0.6, 0.75)) * (u > 0.6 ? 1 : 0));
  vignette(g, 0.6);
}

function sceneFinal(g: CanvasRenderingContext2D, s: TrailerSession, f: TrailerFonts, t: number) {
  const [a, b] = CUTS.final;
  const fade = 1 - ramp(t, b - 0.25, b);
  g.save();
  g.globalAlpha = fade;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 20px ${f.mono}`;
  g.fillStyle = BLOOD_HOT;
  g.globalAlpha = fade * ramp(t, a + 0.2, a + 0.5);
  g.fillText("STARRING", W / 2, H / 2 - 110);
  g.globalAlpha = fade * ramp(t, a + 0.4, a + 0.9);
  g.fillStyle = CREAM;
  g.shadowColor = "rgba(232,223,204,0.25)";
  g.shadowBlur = 24;
  let size = 110;
  g.font = `700 ${size}px ${f.serif}`;
  const name = clip(s.name || "You", 28);
  while (g.measureText(name).width > W - 240 && size > 48) {
    size -= 6;
    g.font = `700 ${size}px ${f.serif}`;
  }
  g.fillText(name, W / 2, H / 2 - 30);
  g.shadowBlur = 0;
  g.globalAlpha = fade * ramp(t, a + 1.0, a + 1.3);
  g.font = `400 34px ${f.type}`;
  g.fillStyle = PAPER;
  g.fillText("Directed by voice.", W / 2, H / 2 + 62);
  g.globalAlpha = fade * ramp(t, a + 1.45, a + 1.75);
  g.font = `italic 500 30px ${f.serif}`;
  g.fillStyle = DIM;
  g.fillText("Coming soon to a browser near you.", W / 2, H / 2 + 118);
  g.restore();
  dust(g, t, 0.25);
}

// ---------- The whole trailer ----------

export function drawTrailer(g: CanvasRenderingContext2D, t: number, s: TrailerSession, assets: TrailerAssets, f: TrailerFonts) {
  g.save();
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.beginPath();
  g.rect(0, BAR, W, PIC_H);
  g.clip();
  g.fillStyle = inside(t, CUTS.silence) ? "#000" : "#070707";
  g.fillRect(0, BAR, W, PIC_H);

  if (inside(t, CUTS.open)) sceneOpen(g, s, f, t);
  else if (inside(t, CUTS.target)) sceneTarget(g, s, f, t);
  else if (inside(t, CUTS.said)) sceneSaid(g, s, f, t);
  else if (inside(t, CUTS.title2)) sceneTitle2(g, s, f, t);
  else if (inside(t, CUTS.slam)) sceneSlam(g, s, f, t);
  else if (inside(t, CUTS.takes)) sceneTakes(g, s, assets, f, t);
  else if (inside(t, CUTS.montage)) sceneMontage(g, s, f, t);
  else if (inside(t, CUTS.poster)) scenePoster(g, s, assets, f, t);
  else if (inside(t, CUTS.final)) sceneFinal(g, s, f, t);
  // CUTS.silence: pure black, on purpose
  g.restore();
  bars(g);
}
