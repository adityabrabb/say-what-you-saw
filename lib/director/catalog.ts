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

// Score every background against some text; images win ties only if they really fit.
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
  for (const p of catalog.procedural) {
    const s = score(p);
    if (s > 0 && (!best || s > best.s)) best = { type: "procedural", id: p.id, s };
  }
  return best ? { type: best.type, id: best.id } : null;
}

export const isProcedural = (id: string) => (PROCEDURAL_BACKGROUNDS as readonly string[]).includes(id);
