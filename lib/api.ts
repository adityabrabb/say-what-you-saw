import type { Scene, Video } from "./scene";

// Client-side helper for the /api/generate route.
export async function requestScenes(description: string, mode: "recall" | "studio"): Promise<Scene[] & { engine?: string }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, mode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return Object.assign(data.scenes as Scene[], { engine: data.engine as string | undefined });
}

export interface EditResult {
  video: Video;
  changes: string[];
  scenes: number[];
  summary: string;
  engine?: string;
}

// Client-side helper for the /api/edit route.
export async function requestEdit(video: Video, instruction: string, currentScene: number): Promise<EditResult> {
  const res = await fetch("/api/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video, instruction, currentScene }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as EditResult;
}
