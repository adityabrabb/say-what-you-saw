import { NextResponse } from "next/server";
import { generateScenes, type GenerateMode } from "@/lib/generate";
import { buildOfflineScene } from "@/lib/offline";
import type { Scene } from "@/lib/scene";

export const maxDuration = 60;

// Recall is waiting on this call, so it must never hang: even if every provider stalls, the local
// keyword builder answers by this deadline. (Healthy models answer in about a second.)
const RECALL_DEADLINE_MS = 18_000;

// Same description -> same scene, for 10 minutes (instant on a repeat, and consistent).
const cache = new Map<string, { at: number; value: { scenes: Scene[]; engine: string } }>();
function cached(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  cache.delete(key);
  return null;
}
function remember(key: string, value: { scenes: Scene[]; engine: string }) {
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

export async function POST(req: Request) {
  let body: { description?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const mode: GenerateMode = body.mode === "studio" ? "studio" : "recall";
  if (!description) return NextResponse.json({ error: "Description is empty" }, { status: 400 });
  if (description.length > 4000) return NextResponse.json({ error: "Description is too long" }, { status: 400 });

  const key = `${mode}|${description.toLowerCase().replace(/\s+/g, " ")}`;
  const hit = cached(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  try {
    let result: { scenes: Scene[]; engine: string };
    if (mode === "recall") {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<{ scenes: Scene[]; engine: string }>((resolve) => {
        timer = setTimeout(() => resolve({ scenes: [buildOfflineScene(description, "recall")], engine: "offline" }), RECALL_DEADLINE_MS);
      });
      try {
        result = await Promise.race([generateScenes(description, mode), deadline]);
      } finally {
        clearTimeout(timer);
      }
    } else {
      const { scenes, engine } = await generateScenes(description, mode);
      result = { scenes, engine };
    }
    // Remember real answers only: a local fallback shouldn't stick if the models recover.
    if (result.engine !== "offline") remember(key, result);
    return NextResponse.json({ scenes: result.scenes, engine: result.engine });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
