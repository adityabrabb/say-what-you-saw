import type { Scene } from "./scene";

// Hand-made Recall targets. Simple, high-contrast, describable in one or two sentences.
const BG = "#10162a";
const RED = "#E5484D";
const BLUE = "#3E7BFA";
const YELLOW = "#F5C518";
const GREEN = "#30A46C";
const ORANGE = "#F76B15";
const PURPLE = "#8E4EC6";
const PINK = "#E93D82";
const WHITE = "#F2F4F8";
const GREY = "#9BA1A6";
const BROWN = "#8D5B3E";

const scene = (id: string, title: string, objects: Scene["objects"], timeline: Scene["timeline"] = []): Scene => ({
  id,
  title,
  duration: 5,
  background: BG,
  objects,
  timeline,
});

export const recallPool: Scene[] = [
  scene("circle-over-square", "Red circle above a blue square", [
    { id: "c", type: "circle", x: 400, y: 140, r: 55, fill: RED },
    { id: "s", type: "rect", x: 400, y: 320, w: 120, h: 120, fill: BLUE },
  ]),
  scene("stars-arrow", "Three yellow stars and an arrow", [
    { id: "s1", type: "star", x: 200, y: 225, r: 40, fill: YELLOW },
    { id: "s2", type: "star", x: 320, y: 225, r: 40, fill: YELLOW },
    { id: "s3", type: "star", x: 440, y: 225, r: 40, fill: YELLOW },
    { id: "a", type: "arrow", x: 520, y: 225, x2: 660, y2: 225, stroke: WHITE, strokeWidth: 5 },
  ]),
  scene("traffic-light", "A traffic light", [
    { id: "box", type: "rect", x: 400, y: 225, w: 110, h: 320, fill: "#2B2F36" },
    { id: "r", type: "circle", x: 400, y: 125, r: 38, fill: RED },
    { id: "y", type: "circle", x: 400, y: 225, r: 38, fill: YELLOW },
    { id: "g", type: "circle", x: 400, y: 325, r: 38, fill: GREEN },
  ]),
  scene("snowman", "Snowman with an orange square hat", [
    { id: "b", type: "circle", x: 400, y: 345, r: 75, fill: WHITE },
    { id: "m", type: "circle", x: 400, y: 222, r: 55, fill: WHITE },
    { id: "h", type: "circle", x: 400, y: 127, r: 40, fill: WHITE },
    { id: "hat", type: "rect", x: 400, y: 72, w: 70, h: 40, fill: ORANGE },
  ]),
  scene("sliding-square", "A purple square slides left to right", [
    { id: "s", type: "rect", x: 140, y: 225, w: 90, h: 90, fill: PURPLE },
  ], [
    { target: "s", action: "move", start: 0.3, duration: 1.6, to: { x: 660, y: 225 } },
  ]),
  scene("moon-orbit", "Grey ball orbiting a big yellow ball", [
    { id: "sun", type: "circle", x: 400, y: 225, r: 65, fill: YELLOW },
    { id: "moon", type: "circle", x: 0, y: 0, r: 18, fill: GREY },
  ], [
    { target: "moon", action: "orbit", start: 0, duration: 4, around: "sun", radius: 140, turns: 2, startAngle: 0 },
  ]),
  scene("hello-sign", "Pink sign that says HELLO", [
    { id: "sign", type: "rect", x: 400, y: 200, w: 320, h: 130, fill: PINK },
    { id: "t", type: "text", x: 400, y: 202, text: "HELLO", fontSize: 56, fill: WHITE },
    { id: "post", type: "rect", x: 400, y: 345, w: 22, h: 160, fill: BROWN },
  ]),
  scene("growing-circles", "Four blue circles getting bigger", [
    { id: "c1", type: "circle", x: 160, y: 225, r: 18, fill: BLUE },
    { id: "c2", type: "circle", x: 290, y: 225, r: 32, fill: BLUE },
    { id: "c3", type: "circle", x: 450, y: 225, r: 48, fill: BLUE },
    { id: "c4", type: "circle", x: 640, y: 225, r: 66, fill: BLUE },
  ]),
  scene("arrow-to-goal", "Red arrow pointing up at a star labelled GOAL", [
    { id: "star", type: "star", x: 400, y: 120, r: 50, fill: YELLOW },
    { id: "label", type: "text", x: 400, y: 40, text: "GOAL", fontSize: 30, fill: WHITE },
    { id: "a", type: "arrow", x: 400, y: 400, x2: 400, y2: 190, stroke: RED, strokeWidth: 6 },
  ]),
  scene("fade-and-square", "Green circle fades out next to a red square", [
    { id: "c", type: "circle", x: 280, y: 225, r: 70, fill: GREEN },
    { id: "s", type: "rect", x: 540, y: 225, w: 140, h: 140, fill: RED },
  ], [
    { target: "c", action: "fade", start: 0.4, duration: 1.4, to: 0 },
  ]),
  scene("big-small", "Big orange rectangle, two small green circles on the left", [
    { id: "g1", type: "circle", x: 170, y: 160, r: 30, fill: GREEN },
    { id: "g2", type: "circle", x: 170, y: 290, r: 30, fill: GREEN },
    { id: "r", type: "rect", x: 500, y: 225, w: 300, h: 180, fill: ORANGE },
  ]),
];

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Record<Difficulty, { label: string; flashSeconds: number }> = {
  easy: { label: "Easy", flashSeconds: 5 },
  medium: { label: "Medium", flashSeconds: 3 },
  hard: { label: "Hard", flashSeconds: 2 },
};

export const DESCRIBE_SECONDS = 30;
