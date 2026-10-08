"use client";

import confetti from "canvas-confetti";

const NEON = ["#39ff14", "#ff2bd6", "#00f0ff", "#ffe600"];

// Two neon cannons from the bottom corners.
export function celebrate(big = false) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const count = big ? 160 : 80;
  const shared = { particleCount: count, spread: 70, startVelocity: big ? 65 : 50, colors: NEON, shapes: ["square" as const], scalar: 1.1, zIndex: 60 };
  confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.9 } });
  confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.9 } });
}
