import { computeFrame, type FrameObject } from "@/lib/engine";
import { STAGE_H, STAGE_W, type Scene } from "@/lib/scene";

// Deterministic starfield so server and client render identically.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return { x: r(1) * STAGE_W, y: r(2) * STAGE_H, r: 0.4 + r(3) * 1.1, o: 0.25 + r(4) * 0.6 };
});

function renderObject(o: FrameObject) {
  const common = {
    opacity: o.opacity,
    stroke: o.stroke,
    strokeWidth: o.strokeWidth ?? (o.stroke ? 2 : undefined),
    strokeDasharray: o.dashed ? "4 6" : undefined,
  };
  // Scale around the object's own centre.
  const transform = o.scale !== 1 ? `translate(${o.x} ${o.y}) scale(${o.scale}) translate(${-o.x} ${-o.y})` : undefined;

  switch (o.type) {
    case "circle":
      return (
        <circle
          key={o.id}
          cx={o.x}
          cy={o.y}
          r={o.r ?? 20}
          fill={o.glow ? `url(#glow-${o.id})` : o.fill ?? "#ccc"}
          filter={o.glow ? "url(#soft-glow)" : undefined}
          transform={transform}
          {...common}
        />
      );
    case "rect": {
      const w = o.w ?? 60;
      const h = o.h ?? 40;
      return <rect key={o.id} x={o.x - w / 2} y={o.y - h / 2} width={w} height={h} rx={6} fill={o.fill ?? "#ccc"} transform={transform} {...common} />;
    }
    case "star": {
      // Five-pointed star, outer radius r, pointing up.
      const r = o.r ?? 24;
      const points = Array.from({ length: 10 }, (_, i) => {
        const rad = i % 2 === 0 ? r : r * 0.42;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${(o.x + rad * Math.cos(a)).toFixed(2)},${(o.y + rad * Math.sin(a)).toFixed(2)}`;
      }).join(" ");
      return <polygon key={o.id} points={points} fill={o.fill ?? "#ccc"} strokeLinejoin="round" transform={transform} {...common} />;
    }
    case "text":
      return (
        <text
          key={o.id}
          x={o.x}
          y={o.y}
          fill={o.fill ?? "#fff"}
          fontSize={o.fontSize ?? 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="var(--font-stage)"
          fontWeight={600}
          transform={transform}
          opacity={o.opacity}
        >
          {o.text}
        </text>
      );
    case "arrow":
      return (
        <line
          key={o.id}
          x1={o.x}
          y1={o.y}
          x2={o.x2 ?? o.x + 60}
          y2={o.y2 ?? o.y}
          markerEnd="url(#arrowhead)"
          {...common}
          stroke={o.stroke ?? o.fill ?? "#fff"}
          strokeWidth={o.strokeWidth ?? 3}
        />
      );
    case "image": {
      const w = o.w ?? 80;
      const h = o.h ?? 80;
      return <image key={o.id} href={o.href} x={o.x - w / 2} y={o.y - h / 2} width={w} height={h} opacity={o.opacity} transform={transform} />;
    }
  }
}

export default function SceneRenderer({ scene, time }: { scene: Scene; time: number }) {
  const frame = computeFrame(scene, time);
  const glowing = scene.objects.filter((o) => o.glow);

  return (
    <svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} className="stage" role="img" aria-label={scene.title}>
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
        <filter id="soft-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {glowing.map((o) => (
          <radialGradient key={o.id} id={`glow-${o.id}`}>
            <stop offset="0%" stopColor="#FFF6D5" />
            <stop offset="55%" stopColor={o.fill ?? "#FDB813"} />
            <stop offset="100%" stopColor="#F28C28" />
          </radialGradient>
        ))}
      </defs>
      <rect width={STAGE_W} height={STAGE_H} fill={scene.background ?? "#0f172a"} />
      {scene.stars && STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
      {frame.map(renderObject)}
    </svg>
  );
}
