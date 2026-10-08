import type { Scene, SceneObject } from "./scene";

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

// ---------- Medium & hard pools: illustrated icons, backdrops, more objects, more motion ----------

type Extra = Partial<Pick<Scene, "background" | "particles" | "camera" | "entrance" | "glow">>;

const rich = (id: string, title: string, extra: Extra, objects: Scene["objects"], timeline: Scene["timeline"] = []): Scene => ({
  id,
  title,
  duration: 5,
  ...extra,
  objects,
  timeline,
});

// Icon helper: icon(id, name, x, y, size)
const icon = (id: string, name: string, x: number, y: number, w = 80): SceneObject => ({ id, type: "icon", icon: name, x, y, w });

export const mediumPool: Scene[] = [
  rich("park-chase", "A dog chases a football past a tree on a sunny day", { background: "sky" }, [
    icon("tree", "tree", 120, 300, 150),
    icon("sun", "sun", 700, 70, 80),
    icon("dog", "dog", 300, 340, 90),
    icon("ball", "football", 430, 360, 46),
  ], [
    { target: "dog", action: "move", start: 0.3, duration: 1.8, to: { x: 520, y: 340 } },
    { target: "ball", action: "move", start: 0.2, duration: 1.6, to: { x: 690, y: 360 }, ease: "out" },
  ]),
  rich("launch", "A rocket blasts off from Earth toward the Moon", { background: "space" }, [
    icon("earth", "earth", 170, 340, 150),
    icon("moon", "moon", 680, 90, 80),
    icon("rocket", "rocket", 280, 260, 80),
    icon("star", "glowing-star", 470, 330, 44),
  ], [
    { target: "rocket", action: "move", start: 0.3, duration: 2, to: { x: 590, y: 120 }, ease: "inOut" },
  ]),
  rich("sea-life", "A sailboat on the ocean with two fish swimming opposite ways", { background: "ocean" }, [
    icon("boat", "boat", 400, 185, 110),
    icon("fish", "fish", 220, 320, 70),
    icon("tfish", "tropical-fish", 600, 395, 64),
    icon("crab", "crab", 700, 415, 54),
  ], [
    { target: "fish", action: "move", start: 0.2, duration: 2, to: { x: 540, y: 320 } },
    { target: "tfish", action: "move", start: 0.2, duration: 2, to: { x: 300, y: 395 } },
  ]),
  rich("ufo-city", "A UFO glides over a night city while a cat watches", { background: "city" }, [
    icon("ufo", "ufo", 140, 110, 100),
    icon("cat", "cat", 110, 395, 64),
    { id: "label", type: "text", x: 400, y: 50, text: "ALIENS?", fontSize: 30, fill: "#7af3ff" },
  ], [
    { target: "ufo", action: "move", start: 0.2, duration: 2.2, to: { x: 560, y: 150 }, ease: "inOut" },
  ]),
  rich("snow-day", "A snowman between two pine trees while it snows", { background: "sky", particles: "snow" }, [
    icon("pine1", "pine-tree", 140, 320, 140),
    icon("pine2", "pine-tree", 670, 320, 150),
    { id: "body", type: "circle", x: 400, y: 360, r: 58, fill: "#F2F4F8" },
    { id: "head", type: "circle", x: 400, y: 270, r: 40, fill: "#F2F4F8" },
    icon("hat", "crown", 400, 222, 50),
  ]),
  rich("neon-race", "A race car speeds across a neon grid toward a trophy", { background: "grid" }, [
    icon("car", "race-car", 140, 385, 100),
    icon("trophy", "trophy", 700, 330, 80),
    { id: "s1", type: "star", x: 180, y: 90, r: 22, fill: "#FF2BD6" },
    { id: "s2", type: "star", x: 620, y: 100, r: 26, fill: "#00F0FF" },
  ], [
    { target: "car", action: "move", start: 0.2, duration: 1.8, to: { x: 560, y: 385 }, ease: "out" },
  ]),
  rich("apple-drop", "An apple falls from a big tree and bounces while a bird flies off", { background: "sky" }, [
    icon("tree", "tree", 300, 270, 230),
    icon("apple", "apple", 340, 200, 42),
    icon("bird", "bird", 580, 140, 60),
  ], [
    { target: "apple", action: "move", start: 0.4, duration: 1.4, to: { x: 340, y: 400 }, ease: "bounce" },
    { target: "bird", action: "move", start: 0.3, duration: 2, to: { x: 720, y: 80 } },
  ]),
  rich("garden", "A bee flies across three flowers: sunflower, tulip and rose", { background: "sky" }, [
    icon("sunflower", "sunflower", 200, 360, 100),
    icon("tulip", "tulip", 400, 370, 90),
    icon("rose", "rose", 600, 360, 90),
    icon("bee", "bee", 140, 160, 56),
    icon("butterfly", "butterfly", 680, 110, 60),
  ], [
    { target: "bee", action: "move", start: 0.2, duration: 2.2, to: { x: 600, y: 250 }, ease: "inOut" },
  ]),
];

export const hardPool: Scene[] = [
  rich("storm", "A ship sails through a thunderstorm with a whale and a seagull", { background: "ocean", particles: "rain", camera: { zoom: 1.1 }, entrance: "stagger" }, [
    icon("cloud1", "storm-cloud", 200, 80, 120),
    icon("cloud2", "storm-cloud", 570, 70, 140),
    icon("bolt", "lightning", 420, 130, 70),
    icon("ship", "ship", 290, 230, 120),
    icon("whale", "whale", 650, 350, 110),
    icon("anchor", "anchor", 120, 390, 50),
    icon("gull", "bird", 700, 190, 48),
  ], [
    { target: "ship", action: "move", start: 0.3, duration: 1.7, to: { x: 470, y: 235 } },
    { target: "gull", action: "move", start: 0.2, duration: 1.6, to: { x: 560, y: 160 } },
    { target: "bolt", action: "fade", start: 0.9, duration: 0.3, to: 0.2 },
  ]),
  rich("space-traffic", "A rocket orbits a ringed planet while a comet, a satellite, a UFO and an alien drift by", { background: "space", particles: "sparkle", camera: { panX: 30, zoom: 1.06 }, entrance: "stagger" }, [
    icon("planet", "planet", 190, 300, 140),
    icon("rocket", "rocket", 0, 0, 56),
    icon("sat", "satellite", 600, 120, 70),
    icon("ufo", "ufo", 690, 330, 80),
    icon("alien", "alien", 460, 370, 60),
    icon("comet", "comet", 300, 70, 70),
    { id: "redstar", type: "star", x: 720, y: 60, r: 18, fill: "#E5484D" },
  ], [
    { target: "rocket", action: "orbit", start: 0, duration: 4, around: "planet", radius: 120, turns: 1, startAngle: 90 },
    { target: "comet", action: "move", start: 0.2, duration: 1.8, to: { x: 520, y: 40 } },
    { target: "sat", action: "move", start: 0.3, duration: 1.8, to: { x: 640, y: 190 } },
  ]),
  rich("winter-village", "A snowy village: house, three pine trees, a snowman and a dog running", { background: "sky", particles: "snow", entrance: "stagger" }, [
    icon("pine1", "pine-tree", 90, 320, 110),
    icon("pine2", "pine-tree", 210, 345, 90),
    icon("house", "house", 420, 320, 130),
    icon("pine3", "pine-tree", 710, 320, 120),
    { id: "sbody", type: "circle", x: 590, y: 375, r: 34, fill: "#F2F4F8" },
    { id: "shead", type: "circle", x: 590, y: 325, r: 23, fill: "#F2F4F8" },
    icon("dog", "dog", 290, 400, 60),
    icon("flake", "snowflake", 400, 100, 50),
  ], [
    { target: "dog", action: "move", start: 0.3, duration: 1.6, to: { x: 500, y: 405 } },
    { target: "flake", action: "grow", start: 0.2, duration: 1.2, to: 1.6, ease: "back" },
  ]),
  rich("arcade", "A neon arcade: game controller, robot, trophy, dice, a rolling coin and three coloured shapes", { background: "grid", particles: "sparkle", camera: { zoom: 1.12 }, entrance: "stagger" }, [
    icon("controller", "video-game", 400, 190, 100),
    icon("robot", "robot", 650, 300, 100),
    icon("trophy", "trophy", 400, 75, 56),
    icon("dice", "dice", 170, 300, 64),
    icon("coin", "coin", 90, 400, 44),
    { id: "c", type: "circle", x: 130, y: 110, r: 22, fill: "#00F0FF" },
    { id: "s", type: "star", x: 680, y: 110, r: 26, fill: "#FFE600" },
    { id: "r", type: "rect", x: 560, y: 400, w: 60, h: 40, fill: "#FF2BD6" },
  ], [
    { target: "coin", action: "move", start: 0.2, duration: 1.6, to: { x: 330, y: 400 }, ease: "out" },
    { target: "controller", action: "grow", start: 0.4, duration: 1, to: 1.25, ease: "elastic" },
  ]),
  rich("jungle", "A jungle: two palm trees, a bouncing monkey, a circling parrot, an elephant, a snake and a banana", { background: "sky", camera: { panX: -30 }, entrance: "stagger" }, [
    icon("palm1", "palm-tree", 100, 290, 180),
    icon("palm2", "palm-tree", 720, 290, 170),
    icon("monkey", "monkey", 250, 220, 70),
    icon("parrot", "parrot", 0, 0, 56),
    icon("elephant", "elephant", 500, 335, 130),
    icon("snake", "snake", 360, 400, 70),
    icon("banana", "banana", 260, 390, 40),
  ], [
    { target: "monkey", action: "move", start: 0.3, duration: 1.2, to: { x: 250, y: 330 }, ease: "bounce" },
    { target: "parrot", action: "orbit", start: 0, duration: 4, around: { x: 570, y: 130 }, radius: 50, turns: 2 },
  ]),
  rich("food-party", "Food chaos: a donut orbits a growing burger with pizza, cake, ice cream, coffee and a fading cookie", { background: "#3b1d4f", particles: "sparkle", entrance: "stagger" }, [
    icon("burger", "burger", 400, 225, 100),
    icon("donut", "donut", 0, 0, 60),
    icon("pizza", "pizza", 160, 120, 80),
    icon("cake", "cake", 650, 340, 90),
    icon("icecream", "ice-cream", 150, 360, 70),
    icon("coffee", "coffee", 660, 110, 60),
    icon("cookie", "cookie", 400, 70, 50),
  ], [
    { target: "donut", action: "orbit", start: 0, duration: 4, around: "burger", radius: 140, turns: 1.5 },
    { target: "burger", action: "grow", start: 0.3, duration: 1.2, to: 1.3, ease: "back" },
    { target: "icecream", action: "move", start: 0.3, duration: 1.4, to: { x: 150, y: 250 } },
    { target: "cookie", action: "fade", start: 0.6, duration: 1, to: 0 },
  ]),
  rich("rush-hour", "Rainy rush hour: a car and a bus head toward each other under a helicopter, beside a traffic light", { background: "city", particles: "rain", camera: { zoom: 1.08, panY: 10 } }, [
    icon("car", "car", 120, 400, 90),
    icon("bus", "bus", 640, 395, 120),
    icon("heli", "helicopter", 260, 110, 90),
    { id: "pole", type: "rect", x: 400, y: 300, w: 40, h: 110, fill: "#2B2F36" },
    { id: "red", type: "circle", x: 400, y: 268, r: 12, fill: "#E5484D", glow: true },
    { id: "amber", type: "circle", x: 400, y: 300, r: 12, fill: "#F5C518" },
    { id: "green", type: "circle", x: 400, y: 332, r: 12, fill: "#30A46C" },
  ], [
    { target: "car", action: "move", start: 0.2, duration: 1.8, to: { x: 300, y: 400 } },
    { target: "bus", action: "move", start: 0.2, duration: 1.8, to: { x: 520, y: 395 } },
    { target: "heli", action: "move", start: 0.2, duration: 2, to: { x: 600, y: 90 } },
  ]),
  rich("birthday", "A birthday party: cake, three rising balloons, a gift, a party popper, a crown and a banner", { background: "#2b0b4a", particles: "sparkle", camera: { zoom: 1.1 }, entrance: "stagger" }, [
    icon("cake", "cake", 400, 340, 130),
    icon("b1", "balloon", 190, 220, 70),
    icon("b2", "balloon", 610, 230, 70),
    icon("b3", "balloon", 690, 300, 56),
    icon("gift", "gift", 190, 375, 80),
    icon("popper", "party-popper", 600, 380, 76),
    icon("crown", "crown", 400, 205, 56),
    { id: "banner", type: "text", x: 400, y: 60, text: "HAPPY BIRTHDAY", fontSize: 30, fill: "#FFE600" },
  ], [
    { target: "b1", action: "move", start: 0.2, duration: 2, to: { x: 200, y: 110 } },
    { target: "b2", action: "move", start: 0.3, duration: 2, to: { x: 600, y: 120 } },
    { target: "b3", action: "move", start: 0.4, duration: 2, to: { x: 700, y: 190 } },
  ]),
];

export function poolFor(difficulty: Difficulty): Scene[] {
  return difficulty === "easy" ? recallPool : difficulty === "medium" ? mediumPool : hardPool;
}
