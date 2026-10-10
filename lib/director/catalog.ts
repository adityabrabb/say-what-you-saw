import { PROCEDURAL_BACKGROUNDS } from "./settings";

// The background catalog lives in public/backgrounds/backgrounds.json.

export interface Credit {
  title: string;
  author: string;
  license: string;
  url: string;
}
export interface ImageBackground {
  id: string;
  file: string;
  tags: string[];
  moods: string[];
  time: string;
  credit: Credit;
}
export interface ProceduralEntry {
  id: string;
  tags: string[];
  moods: string[];
  time: string;
}
export interface Catalog {
  images: ImageBackground[];
  procedural: ProceduralEntry[];
}

// Real photos are always preferred. Each generated backdrop has a photo that stands in for it, so the
// Director never shows a procedural scene while a matching photograph exists.
export const PHOTO_FOR_PROCEDURAL: Record<string, string> = {
  "neon-rain-city": "noir-rainy-avenue",
  "star-field": "northern-lights",
  "sunset-gradient": "noir-skyline-dusk",
  "studio-backdrop": "noir-lamplit-room",
  "foggy-forest": "noir-misty-pines",
};

export function photoFor(catalog: Catalog | null | undefined, proceduralId: string): string | null {
  const id = PHOTO_FOR_PROCEDURAL[proceduralId];
  return id && catalog?.images.some((i) => i.id === id) ? id : null;
}

// Score every background against some text. Photos win over generated backdrops (a generated one
// only wins when no photo matches at all, and then it is swapped for its photo if it has one).
// Returns null when nothing matches at all.
export function bestBackground(catalog: Catalog, text: string): { type: "image" | "procedural"; id: string } | null {
  const t = ` ${text.toLowerCase()} `;
  const score = (e: { tags: string[]; moods: string[]; time: string }) =>
    e.tags.reduce((s, tag) => s + (t.includes(tag) ? (tag.includes(" ") ? 3 : 2) : 0), 0) +
    e.moods.reduce((s, m) => s + (t.includes(m) ? 1 : 0), 0) +
    (e.time !== "any" && t.includes(e.time) ? 1 : 0);
  let best: { type: "image" | "procedural"; id: string; s: number } | null = null;
  for (const img of catalog.images) {
    const s = score(img);
    if (s > 0 && (!best || s > best.s)) best = { type: "image", id: img.id, s };
  }
  if (best) return { type: "image", id: best.id };
  for (const p of catalog.procedural) {
    const s = score(p);
    if (s > 0 && (!best || s > best.s)) best = { type: "procedural", id: p.id, s };
  }
  if (best?.type === "image") return { type: "image", id: best.id };
  if (best) {
    const photo = photoFor(catalog, best.id);
    return photo ? { type: "image", id: photo } : { type: "procedural", id: best.id };
  }
  return null;
}

export const isProcedural = (id: string) => (PROCEDURAL_BACKGROUNDS as readonly string[]).includes(id);
