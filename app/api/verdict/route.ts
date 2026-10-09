import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderSession, type Message } from "@/lib/providers";
import { offlineCharge } from "@/lib/verdict/offline";
import { VERDICT_SYSTEM, verdictUser } from "@/lib/verdict/prompt";
import { caseFileSchema, chargeSchema, type CaseFile, type Charge } from "@/lib/verdict/schema";

export const maxDuration = 60;

// Act III: text in (name, testimony, director lines), charge sheet out. Never images.

// ---------- Rate limit: 6 verdicts per minute per client ----------
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) hits.clear();
  return recent.length > 6;
}

// ---------- Cache: same case file -> same charge, for 10 minutes ----------
type Result = Charge & { engine: string };
const cache = new Map<string, { at: number; value: Result }>();
function cached(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  cache.delete(key);
  return null;
}
function remember(key: string, value: Result) {
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

// Evidence must quote the suspect's real words, each exhibit a different line; anything invented or
// repeated is swapped for an unused real line (or the house "silence" exhibit).
function keepQuotesReal(charge: Charge, file: CaseFile): Charge {
  const said = [...file.rounds.map((r) => r.said), ...file.directorLines].map(norm).filter(Boolean);
  const real = (q: string) => {
    const n = norm(q);
    if (!said.length) return /silence|nothing|\.\.\./i.test(q);
    return n.length > 0 && said.some((s) => s.includes(n) || (n.length > 12 && n.includes(s)));
  };
  const used = new Set<string>();
  const spare = offlineCharge(file).evidence;
  const nextSpare = () => spare.find((s) => !used.has(norm(s.quote))) ?? { quote: "(silence)", note: "Refused to elaborate" };
  const evidence = charge.evidence.map((e) => {
    const n = norm(e.quote);
    const keep = real(e.quote) && (!used.has(n) || !said.length);
    const out = keep ? e : nextSpare();
    used.add(norm(out.quote));
    return out;
  });
  return { ...charge, evidence };
}

export async function POST(req: Request) {
  const parsed = caseFileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the case file" }, { status: 400 });
  const file = parsed.data;

  const key = JSON.stringify(file);
  const hit = cached(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  // Over the limit: still a verdict, just the house one.
  if (rateLimited(ip)) return NextResponse.json({ ...offlineCharge(file), engine: "offline" });

  const session = new ProviderSession();
  const messages: Message[] = [
    { role: "system", content: VERDICT_SYSTEM },
    { role: "user", content: verdictUser(file) },
  ];
  let result: Result | null = null;
  try {
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const reply = await session.call(messages, 700);
      try {
        const check = chargeSchema.safeParse(extractJson(reply));
        if (!check.success) throw new Error(z.prettifyError(check.error));
        result = { ...keepQuotesReal(check.data, file), engine: session.used };
      } catch (err) {
        messages.push(
          { role: "assistant", content: reply },
          { role: "user", content: `Invalid: ${(err as Error).message.slice(0, 400)}\nReturn only the JSON object with alias, crime, exactly 3 evidence items and reward.` }
        );
      }
    }
  } catch (err) {
    console.warn("Verdict AI unavailable, using the house verdict:", (err as Error).message.slice(0, 200));
  }
  if (!result) result = { ...offlineCharge(file), engine: "offline" };
  remember(key, result);
  return NextResponse.json(result);
}
