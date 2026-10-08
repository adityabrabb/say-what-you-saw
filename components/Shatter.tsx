"use client";

import { motion } from "motion/react";
import { useEffect, useMemo } from "react";

interface Props {
  origin: { x: number; y: number };
  onDone: () => void;
  children: React.ReactNode; // a still copy of the screen; each shard shows its slice of it
}

type Pt = [number, number];

// Seeded random so a shatter's geometry stays stable across re-renders.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Split the screen into glass shards: rays out from the impact point, cut by jittered rings.
function buildShards(cx: number, cy: number, w: number, h: number) {
  const rand = rng(Math.floor(cx * 31 + cy * 17) || 7);
  const rays = 11;
  const angles = Array.from({ length: rays }, (_, i) => ((i + 0.25 + rand() * 0.5) / rays) * Math.PI * 2);
  const far = Math.hypot(w, h) * 1.2;
  const rings = [0, 50 + rand() * 30, 160 + rand() * 60, 340 + rand() * 80, 620 + rand() * 120, far];
  // Each ray gets its own jittered radius per ring so edges aren't perfect circles.
  const radius = angles.map(() => rings.map((r, j) => (j === 0 || j === rings.length - 1 ? r : r * (0.8 + rand() * 0.4))));
  const point = (i: number, j: number): Pt => {
    const a = angles[i % rays];
    const r = radius[i % rays][j];
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const shards: { points: Pt[]; centre: Pt; ring: number }[] = [];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < rays; i++) {
      const points = j === 0 ? [point(i, 0), point(i, 1), point(i + 1, 1)] : [point(i, j), point(i, j + 1), point(i + 1, j + 1), point(i + 1, j)];
      const centre: Pt = [
        points.reduce((s, p) => s + p[0], 0) / points.length,
        points.reduce((s, p) => s + p[1], 0) / points.length,
      ];
      shards.push({ points, centre, ring: j });
    }
  return { shards, angles, rand };
}

export default function Shatter({ origin, onDone, children }: Props) {
  const { shards, angles, motions } = useMemo(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const built = buildShards(origin.x, origin.y, w, h);
    const motions = built.shards.map((s) => {
      const dx = s.centre[0] - origin.x;
      const dy = s.centre[1] - origin.y;
      const dist = Math.hypot(dx, dy) || 1;
      return {
        x: (dx / dist) * (60 + built.rand() * 140),
        y: h + 200 + built.rand() * 400,
        rotate: (built.rand() - 0.5) * 160,
        rotateX: (built.rand() - 0.5) * 120,
        delay: 0.18 + Math.min(0.45, dist / 1600) + built.rand() * 0.08,
        duration: 0.8 + built.rand() * 0.5,
      };
    });
    return { shards: built.shards, angles: built.angles, motions };
  }, [origin]);

  useEffect(() => {
    const id = setTimeout(onDone, 1250);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="shatter" aria-hidden>
      {/* Impact flash */}
      <motion.div className="shatter-flash" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
      {shards.map((s, i) => {
        const m = motions[i];
        const clip = `polygon(${s.points.map(([x, y]) => `${x}px ${y}px`).join(", ")})`;
        return (
          <motion.div
            key={i}
            className="shard"
            style={{ transformOrigin: `${s.centre[0]}px ${s.centre[1]}px` }}
            initial={{ x: 0, y: 0, rotate: 0 }}
            animate={{
              x: [0, (Math.random() - 0.5) * 6, m.x],
              y: [0, (Math.random() - 0.5) * 6, m.y],
              rotate: [0, 0, m.rotate],
              rotateX: [0, 0, m.rotateX],
              opacity: [1, 1, 0.9],
            }}
            transition={{ duration: m.duration + m.delay, times: [0, m.delay / (m.duration + m.delay), 1], ease: ["linear", [0.5, 0, 0.9, 0.6]] }}
          >
            <div className="shard-glass" style={{ clipPath: clip }}>
              {children}
            </div>
          </motion.div>
        );
      })}
      {/* Crack lines radiating from the impact */}
      <motion.svg className="shatter-cracks" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
        {angles.map((a, i) => (
          <motion.line
            key={i}
            x1={origin.x}
            y1={origin.y}
            x2={origin.x + Math.cos(a) * 2000}
            y2={origin.y + Math.sin(a) * 2000}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.15 }}
          />
        ))}
      </motion.svg>
    </div>
  );
}
