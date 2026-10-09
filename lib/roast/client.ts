import { offlineRoast } from "./offline";
import type { RoastRequest, RoastResult } from "./schema";

// Asks the server for a roast; a slow or failed call becomes a house roast, so the director never goes quiet.
export async function requestRoast(req: RoastRequest): Promise<RoastResult> {
  const house = (): RoastResult => ({ line: offlineRoast(req, Math.floor(Math.random() * 1e6)), engine: "offline" });
  if (req.kind === "shot" || req.kind === "undo" || !req.said.trim()) return house();
  try {
    const res = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(7000),
    });
    const data = (await res.json()) as Partial<RoastResult>;
    if (!res.ok || typeof data.line !== "string" || data.line.length < 8) throw new Error("bad roast");
    return { line: data.line, engine: data.engine ?? "?" };
  } catch {
    return house();
  }
}
