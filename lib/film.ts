"use client";

import type { RecallRound } from "@/components/RecallGame";
import type { Credit } from "@/lib/director/catalog";
import type { Charge } from "@/lib/verdict/schema";

// The film's running order. Progress is saved after every cut so a refresh resumes the same scene.
export const SCENES = ["opening", "cast", "act1-card", "act1", "act2-card", "act2", "act3", "credits"] as const;
export type SceneId = (typeof SCENES)[number];

export interface WitnessResult {
  score: number;
  max: number;
  best: number;
  bestLine: string;
  rounds?: RecallRound[];
}

export interface DirectorResult {
  lines: string[];
  takes: number;
  credits: Credit[];
  strip: string | null; // JPEG data URL, so it survives a refresh
  freeze?: string | null; // the frame Act III freezes on (JPEG data URL)
  demo?: boolean; // shot without a real camera
}

export interface VerdictResult extends Charge {
  engine: string;
  poster: string | null; // stamped poster, JPEG data URL
}

export interface FilmState {
  scene: SceneId;
  name: string;
  seen: boolean; // has watched the opening once: unlocks Select Scene from the start
  witness: WitnessResult | null;
  director: DirectorResult | null;
  verdict?: VerdictResult | null;
}

const KEY = "swys-film";
export const FRESH: FilmState = { scene: "opening", name: "", seen: false, witness: null, director: null, verdict: null };

let resuming: boolean | null = null;

// A refresh resumes the same scene; a new visit (new tab or browser session) starts the film from
// the top, keeping the star's name and the Select Scene unlock.
export function loadFilm(): FilmState {
  try {
    // Decided once per page load (React may mount twice in development).
    resuming ??= sessionStorage.getItem(KEY) === "1";
    sessionStorage.setItem(KEY, "1");
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<FilmState> | null;
    if (!raw || !SCENES.includes(raw.scene as SceneId)) return FRESH;
    const saved = { ...FRESH, ...raw };
    return resuming ? saved : { ...saved, scene: "opening" };
  } catch {
    return FRESH;
  }
}

export function saveFilm(s: FilmState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Quota or private mode: retry without the big images, then give up quietly.
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...s, director: s.director && { ...s.director, strip: null, freeze: null } }));
    } catch {}
  }
}

export const starName = (s: FilmState) => s.name || "You";

// ---------- "Roll camera" cue: forgiving, because Wispr dictates into the box ----------

const CUE_WORDS = ["roll", "rolling", "camera", "action", "start", "begin", "pick", "lets", "go", "play", "shoot", "ready"];

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function isRollCue(text: string) {
  const words = text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  return words.some((w) =>
    CUE_WORDS.some((c) => w === c || (c.length >= 4 && w.length >= 4 && distance(w, c) <= (c.length >= 6 ? 2 : 1)))
  );
}

// Tidy a dictated name: "my name is adi." -> "Adi"
export function cleanName(raw: string) {
  const t = raw
    .replace(/^\s*(it'?s|i'?m|i am|my name is|this is|call me|starring)\s+/i, "")
    .replace(/[.!?,;:"“”]+/g, "")
    .trim()
    .slice(0, 28);
  return t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

// ---------- Images ----------

export async function blobToJpeg(blob: Blob, quality = 0.86): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext("2d")!;
  g.drawImage(bmp, 0, 0);
  return c.toDataURL("image/jpeg", quality);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

// A 4:5 credits card for sharing: title, star, scores, best line, the director's scenes and the strip.
export async function buildCreditsCard(s: FilmState): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const serif = css.getPropertyValue("--font-serif").trim() || "Georgia, serif";
  const sans = css.getPropertyValue("--font-body").trim() || "system-ui, sans-serif";
  const CREAM = "#f3e9d2";
  const AMBER = "#ffb547";
  const DIM = "#9b8f7a";

  g.fillStyle = "#050403";
  g.fillRect(0, 0, W, H);
  // Warm key light from the top, pooling at the bottom
  const beam = g.createRadialGradient(W / 2, -120, 40, W / 2, -120, 1100);
  beam.addColorStop(0, "rgba(255,190,110,0.22)");
  beam.addColorStop(1, "rgba(255,190,110,0)");
  g.fillStyle = beam;
  g.fillRect(0, 0, W, H);

  const art = s.verdict?.poster ?? s.director?.strip;
  const strip = art ? await loadImage(art).catch(() => null) : null;
  const stripW = strip ? 300 : 0;
  const stripH = strip ? Math.min(H - 220, (strip.height / strip.width) * stripW) : 0;
  const left = 80;
  const colW = strip ? W - stripW - left * 2 - 50 : W - left * 2;
  if (strip) {
    const x = W - left - stripW;
    const y = (H - stripH) / 2;
    g.save();
    g.shadowColor = "rgba(255,170,80,0.35)";
    g.shadowBlur = 40;
    g.drawImage(strip, x, y, stripW, stripH);
    g.restore();
  }

  let y = 150;
  g.textAlign = "left";
  g.fillStyle = AMBER;
  g.font = `600 22px ${sans}`;
  g.fillText("A FILM DIRECTED BY VOICE", left, y);
  y += 90;
  g.fillStyle = CREAM;
  g.shadowColor = "rgba(255,180,90,0.45)";
  g.shadowBlur = 30;
  g.font = `600 84px ${serif}`;
  for (const l of wrapText(g, "Say What You Saw", colW)) {
    g.fillText(l, left, y);
    y += 86;
  }
  g.shadowBlur = 0;

  const block = (label: string, value: string, size = 46) => {
    y += 46;
    g.fillStyle = AMBER;
    g.font = `600 20px ${sans}`;
    g.fillText(label.toUpperCase(), left, y);
    y += size + 6;
    g.fillStyle = CREAM;
    g.font = `500 ${size}px ${serif}`;
    for (const l of wrapText(g, value, colW).slice(0, 3)) {
      g.fillText(l, left, y);
      y += size + 4;
    }
  };

  block("Starring", starName(s), 56);
  if (s.verdict) block("Also known as", `“${s.verdict.alias}”`, 36);
  const w = s.witness;
  block("Witness score", w ? `${w.score} / ${w.max}   ·   best ${w.best}` : "Did not testify");
  if (w?.bestLine) block("Best line", `“${w.bestLine}”`, 32);
  const d = s.director;
  block("Directed by", `${starName(s)}, by voice${d ? ` · ${d.takes} take${d.takes === 1 ? "" : "s"}` : ""}`, 36);
  if (d?.lines.length) block("Final scene", `“${d.lines[d.lines.length - 1]}”`, 30);

  g.fillStyle = DIM;
  g.font = `500 20px ${sans}`;
  g.fillText("Dictated with Wispr Flow  ·  Made by Adi", left, H - 90);
  g.fillText("say-what-you-saw.vercel.app", left, H - 60);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}

export function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
