// Scene format: a video is a list of scenes; each scene has objects and a timeline of animations.
// Coordinates live in a fixed 800x450 stage.

export const STAGE_W = 800;
export const STAGE_H = 450;

export type ObjectType = "circle" | "rect" | "star" | "text" | "arrow" | "image";

export interface SceneObject {
  id: string;
  type: ObjectType;
  x: number; // centre (circle/rect/text/image) or start point (arrow); offset from `follow` target if set
  y: number;
  r?: number; // circle/star radius
  w?: number; // rect/image width
  h?: number; // rect/image height
  x2?: number; // arrow end point
  y2?: number;
  fill?: string; // "none" for outlines
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  glow?: boolean;
  text?: string;
  fontSize?: number;
  href?: string; // image source
  opacity?: number; // initial opacity, default 1
  scale?: number; // initial scale, default 1
  follow?: string; // id of another object; x/y become an offset from it (labels that ride along)
}

export type Animation =
  | { target: string; action: "move"; start: number; duration: number; to: { x: number; y: number } }
  | { target: string; action: "fade"; start: number; duration: number; to: number }
  | { target: string; action: "grow"; start: number; duration: number; to: number }
  | {
      target: string;
      action: "orbit";
      start: number;
      duration: number;
      around: string | { x: number; y: number }; // object id or fixed point
      radius: number;
      turns: number; // positive = counter-clockwise on screen
      startAngle?: number; // degrees, 0 = right of centre
    };

export interface Scene {
  id: string;
  title: string;
  duration: number; // seconds
  background?: string;
  stars?: boolean;
  caption?: string;
  objects: SceneObject[];
  timeline: Animation[];
}

export interface Video {
  title: string;
  scenes: Scene[];
}
