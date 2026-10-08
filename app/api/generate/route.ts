import { NextResponse } from "next/server";
import { generateScenes, type GenerateMode } from "@/lib/generate";

export const maxDuration = 60;

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

  try {
    const scenes = await generateScenes(description, mode);
    return NextResponse.json({ scenes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
