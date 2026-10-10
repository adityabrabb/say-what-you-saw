import { offlineTrailerLines } from "./offline";
import type { TrailerLines, TrailerRequest } from "./schema";

// Text only goes to the model. A slow, failed or odd reply gets the house narration, so the trailer
// never waits on, or breaks because of, the network.
export async function requestTrailerLines(req: TrailerRequest, timeoutMs = 9000): Promise<TrailerLines> {
  try {
    const res = await fetch("/api/trailer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json()) as Partial<TrailerLines>;
    if (!res.ok || !Array.isArray(data.lines) || data.lines.length !== 4 || data.lines.some((l) => typeof l !== "string" || !l.trim())) throw new Error("bad lines");
    return { lines: data.lines as TrailerLines["lines"], engine: data.engine ?? "ai" };
  } catch {
    return { lines: offlineTrailerLines(req), engine: "offline" };
  }
}
