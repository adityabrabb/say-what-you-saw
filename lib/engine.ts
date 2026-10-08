import type { Animation, Scene, SceneObject } from "./scene";

// Resolved, render-ready state of one object at a moment in time.
export interface FrameObject extends SceneObject {
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function progress(a: Animation, t: number): number {
  if (a.duration <= 0) return t >= a.start ? 1 : 0;
  return clamp01((t - a.start) / a.duration);
}

// Compute every object's position/opacity/scale at time t (seconds into the scene).
// Animations apply in start order, each one tweening from wherever the previous ones left off.
export function computeFrame(scene: Scene, t: number): FrameObject[] {
  const byId = new Map(scene.objects.map((o) => [o.id, o]));
  const timeline = [...scene.timeline].sort((a, b) => a.start - b.start);
  const cache = new Map<string, FrameObject>();
  const resolving = new Set<string>();

  function resolve(id: string): FrameObject | undefined {
    const cached = cache.get(id);
    if (cached) return cached;
    const obj = byId.get(id);
    if (!obj || resolving.has(id)) return undefined; // unknown or circular
    resolving.add(id);

    let x = obj.x;
    let y = obj.y;
    let opacity = obj.opacity ?? 1;
    let scale = obj.scale ?? 1;

    for (const a of timeline) {
      if (a.target !== id) continue;
      // Orbits place the object on its path even before they start, so it doesn't jump.
      if (a.action === "orbit") {
        const c = typeof a.around === "string" ? resolve(a.around) : a.around;
        if (!c) continue;
        const p = t < a.start ? 0 : progress(a, t);
        const angle = ((a.startAngle ?? 0) * Math.PI) / 180 + 2 * Math.PI * a.turns * p;
        x = c.x + a.radius * Math.cos(angle);
        y = c.y - a.radius * Math.sin(angle);
        continue;
      }
      if (t < a.start) continue;
      const p = easeInOut(progress(a, t));
      if (a.action === "move") {
        x = lerp(x, a.to.x, p);
        y = lerp(y, a.to.y, p);
      } else if (a.action === "fade") {
        opacity = lerp(opacity, a.to, p);
      } else if (a.action === "grow") {
        scale = lerp(scale, a.to, p);
      }
    }

    if (obj.follow) {
      const parent = resolve(obj.follow);
      if (parent) {
        x += parent.x;
        y += parent.y;
        opacity *= parent.opacity;
      }
    }

    resolving.delete(id);
    const frame: FrameObject = { ...obj, x, y, opacity, scale };
    cache.set(id, frame);
    return frame;
  }

  return scene.objects.map((o) => resolve(o.id)).filter((f): f is FrameObject => !!f);
}

// Map a global time across all scenes to (scene index, local time).
export function locate(durations: number[], globalT: number): { index: number; local: number } {
  let acc = 0;
  for (let i = 0; i < durations.length; i++) {
    if (globalT < acc + durations[i] || i === durations.length - 1) {
      return { index: i, local: Math.min(globalT - acc, durations[i]) };
    }
    acc += durations[i];
  }
  return { index: 0, local: 0 };
}
