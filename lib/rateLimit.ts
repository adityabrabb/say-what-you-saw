// Per-IP sliding-window limiter (in memory, per server instance). Used by the routes that call a model.
// Going over is never an error for the player: the route answers from its offline engine instead.
const windows = new Map<string, number[]>();

export function overLimit(bucket: string, ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${bucket}|${ip}`;
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  windows.set(key, recent);
  if (windows.size > 5000) windows.clear();
  return recent.length > max;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

// 60 model-backed requests per hour per IP on each of generate and direct (a shared Wi-Fi can replay the film).
export const HOURLY_LIMIT = 60;
export const HOUR_MS = 3_600_000;
