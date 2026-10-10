import { z } from "zod";

// The trailer's narration: text in (the session's words), four title lines out. Never images.
export const trailerRequestSchema = z.object({
  name: z.string().trim().max(40).default(""),
  witnessScore: z.number().int().min(0).max(1000).nullable().default(null),
  witnessMax: z.number().int().min(0).max(1000).nullable().default(null),
  said: z.array(z.string().max(300)).max(5).default([]), // what they said in each Recall round
  directorLines: z.array(z.string().max(200)).max(20).default([]),
  alias: z.string().max(40).default(""),
  crime: z.string().max(160).default(""),
});
export type TrailerRequest = z.infer<typeof trailerRequestSchema>;

export const trailerReplySchema = z.object({ lines: z.array(z.string().trim().min(6).max(90)).length(4) });
export interface TrailerLines {
  lines: [string, string, string, string];
  engine: string;
}
