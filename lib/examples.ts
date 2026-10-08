import type { Video } from "./scene";

export const solarSystem: Video = {
  title: "Sun, Earth and Moon",
  scenes: [
    {
      id: "orbits",
      title: "Who orbits whom",
      duration: 14,
      background: "space",
      camera: { zoom: 1.1 },
      caption: "The Earth goes around the Sun, and the Moon goes around the Earth.",
      objects: [
        { id: "earthPath", type: "circle", x: 400, y: 235, r: 150, fill: "none", stroke: "#8aa4c8", strokeWidth: 1, dashed: true, opacity: 0 },
        { id: "sun", type: "circle", x: 400, y: 235, r: 42, fill: "#FDB813", glow: true, opacity: 0, scale: 0.3 },
        { id: "sunLabel", type: "text", x: 0, y: 66, text: "Sun", fontSize: 18, fill: "#FFE7A3", follow: "sun", opacity: 0 },
        { id: "earth", type: "circle", x: 0, y: 0, r: 14, fill: "#2E6FD8", opacity: 0 },
        { id: "earthLabel", type: "text", x: 0, y: 30, text: "Earth", fontSize: 15, fill: "#BFD6FF", follow: "earth", opacity: 0 },
        { id: "moonPath", type: "circle", x: 0, y: 0, r: 34, fill: "none", stroke: "#8aa4c8", strokeWidth: 1, dashed: true, follow: "earth", opacity: 0 },
        { id: "moon", type: "circle", x: 0, y: 0, r: 5, fill: "#C9C9C9", opacity: 0 },
        { id: "moonLabel", type: "text", x: 0, y: -13, text: "Moon", fontSize: 12, fill: "#E2E2E2", follow: "moon", opacity: 0 },
        { id: "title", type: "text", x: 400, y: 36, text: "The Earth orbits the Sun. The Moon orbits the Earth.", fontSize: 20, fill: "#F2F4F8", opacity: 0 },
      ],
      timeline: [
        { target: "sun", action: "fade", start: 0, duration: 1, to: 1 },
        { target: "sun", action: "grow", start: 0, duration: 1.2, to: 1 },
        { target: "title", action: "fade", start: 0.4, duration: 0.8, to: 1 },
        { target: "sunLabel", action: "fade", start: 1, duration: 0.6, to: 1 },
        { target: "earthPath", action: "fade", start: 1.2, duration: 0.8, to: 0.45 },
        { target: "earth", action: "fade", start: 1.5, duration: 0.8, to: 1 },
        { target: "earth", action: "orbit", start: 1.5, duration: 12.5, around: "sun", radius: 150, turns: 1, startAngle: 200 },
        { target: "earthLabel", action: "fade", start: 2, duration: 0.6, to: 1 },
        { target: "moonPath", action: "fade", start: 3, duration: 0.8, to: 0.4 },
        { target: "moon", action: "fade", start: 3, duration: 0.8, to: 1 },
        { target: "moon", action: "orbit", start: 3, duration: 11, around: "earth", radius: 34, turns: 5, startAngle: 90 },
        { target: "moonLabel", action: "fade", start: 3.6, duration: 0.6, to: 1 },
      ],
    },
  ],
};
