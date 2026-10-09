import type { GradePreset, ShotSettings } from "./settings";

// Each grade preset is a numeric "look" so presets can be blended smoothly into each other.
// The user's own exposure/contrast/etc. adjustments are layered on top.

export interface Look {
  exposure: number; // stops
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  fade: number;
  mono: number; // 0 colour .. 1 black & white
  bleach: number; // bleach-bypass strength
  shadows: [number, number, number]; // split-tone colour added to shadows
  highlights: [number, number, number]; // split-tone colour added to highlights
}

const neutral: Look = {
  exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0, fade: 0, mono: 0, bleach: 0,
  shadows: [0, 0, 0], highlights: [0, 0, 0],
};

export const LOOKS: Record<GradePreset, Look> = {
  natural: neutral,
  noir: { ...neutral, contrast: 1.45, mono: 1, fade: 0.08, exposure: -0.1 },
  "golden-noir": { ...neutral, contrast: 1.35, mono: 0.85, temperature: 0.35, highlights: [0.22, 0.14, -0.04], shadows: [0.02, 0.0, -0.03] },
  "teal-orange": { ...neutral, contrast: 1.18, saturation: 1.15, shadows: [-0.1, 0.06, 0.14], highlights: [0.16, 0.06, -0.08] },
  "kodak-portra": { ...neutral, contrast: 0.92, saturation: 0.88, temperature: 0.25, fade: 0.25, highlights: [0.06, 0.03, -0.02], shadows: [0.02, 0.0, 0.03] },
  cyberpunk: { ...neutral, contrast: 1.25, saturation: 1.45, tint: 0.35, shadows: [0.02, -0.04, 0.2], highlights: [0.18, -0.06, 0.12] },
  dreamy: { ...neutral, contrast: 0.85, saturation: 0.9, exposure: 0.2, fade: 0.35, tint: 0.15, highlights: [0.06, 0.02, 0.08] },
  cinematic: { ...neutral, contrast: 1.2, saturation: 0.95, fade: 0.1, shadows: [-0.04, 0.03, 0.08], highlights: [0.08, 0.03, -0.03] },
  "bleach-bypass": { ...neutral, contrast: 1.4, saturation: 0.45, bleach: 0.7, exposure: -0.05 },
};

// Final look = preset combined with the user's adjustments.
export function lookFor(grade: ShotSettings["grade"]): Look {
  const p = LOOKS[grade.preset] ?? neutral;
  return {
    exposure: p.exposure + grade.exposure,
    contrast: p.contrast * grade.contrast,
    saturation: p.saturation * grade.saturation,
    temperature: p.temperature + grade.temperature,
    tint: p.tint + grade.tint,
    fade: Math.min(1, p.fade + grade.fade),
    mono: p.mono,
    bleach: p.bleach,
    shadows: p.shadows,
    highlights: p.highlights,
  };
}
