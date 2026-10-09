import { z } from "zod";

// Act III: everything the film knows about the "suspect", as text only. No images ever leave the device.
export const caseFileSchema = z.object({
  name: z.string().trim().max(40).default(""),
  witnessScore: z.number().int().min(0).max(1000).nullable().default(null),
  witnessMax: z.number().int().min(0).max(1000).nullable().default(null),
  rounds: z
    .array(z.object({ title: z.string().max(80), truth: z.string().max(400), said: z.string().max(400), score: z.number().min(0).max(100) }))
    .max(5)
    .default([]),
  directorLines: z.array(z.string().max(200)).max(20).default([]),
});
export type CaseFile = z.infer<typeof caseFileSchema>;

// What the model returns: the charge sheet printed on the wanted poster.
export const chargeSchema = z.object({
  alias: z.string().trim().min(2).max(40),
  crime: z.string().trim().min(8).max(150),
  evidence: z
    .array(z.object({ quote: z.string().trim().min(1).max(160), note: z.string().trim().min(2).max(90) }))
    .length(3),
  reward: z.string().trim().min(3).max(80),
});
export type Charge = z.infer<typeof chargeSchema>;
