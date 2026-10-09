"use client";

import { useEffect, useRef } from "react";

const COLOURS = ["#ffffff", "#ffffff", "#ffffff", "#00f0ff", "#ff2bd6", "#ffe600", "#39ff14"];

// Fullscreen warp starfield: stars stream out from the centre with neon tints.
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      const dpr = 1; // trails look the same at 1x and cost far less
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 170 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
      c: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    }));

    const draw = () => {
      // Director mode covers the page with its own canvas; don't spend frames behind it.
      if (document.body.classList.contains("director-active")) {
        raf = requestAnimationFrame(draw);
        return;
      }
      g.fillStyle = "rgba(8, 0, 20, 0.35)"; // leaves short trails
      g.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.max(w, h) * 0.5;
      for (const s of stars) {
        const pz = s.z;
        if (!reduced) s.z -= 0.0016;
        if (s.z <= 0.02) {
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
          s.z = 1;
          continue;
        }
        const sx = cx + (s.x / s.z) * scale * 0.5;
        const sy = cy + (s.y / s.z) * scale * 0.5;
        const px = cx + (s.x / pz) * scale * 0.5;
        const py = cy + (s.y / pz) * scale * 0.5;
        const size = Math.max(0.4, (1 - s.z) * 2.4);
        g.strokeStyle = s.c;
        g.globalAlpha = Math.min(1, (1 - s.z) * 1.4);
        g.lineWidth = size;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(sx + 0.1, sy + 0.1);
        g.stroke();
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    g.fillStyle = "#080014";
    g.fillRect(0, 0, w, h);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden />;
}
