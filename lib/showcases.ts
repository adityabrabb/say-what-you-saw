import type { SceneObject, Video } from "./scene";

// Hand-made showcase explainers. They're the Studio's demo reel and double as
// style references for the generator (layered composition, icons, labels, arrows, motion).

const icon = (id: string, name: string, x: number, y: number, w: number, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, type: "icon", icon: name, x, y, w, ...extra,
});
const label = (id: string, text: string, x: number, y: number, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, type: "text", text, x, y, fontSize: 18, fill: "#F2F4F8", opacity: 0, ...extra,
});

export const solarEclipse: Video = {
  title: "Solar eclipse",
  scenes: [
    {
      id: "eclipse",
      title: "How a solar eclipse happens",
      duration: 11,
      background: "space",
      particles: "sparkle",
      camera: { zoom: 1.08, panX: 10 },
      entrance: "stagger",
      caption: "When the Moon slides exactly between the Sun and Earth, its shadow falls on Earth and day turns to night.",
      objects: [
        { id: "title", type: "text", text: "SOLAR ECLIPSE", x: 400, y: 38, fontSize: 28, fill: "#FFE600" },
        icon("sun", "sun", 140, 230, 170, { glow: true }),
        icon("earth", "earth", 660, 230, 120),
        icon("moon", "moon", 400, 95, 54),
        { id: "ray1", type: "arrow", x: 240, y: 180, x2: 340, y2: 205, stroke: "#FDB813", strokeWidth: 4, opacity: 0 },
        { id: "ray2", type: "arrow", x: 240, y: 280, x2: 340, y2: 255, stroke: "#FDB813", strokeWidth: 4, opacity: 0 },
        { id: "umbra", type: "circle", x: 640, y: 222, r: 24, fill: "#1C2024", opacity: 0 },
        label("sunLabel", "SUN", 0, 100, { follow: "sun" }),
        label("moonLabel", "MOON", 0, -40, { follow: "moon" }),
        label("earthLabel", "EARTH", 0, 80, { follow: "earth" }),
        label("umbraLabel", "SHADOW (UMBRA)", 650, 340, { fill: "#FF8589" }),
      ],
      timeline: [
        { target: "sunLabel", action: "fade", start: 0.8, duration: 0.6, to: 1 },
        { target: "earthLabel", action: "fade", start: 1.1, duration: 0.6, to: 1 },
        { target: "moonLabel", action: "fade", start: 1.4, duration: 0.6, to: 1 },
        { target: "ray1", action: "fade", start: 1.8, duration: 0.6, to: 1 },
        { target: "ray2", action: "fade", start: 2, duration: 0.6, to: 1 },
        { target: "moon", action: "move", start: 2.6, duration: 3.2, to: { x: 420, y: 230 }, ease: "inOut" },
        { target: "umbra", action: "fade", start: 5.4, duration: 1.2, to: 0.75 },
        { target: "umbraLabel", action: "fade", start: 6, duration: 0.6, to: 1 },
        { target: "sun", action: "grow", start: 6.2, duration: 1.4, to: 1.08, ease: "back" },
      ],
    },
  ],
};

export const waterCycle: Video = {
  title: "The water cycle",
  scenes: [
    {
      id: "water-cycle",
      title: "The water cycle",
      duration: 12,
      background: "sky",
      entrance: "stagger",
      camera: { zoom: 1.06 },
      caption: "The sun heats water, vapour rises and cools into clouds, rain falls on the mountains and flows back to the sea.",
      objects: [
        icon("sun", "sun", 700, 75, 100, { glow: true }),
        icon("sea", "water", 190, 385, 170),
        icon("mountain", "snow-mountain", 620, 350, 180),
        icon("cloud", "cloud", 250, 140, 110),
        icon("vapour", "droplet", 170, 330, 34),
        icon("rainCloud", "rain", 560, 120, 110, { opacity: 0 }),
        icon("rainDrop", "droplet", 560, 175, 30, { opacity: 0 }),
        { id: "evap", type: "arrow", x: 200, y: 310, x2: 230, y2: 200, stroke: "#3E7BFA", strokeWidth: 4 },
        { id: "flow", type: "arrow", x: 540, y: 410, x2: 300, y2: 415, stroke: "#3E7BFA", strokeWidth: 4, opacity: 0 },
        label("evapLabel", "EVAPORATION", 110, 250, { fill: "#063D6B" }),
        label("condLabel", "CONDENSATION", 400, 70, { fill: "#063D6B" }),
        label("rainLabel", "PRECIPITATION", 700, 200, { fill: "#063D6B" }),
        label("flowLabel", "COLLECTION", 420, 440, { fill: "#063D6B", fontSize: 16 }),
      ],
      timeline: [
        { target: "evapLabel", action: "fade", start: 0.8, duration: 0.6, to: 1 },
        { target: "vapour", action: "move", start: 1, duration: 2.2, to: { x: 240, y: 170 }, ease: "out" },
        { target: "vapour", action: "fade", start: 2.6, duration: 0.6, to: 0 },
        { target: "cloud", action: "move", start: 3, duration: 2.6, to: { x: 500, y: 120 } },
        { target: "condLabel", action: "fade", start: 3.4, duration: 0.6, to: 1 },
        { target: "cloud", action: "fade", start: 5.4, duration: 0.5, to: 0 },
        { target: "rainCloud", action: "fade", start: 5.4, duration: 0.5, to: 1 },
        { target: "rainLabel", action: "fade", start: 6, duration: 0.6, to: 1 },
        { target: "rainDrop", action: "fade", start: 6.2, duration: 0.3, to: 1 },
        { target: "rainDrop", action: "move", start: 6.2, duration: 1.4, to: { x: 590, y: 290 }, ease: "bounce" },
        { target: "flow", action: "fade", start: 8, duration: 0.6, to: 1 },
        { target: "flowLabel", action: "fade", start: 8.2, duration: 0.6, to: 1 },
        { target: "sea", action: "grow", start: 8.8, duration: 1.2, to: 1.1, ease: "back" },
      ],
    },
  ],
};

export const rocketLaunch: Video = {
  title: "Rocket launch",
  scenes: [
    {
      id: "liftoff",
      title: "Liftoff",
      duration: 10,
      background: "sky",
      particles: "sparkle",
      camera: { zoom: 1.1, panY: -20 },
      entrance: "stagger",
      caption: "Engines push exhaust down, the reaction pushes the rocket up, and it climbs toward orbit.",
      objects: [
        icon("moon", "moon", 690, 70, 60),
        { id: "tower", type: "rect", x: 470, y: 340, w: 26, h: 190, fill: "#9BA1A6" },
        icon("smokeL", "cloud", 300, 405, 120),
        icon("smokeR", "cloud", 520, 410, 120),
        icon("rocket", "rocket", 400, 330, 110),
        icon("flame", "fire", 0, 70, 56, { follow: "rocket", opacity: 0 }),
        { id: "thrust", type: "arrow", x: 250, y: 260, x2: 250, y2: 150, stroke: "#E5484D", strokeWidth: 5, opacity: 0 },
        label("thrustLabel", "THRUST", 250, 285, { fill: "#E5484D", fontSize: 20 }),
        { id: "count", type: "text", text: "3 · 2 · 1", x: 400, y: 200, fontSize: 34, fill: "#FFE600" },
        label("liftoff", "LIFTOFF!", 400, 200, { fontSize: 40, fill: "#F76B15" }),
        label("speed", "11.2 km/s to escape Earth", 170, 60, { fill: "#063D6B", fontSize: 16 }),
      ],
      timeline: [
        { target: "count", action: "fade", start: 1.8, duration: 0.4, to: 0 },
        { target: "flame", action: "fade", start: 2, duration: 0.3, to: 1 },
        { target: "liftoff", action: "fade", start: 2.1, duration: 0.3, to: 1 },
        { target: "smokeL", action: "grow", start: 2, duration: 1.6, to: 1.6, ease: "out" },
        { target: "smokeR", action: "grow", start: 2, duration: 1.6, to: 1.6, ease: "out" },
        { target: "rocket", action: "move", start: 2.4, duration: 4.5, to: { x: 400, y: 70 }, ease: "inOut" },
        { target: "liftoff", action: "fade", start: 3.6, duration: 0.6, to: 0 },
        { target: "thrust", action: "fade", start: 3.8, duration: 0.5, to: 1 },
        { target: "thrustLabel", action: "fade", start: 4, duration: 0.5, to: 1 },
        { target: "speed", action: "fade", start: 5.5, duration: 0.6, to: 1 },
        { target: "moon", action: "grow", start: 6.5, duration: 1.5, to: 1.3, ease: "back" },
      ],
    },
  ],
};

export const SHOWCASES = [solarEclipse, waterCycle, rocketLaunch];
