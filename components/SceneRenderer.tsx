import { memo, useId, useMemo } from "react";
import { SceneBackground, SceneParticles } from "./SceneBackground";
import { cameraAt, computeFrame, type FrameObject } from "@/lib/engine";
import { normalise, parseColour, shade } from "@/lib/colour";
import { ArtPiece } from "./Art";
import { ART_COLOURS, isArtName } from "@/lib/art";
import { ICON_COLOURS, ICON_GROUPS, iconHref } from "@/lib/icons";
import { STAGE_H, STAGE_W, type Scene, type SceneObject } from "@/lib/scene";

// Rendering budget: only objects, trails and the camera change per frame. Backgrounds,
// particles and gradient defs are memoised.
// Look: evidence photos, not neon. Objects are flat two-tone cut-outs lit from the top left, in
// their true colours (slightly muted by CSS), with one hard drop shadow on the whole object layer
// (CSS). No glow halos. What the scene IS (the JSON, the icon names) never changes here.

const TRAIL_STEPS = 5;
const TRAIL_GAP = 0.05; // seconds between ghosts

export interface Highlight {
  id: string;
  colour: string;
}

const isSolidFill = (o: SceneObject) => !!o.fill && o.fill !== "none";

// Rough radius of an object, for halos, shadows and highlight rings.
function radiusOf(o: FrameObject): number {
  switch (o.type) {
    case "circle":
    case "star":
      return (o.r ?? 20) * o.scale;
    case "rect":
    case "image":
      return (Math.max(o.w ?? 60, o.h ?? 40) / 2) * o.scale;
    case "icon":
      return ((o.w ?? 80) / 2) * o.scale;
    case "art":
      return (Math.max(o.w ?? 120, o.h ?? o.w ?? 120) / 2) * 0.8 * o.scale;
    case "text":
      return (o.fontSize ?? 16) * Math.max(1, (o.text ?? "").length) * 0.32 * o.scale;
    case "arrow":
      return Math.hypot((o.x2 ?? o.x + 60) - o.x, (o.y2 ?? o.y) - o.y) / 2;
  }
}

function starPoints(x: number, y: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(x + rad * Math.cos(a)).toFixed(1)},${(y + rad * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

// Gradient fills and glow halos for every object. Recomputed only when the objects change.
const ObjectDefs = memo(function ObjectDefs({ objects, p }: { objects: SceneObject[]; p: string }) {
  return (
    <>
      <marker id={`${p}arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
      </marker>
      {objects.map((o) => {
        const base = normalise(isSolidFill(o) ? o.fill : o.stroke, pictureColour(o));
        const shaded = isSolidFill(o) && (o.type === "circle" || o.type === "rect" || o.type === "star");
        // Two flat tones with a hard edge: the lit side and the side turned away from the one light.
        return shaded ? (
          <linearGradient key={o.id} id={`${p}f-${o.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={shade(base, 0.08)} />
            <stop offset="56%" stopColor={shade(base, 0.08)} />
            <stop offset="56%" stopColor={shade(base, -0.2)} />
            <stop offset="100%" stopColor={shade(base, -0.2)} />
          </linearGradient>
        ) : null;
      })}
    </>
  );
});

// Dark text gets a light outline and vice versa, so labels read on any backdrop.
function isDark(c: string | undefined): boolean {
  const rgb = parseColour(c);
  return !!rgb && 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 110;
}

// Neon colour of an icon (scene "fill" overrides the icon's default) or an art piece's main colour.
// The icon set's default colours were picked for neon tubes. When a scene doesn't give an icon a
// colour, tone the default down to a natural, printable version of the same hue (rendering only).
function naturalTone(hex: string): string {
  const rgb = parseColour(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const s0 = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  const s1 = Math.min(s0, 0.52);
  const l1 = Math.min(0.62, Math.max(0.42, l * 0.86));
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h % 6) + 6) % 2 - 1));
  const m = l1 - c / 2;
  const seg = Math.floor(((h % 6) + 6) % 6);
  const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  const hx = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hx(r1)}${hx(g1)}${hx(b1)}`;
}

function pictureColour(o: SceneObject): string {
  if (o.type === "icon") return isSolidFill(o) ? normalise(o.fill) : naturalTone(ICON_COLOURS[o.icon ?? ""] ?? "#9aa3a8");
  if (o.type === "art") return isArtName(o.art) ? ART_COLOURS[o.art] : "#cccccc";
  return "#cccccc";
}

function shapeFill(o: FrameObject, p: string) {
  return isSolidFill(o) ? `url(#${p}f-${o.id})` : "none";
}

// Draw one object. `ghost` draws a simplified copy for motion trails.
function drawObject(o: FrameObject, p: string, ghost = false, key = o.id) {
  const stroke = o.stroke && o.stroke !== "none" ? o.stroke : undefined;
  const common = {
    opacity: o.opacity,
    stroke,
    strokeWidth: stroke ? o.strokeWidth ?? 2 : undefined,
    strokeDasharray: o.dashed ? "5 7" : undefined,
  };
  const transform = o.scale !== 1 ? `translate(${o.x} ${o.y}) scale(${o.scale}) translate(${-o.x} ${-o.y})` : undefined;

  switch (o.type) {
    case "circle":
      return <circle key={key} cx={o.x} cy={o.y} r={o.r ?? 20} fill={shapeFill(o, p)} transform={transform} {...common} />;
    case "rect": {
      const w = o.w ?? 60;
      const h = o.h ?? 40;
      return <rect key={key} x={o.x - w / 2} y={o.y - h / 2} width={w} height={h} rx={Math.min(10, w / 6, h / 6)} fill={shapeFill(o, p)} transform={transform} {...common} />;
    }
    case "star":
      return <polygon key={key} points={starPoints(o.x, o.y, o.r ?? 24)} fill={shapeFill(o, p)} strokeLinejoin="round" transform={transform} {...common} />;
    case "icon": {
      const s = o.w ?? 80;
      if (!o.icon || !(o.icon in ICON_GROUPS))
        return <circle key={key} cx={o.x} cy={o.y} r={s / 2.4} fill="#9ba1a6" opacity={o.opacity} transform={transform} />;
      // A crisp ink line in the icon's own colour over a darker under-stroke, like a printed cut-out.
      const colour = pictureColour(o);
      const sw = Math.min(2.8, Math.max(1.1, (3.8 * 24) / s)); // ~3.5px on stage whatever the size
      const box = { href: iconHref(o.icon), x: o.x - s / 2, y: o.y - s / 2, width: s, height: s };
      const width = (w: number) => ({ "--sw": w }) as React.CSSProperties;
      return (
        <g key={key} opacity={o.opacity} transform={transform}>
          {!ghost && <use {...box} color={shade(colour, -0.55)} style={width(sw * 2.1)} />}
          <use {...box} color={colour} style={width(sw)} />
        </g>
      );
    }
    case "art": {
      if (ghost || !isArtName(o.art)) return null;
      const w = o.w ?? 120;
      const h = o.h ?? w;
      return (
        <g key={key} opacity={o.opacity} transform={`translate(${o.x} ${o.y}) scale(${(w / 100) * o.scale} ${(h / 100) * o.scale})`}>
          <ArtPiece name={o.art} p={`${p}${o.id}-`} />
        </g>
      );
    }
    case "text":
      if (ghost) return null;
      return (
        <text
          key={key}
          x={o.x}
          y={o.y}
          fill={o.fill ?? "#fff"}
          fontSize={o.fontSize ?? 18}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="var(--font-body), 'Courier New', monospace"
          fontWeight={700}
          stroke={isDark(o.fill) ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)"}
          strokeWidth={4}
          strokeLinejoin="round"
          paintOrder="stroke"
          transform={transform}
          opacity={o.opacity}
        >
          {o.text}
        </text>
      );
    case "arrow":
      return (
        <line
          key={key}
          x1={o.x}
          y1={o.y}
          x2={o.x2 ?? o.x + 60}
          y2={o.y2 ?? o.y}
          markerEnd={`url(#${p}arrow)`}
          strokeLinecap="round"
          {...common}
          stroke={stroke ?? o.fill ?? "#fff"}
          strokeWidth={o.strokeWidth ?? 4}
        />
      );
    case "image": {
      const w = o.w ?? 80;
      const h = o.h ?? 80;
      return <image key={key} href={o.href} x={o.x - w / 2} y={o.y - h / 2} width={w} height={h} opacity={o.opacity} transform={transform} />;
    }
  }
}

// A circle inked by hand around a missed (or invented) object: slightly lopsided, the pen
// overshoots where it started, and it draws itself in.
function ring(o: FrameObject, colour: string) {
  let cx = o.x;
  let cy = o.y;
  if (o.type === "arrow") {
    cx = (o.x + (o.x2 ?? o.x + 60)) / 2;
    cy = (o.y + (o.y2 ?? o.y)) / 2;
  }
  const r = radiusOf(o) + 14;
  let seed = 0;
  for (const ch of o.id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const wob = (k: number) => 1 + 0.06 * Math.sin(seed + k * 1.7);
  const pts = Array.from({ length: 15 }, (_, k) => {
    const a = -2.2 + (k / 14) * (Math.PI * 2 + 0.5); // a little over a full turn
    return `${(cx + Math.cos(a) * r * 1.08 * wob(k)).toFixed(1)},${(cy + Math.sin(a) * r * 0.92 * wob(k + 3)).toFixed(1)}`;
  });
  return (
    <polyline key={`ring-${o.id}`} className="ink-ring" points={pts.join(" ")} pathLength={1}
      fill="none" stroke={colour} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
  );
}

export default function SceneRenderer({
  scene,
  time,
  highlights = [],
  still = false,
}: {
  scene: Scene;
  time: number;
  highlights?: Highlight[];
  still?: boolean; // thumbnails: freeze CSS animations too
}) {
  const p = useId().replace(/[^a-zA-Z0-9]/g, "") + "-";
  const frame = computeFrame(scene, time);
  const byId = new Map(frame.map((o) => [o.id, o]));
  const cam = cameraAt(scene, time);

  // Objects that move or orbit get trails. Depends only on the timeline.
  const movers = useMemo(() => {
    const ids = new Set<string>();
    for (const a of scene.timeline) if (a.action === "move" || a.action === "orbit") ids.add(a.target);
    return ids;
  }, [scene.timeline]);

  // Ghost copies at slightly earlier times form the motion trail.
  const trails: React.ReactNode[] = [];
  const trailIds = scene.objects.filter((o) => (o.trail ?? movers.has(o.id)) && o.type !== "text" && o.type !== "art").map((o) => o.id);
  if (trailIds.length) {
    for (let k = TRAIL_STEPS; k >= 1; k--) {
      const t = time - k * TRAIL_GAP;
      if (t < 0) continue;
      const past = new Map(computeFrame(scene, t).map((o) => [o.id, o]));
      for (const id of trailIds) {
        const now = byId.get(id);
        const then = past.get(id);
        if (!now || !then || Math.hypot(now.x - then.x, now.y - then.y) < 1.5) continue;
        const fade = (1 - k / (TRAIL_STEPS + 1)) * 0.22;
        trails.push(drawObject({ ...then, opacity: then.opacity * fade, scale: then.scale * (1 - k * 0.05) }, p, true, `tr${k}-${id}`));
      }
    }
  }

  // Three stacked layers so a moving object never forces the static backdrop to repaint.
  // The camera is a CSS transform on each layer (GPU-composited); the backdrop drifts less for parallax.
  const camCss = (zoom: number, x: number, y: number) =>
    scene.camera ? { transform: `translate(${(-x / STAGE_W) * 100}%, ${(-y / STAGE_H) * 100}%) scale(${zoom})` } : undefined;
  const view = `0 0 ${STAGE_W} ${STAGE_H}`;

  return (
    <div className={still ? "stage still" : "stage"} role="img" aria-label={scene.title}>
      <svg viewBox={view} className="stage-layer backdrop" style={camCss(1.08 + (cam.zoom - 1) * 0.4, cam.x * 0.4, cam.y * 0.4)} aria-hidden>
        <SceneBackground background={scene.background} stars={scene.stars} idPrefix={p} />
      </svg>
      <svg viewBox={view} className="stage-layer world" style={camCss(cam.zoom, cam.x, cam.y)} aria-hidden>
        <defs>
          <ObjectDefs objects={scene.objects} p={p} />
        </defs>
        {trails}
        {frame.map((o) => drawObject(o, p, false, o.id))}
        {highlights.map((h) => {
          const o = byId.get(h.id);
          return o ? ring(o, h.colour) : null;
        })}
      </svg>
      {scene.particles && (
        <svg viewBox={view} className="stage-layer weather" aria-hidden>
          <SceneParticles kind={scene.particles} />
        </svg>
      )}
    </div>
  );
}
