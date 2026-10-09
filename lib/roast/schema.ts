import { z } from "zod";

// The director's roasts: text in, one short line out. Never images, never anyone's looks or identity.
export const roastRequestSchema = z.object({
  kind: z.enum(["answer", "direction", "shot", "undo"]),
  said: z.string().trim().max(400).default(""),
  truth: z.string().trim().max(400).default(""), // what was really in the Recall scene
  score: z.number().min(0).max(100).nullable().default(null),
});
export type RoastRequest = z.infer<typeof roastRequestSchema>;

export const roastReplySchema = z.object({ line: z.string().trim().min(8).max(170) });

export interface RoastResult {
  line: string;
  engine: string;
}
