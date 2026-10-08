import type { Scene } from "./scene";

// Client-side helper for the /api/generate route.
export async function requestScenes(description: string, mode: "recall" | "studio"): Promise<Scene[]> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, mode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data.scenes as Scene[];
}
