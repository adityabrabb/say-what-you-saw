import { NextResponse } from "next/server";
import { z } from "zod";
import { editVideo } from "@/lib/edit";
import { scenesResponse } from "@/lib/schema";
import type { Video } from "@/lib/scene";

export const maxDuration = 60;

const body = z.object({
  video: scenesResponse.extend({ title: z.string() }),
  instruction: z.string().trim().min(1).max(1000),
  currentScene: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const { video, instruction, currentScene } = parsed.data;
  try {
    const result = await editVideo(video as Video, instruction, currentScene);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Edit failed" }, { status: 502 });
  }
}
