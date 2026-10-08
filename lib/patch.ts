import { z } from "zod";
import { snapIcons } from "./iconMatch";
import { animation, checkScene, clampToStage, ease, point, sceneObject, scenesResponse } from "./schema";
import { PARTICLES, type Animation, type Scene, type SceneObject, type Video } from "./scene";

// A voice edit is a small list of operations against the existing video, never a rewrite.

const sceneIndex = z.number().int().min(0);
const action = z.enum(["move", "fade", "grow", "orbit"]);

const objectChanges = sceneObject.omit({ id: true }).partial();
const animationChanges = z
  .object({
    start: z.number().min(0),
    duration: z.number().min(0),
    to: z.union([z.number(), point]),
    around: z.union([z.string(), point]),
    radius: z.number().positive(),
    turns: z.number(),
    startAngle: z.number(),
    ease,
  })
  .partial();
const sceneChanges = z
  .object({
    title: z.string(),
    duration: z.number().positive().max(60),
    background: z.string(),
    stars: z.boolean(),
    particles: z.enum(PARTICLES),
    camera: z.object({ zoom: z.number().min(0.5).max(2).optional(), panX: z.number().optional(), panY: z.number().optional() }),
    entrance: z.enum(["stagger", "none"]),
    glow: z.boolean(),
    caption: z.string(),
  })
  .partial();

const op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("updateObject"), scene: sceneIndex, id: z.string(), set: objectChanges }),
  z.object({ op: z.literal("addObject"), scene: sceneIndex, object: sceneObject }),
  z.object({ op: z.literal("removeObject"), scene: sceneIndex, id: z.string() }),
  z.object({ op: z.literal("addAnimation"), scene: sceneIndex, animation }),
  z.object({ op: z.literal("updateAnimation"), scene: sceneIndex, target: z.string(), action, set: animationChanges }),
  z.object({ op: z.literal("removeAnimation"), scene: sceneIndex, target: z.string(), action }),
  z.object({ op: z.literal("updateScene"), scene: sceneIndex, set: sceneChanges }),
]);

export const patchSchema = z.object({ summary: z.string(), ops: z.array(op).min(1).max(20) });

export type Patch = z.infer<typeof patchSchema>;
export type PatchOp = Patch["ops"][number];

const fmt = (v: unknown): string => {
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  if (v && typeof v === "object") return JSON.stringify(v).replace(/"/g, "");
  return JSON.stringify(v);
};

function diff(label: string, before: Record<string, unknown>, set: Record<string, unknown>): string[] {
  return Object.entries(set)
    .filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v))
    .map(([k, v]) => `${label} ${k}: ${before[k] === undefined ? "—" : fmt(before[k])} → ${fmt(v)}`);
}

// Apply ops to a copy of the video. Throws with a model-readable message if an op doesn't fit.
// Returns the new video plus a human-readable list of what changed.
export function applyPatch(video: Video, patch: Patch): { video: Video; changes: string[]; scenes: number[] } {
  const scenes: Scene[] = structuredClone(video.scenes);
  const changes: string[] = [];
  const touched = new Set<number>();

  const getScene = (i: number) => {
    const s = scenes[i];
    if (!s) throw new Error(`scene ${i} does not exist (there are ${scenes.length})`);
    touched.add(i);
    return s;
  };
  const getObject = (s: Scene, id: string) => {
    const o = s.objects.find((x) => x.id === id);
    if (!o) throw new Error(`object "${id}" not found in scene "${s.id}"; ids are ${s.objects.map((x) => x.id).join(", ")}`);
    return o;
  };
  const getAnimation = (s: Scene, target: string, act: Animation["action"]) => {
    const a = s.timeline.find((x) => x.target === target && x.action === act);
    if (!a) throw new Error(`no "${act}" animation on "${target}" in scene "${s.id}"`);
    return a;
  };

  for (const o of patch.ops) {
    const s = getScene(o.scene);
    switch (o.op) {
      case "updateObject": {
        const obj = getObject(s, o.id);
        changes.push(...diff(o.id, obj as unknown as Record<string, unknown>, o.set));
        Object.assign(obj, o.set);
        break;
      }
      case "addObject": {
        if (s.objects.some((x) => x.id === o.object.id)) throw new Error(`object id "${o.object.id}" already exists`);
        s.objects.push(o.object as SceneObject);
        changes.push(`added ${o.object.type} "${o.object.id}"${o.object.text ? ` ("${o.object.text}")` : ""}`);
        break;
      }
      case "removeObject": {
        getObject(s, o.id);
        // Labels riding on the removed object go with it.
        const gone = new Set([o.id, ...s.objects.filter((x) => x.follow === o.id).map((x) => x.id)]);
        s.objects = s.objects.filter((x) => !gone.has(x.id));
        s.timeline = s.timeline.filter((a) => !gone.has(a.target) && !(a.action === "orbit" && typeof a.around === "string" && gone.has(a.around)));
        changes.push(`removed ${[...gone].map((id) => `"${id}"`).join(", ")}`);
        break;
      }
      case "addAnimation": {
        getObject(s, o.animation.target);
        s.timeline.push(o.animation as Animation);
        changes.push(`added ${o.animation.action} on "${o.animation.target}" at ${fmt(o.animation.start)}s`);
        break;
      }
      case "updateAnimation": {
        const a = getAnimation(s, o.target, o.action);
        changes.push(...diff(`${o.target} ${o.action}`, a as unknown as Record<string, unknown>, o.set));
        Object.assign(a, o.set);
        break;
      }
      case "removeAnimation": {
        const a = getAnimation(s, o.target, o.action);
        s.timeline = s.timeline.filter((x) => x !== a);
        changes.push(`removed ${o.action} on "${o.target}"`);
        break;
      }
      case "updateScene": {
        changes.push(...diff(`scene ${o.scene + 1}`, s as unknown as Record<string, unknown>, o.set));
        Object.assign(s, o.set);
        break;
      }
    }
  }

  // Snap any invented icon names to the closest listed icon before validating.
  for (let i = 0; i < scenes.length; i++) {
    const snapped = snapIcons(scenes[i]);
    if (snapped.swaps.length) {
      scenes[i] = snapped.scene;
      changes.push(...snapped.swaps.map((sw) => `icon ${sw}`));
    }
  }

  // Re-validate the whole result so a patch can never leave the scene broken.
  const parsed = scenesResponse.safeParse({ scenes });
  if (!parsed.success) throw new Error(`patched scene is invalid: ${z.prettifyError(parsed.error)}`);
  const problems = scenes.flatMap(checkScene);
  if (problems.length) throw new Error(`patched scene is invalid: ${problems.join("; ")}`);
  if (changes.length === 0) throw new Error("the patch changed nothing; make the requested change");

  return {
    video: { ...video, scenes: scenes.map((sc, i) => (touched.has(i) ? clampToStage(sc) : sc)) },
    changes,
    scenes: [...touched].sort((a, b) => a - b),
  };
}
