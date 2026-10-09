import { NextResponse } from "next/server";
import { ProviderSession, type Message } from "@/lib/providers";
import { offlineRoast, quoteOf } from "@/lib/roast/offline";
import { ROAST_SYSTEM, roastUser } from "@/lib/roast/prompt";
import { roastReplySchema, roastRequestSchema, type RoastRequest, type RoastResult } from "@/lib/roast/schema";

export const maxDuration = 30;

// The director's roasts: text in, one line out. Always answers: if the model is down, slow, rate
// limited or off-brief, the line comes from the house pool instead of an error.

// ---------- Rate limit: 24 roasts a minute per client ----------
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) hits.clear();
  return recent.length > 24;
}

// ---------- Cache: same request -> same roast, for 10 minutes ----------
const cache = new Map<string, { at: number; value: RoastResult }>();
function cached(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  cache.delete(key);
  return null;
}
function remember(key: string, value: RoastResult) {
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["that", "this", "with", "there", "were", "what", "have", "just", "like", "some", "from", "they", "then", "them", "very", "about", "would", "could", "maybe", "think", "said"]);

// Appearance and identity words the director must never use. Words the player said themselves are
// allowed back (it's their quote); anything the model brings in is not.
const OFF_LIMITS = /\b(face|faces|ugly|fat|skinny|chubby|hair|bald|nose|teeth|skin|body|weight|beard|wrinkles?|old|young|age|aged|gender|race|racial|accent|voice|eyes|handsome|pretty|attractive|hideous|gorgeous|religion|religious)\b/gi;

// A good roast quotes the player (at least one real word of theirs) and stays off-limits-free.
function onBrief(line: string, req: RoastRequest): boolean {
  const said = norm(req.said);
  const sayWords = said.split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
  const own = new Set(said.split(" "));
  const bad = (line.match(OFF_LIMITS) ?? []).some((w) => !own.has(w.toLowerCase()));
  if (bad) return false;
  if (!sayWords.length) return true;
  const out = new Set(norm(line).split(" "));
  return sayWords.some((w) => out.has(w));
}

export async function POST(req: Request) {
  const parsed = roastRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { kind, said }" }, { status: 400 });
  const input = parsed.data;
  const house = (): RoastResult => ({ line: offlineRoast(input), engine: "offline" });

  // Local commands and silences never need a model.
  if (input.kind === "shot" || input.kind === "undo" || !input.said) return NextResponse.json(house());

  const key = JSON.stringify(input);
  const hit = cached(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) return NextResponse.json(house());

  const session = new ProviderSession();
  const messages: Message[] = [
    { role: "system", content: ROAST_SYSTEM },
    { role: "user", content: roastUser(input) },
  ];
  let result: RoastResult | null = null;
  try {
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const reply = await session.call(messages, 140);
      try {
        const check = roastReplySchema.safeParse(extractJson(reply));
        if (!check.success) throw new Error('Reply must be {"line": "..."} with 8 to 170 characters');
        const line = check.data.line.replace(/\s+/g, " ");
        if (!onBrief(line, input))
          throw new Error(`Off brief: quote a few of the player's own words (e.g. "${quoteOf(input.said, 4)}") and never mention looks, body, voice or identity`);
        result = { line, engine: session.used };
      } catch (err) {
        messages.push(
          { role: "assistant", content: reply },
          { role: "user", content: `Invalid: ${(err as Error).message.slice(0, 300)}\nReply with only {"line": "..."}.` }
        );
      }
    }
  } catch (err) {
    console.warn("Roast AI unavailable, using the house roasts:", (err as Error).message.slice(0, 200));
  }
  if (!result) result = house();
  remember(key, result);
  return NextResponse.json(result);
}
