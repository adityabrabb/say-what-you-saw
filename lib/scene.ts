// Scene format: a video is a list of scenes; each scene has objects and a timeline of animations.
// Coordinates live in a fixed 800x450 stage.

export const STAGE_W = 800;
export const STAGE_H = 450;

export type ObjectType = "circle" | "rect" | "star" | "text" | "arrow" | "image" | "icon" | "art";

export interface SceneObject {
  id: string;
  type: ObjectType;
  x: number; // centre (circle/rect/text/image/icon) or start point (arrow); offset from `follow` target if set
  y: number;
  r?: number; // circle/star radius
  w?: number; // rect/image width, icon size
  h?: number; // rect/image height
  x2?: number; // arrow end point
  y2?: number;
  fill?: string; // "none" for outlines
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  glow?: boolean;
  shadow?: boolean; // soft ground shadow; defaults on for solid shapes and icons
  trail?: boolean; // motion trail; defaults on for objects that move or orbit
  text?: string;
  fontSize?: number;
  href?: string; // image source
  icon?: string; // icon name from lib/icons.ts
  art?: string; // hand-drawn illustration name from lib/art.ts (w/h set its box)
  opacity?: number; // initial opacity, default 1
  scale?: number; // initial scale, default 1
  follow?: string; // id of another object; x/y become an offset from it (labels that ride along)
}

export type Ease = "linear" | "inOut" | "out" | "back" | "bounce" | "elastic";

interface Timing {
  target: string;
  start: number;
  duration: number;
  ease?: Ease; // default "inOut" (orbits default to "linear")
}

export type Animation =
  | (Timing & { action: "move"; to: { x: number; y: number } })
  | (Timing & { action: "fade"; to: number })
  | (Timing & { action: "grow"; to: number })
  | (Timing & {
      action: "orbit";
      around: string | { x: number; y: number }; // object id or fixed point
      radius: number;
      turns: number; // positive = counter-clockwise on screen
      startAngle?: number; // degrees, 0 = right of centre
    });

export const BACKGROUNDS = ["space", "sky", "ocean", "city", "grid"] as const;
export type BackgroundPreset = (typeof BACKGROUNDS)[number];
export const PARTICLES = ["sparkle", "rain", "snow"] as const;
export type Particles = (typeof PARTICLES)[number];

export interface Camera {
  zoom?: number; // zoom reached by the end of the scene (1 = none)
  panX?: number; // pixels the view drifts by the end of the scene
  panY?: number;
}

export interface Scene {
  id: string;
  title: string;
  duration: number; // seconds
  background?: string; // a preset name or a hex colour
  stars?: boolean; // legacy: sprinkle stars on a plain background
  particles?: Particles;
  camera?: Camera;
  entrance?: "stagger" | "none"; // objects pop in one after another
  glow?: boolean; // everything glows
  caption?: string;
  objects: SceneObject[];
  timeline: Animation[];
}

export interface Video {
  title: string;
  scenes: Scene[];
}
