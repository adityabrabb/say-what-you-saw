import type { ArtName } from "./art";
import type { SceneObject, Video } from "./scene";

// Hand-made showcase explainers, drawn with the detailed "art" illustrations. They're the
// Studio's demo reel and double as style references for the generator.

const art = (id: string, name: ArtName, x: number, y: number, w: number, extra: Partial<SceneObject> = {}): SceneObject => ({
  id, type: "art", art: name, x, y, w, ...extra,
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
      camera: { zoom: 1.08, panX: 12 },
      entrance: "stagger",
      caption: "When the Moon slides exactly between the Sun and Earth, its shadow cone falls on Earth and day turns to night.",
      objects: [
        { id: "title", type: "text", text: "SOLAR ECLIPSE", x: 400, y: 38, fontSize: 28, fill: "#FFE600" },
        art("sun", "sun", 135, 230, 210, { glow: true }),
        art("earth", "earth", 670, 230, 150),
        art("cone", "shadow-cone", 545, 230, 150, { h: 90, opacity: 0 }),
        art("moon", "moon", 400, 95, 62),
        { id: "ray1", type: "arrow", x: 250, y: 185, x2: 345, y2: 208, stroke: "#FDB813", strokeWidth: 4, opacity: 0 },
        { id: "ray2", type: "arrow", x: 250, y: 275, x2: 345, y2: 252, stroke: "#FDB813", strokeWidth: 4, opacity: 0 },
        { id: "umbra", type: "circle", x: 628, y: 230, r: 15, fill: "#05030F", opacity: 0 },
        label("sunLabel", "SUN", 0, 112, { follow: "sun" }),
        label("moonLabel", "MOON", 0, -40, { follow: "moon" }),
        label("earthLabel", "EARTH", 0, 88, { follow: "earth" }),
        label("coneLabel", "SHADOW CONE", 545, 172, { fill: "#FF8589", fontSize: 16 }),
      ],
      timeline: [
        { target: "sunLabel", action: "fade", start: 0.9, duration: 0.6, to: 1 },
        { target: "earthLabel", action: "fade", start: 1.2, duration: 0.6, to: 1 },
        { target: "moonLabel", action: "fade", start: 1.5, duration: 0.6, to: 1 },
        { target: "ray1", action: "fade", start: 1.9, duration: 0.6, to: 1 },
        { target: "ray2", action: "fade", start: 2.1, duration: 0.6, to: 1 },
        { target: "moon", action: "move", start: 2.6, duration: 3.2, to: { x: 440, y: 230 }, ease: "inOut" },
        { target: "cone", action: "fade", start: 5.4, duration: 1.2, to: 1 },
        { target: "umbra", action: "fade", start: 5.8, duration: 1, to: 0.8 },
        { target: "coneLabel", action: "fade", start: 6.2, duration: 0.6, to: 1 },
        { target: "sun", action: "grow", start: 6.6, duration: 1.4, to: 1.06, ease: "back" },
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
      caption: "The sun heats the sea, vapour rises and cools into clouds, rain falls on the mountains and flows back to the sea.",
      objects: [
        art("sun", "sun", 700, 78, 130, { glow: true }),
        art("mountain", "mountain", 630, 330, 240),
        art("sea", "sea", 200, 392, 360, { h: 120 }),
        art("vapor", "vapor", 200, 280, 80),
        art("cloud", "cloud", 250, 135, 160),
        art("rainCloud", "rain-cloud", 560, 120, 170, { opacity: 0 }),
        art("drop", "drop", 570, 175, 28, { opacity: 0 }),
        { id: "evap", type: "arrow", x: 250, y: 300, x2: 270, y2: 205, stroke: "#1B6FD8", strokeWidth: 4 },
        { id: "flow", type: "arrow", x: 540, y: 420, x2: 330, y2: 420, stroke: "#1B6FD8", strokeWidth: 4, opacity: 0 },
        label("evapLabel", "EVAPORATION", 120, 235, { fill: "#063D6B" }),
        label("condLabel", "CONDENSATION", 400, 60, { fill: "#063D6B" }),
        label("rainLabel", "PRECIPITATION", 690, 200, { fill: "#063D6B" }),
        label("flowLabel", "COLLECTION", 440, 440, { fill: "#063D6B", fontSize: 16 }),
      ],
      timeline: [
        { target: "evapLabel", action: "fade", start: 0.9, duration: 0.6, to: 1 },
        { target: "vapor", action: "move", start: 1, duration: 2.4, to: { x: 230, y: 200 }, ease: "out" },
        { target: "vapor", action: "fade", start: 2.8, duration: 0.6, to: 0 },
        { target: "cloud", action: "move", start: 3, duration: 2.6, to: { x: 520, y: 115 } },
        { target: "condLabel", action: "fade", start: 3.4, duration: 0.6, to: 1 },
        { target: "cloud", action: "fade", start: 5.4, duration: 0.5, to: 0 },
        { target: "rainCloud", action: "fade", start: 5.4, duration: 0.5, to: 1 },
        { target: "rainLabel", action: "fade", start: 6, duration: 0.6, to: 1 },
        { target: "drop", action: "fade", start: 6.2, duration: 0.3, to: 1 },
        { target: "drop", action: "move", start: 6.2, duration: 1.4, to: { x: 600, y: 290 }, ease: "bounce" },
        { target: "flow", action: "fade", start: 8, duration: 0.6, to: 1 },
        { target: "flowLabel", action: "fade", start: 8.2, duration: 0.6, to: 1 },
        { target: "sea", action: "grow", start: 8.8, duration: 1.2, to: 1.06, ease: "back" },
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
      caption: "Engines blast exhaust downward, the reaction pushes the rocket up, and it climbs toward orbit.",
      objects: [
        art("moon", "moon", 690, 72, 76),
        art("pad", "launch-pad", 430, 345, 170),
        art("rocket", "rocket", 400, 318, 112),
        art("flame", "flame", 0, 68, 46, { follow: "rocket", h: 56, opacity: 0 }),
        art("smokeL", "smoke", 320, 400, 140),
        art("smokeR", "smoke", 500, 405, 150),
        { id: "thrust", type: "arrow", x: 230, y: 270, x2: 230, y2: 160, stroke: "#E5484D", strokeWidth: 5, opacity: 0 },
        label("thrustLabel", "THRUST", 230, 295, { fill: "#B3122E", fontSize: 20 }),
        { id: "count", type: "text", text: "3 · 2 · 1", x: 400, y: 190, fontSize: 34, fill: "#F76B15" },
        label("liftoff", "LIFTOFF!", 400, 190, { fontSize: 40, fill: "#F76B15" }),
        label("speed", "11.2 km/s TO ESCAPE EARTH", 190, 58, { fill: "#063D6B", fontSize: 16 }),
      ],
      timeline: [
        { target: "count", action: "fade", start: 1.8, duration: 0.4, to: 0 },
        { target: "flame", action: "fade", start: 2, duration: 0.3, to: 1 },
        { target: "liftoff", action: "fade", start: 2.1, duration: 0.3, to: 1 },
        { target: "smokeL", action: "grow", start: 2, duration: 1.8, to: 1.6, ease: "out" },
        { target: "smokeR", action: "grow", start: 2, duration: 1.8, to: 1.6, ease: "out" },
        { target: "rocket", action: "move", start: 2.4, duration: 4.5, to: { x: 400, y: 60 }, ease: "inOut" },
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
