import { z } from "zod";
import { STAGE_H, STAGE_W, type Scene } from "./scene";

// Runtime validation for LLM output. Mirrors the types in scene.ts.
const point = z.object({ x: z.number(), y: z.number() });

const sceneObject = z.object({
  id: z.string().min(1),
  type: z.enum(["circle", "rect", "star", "text", "arrow", "image"]),
  x: z.number(),
  y: z.number(),
  r: z.number().positive().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  dashed: z.boolean().optional(),
  glow: z.boolean().optional(),
  text: z.string().optional(),
  fontSize: z.number().positive().optional(),
  href: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  scale: z.number().positive().optional(),
  follow: z.string().optional(),
});

const timing = { target: z.string(), start: z.number().min(0), duration: z.number().min(0) };

const animation = z.discriminatedUnion("action", [
  z.object({ ...timing, action: z.literal("move"), to: point }),
  z.object({ ...timing, action: z.literal("fade"), to: z.number().min(0).max(1) }),
  z.object({ ...timing, action: z.literal("grow"), to: z.number().positive() }),
  z.object({
    ...timing,
    action: z.literal("orbit"),
    around: z.union([z.string(), point]),
    radius: z.number().positive(),
    turns: z.number(),
    startAngle: z.number().optional(),
  }),
]);

const scene = z.object({
  id: z.string().min(1),
  title: z.string(),
  duration: z.number().positive().max(60),
  background: z.string().optional(),
  stars: z.boolean().optional(),
  caption: z.string().optional(),
  objects: z.array(sceneObject).min(1).max(40),
  timeline: z.array(animation).max(80),
});

export const scenesResponse = z.object({ scenes: z.array(scene).min(1).max(6) });

// Check references and keep things on stage. Returns a list of problems the LLM should fix.
export function checkScene(s: Scene): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const o of s.objects) {
    if (ids.has(o.id)) problems.push(`duplicate object id "${o.id}"`);
    ids.add(o.id);
  }
  for (const o of s.objects) {
    if (o.follow && !ids.has(o.follow)) problems.push(`object "${o.id}" follows unknown id "${o.follow}"`);
  }
  for (const a of s.timeline) {
    if (!ids.has(a.target)) problems.push(`animation targets unknown id "${a.target}"`);
    if (a.action === "orbit" && typeof a.around === "string" && !ids.has(a.around))
      problems.push(`orbit around unknown id "${a.around}"`);
  }
  return problems;
}

// Gentle auto-repair: clamp absolute positions onto the stage so nothing is lost off-screen.
export function clampToStage(s: Scene): Scene {
  const clampX = (v: number) => Math.min(STAGE_W - 10, Math.max(10, v));
  const clampY = (v: number) => Math.min(STAGE_H - 10, Math.max(10, v));
  return {
    ...s,
    objects: s.objects.map((o) =>
      o.follow
        ? o
        : {
            ...o,
            x: clampX(o.x),
            y: clampY(o.y),
            ...(o.x2 !== undefined && { x2: clampX(o.x2) }),
            ...(o.y2 !== undefined && { y2: clampY(o.y2) }),
          }
    ),
    timeline: s.timeline.map((a) => (a.action === "move" ? { ...a, to: { x: clampX(a.to.x), y: clampY(a.to.y) } } : a)),
  };
}
