import { NextResponse } from "next/server";
import { ProviderSession, type Message } from "@/lib/providers";
import { offlineTrailerLines } from "@/lib/trailer/offline";
import { TRAILER_SYSTEM, trailerUser } from "@/lib/trailer/prompt";
import { trailerReplySchema, trailerRequestSchema, type TrailerLines, type TrailerRequest } from "@/lib/trailer/schema";

export const maxDuration = 60;

// Trailer narration: text in (the session's words), four title lines out. Never images.
// Same provider chain as the rest of the film, with a cache, a rate limit and a funny house fallback.

const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) hits.clear();
  return recent.length > 6;
}

const cache = new Map<string, { at: number; value: TrailerLines }>();
function cached(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  cache.delete(key);
  return null;
}
function remember(key: string, value: TrailerLines) {
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Appearance and identity words the narrator must never bring in (words the player said are allowed back).
const OFF_LIMITS = /\b(face|faces|ugly|fat|skinny|chubby|hair|bald|nose|teeth|skin|body|weight|beard|wrinkles?|old|young|age|aged|gender|race|racial|accent|voice|eyes|handsome|pretty|attractive|hideous|gorgeous|religion|religious)\b/gi;

// Anything in “curly quotes” must be something the player really said; no off-limits words.
function onBrief(lines: string[], req: TrailerRequest): string | null {
  const said = [...req.said, ...req.directorLines, req.name].map(norm).filter(Boolean);
  const own = new Set(said.join(" ").split(" "));
  for (const line of lines) {
    if ((line.match(OFF_LIMITS) ?? []).some((w) => !own.has(w.toLowerCase()))) return "Never mention looks, body, voice, age or identity";
    for (const m of line.matchAll(/[“"]([^”"]{3,})[”"]/g)) {
      const q = norm(m[1]);
      if (q && !said.some((s) => s.includes(q))) return `“${m[1]}” was never said. Only quote real words`;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const parsed = trailerRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the session text" }, { status: 400 });
  const input = parsed.data;
  const house = (): TrailerLines => ({ lines: offlineTrailerLines(input), engine: "offline" });

  const key = JSON.stringify(input);
  const hit = cached(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) return NextResponse.json(house());

  const session = new ProviderSession();
  const messages: Message[] = [
    { role: "system", content: TRAILER_SYSTEM },
    { role: "user", content: trailerUser(input) },
  ];
  let result: TrailerLines | null = null;
  try {
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const reply = await session.call(messages, 260);
      try {
        const check = trailerReplySchema.safeParse(extractJson(reply));
        if (!check.success) throw new Error('Reply must be {"lines": [four strings, 6 to 90 characters each]}');
        const lines = check.data.lines.map((l) => l.replace(/\s+/g, " "));
        const problem = onBrief(lines, input);
        if (problem) throw new Error(problem);
        result = { lines: lines as TrailerLines["lines"], engine: session.used };
      } catch (err) {
        messages.push(
          { role: "assistant", content: reply },
          { role: "user", content: `Invalid: ${(err as Error).message.slice(0, 300)}\nReply with only {"lines": [four strings]}.` }
        );
      }
    }
  } catch (err) {
    console.warn("Trailer AI unavailable, using the house narration:", (err as Error).message.slice(0, 200));
  }
  if (!result) result = house();
  remember(key, result);
  return NextResponse.json(result);
}
