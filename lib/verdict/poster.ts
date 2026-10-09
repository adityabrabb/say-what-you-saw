"use client";

import type { Charge } from "./schema";

// The wanted poster, drawn on a canvas on the device: old toned paper with stains, the frozen frame
// in sepia, the charge sheet, and a GUILTY stamp. Layout constants are shared with the on-screen stamp.

export const POSTER_W = 1200;
export const POSTER_H = 1600;
export const PHOTO = { x: 250, y: 300, w: 700, h: 470 };
export const STAMP = { cx: 790, cy: 668, w: 480, h: 164, rot: -14 };

const INK = "#2a1c10";
const INK_SOFT = "#5a4430";
const RED = "#b3261e";

// Where the poster sits on screen: centred between the film chrome and the buttons, 3:4.
export function posterRect(vw: number, vh: number) {
  const top = 56;
  const bottom = vw < 640 ? 150 : 96;
  const h = Math.max(240, Math.min(vh - top - bottom, ((vw - 32) * POSTER_H) / POSTER_W));
  const w = (h * POSTER_W) / POSTER_H;
  return { x: (vw - w) / 2, y: top + (vh - top - bottom - h) / 2, w, h };
}

// Small seeded random so the stains are the same every time for the same suspect.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const fonts = () => {
  const css = getComputedStyle(document.documentElement);
  return {
    serif: css.getPropertyValue("--font-serif").trim() || "Georgia, serif",
    type: "'Courier New', Courier, monospace",
  };
};

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (g.measureText(`${last}…`).width > maxW && last.length > 1) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function paper(g: CanvasRenderingContext2D, seed: string) {
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, POSTER_W, POSTER_H);
  base.addColorStop(0, "#efe2c4");
  base.addColorStop(0.5, "#e6d6b2");
  base.addColorStop(1, "#d9c49a");
  g.fillStyle = base;
  g.fillRect(0, 0, POSTER_W, POSTER_H);
  // Water and coffee stains
  for (let i = 0; i < 9; i++) {
    const x = r() * POSTER_W;
    const y = r() * POSTER_H;
    const rad = 60 + r() * 220;
    const s = g.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    s.addColorStop(0, `rgba(120, 82, 40, ${0.04 + r() * 0.07})`);
    s.addColorStop(0.8, `rgba(110, 72, 30, ${0.03 + r() * 0.05})`);
    s.addColorStop(1, "rgba(110, 72, 30, 0)");
    g.fillStyle = s;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // A coffee-cup ring
  g.strokeStyle = "rgba(110, 66, 24, 0.22)";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(160 + r() * 120, 1380 + r() * 120, 92, 0.3, Math.PI * 1.85);
  g.stroke();
  // Fold creases
  g.strokeStyle = "rgba(255, 250, 235, 0.35)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, POSTER_H / 2);
  g.lineTo(POSTER_W, POSTER_H / 2 + 6);
  g.moveTo(POSTER_W / 2 + 4, 0);
  g.lineTo(POSTER_W / 2 - 4, POSTER_H);
  g.stroke();
  g.strokeStyle = "rgba(80, 50, 20, 0.12)";
  g.beginPath();
  g.moveTo(0, POSTER_H / 2 + 3);
  g.lineTo(POSTER_W, POSTER_H / 2 + 9);
  g.stroke();
  // Aged, scorched edges
  const edge = g.createRadialGradient(POSTER_W / 2, POSTER_H / 2, POSTER_H * 0.38, POSTER_W / 2, POSTER_H / 2, POSTER_H * 0.78);
  edge.addColorStop(0, "rgba(60, 35, 10, 0)");
  edge.addColorStop(1, "rgba(60, 35, 10, 0.55)");
  g.fillStyle = edge;
  g.fillRect(0, 0, POSTER_W, POSTER_H);
}

// Turn the photo slot sepia by hand (canvas filters are missing in some browsers).
function sepiaInPlace(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const img = g.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const c = (l - 128) * 1.12 + 128;
    d[i] = Math.min(255, c * 1.07 + 18);
    d[i + 1] = Math.min(255, c * 0.92 + 10);
    d[i + 2] = Math.min(255, c * 0.72);
  }
  g.putImageData(img, x, y);
}

// A police-sketch suspect for when nobody stepped in front of the camera.
export function mugshotSketch(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = PHOTO.w;
  c.height = PHOTO.h;
  const g = c.getContext("2d")!;
  const r = rng("sketch");
  g.fillStyle = "#e9dfc8";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(40, 32, 26, 0.55)";
  g.lineCap = "round";
  const cx = c.width / 2;
  // Hatched head and shoulders, drawn as many loose pencil passes
  for (let pass = 0; pass < 7; pass++) {
    g.lineWidth = 1.2 + r() * 1.6;
    g.beginPath();
    g.ellipse(cx + (r() - 0.5) * 8, 190 + (r() - 0.5) * 8, 92 + r() * 8, 120 + r() * 8, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 220 + r() * 10, c.height);
    g.quadraticCurveTo(cx - 200, 330 + r() * 10, cx - 50, 318);
    g.lineTo(cx + 50, 318);
    g.quadraticCurveTo(cx + 200, 330 + r() * 10, cx + 220 + r() * 10, c.height);
    g.stroke();
  }
  g.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = cx - 80 + r() * 160;
    g.beginPath();
    g.moveTo(x, 120 + r() * 40);
    g.lineTo(x - 30, 250 + r() * 60);
    g.stroke();
  }
  g.fillStyle = "rgba(40, 32, 26, 0.75)";
  g.font = `700 150px ${fonts().serif}`;
  g.textAlign = "center";
  g.fillText("?", cx, 245);
  return c;
}

// The stamp alone, so the screen can slam it down before it's printed into the download.
export function stampCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = STAMP.w;
  c.height = STAMP.h;
  const g = c.getContext("2d")!;
  const r = rng("stamp");
  g.strokeStyle = RED;
  g.fillStyle = RED;
  g.lineWidth = 10;
  g.strokeRect(8, 8, STAMP.w - 16, STAMP.h - 16);
  g.lineWidth = 4;
  g.strokeRect(24, 24, STAMP.w - 48, STAMP.h - 48);
  g.font = `900 104px Impact, "Arial Black", ${fonts().serif}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("GUILTY", STAMP.w / 2, STAMP.h / 2 + 6);
  // Worn ink: knock little holes out of it
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.3 + r() * 0.7;
    g.beginPath();
    g.arc(r() * STAMP.w, r() * STAMP.h, 0.6 + r() * 2.6, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export interface PosterInput {
  name: string;
  charge: Charge;
  photo: CanvasImageSource | null; // frozen frame or police sketch; null = empty slot
  sepia: boolean; // tone the photo (the real frame) or leave it as drawn (the sketch)
  refused: boolean; // no camera: print "Suspect refuses to be photographed"
  stamp: boolean;
}

export function drawPoster({ name, charge, photo, sepia, refused, stamp }: PosterInput): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = POSTER_W;
  c.height = POSTER_H;
  const g = c.getContext("2d")!;
  const { serif, type } = fonts();
  paper(g, `${name}|${charge.alias}`);

  // Pin at the top
  g.fillStyle = "#7d1b14";
  g.beginPath();
  g.arc(POSTER_W / 2, 46, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  g.arc(POSTER_W / 2 - 5, 41, 5, 0, Math.PI * 2);
  g.fill();

  g.textAlign = "center";
  g.fillStyle = INK;
  g.font = `700 172px ${serif}`;
  g.fillText("WANTED", POSTER_W / 2, 220);
  g.font = `600 30px ${type}`;
  g.fillStyle = INK_SOFT;
  g.fillText("FOR CRIMES AGAINST MEMORY", POSTER_W / 2, 268);

  // Photo
  g.fillStyle = "#1a120a";
  g.fillRect(PHOTO.x - 10, PHOTO.y - 10, PHOTO.w + 20, PHOTO.h + 20);
  if (photo && sepia) {
    const sw = (photo as HTMLCanvasElement).width;
    const sh = (photo as HTMLCanvasElement).height;
    const scale = Math.max(PHOTO.w / sw, PHOTO.h / sh);
    const cw = PHOTO.w / scale;
    const ch = PHOTO.h / scale;
    g.drawImage(photo, (sw - cw) / 2, (sh - ch) / 2, cw, ch, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    sepiaInPlace(g, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
  } else if (photo) {
    g.drawImage(photo, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
  } else {
    g.fillStyle = "#cdbb95";
    g.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    g.setLineDash([16, 12]);
    g.strokeStyle = INK_SOFT;
    g.lineWidth = 3;
    g.strokeRect(PHOTO.x + 24, PHOTO.y + 24, PHOTO.w - 48, PHOTO.h - 48);
    g.setLineDash([]);
    g.fillStyle = INK_SOFT;
    g.font = `700 34px ${type}`;
    g.fillText("PHOTO MISSING", POSTER_W / 2, PHOTO.y + PHOTO.h / 2 + 12);
  }
  // Wash the photo slightly into the paper
  g.fillStyle = "rgba(230, 210, 170, 0.1)";
  g.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);

  let y = PHOTO.y + PHOTO.h + 34;
  if (refused) {
    g.font = `italic 600 25px ${serif}`;
    g.fillStyle = INK_SOFT;
    g.fillText("Suspect refuses to be photographed. Suspicious.", POSTER_W / 2, y + 6);
    y += 28;
  }

  // Name and alias
  g.fillStyle = INK;
  g.font = `700 78px ${serif}`;
  y += 70;
  g.fillText((name || "Unknown Suspect").toUpperCase(), POSTER_W / 2, y);
  g.font = `italic 500 38px ${serif}`;
  g.fillStyle = INK_SOFT;
  y += 50;
  g.fillText(`a.k.a. “${charge.alias}”`, POSTER_W / 2, y);

  // The crime
  y += 56;
  g.font = `700 24px ${type}`;
  g.fillStyle = RED;
  g.fillText("WANTED FOR", POSTER_W / 2, y);
  g.font = `600 33px ${serif}`;
  g.fillStyle = INK;
  for (const l of wrap(g, charge.crime, 960, 2)) {
    y += 40;
    g.fillText(l, POSTER_W / 2, y);
  }

  // Evidence A, B, C
  y += 50;
  g.textAlign = "left";
  const left = 130;
  const right = POSTER_W - 130;
  charge.evidence.forEach((ev, i) => {
    g.font = `700 22px ${type}`;
    g.fillStyle = RED;
    g.fillText(`EXHIBIT ${"ABC"[i]}`, left, y);
    g.font = `italic 500 31px ${serif}`;
    g.fillStyle = INK;
    const quote = wrap(g, `“${ev.quote}”`, right - left - 170, 2);
    quote.forEach((l, j) => g.fillText(l, left + 170, y + j * 34));
    g.font = `600 22px ${serif}`;
    g.fillStyle = INK_SOFT;
    g.fillText(wrap(g, `— ${ev.note}`, right - left - 170, 1)[0] ?? "", left + 170, y + quote.length * 34 + 4);
    y += quote.length * 34 + 52;
  });

  // Reward
  g.textAlign = "center";
  g.font = `700 26px ${type}`;
  g.fillStyle = RED;
  const ry = Math.min(POSTER_H - 92, Math.max(y + 24, POSTER_H - 150));
  g.fillText("REWARD", POSTER_W / 2, ry);
  g.font = `600 34px ${serif}`;
  g.fillStyle = INK;
  g.fillText(wrap(g, charge.reward, 1000, 1)[0] ?? "", POSTER_W / 2, ry + 42);
  g.font = `500 20px ${type}`;
  g.fillStyle = INK_SOFT;
  g.fillText("IF SEEN, SAY WHAT YOU SAW  ·  say-what-you-saw.vercel.app", POSTER_W / 2, POSTER_H - 34);

  if (stamp) {
    g.save();
    g.translate(STAMP.cx, STAMP.cy);
    g.rotate((STAMP.rot * Math.PI) / 180);
    g.globalAlpha = 0.85;
    g.drawImage(stampCanvas(), -STAMP.w / 2, -STAMP.h / 2);
    g.restore();
  }
  return c;
}

// The back of the poster: plain aged paper, for the moment before it spins around.
export function posterBack(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = POSTER_W / 4;
  c.height = POSTER_H / 4;
  const g = c.getContext("2d")!;
  g.scale(0.25, 0.25);
  paper(g, "back");
  return c;
}
