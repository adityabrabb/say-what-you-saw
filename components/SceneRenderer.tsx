import { memo, useId, useMemo } from "react";
import { SceneBackground, SceneParticles } from "./SceneBackground";
import { cameraAt, computeFrame, type FrameObject } from "@/lib/engine";
import { normalise, parseColour, shade } from "@/lib/colour";
import { ICON_GROUPS, iconUrl } from "@/lib/icons";
import { STAGE_H, STAGE_W, type Scene, type SceneObject } from "@/lib/scene";

// Rendering budget: only objects, trails and the camera change per frame. Backgrounds,
// particles and gradient defs are memoised, and every glow/shadow is a gradient, not a blur filter.

const DARK_BACKDROPS = new Set(["space", "grid", "city"]);
const LIGHT_BACKDROPS = new Set(["sky", "ocean"]);
const SOLID = new Set(["circle", "rect", "star", "icon"]);
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
      <radialGradient id={`${p}shadow`}>
        <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      {objects.map((o) => {
        const base = normalise(isSolidFill(o) ? o.fill : o.stroke, o.type === "icon" ? "#fff3c4" : "#cccccc");
        const shaded = isSolidFill(o) && (o.type === "circle" || o.type === "rect" || o.type === "star");
        return (
          <g key={o.id}>
            {shaded &&
              (o.type === "rect" ? (
                <linearGradient id={`${p}f-${o.id}`} x1="0" y1="0" x2="0.35" y2="1">
                  <stop offset="0%" stopColor={shade(base, 0.35)} />
                  <stop offset="55%" stopColor={base} />
                  <stop offset="100%" stopColor={shade(base, -0.3)} />
                </linearGradient>
              ) : (
                <radialGradient id={`${p}f-${o.id}`} cx="0.36" cy="0.32" r="0.75">
                  <stop offset="0%" stopColor={shade(base, o.glow ? 0.7 : 0.45)} />
                  <stop offset="50%" stopColor={base} />
                  <stop offset="100%" stopColor={shade(base, -0.35)} />
                </radialGradient>
              ))}
            <radialGradient id={`${p}h-${o.id}`}>
              <stop offset="35%" stopColor={shade(base, 0.2)} stopOpacity="0.55" />
              <stop offset="100%" stopColor={base} stopOpacity="0" />
            </radialGradient>
          </g>
        );
      })}
    </>
  );
});

// Dark text gets a light outline and vice versa, so labels read on any backdrop.
function isDark(c: string | undefined): boolean {
  const rgb = parseColour(c);
  return !!rgb && 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 110;
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
      return <image key={key} href={iconUrl(o.icon)} x={o.x - s / 2} y={o.y - s / 2} width={s} height={s} opacity={o.opacity} transform={transform} />;
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
          fontFamily="var(--font-stage)"
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

// Soft glow behind an object: a radial-gradient disc, far cheaper than a blur filter.
function drawHalo(o: FrameObject, p: string) {
  if (o.opacity < 0.02) return null;
  if (o.type === "arrow") {
    return (
      <line key={`halo${o.id}`} x1={o.x} y1={o.y} x2={o.x2 ?? o.x + 60} y2={o.y2 ?? o.y}
        stroke={o.stroke ?? o.fill ?? "#fff"} strokeWidth={(o.strokeWidth ?? 4) * 4} strokeLinecap="round" opacity={0.18 * o.opacity} />
    );
  }
  if (o.type === "text") return null;
  const r = radiusOf(o) * (o.glow ? 2.1 : 1.7);
  return <circle key={`halo${o.id}`} cx={o.x} cy={o.y} r={r} fill={`url(#${p}h-${o.id})`} opacity={o.opacity} />;
}

// Soft contact shadow under an object.
function drawShadow(o: FrameObject, p: string) {
  if (o.opacity < 0.02) return null;
  const r = radiusOf(o);
  return <ellipse key={`sh${o.id}`} cx={o.x + r * 0.12} cy={o.y + r * 0.95} rx={r * 0.95} ry={r * 0.24} fill={`url(#${p}shadow)`} opacity={o.opacity * 0.9} />;
}

function ring(o: FrameObject, colour: string) {
  let cx = o.x;
  let cy = o.y;
  if (o.type === "arrow") {
    cx = (o.x + (o.x2 ?? o.x + 60)) / 2;
    cy = (o.y + (o.y2 ?? o.y)) / 2;
  }
  return (
    <circle key={`ring-${o.id}`} className="miss-ring" cx={cx} cy={cy} r={radiusOf(o) + 12}
      fill="none" stroke={colour} strokeWidth={4} strokeDasharray="10 6" />
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

  const bg = scene.background ?? "";
  const glowAll = scene.glow ?? DARK_BACKDROPS.has(bg);
  const shadowsOn = LIGHT_BACKDROPS.has(bg);

  // Objects that move or orbit get trails. Depends only on the timeline.
  const movers = useMemo(() => {
    const ids = new Set<string>();
    for (const a of scene.timeline) if (a.action === "move" || a.action === "orbit") ids.add(a.target);
    return ids;
  }, [scene.timeline]);

  // Ghost copies at slightly earlier times form the motion trail.
  const trails: React.ReactNode[] = [];
  const trailIds = scene.objects.filter((o) => (o.trail ?? movers.has(o.id)) && o.type !== "text").map((o) => o.id);
  if (trailIds.length) {
    for (let k = TRAIL_STEPS; k >= 1; k--) {
      const t = time - k * TRAIL_GAP;
      if (t < 0) continue;
      const past = new Map(computeFrame(scene, t).map((o) => [o.id, o]));
      for (const id of trailIds) {
        const now = byId.get(id);
        const then = past.get(id);
        if (!now || !then || Math.hypot(now.x - then.x, now.y - then.y) < 1.5) continue;
        const fade = (1 - k / (TRAIL_STEPS + 1)) * 0.32;
        trails.push(drawObject({ ...then, opacity: then.opacity * fade, scale: then.scale * (1 - k * 0.05) }, p, true, `tr${k}-${id}`));
      }
    }
  }

  const halos = frame.filter((o) => o.glow || (glowAll && o.type !== "text")).map((o) => drawHalo(o, p));
  const shadows = frame.filter((o) => (o.shadow ?? (shadowsOn && SOLID.has(o.type))) && !o.follow).map((o) => drawShadow(o, p));

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
        {shadows}
        {trails}
        {halos}
        {frame.map((o) => drawObject(o, p))}
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
