import { memo, type ReactElement } from "react";
import { parseColour } from "@/lib/colour";
import { STAGE_H, STAGE_W, type Particles } from "@/lib/scene";

// Scene backdrops and particle weather, drawn as desaturated real places for the noir evidence
// look: one light source each, a little fog, soft falloff, no neon. The preset NAMES are part of
// the scene JSON and never change (space, sky, ocean, city, grid); only how they're drawn does.
// Everything is static SVG animated by CSS (transform/opacity keyframes in globals.css).

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

// ---------- Shared pieces ----------

function Vignette({ p, strength = 0.6 }: { p: string; strength?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={`${p}vig`} cx="50%" cy="45%" r="75%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity={strength} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}vig)`} />
    </>
  );
}

// Slow banks of fog: large, faint, drifting.
function Fog({ p, y, colour = "#c9c7c0", opacity = 0.14 }: { p: string; y: number; colour?: string; opacity?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={`${p}fog`}>
          <stop offset="0%" stopColor={colour} stopOpacity={opacity} />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={220} cy={y} rx={360} ry={70} fill={`url(#${p}fog)`} className="bg-drift" />
      <ellipse cx={620} cy={y + 30} rx={340} ry={60} fill={`url(#${p}fog)`} className="bg-drift slow" />
    </>
  );
}

function Stars({ count, seed, twinkle, dim = 1 }: { count: number; seed: number; twinkle: number; dim?: number }) {
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
            r={0.4 + r() * 1.1}
            fill="#e6e2d8"
            opacity={(0.2 + r() * 0.5) * dim}
            className={tw ? "bg-twinkle" : undefined}
            style={tw ? { animationDelay: `${-r() * 4}s`, animationDuration: `${2 + r() * 3}s` } : undefined}
          />
        );
      })}
    </g>
  );
}

// ---------- Space: a night sky seen through a long lens, cold and quiet ----------

function Space({ p }: { p: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}space`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#090a0d" />
          <stop offset="100%" stopColor="#16181d" />
        </linearGradient>
        <radialGradient id={`${p}band`}>
          <stop offset="0%" stopColor="#8d8f94" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#8d8f94" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}space)`} />
      <ellipse cx={400} cy={200} rx={520} ry={70} fill={`url(#${p}band)`} transform="rotate(-18 400 200)" className="bg-drift slow" />
      <Stars count={95} seed={7} twinkle={0.25} />
      <Vignette p={p} strength={0.55} />
    </>
  );
}

// ---------- Sky: an overcast afternoon, the sun a pale smear behind cloud ----------

function Cloud({ x, y, s, cls, tone }: { x: number; y: number; s: number; cls: string; tone: string }) {
  return (
    <g className={cls} opacity={0.85}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill={tone}>
        <ellipse cx={0} cy={10} rx={70} ry={20} />
        <circle cx={-26} cy={0} r={24} />
        <circle cx={12} cy={-8} r={30} />
        <circle cx={44} cy={4} r={20} />
      </g>
    </g>
  );
}

function Sky({ p }: { p: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6f777c" />
          <stop offset="75%" stopColor="#a9aca7" />
          <stop offset="100%" stopColor="#c3c3bc" />
        </linearGradient>
        <radialGradient id={`${p}sun`}>
          <stop offset="0%" stopColor="#efe8d6" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#efe8d6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}sky)`} />
      <circle cx={680} cy={70} r={170} fill={`url(#${p}sun)`} />
      <Cloud x={130} y={80} s={1} cls="bg-cloud" tone="#bdbfbb" />
      <Cloud x={520} y={130} s={0.75} cls="bg-cloud slow" tone="#9fa3a2" />
      <Cloud x={330} y={52} s={0.55} cls="bg-cloud slower" tone="#c8c9c4" />
      <Fog p={p} y={410} colour="#d6d5cf" opacity={0.3} />
      <Vignette p={p} strength={0.35} />
    </>
  );
}

// ---------- Ocean: a grey harbour at dusk, a low sun behind haze ----------

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
          <stop offset="0%" stopColor="#4d5357" />
          <stop offset="100%" stopColor="#9a9a93" />
        </linearGradient>
        <linearGradient id={`${p}sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a565c" />
          <stop offset="100%" stopColor="#1b2226" />
        </linearGradient>
        <radialGradient id={`${p}lowsun`}>
          <stop offset="0%" stopColor="#dcd5c3" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#dcd5c3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}osky)`} />
      <circle cx={420} cy={196} r={110} fill={`url(#${p}lowsun)`} />
      <rect y={200} width={W} height={H - 200} fill={`url(#${p}sea)`} />
      {/* A distant pier on the horizon */}
      <g fill="#2b3135" opacity={0.8}>
        <rect x={40} y={188} width={150} height={4} />
        {[50, 80, 110, 140, 170].map((x) => (
          <rect key={x} x={x} y={190} width={3} height={14} />
        ))}
      </g>
      <path d={wavePath(215, 6, 160)} fill="#5b676c" opacity={0.45} className="bg-wave" />
      <path d={wavePath(270, 10, 220)} fill="#3b464b" opacity={0.55} className="bg-wave slow reverse" />
      <path d={wavePath(340, 12, 260)} fill="#273035" opacity={0.65} className="bg-wave slower" />
      <Fog p={p} y={200} colour="#b9b8b0" opacity={0.25} />
      <Vignette p={p} strength={0.45} />
    </>
  );
}

// ---------- City: a night street, one sodium lamp, a few lit windows ----------

function City({ p }: { p: string }) {
  const r = seeded(42);
  const back: ReactElement[] = [];
  const front: ReactElement[] = [];
  for (let x = -10; x < W; ) {
    const w = 40 + Math.round(r() * 50);
    const h = 120 + Math.round(r() * 150);
    back.push(<rect key={x} x={x} y={H - h - 40} width={w} height={h + 40} fill="#1d1f22" />);
    x += w + 4;
  }
  let k = 0;
  for (let x = -20; x < W; ) {
    const w = 50 + Math.round(r() * 60);
    const h = 70 + Math.round(r() * 120);
    const top = H - h;
    front.push(<rect key={`b${x}`} x={x} y={top} width={w} height={h} fill="#121315" />);
    for (let wy = top + 12; wy < H - 14; wy += 18)
      for (let wx = x + 8; wx < x + w - 10; wx += 14) {
        // Mostly dark offices; a few warm windows still lit.
        if (r() < 0.16) {
          const flick = r() < 0.1;
          front.push(
            <rect
              key={`w${k++}`}
              x={wx}
              y={wy}
              width={6}
              height={8}
              fill={r() < 0.85 ? "#b8945a" : "#9aa3a8"}
              opacity={0.55}
              className={flick ? "bg-twinkle" : undefined}
              style={flick ? { animationDuration: `${4 + r() * 5}s`, animationDelay: `${-r() * 5}s` } : undefined}
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
          <stop offset="0%" stopColor="#0d0e10" />
          <stop offset="100%" stopColor="#25272a" />
        </linearGradient>
        <linearGradient id={`${p}cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#efe2c4" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#efe2c4" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${p}pool`}>
          <stop offset="0%" stopColor="#efe2c4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#efe2c4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}night)`} />
      <Stars count={18} seed={3} twinkle={0} dim={0.5} />
      {back}
      {front}
      {/* The one light: a street lamp on the right, its cone falling through the fog */}
      <rect x={650} y={150} width={4} height={H - 150} fill="#0a0a0b" />
      <rect x={636} y={146} width={32} height={8} rx={2} fill="#0a0a0b" />
      <circle cx={652} cy={156} r={4} fill="#f4e7c8" />
      <polygon points={`640,156 664,156 760,${H} 544,${H}`} fill={`url(#${p}cone)`} />
      <ellipse cx={652} cy={H - 6} rx={150} ry={22} fill={`url(#${p}pool)`} />
      <Fog p={p} y={300} colour="#a7a9ab" opacity={0.12} />
      <Vignette p={p} strength={0.6} />
    </>
  );
}

// ---------- Grid: an interrogation room, concrete, one hard overhead light ----------

function Grid({ p }: { p: string }) {
  const floorY = 330;
  return (
    <>
      <defs>
        <linearGradient id={`${p}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c2b29" />
          <stop offset="100%" stopColor="#3b3a37" />
        </linearGradient>
        <linearGradient id={`${p}floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#262523" />
          <stop offset="100%" stopColor="#151514" />
        </linearGradient>
        <linearGradient id={`${p}beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3ead3" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f3ead3" stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id={`${p}lit`}>
          <stop offset="0%" stopColor="#f3ead3" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#f3ead3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}mirror`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b1d1f" />
          <stop offset="60%" stopColor="#24272a" />
          <stop offset="100%" stopColor="#17191b" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}wall)`} />
      {/* Concrete panel seams */}
      <g stroke="#232220" strokeWidth={2} opacity={0.7}>
        {[160, 320, 480, 640].map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={floorY} />
        ))}
        <line x1={0} y1={150} x2={W} y2={150} />
      </g>
      {/* The one-way mirror */}
      <rect x={40} y={70} width={180} height={110} fill={`url(#${p}mirror)`} stroke="#141414" strokeWidth={6} />
      <line x1={70} y1={80} x2={140} y2={170} stroke="#3b3f42" strokeWidth={3} opacity={0.5} />
      <rect y={floorY} width={W} height={H - floorY} fill={`url(#${p}floor)`} />
      <line x1={0} y1={floorY} x2={W} y2={floorY} stroke="#121211" strokeWidth={3} />
      {/* The one light: a caged lamp overhead, a hard cone, a bright pool on the floor */}
      <rect x={398} y={0} width={4} height={34} fill="#0e0e0d" />
      <polygon points="370,34 430,34 446,52 354,52" fill="#0e0e0d" />
      <ellipse cx={400} cy={53} rx={30} ry={4} fill="#fbf3dc" />
      <polygon points={`356,54 444,54 640,${H} 160,${H}`} fill={`url(#${p}beam)`} />
      <ellipse cx={400} cy={floorY + 60} rx={230} ry={46} fill={`url(#${p}lit)`} />
      <Fog p={p} y={220} colour="#bdb9ae" opacity={0.07} />
      <Vignette p={p} strength={0.75} />
    </>
  );
}

// ---------- A plain colour: the same colour as a lit wall, desaturated ----------

function Wall({ p, colour }: { p: string; colour: string }) {
  const rgb = parseColour(colour) ?? [16, 22, 42];
  const grey = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  // Keep a hint of the original hue (35%), lift very dark walls a little so objects read.
  const mix = rgb.map((c) => Math.round(Math.max(26, grey + (c - grey) * 0.35)));
  const base = `rgb(${mix.join(",")})`;
  return (
    <>
      <defs>
        <radialGradient id={`${p}walllight`} cx="30%" cy="20%" r="85%">
          <stop offset="0%" stopColor="#f1e8d2" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#f1e8d2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={base} />
      <rect width={W} height={H} fill={`url(#${p}walllight)`} />
      <Fog p={p} y={360} colour="#b9b6ad" opacity={0.08} />
      <Vignette p={p} strength={0.55} />
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
          <Wall p={p} colour={background ?? "#10162a"} />
          {stars && <Stars count={60} seed={1} twinkle={0.2} dim={0.8} />}
        </>
      );
  }
});

export const SceneParticles = memo(function SceneParticles({ kind }: { kind?: Particles }) {
  if (!kind) return null;
  const r = seeded(kind === "rain" ? 5 : kind === "snow" ? 9 : 13);
  if (kind === "rain")
    return (
      <g stroke="#c4c8cb" strokeWidth={1.1} strokeLinecap="round" opacity={0.45}>
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
      <g fill="#e4e2dc">
        {Array.from({ length: 60 }, (_, i) => (
          <circle
            key={i}
            cx={Math.round(r() * W)}
            cy={-10}
            r={1.1 + r() * 2.2}
            opacity={0.45 + r() * 0.4}
            className="fx-snow"
            style={{ animationDuration: `${6 + r() * 7}s`, animationDelay: `${-r() * 13}s` }}
          />
        ))}
      </g>
    );
  // Sparkle: dust caught in the light, small pale motes that glint and fade.
  return (
    <g fill="#ece4d0">
      {Array.from({ length: 30 }, (_, i) => {
        const x = Math.round(r() * W);
        const y = Math.round(r() * H);
        const s = 2 + r() * 3;
        return (
          <path
            key={i}
            d={`M ${x} ${y - s} L ${x + s * 0.3} ${y} L ${x} ${y + s} L ${x - s * 0.3} ${y} Z`}
            className="fx-sparkle"
            style={{ animationDuration: `${1.6 + r() * 1.8}s`, animationDelay: `${-r() * 3}s` }}
          />
        );
      })}
    </g>
  );
});
