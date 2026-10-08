import { memo, type ReactElement } from "react";
import { STAGE_H, STAGE_W, type Particles } from "@/lib/scene";

// Scene backdrops and particle weather. Everything here is static SVG animated by CSS
// (transform/opacity keyframes in globals.css), so none of it re-renders per frame.

const W = STAGE_W;
const H = STAGE_H;

// Deterministic pseudo-random sequence, rounded so server and client markup match.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return Math.round(((s - 1) / 2147483646) * 1000) / 1000;
  };
}

function Stars({ count, seed, twinkle }: { count: number; seed: number; twinkle: number }) {
  const r = seeded(seed);
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const tw = r() < twinkle;
        return (
          <circle
            key={i}
            cx={Math.round(r() * W)}
            cy={Math.round(r() * H)}
            r={0.5 + r() * 1.3}
            fill="#fff"
            opacity={0.35 + r() * 0.6}
            className={tw ? "bg-twinkle" : undefined}
            style={tw ? { animationDelay: `${-r() * 4}s`, animationDuration: `${2 + r() * 3}s` } : undefined}
          />
        );
      })}
    </g>
  );
}

function Space({ p }: { p: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${p}space`} cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor="#1b1046" />
          <stop offset="60%" stopColor="#0a0620" />
          <stop offset="100%" stopColor="#03020a" />
        </radialGradient>
        <radialGradient id={`${p}neb1`}>
          <stop offset="0%" stopColor="#8e4ec6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#8e4ec6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}neb2`}>
          <stop offset="0%" stopColor="#00b3c7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00b3c7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}space)`} />
      <ellipse cx={170} cy={110} rx={260} ry={150} fill={`url(#${p}neb1)`} className="bg-drift" />
      <ellipse cx={640} cy={340} rx={240} ry={140} fill={`url(#${p}neb2)`} className="bg-drift slow" />
      <Stars count={110} seed={7} twinkle={0.4} />
    </>
  );
}

function Cloud({ x, y, s, cls }: { x: number; y: number; s: number; cls: string }) {
  return (
    <g className={cls} opacity={0.92}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx={0} cy={10} rx={60} ry={20} fill="#ffffff" />
        <circle cx={-22} cy={0} r={24} fill="#ffffff" />
        <circle cx={12} cy={-8} r={30} fill="#ffffff" />
        <circle cx={40} cy={4} r={20} fill="#f1f7ff" />
      </g>
    </g>
  );
}

function Sky({ p }: { p: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f86f6" />
          <stop offset="70%" stopColor="#8ccaff" />
          <stop offset="100%" stopColor="#d9f0ff" />
        </linearGradient>
        <radialGradient id={`${p}sunglow`}>
          <stop offset="0%" stopColor="#fff6c9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff6c9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}sky)`} />
      <circle cx={700} cy={60} r={140} fill={`url(#${p}sunglow)`} />
      <Cloud x={120} y={80} s={1} cls="bg-cloud" />
      <Cloud x={520} y={130} s={0.7} cls="bg-cloud slow" />
      <Cloud x={330} y={50} s={0.55} cls="bg-cloud slower" />
    </>
  );
}

// One period of a sine wave, repeated so it can slide sideways seamlessly.
const wavePath = (y: number, amp: number, len: number) => {
  let d = `M -${len} ${y}`;
  for (let x = -len; x < W + len; x += len) d += ` q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0`;
  return `${d} V ${H} H -${len} Z`;
};

function Ocean({ p }: { p: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}osky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb07a" />
          <stop offset="100%" stopColor="#ffe3b8" />
        </linearGradient>
        <linearGradient id={`${p}sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b8fd1" />
          <stop offset="100%" stopColor="#063d6b" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}osky)`} />
      <circle cx={400} cy={200} r={60} fill="#ffd27a" opacity={0.9} />
      <rect y={200} width={W} height={H - 200} fill={`url(#${p}sea)`} />
      <path d={wavePath(215, 8, 160)} fill="#2aa3e0" opacity={0.55} className="bg-wave" />
      <path d={wavePath(270, 12, 220)} fill="#1580c0" opacity={0.6} className="bg-wave slow reverse" />
      <path d={wavePath(340, 14, 260)} fill="#0b5d96" opacity={0.65} className="bg-wave slower" />
    </>
  );
}

function City({ p }: { p: string }) {
  const r = seeded(42);
  const back: ReactElement[] = [];
  const front: ReactElement[] = [];
  for (let x = -10; x < W; ) {
    const w = 40 + Math.round(r() * 50);
    const h = 120 + Math.round(r() * 150);
    back.push(<rect key={x} x={x} y={H - h - 40} width={w} height={h + 40} fill="#2a1452" />);
    x += w + 4;
  }
  let k = 0;
  for (let x = -20; x < W; ) {
    const w = 50 + Math.round(r() * 60);
    const h = 70 + Math.round(r() * 120);
    const top = H - h;
    front.push(<rect key={`b${x}`} x={x} y={top} width={w} height={h} fill="#120726" />);
    for (let wy = top + 12; wy < H - 14; wy += 18)
      for (let wx = x + 8; wx < x + w - 10; wx += 14) {
        if (r() < 0.38) {
          const blink = r() < 0.12;
          front.push(
            <rect
              key={`w${k++}`}
              x={wx}
              y={wy}
              width={6}
              height={8}
              fill={r() < 0.8 ? "#ffd86b" : "#7af3ff"}
              opacity={0.85}
              className={blink ? "bg-twinkle" : undefined}
              style={blink ? { animationDuration: `${3 + r() * 4}s`, animationDelay: `${-r() * 5}s` } : undefined}
            />
          );
        }
      }
    x += w + 6;
  }
  return (
    <>
      <defs>
        <linearGradient id={`${p}night`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#090221" />
          <stop offset="100%" stopColor="#3a0f5e" />
        </linearGradient>
        <radialGradient id={`${p}moonglow`}>
          <stop offset="0%" stopColor="#fff4d6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff4d6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}night)`} />
      <Stars count={50} seed={3} twinkle={0.3} />
      <circle cx={660} cy={80} r={90} fill={`url(#${p}moonglow)`} />
      <circle cx={660} cy={80} r={26} fill="#fff4d6" />
      {back}
      {front}
    </>
  );
}

function Grid({ p }: { p: string }) {
  const horizon = 260;
  const vlines = Array.from({ length: 25 }, (_, i) => -800 + i * 100);
  const hlines = Array.from({ length: 9 }, (_, i) => horizon + Math.pow(i / 8, 2) * (H - horizon) + i * 2);
  return (
    <>
      <defs>
        <linearGradient id={`${p}gsky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d0221" />
          <stop offset="100%" stopColor="#3b0a6b" />
        </linearGradient>
        <linearGradient id={`${p}gsun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe600" />
          <stop offset="100%" stopColor="#ff2bd6" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}gsky)`} />
      <Stars count={40} seed={11} twinkle={0.3} />
      <g className="bg-pulse">
        <circle cx={400} cy={horizon - 10} r={95} fill={`url(#${p}gsun)`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={300} y={horizon - 40 + i * 12} width={200} height={3 + i * 1.5} fill="#2a0750" />
        ))}
      </g>
      <rect y={horizon} width={W} height={H - horizon} fill="#0b0120" />
      <g stroke="#ff2bd6" strokeWidth={1.4} opacity={0.75}>
        {vlines.map((x) => (
          <line key={x} x1={400} y1={horizon} x2={400 + (x - 400) * 2.4} y2={H} />
        ))}
        {hlines.map((y, i) => (
          <line key={i} x1={0} y1={y} x2={W} y2={y} />
        ))}
      </g>
      <line x1={0} y1={horizon} x2={W} y2={horizon} stroke="#00f0ff" strokeWidth={2} />
    </>
  );
}

export const SceneBackground = memo(function SceneBackground({ background, stars, idPrefix }: { background?: string; stars?: boolean; idPrefix: string }) {
  const p = idPrefix;
  switch (background) {
    case "space":
      return <Space p={p} />;
    case "sky":
      return <Sky p={p} />;
    case "ocean":
      return <Ocean p={p} />;
    case "city":
      return <City p={p} />;
    case "grid":
      return <Grid p={p} />;
    default:
      return (
        <>
          <rect width={W} height={H} fill={background ?? "#10162a"} />
          {stars && <Stars count={70} seed={1} twinkle={0.25} />}
        </>
      );
  }
});

export const SceneParticles = memo(function SceneParticles({ kind }: { kind?: Particles }) {
  if (!kind) return null;
  const r = seeded(kind === "rain" ? 5 : kind === "snow" ? 9 : 13);
  if (kind === "rain")
    return (
      <g stroke="#bfe3ff" strokeWidth={1.4} strokeLinecap="round" opacity={0.6}>
        {Array.from({ length: 70 }, (_, i) => {
          const x = Math.round(r() * (W + 100));
          const len = 12 + Math.round(r() * 12);
          return (
            <line
              key={i}
              x1={x}
              y1={-30}
              x2={x - 4}
              y2={-30 + len}
              className="fx-rain"
              style={{ animationDuration: `${0.55 + r() * 0.4}s`, animationDelay: `${-r() * 2}s` }}
            />
          );
        })}
      </g>
    );
  if (kind === "snow")
    return (
      <g fill="#ffffff">
        {Array.from({ length: 60 }, (_, i) => (
          <circle
            key={i}
            cx={Math.round(r() * W)}
            cy={-10}
            r={1.2 + r() * 2.6}
            opacity={0.55 + r() * 0.45}
            className="fx-snow"
            style={{ animationDuration: `${6 + r() * 7}s`, animationDelay: `${-r() * 13}s` }}
          />
        ))}
      </g>
    );
  // Sparkles: four-point stars that twinkle and spin.
  return (
    <g>
      {Array.from({ length: 26 }, (_, i) => {
        const x = Math.round(r() * W);
        const y = Math.round(r() * H);
        const s = 4 + r() * 7;
        const colour = ["#ffffff", "#fff3a0", "#9ff4ff", "#ffb3f2"][i % 4];
        return (
          <path
            key={i}
            d={`M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`}
            fill={colour}
            className="fx-sparkle"
            style={{ animationDuration: `${1.4 + r() * 1.6}s`, animationDelay: `${-r() * 3}s` }}
          />
        );
      })}
    </g>
  );
});
