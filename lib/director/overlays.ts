"use client";

import { ICON_COLOURS, ICON_GROUPS, ICON_SPRITE } from "../icons";
import type { Overlay } from "./settings";
import type { FaceAnchors } from "./tracking";

// Draws face-anchored overlays into two small 2D canvases ("back" = passes behind the head,
// "front" = on top). The WebGL pass composites them. Changes ease over ~1s; nothing pops.

export const OV_W = 960;
export const OV_H = 540;

type RGB = [number, number, number];
const hexToRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbStr = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const shadeRgb = (c: RGB, k: number): RGB => c.map((v) => (k > 0 ? v + (255 - v) * k : v * (1 + k))) as RGB;

// ---------- Neon icons from the existing sprite, rasterised once per name+colour ----------
let symbols: Map<string, { viewBox: string; body: string }> | null = null;
let symbolsLoading: Promise<void> | null = null;
const iconCache = new Map<string, HTMLCanvasElement | "loading">();

function loadSymbols() {
  symbolsLoading ??= fetch(ICON_SPRITE)
    .then((r) => r.text())
    .then((svg) => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      symbols = new Map();
      doc.querySelectorAll("symbol").forEach((s) => symbols!.set(s.id, { viewBox: s.getAttribute("viewBox") ?? "0 0 24 24", body: s.innerHTML }));
    })
    .catch(() => {});
  return symbolsLoading;
}

function iconCanvas(name: string, colour: string): HTMLCanvasElement | null {
  const key = `${name}|${colour}`;
  const hit = iconCache.get(key);
  if (hit && hit !== "loading") return hit;
  if (hit === "loading") return null;
  if (!symbols) {
    void loadSymbols();
    return null;
  }
  const sym = symbols.get(name in ICON_GROUPS ? name : "star");
  if (!sym) return null;
  iconCache.set(key, "loading");
  const core = shadeRgb(hexToRgb(colour), 0.7);
  const svg = (c: string, sw: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.viewBox}" width="160" height="160" style="--sw:${sw};color:${c}">${sym.body}</svg>`;
  const load = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
    });
  Promise.all([load(svg(colour, 2.2)), load(svg(rgbStr(core), 0.9))])
    .then(([tube, hot]) => {
      const c = document.createElement("canvas");
      c.width = c.height = 200;
      const g = c.getContext("2d")!;
      g.shadowColor = colour;
      g.shadowBlur = 18;
      g.drawImage(tube, 20, 20);
      g.drawImage(tube, 20, 20);
      g.shadowBlur = 0;
      g.drawImage(hot, 20, 20);
      iconCache.set(key, c);
    })
    .catch(() => iconCache.delete(key));
  return null;
}

// ---------- Overlay states with easing ----------
interface Live {
  target: Overlay;
  colour: RGB;
  size: number;
  offX: number;
  offY: number;
  alpha: number; // 0..1 appear/disappear
  removing: boolean;
  phase: number;
}

const fontVar = (name: string, fallback: string) => {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

export class OverlayLayer {
  readonly front = document.createElement("canvas");
  readonly back = document.createElement("canvas");
  private fctx: CanvasRenderingContext2D;
  private bctx: CanvasRenderingContext2D;
  private live = new Map<string, Live>();
  private bodyFont = fontVar("--font-body", "sans-serif");
  private lastStamp = "";
  backDirty = false;
  frontDirty = true;

  constructor() {
    for (const c of [this.front, this.back]) {
      c.width = OV_W;
      c.height = OV_H;
    }
    this.fctx = this.front.getContext("2d")!;
    this.bctx = this.back.getContext("2d")!;
    void loadSymbols();
  }

  sync(overlays: Overlay[]) {
    const ids = new Set(overlays.map((o) => o.id));
    for (const [id, l] of this.live) if (!ids.has(id)) l.removing = true;
    for (const o of overlays) {
      const l = this.live.get(o.id);
      if (l) {
        l.target = o;
        l.removing = false;
      } else
        this.live.set(o.id, {
          target: o,
          colour: hexToRgb(o.color),
          size: o.size,
          offX: o.offsetX,
          offY: o.offsetY,
          alpha: 0,
          removing: false,
          phase: Math.random() * Math.PI * 2,
        });
    }
  }

  get active() {
    return this.live.size > 0;
  }

  // Draw one frame. "redrawn" says whether the front canvas changed (and needs uploading).
  draw(anchors: FaceAnchors | null, t: number, dt: number, stamp: string): { redrawn: boolean; back: boolean } {
    const k = 1 - Math.exp(-dt * 4.5); // ~1s to settle
    const f = this.fctx;
    const b = this.bctx;
    const hasLive = this.live.size > 0;
    let backUsed = false;

    if (!hasLive && stamp === this.lastStamp && !this.frontDirty) return { redrawn: false, back: false };
    f.clearRect(0, 0, OV_W, OV_H);
    if (this.backDirty) b.clearRect(0, 0, OV_W, OV_H);
    this.backDirty = false;

    if (anchors) {
      for (const [id, l] of this.live) {
        const o = l.target;
        l.alpha += ((l.removing ? 0 : 1) - l.alpha) * k;
        if (l.removing && l.alpha < 0.02) {
          this.live.delete(id);
          continue;
        }
        const tc = hexToRgb(o.color);
        l.colour = l.colour.map((v, i) => v + (tc[i] - v) * k) as RGB;
        l.size += (o.size - l.size) * k;
        l.offX += (o.offsetX - l.offX) * k;
        l.offY += (o.offsetY - l.offY) * k;
        if (this.drawOne(l, anchors, t, f, b)) backUsed = true;
      }
    }

    // Vintage orange date stamp, bottom-right.
    f.save();
    f.font = `700 22px ui-monospace, "Courier New", monospace`;
    f.textAlign = "right";
    f.fillStyle = "#ff8a1e";
    f.shadowColor = "#ff5a00";
    f.shadowBlur = 8;
    f.globalAlpha = 0.92;
    f.fillText(stamp, OV_W * 0.89, OV_H * 0.9);
    f.restore();
    this.lastStamp = stamp;
    this.frontDirty = hasLive;
    if (backUsed) this.backDirty = true;
    return { redrawn: true, back: backUsed };
  }

  private drawOne(l: Live, a: FaceAnchors, t: number, f: CanvasRenderingContext2D, b: CanvasRenderingContext2D): boolean {
    const o = l.target;
    const faceW = a.faceW * OV_W;
    const anchor = a[o.anchor];
    const cos = Math.cos(a.roll);
    const sin = Math.sin(a.roll);
    // Offsets are in face widths and rotate with the head.
    const ox = l.offX * faceW;
    const oy = l.offY * faceW;
    let x = anchor.x * OV_W + ox * cos - oy * sin;
    let y = anchor.y * OV_H + ox * sin + oy * cos;
    let scale = 1;
    let rot = a.roll;
    let alpha = l.alpha;
    let behind = false;
    const appear = 0.6 + 0.4 * l.alpha; // grows in as it fades in

    switch (o.animation) {
      case "orbit": {
        const th = t * 1.3 + l.phase;
        const r = faceW * (0.95 + 0.2 * l.size);
        x += Math.cos(th) * r;
        y += Math.sin(th) * r * 0.32;
        behind = Math.sin(th) < 0;
        scale = 1 + 0.18 * Math.sin(th);
        break;
      }
      case "float":
        y += Math.sin(t * 2 + l.phase) * faceW * 0.06;
        break;
      case "pulse":
        scale = 1 + 0.12 * Math.sin(t * 4 + l.phase);
        break;
      case "spin":
        rot += t * 1.6;
        break;
      case "blink":
        alpha *= 0.55 + 0.45 * (Math.sin(t * 6 + l.phase) > 0 ? 1 : 0);
        break;
    }

    if (o.kind === "halo") {
      const rx = faceW * 0.5 * l.size * appear;
      const ry = rx * 0.26;
      const col = rgbStr(l.colour, alpha);
      const ring = (g: CanvasRenderingContext2D, start: number, end: number) => {
        g.save();
        g.translate(x, y);
        g.rotate(a.roll);
        g.strokeStyle = col;
        g.lineWidth = Math.max(3, faceW * 0.045);
        g.shadowColor = rgbStr(l.colour, 1);
        g.shadowBlur = 22;
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, start, end);
        g.stroke();
        g.strokeStyle = rgbStr(shadeRgb(l.colour, 0.75), alpha);
        g.lineWidth = Math.max(1, faceW * 0.015);
        g.shadowBlur = 0;
        g.stroke();
        g.restore();
      };
      ring(b, Math.PI, Math.PI * 2); // far half, hidden by the head
      ring(f, 0, Math.PI);
      return true;
    }

    const g = behind ? b : f;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(rot);
    g.scale(scale * appear, scale * appear);

    if (o.kind === "icon") {
      const icon = iconCanvas(o.icon ?? "star", o.color ?? ICON_COLOURS[o.icon ?? ""] ?? "#00f0ff");
      if (icon) {
        const s = faceW * 0.6 * l.size;
        g.drawImage(icon, -s * 0.625, -s * 0.625, s * 1.25, s * 1.25);
      }
    } else if (o.kind === "text") {
      const px = Math.max(14, faceW * 0.26 * l.size);
      g.font = `700 ${px}px ${this.bodyFont}, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const metal = g.createLinearGradient(0, -px / 2, 0, px / 2);
      metal.addColorStop(0, rgbStr(shadeRgb(l.colour, 0.65)));
      metal.addColorStop(0.5, rgbStr(l.colour));
      metal.addColorStop(1, rgbStr(shadeRgb(l.colour, -0.35)));
      g.shadowColor = rgbStr(l.colour, 0.9);
      g.shadowBlur = 16;
      g.lineWidth = Math.max(2, px * 0.08);
      g.strokeStyle = "rgba(0,0,0,0.45)";
      g.strokeText(o.text ?? "", 0, 0);
      g.fillStyle = metal;
      g.fillText(o.text ?? "", 0, 0);
    }
    g.restore();
    return behind;
  }
}

// "'26 10 09  14:32" like an old point-and-shoot.
export function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `'${String(d.getFullYear()).slice(2)} ${p(d.getMonth() + 1)} ${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
}
