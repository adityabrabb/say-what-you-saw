import { z } from "zod";

// Director mode "shot settings": one small JSON object that fully describes the look of the frame.
// The model only ever returns a patch against it; everything is clamped to safe ranges.

export const GRADE_PRESETS = [
  "natural",
  "noir",
  "golden-noir",
  "teal-orange",
  "kodak-portra",
  "cyberpunk",
  "dreamy",
  "cinematic",
  "bleach-bypass",
] as const;
export type GradePreset = (typeof GRADE_PRESETS)[number];

export const PROCEDURAL_BACKGROUNDS = ["neon-rain-city", "star-field", "sunset-gradient", "studio-backdrop", "foggy-forest"] as const;
export type ProceduralBackground = (typeof PROCEDURAL_BACKGROUNDS)[number];

export const ANCHORS = ["head", "head-top", "forehead", "left-eye", "right-eye", "nose", "mouth", "chin", "left-cheek", "right-cheek"] as const;
export type Anchor = (typeof ANCHORS)[number];

export const OVERLAY_KINDS = ["icon", "text", "halo"] as const;
export const ANIMATIONS = ["none", "orbit", "float", "pulse", "spin", "blink"] as const;
export const TEETH = ["none", "gold"] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const overlaySchema = z.object({
  id: z.string().min(1).max(24),
  kind: z.enum(OVERLAY_KINDS),
  icon: z.string().max(32).optional(), // name from the neon icon set (kind "icon")
  text: z.string().max(40).optional(), // kind "text"
  anchor: z.enum(ANCHORS),
  color: hex,
  size: z.number(), // relative to face size, clamped 0.2..3
  animation: z.enum(ANIMATIONS),
  offsetX: z.number(), // in face widths, clamped -3..3
  offsetY: z.number(),
});
export type Overlay = z.infer<typeof overlaySchema>;

export const settingsSchema = z.object({
  background: z.object({
    type: z.enum(["camera", "image", "procedural"]),
    id: z.string().max(40), // image id from backgrounds.json, or a procedural id
    blur: z.number(), // 0..1
    color: hex, // tint for the studio backdrop
  }),
  grade: z.object({
    preset: z.enum(GRADE_PRESETS),
    exposure: z.number(), // stops, -2..2
    contrast: z.number(), // 0.5..2
    saturation: z.number(), // 0..2
    temperature: z.number(), // -1 cool .. 1 warm
    tint: z.number(), // -1 green .. 1 magenta
    fade: z.number(), // 0..1 lifted blacks
    vignette: z.number(), // 0..1
  }),
  light: z.object({
    angle: z.number(), // degrees the key light comes FROM: 0 right, 90 above, 180 left, 270 below
    color: hex,
    intensity: z.number(), // 0..2
    softness: z.number(), // 0..1
    rim: z.number(), // 0..1 edge light
  }),
  grain: z.object({ amount: z.number(), size: z.number() }), // 0..1, 1..3
  leaks: z.object({ amount: z.number(), hue: z.number() }), // 0..1, 0..360
  face: z.object({ teeth: z.enum(TEETH) }),
  overlays: z.array(overlaySchema).max(8),
});
export type ShotSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: ShotSettings = {
  background: { type: "camera", id: "camera", blur: 0, color: "#8a8f9c" },
  // The shot opens completely clean: the raw camera, no grade, grain, light or vignette.
  // Effects only appear once the director asks for them.
  grade: { preset: "natural", exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0, fade: 0, vignette: 0 },
  light: { angle: 150, color: "#fff1dc", intensity: 0, softness: 0.6, rim: 0 },
  grain: { amount: 0, size: 1.5 },
  leaks: { amount: 0, hue: 30 },
  face: { teeth: "none" },
  overlays: [],
};

// ---------- Clamping ----------

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const colour = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const wrapAngle = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? ((v % 360) + 360) % 360 : fallback);

export function clampOverlay(o: Partial<Overlay>, fallbackId: string): Overlay {
  const kind = pick(o.kind, OVERLAY_KINDS, "icon");
  return {
    id: (typeof o.id === "string" && o.id ? o.id : fallbackId).slice(0, 24),
    kind,
    icon: kind === "icon" ? (typeof o.icon === "string" ? o.icon.slice(0, 32) : "star") : undefined,
    text: kind === "text" ? (typeof o.text === "string" ? o.text.slice(0, 40) : "") : undefined,
    anchor: pick(o.anchor, ANCHORS, kind === "halo" ? "head-top" : "head"),
    color: colour(o.color, kind === "halo" ? "#ffe9a6" : "#ffe600"),
    size: clamp(o.size, 0.2, 3, 1),
    animation: pick(o.animation, ANIMATIONS, "none"),
    offsetX: clamp(o.offsetX, -3, 3, 0),
    offsetY: clamp(o.offsetY, -3, 3, 0),
  };
}

export function clampSettings(s: ShotSettings): ShotSettings {
  const d = DEFAULT_SETTINGS;
  const seen = new Set<string>();
  return {
    background: {
      type: pick(s.background?.type, ["camera", "image", "procedural"] as const, "camera"),
      id: typeof s.background?.id === "string" ? s.background.id.slice(0, 40) : "camera",
      blur: clamp(s.background?.blur, 0, 1, 0),
      color: colour(s.background?.color, d.background.color),
    },
    grade: {
      preset: pick(s.grade?.preset, GRADE_PRESETS, "natural"),
      exposure: clamp(s.grade?.exposure, -2, 2, 0),
      contrast: clamp(s.grade?.contrast, 0.5, 2, 1),
      saturation: clamp(s.grade?.saturation, 0, 2, 1),
      temperature: clamp(s.grade?.temperature, -1, 1, 0),
      tint: clamp(s.grade?.tint, -1, 1, 0),
      fade: clamp(s.grade?.fade, 0, 1, 0),
      vignette: clamp(s.grade?.vignette, 0, 1, d.grade.vignette),
    },
    light: {
      angle: wrapAngle(s.light?.angle, d.light.angle),
      color: colour(s.light?.color, d.light.color),
      intensity: clamp(s.light?.intensity, 0, 2, 0),
      softness: clamp(s.light?.softness, 0, 1, d.light.softness),
      rim: clamp(s.light?.rim, 0, 1, 0),
    },
    grain: { amount: clamp(s.grain?.amount, 0, 1, d.grain.amount), size: clamp(s.grain?.size, 1, 3, d.grain.size) },
    leaks: { amount: clamp(s.leaks?.amount, 0, 1, 0), hue: wrapAngle(s.leaks?.hue, d.leaks.hue) },
    face: { teeth: pick(s.face?.teeth, TEETH, "none") },
    overlays: (Array.isArray(s.overlays) ? s.overlays : [])
      .slice(0, 8)
      .map((o, i) => clampOverlay(o, `fx${i}`))
      .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true))),
  };
}

// ---------- Patches ----------
// A patch is a deep partial of the settings, except overlays, which use add/update/remove ops.

const loose = <T extends z.ZodRawShape>(shape: T) => z.object(shape).partial();

export const patchSchema = z.object({
  background: loose({ type: z.enum(["camera", "image", "procedural"]), id: z.string(), blur: z.number(), color: z.string() }).optional(),
  grade: loose({
    preset: z.enum(GRADE_PRESETS),
    exposure: z.number(),
    contrast: z.number(),
    saturation: z.number(),
    temperature: z.number(),
    tint: z.number(),
    fade: z.number(),
    vignette: z.number(),
  }).optional(),
  light: loose({ angle: z.number(), color: z.string(), intensity: z.number(), softness: z.number(), rim: z.number() }).optional(),
  grain: loose({ amount: z.number(), size: z.number() }).optional(),
  leaks: loose({ amount: z.number(), hue: z.number() }).optional(),
  face: loose({ teeth: z.enum(TEETH) }).optional(),
  overlays: z
    .object({
      add: z.array(overlaySchema.partial().extend({ kind: z.enum(OVERLAY_KINDS) })).max(6).optional(),
      update: z.array(overlaySchema.partial().extend({ id: z.string() })).max(8).optional(),
      remove: z.array(z.string()).max(8).optional(), // ids, or ["all"]
    })
    .optional(),
});
export type ShotPatch = z.infer<typeof patchSchema>;

export function applyShotPatch(settings: ShotSettings, patch: ShotPatch): ShotSettings {
  const next: ShotSettings = structuredClone(settings);
  if (patch.background) Object.assign(next.background, patch.background);
  if (patch.grade) Object.assign(next.grade, patch.grade);
  if (patch.light) Object.assign(next.light, patch.light);
  if (patch.grain) Object.assign(next.grain, patch.grain);
  if (patch.leaks) Object.assign(next.leaks, patch.leaks);
  if (patch.face) Object.assign(next.face, patch.face);
  const ops = patch.overlays;
  if (ops?.remove?.length) next.overlays = ops.remove.includes("all") ? [] : next.overlays.filter((o) => !ops.remove!.includes(o.id));
  for (const u of ops?.update ?? []) {
    const o = next.overlays.find((x) => x.id === u.id);
    if (o) Object.assign(o, u);
  }
  for (const [i, a] of (ops?.add ?? []).entries()) {
    const id = a.id && !next.overlays.some((o) => o.id === a.id) ? a.id : `${a.kind}${Date.now() % 100000}${i}`;
    next.overlays.push(clampOverlay({ ...a, id }, id));
  }
  if (next.overlays.length > 8) next.overlays = next.overlays.slice(-8);
  return clampSettings(next);
}

// Keep only the parts of a broken patch that are individually valid ("repair").
export function repairPatch(raw: unknown): ShotPatch {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  const shape = patchSchema.shape as Record<string, z.ZodTypeAny>;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const field = shape[key];
    if (!field) continue;
    const parsed = field.safeParse(value);
    if (parsed.success) out[key] = parsed.data;
    else if (value && typeof value === "object" && !Array.isArray(value) && key !== "overlays") {
      // Salvage the valid sub-fields of a section.
      const inner = (field as z.ZodOptional<z.ZodObject<z.ZodRawShape>>).unwrap().shape as Record<string, z.ZodTypeAny>;
      const kept: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) if (inner[k]?.safeParse(v).success) kept[k] = v;
      if (Object.keys(kept).length) out[key] = kept;
    }
  }
  return out as ShotPatch;
}
