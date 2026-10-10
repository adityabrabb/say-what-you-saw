import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bestBackground, isProcedural, photoFor, type Catalog } from "@/lib/director/catalog";
import { offlineDirect } from "@/lib/director/offline";
import { directorPrompt } from "@/lib/director/prompt";
import { applyShotPatch, clampSettings, DEFAULT_SETTINGS, patchSchema, repairPatch, settingsSchema, type ShotPatch, type ShotSettings } from "@/lib/director/settings";
import { closestIcon } from "@/lib/iconMatch";
import { ICON_GROUPS } from "@/lib/icons";
import { clientIp, HOUR_MS, HOURLY_LIMIT, overLimit } from "@/lib/rateLimit";
import { ProviderSession, type Message } from "@/lib/providers";

export const maxDuration = 60;

// ---------- Catalog (read once per instance) ----------
let catalogPromise: Promise<Catalog> | null = null;
const loadCatalog = () =>
  (catalogPromise ??= readFile(path.join(process.cwd(), "public/backgrounds/backgrounds.json"), "utf8").then((t) => JSON.parse(t) as Catalog));

// ---------- Cache: same line + same settings -> same patch, for 10 minutes ----------
const cache = new Map<string, { at: number; value: { patch: ShotPatch; note: string; engine: string } }>();
function cached(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  cache.delete(key);
  return null;
}
function remember(key: string, value: { patch: ShotPatch; note: string; engine: string }) {
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

const body = z.object({ line: z.string().trim().min(1).max(300), settings: z.unknown() });

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

// Make a validated patch safe to apply: real background ids, known icons, sane overlays.
function sanitise(patch: ShotPatch, catalog: Catalog, line: string): ShotPatch {
  const p = structuredClone(patch);
  if (p.background?.id) {
    const id = p.background.id;
    const isImage = catalog.images.some((i) => i.id === id);
    if (isImage) p.background.type = "image";
    else if (isProcedural(id)) {
      // Real photos first: a generated backdrop is swapped for its photograph whenever there is one.
      const photo = photoFor(catalog, id);
      if (photo) p.background = { ...p.background, type: "image", id: photo };
      else p.background.type = "procedural";
    }
    else if (id === "camera") p.background.type = "camera";
    else {
      // Unknown id: pick the best photo for the line, else the plain lamplit room.
      const best = bestBackground(catalog, `${line} ${id}`);
      const room = photoFor(catalog, "studio-backdrop");
      p.background = { ...p.background, ...(best ?? (room ? { type: "image" as const, id: room } : { type: "procedural" as const, id: "studio-backdrop" })) };
    }
  }
  for (const o of [...(p.overlays?.add ?? []), ...(p.overlays?.update ?? [])])
    if (o.icon && !(o.icon in ICON_GROUPS)) o.icon = closestIcon(o.icon);
  return p;
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { line, settings }" }, { status: 400 });
  const { line } = parsed.data;
  const current = settingsSchema.safeParse(parsed.data.settings);
  let settings: ShotSettings;
  try {
    const raw = current.success ? current.data : parsed.data.settings && typeof parsed.data.settings === "object" ? { ...DEFAULT_SETTINGS, ...(parsed.data.settings as Partial<ShotSettings>) } : DEFAULT_SETTINGS;
    settings = clampSettings(raw);
  } catch {
    settings = DEFAULT_SETTINGS; // junk settings from a stray client: start from a clean shot
  }
  const catalog = await loadCatalog();

  const key = JSON.stringify([line.toLowerCase(), settings]);
  const hit = cached(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  // Over the hourly limit: no model call, the offline director answers and the film plays on.
  if (overLimit("direct", clientIp(req), HOURLY_LIMIT, HOUR_MS)) {
    const off = offlineDirect(line, settings, catalog);
    const patch = sanitise(off.patch, catalog, line);
    applyShotPatch(settings, patch);
    return NextResponse.json({ patch, note: off.note, engine: "offline", limited: true });
  }

  const session = new ProviderSession();
  const messages: Message[] = [
    { role: "system", content: directorPrompt(catalog) },
    { role: "user", content: `Current settings:\n${JSON.stringify(settings)}\n\nDirector says: "${line}"` },
  ];

  let result: { patch: ShotPatch; note: string; engine: string } | null = null;
  let lastRaw: unknown = null;
  try {
    // One attempt plus one retry with the validation error fed back.
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const reply = await session.call(messages, 900);
      try {
        const json = extractJson(reply) as { patch?: unknown; note?: unknown };
        lastRaw = json.patch ?? json;
        const check = patchSchema.safeParse(lastRaw);
        if (!check.success) throw new Error(z.prettifyError(check.error));
        result = { patch: check.data, note: typeof json.note === "string" ? json.note.slice(0, 80) : "", engine: session.used };
      } catch (err) {
        messages.push(
          { role: "assistant", content: reply },
          { role: "user", content: `Invalid: ${(err as Error).message.slice(0, 400)}\nReturn only {"patch": {...}, "note": "..."} with valid fields.` }
        );
      }
    }
    // Still invalid after the retry: keep whatever parts are valid.
    if (!result && lastRaw) {
      const repaired = repairPatch(lastRaw);
      if (Object.keys(repaired).length) result = { patch: repaired, note: "", engine: `${session.used} (repaired)` };
    }
  } catch (err) {
    console.warn("Director AI unavailable, using offline rules:", (err as Error).message.slice(0, 200));
  }
  if (!result) result = { ...offlineDirect(line, settings, catalog), engine: "offline" };

  result.patch = sanitise(result.patch, catalog, line);
  // Prove the patch applies cleanly before sending it.
  applyShotPatch(settings, result.patch);
  remember(key, result);
  return NextResponse.json(result);
}
