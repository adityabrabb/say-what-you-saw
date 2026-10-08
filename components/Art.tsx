import { memo } from "react";
import type { ArtName } from "@/lib/art";

// Hand-drawn illustration pieces. Each is drawn in a 100x100 box centred on (0,0) and scaled
// by the renderer. Gradients give them depth; small details (corona, flicker, smoke, rain,
// spinning continents) are pure CSS animations so they cost nothing per frame.

type P = { p: string }; // unique id prefix for this instance's gradients

const Sun = ({ p }: P) => (
  <g>
    <defs>
      <radialGradient id={`${p}core`} cx="0.4" cy="0.38" r="0.65">
        <stop offset="0" stopColor="#FFFDF0" />
        <stop offset="0.35" stopColor="#FFE36B" />
        <stop offset="0.8" stopColor="#FFB020" />
        <stop offset="1" stopColor="#FF7A00" />
      </radialGradient>
      <radialGradient id={`${p}corona`}>
        <stop offset="0.45" stopColor="#FFD24A" stopOpacity="0.55" />
        <stop offset="1" stopColor="#FF9A1F" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle r={50} fill={`url(#${p}corona)`} className="art-pulse" />
    <g className="art-spin">
      {Array.from({ length: 12 }, (_, i) => (
        <polygon key={i} points="-3,-34 3,-34 0,-46" fill="#FFC93C" opacity={0.85} transform={`rotate(${i * 30})`} />
      ))}
    </g>
    <circle r={31} fill={`url(#${p}core)`} />
    <circle cx={-9} cy={7} r={4} fill="#FF9A1F" opacity={0.3} />
    <circle cx={10} cy={-3} r={2.6} fill="#FF9A1F" opacity={0.3} />
    <circle cx={4} cy={14} r={3} fill="#FF9A1F" opacity={0.25} />
    <ellipse cx={-10} cy={-13} rx={10} ry={6} fill="#FFFFFF" opacity={0.35} />
  </g>
);

// Continents drawn twice side by side so they can scroll round the globe seamlessly.
const CONTINENTS = (
  <>
    <path d="M-30,-14 C-24,-24 -12,-22 -10,-14 C-8,-6 -16,-4 -14,4 C-12,12 -20,16 -26,8 C-32,0 -34,-6 -30,-14Z" />
    <path d="M-2,-26 C6,-30 16,-24 14,-16 C12,-10 4,-12 2,-6 C0,0 -6,-4 -6,-12 C-6,-18 -6,-22 -2,-26Z" />
    <path d="M4,4 C12,0 22,4 20,14 C18,22 10,28 4,22 C0,16 -2,8 4,4Z" />
    <path d="M24,-20 C30,-22 34,-16 30,-12 C26,-8 22,-14 24,-20Z" />
  </>
);

const Earth = ({ p }: P) => (
  <g>
    <defs>
      <radialGradient id={`${p}ocean`} cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#8FD3FF" />
        <stop offset="0.5" stopColor="#2F86E8" />
        <stop offset="1" stopColor="#0B2C78" />
      </radialGradient>
      <radialGradient id={`${p}atmo`}>
        <stop offset="0.72" stopColor="#6EC8FF" stopOpacity="0" />
        <stop offset="0.8" stopColor="#6EC8FF" stopOpacity="0.55" />
        <stop offset="1" stopColor="#6EC8FF" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${p}night`} x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0.45" stopColor="#03061E" stopOpacity="0" />
        <stop offset="1" stopColor="#03061E" stopOpacity="0.7" />
      </linearGradient>
      <clipPath id={`${p}clip`}>
        <circle r={34} />
      </clipPath>
    </defs>
    <circle r={47} fill={`url(#${p}atmo)`} />
    <circle r={34} fill={`url(#${p}ocean)`} />
    <g clipPath={`url(#${p}clip)`}>
      <g className="art-earth-spin" fill="#3FBF6A" stroke="#2E9152" strokeWidth={1}>
        <g>{CONTINENTS}</g>
        <g transform="translate(68 0)">{CONTINENTS}</g>
      </g>
      <path d="M-30,-22 q10,-4 20,0 M-4,10 q12,-5 24,0 M-20,22 q8,-3 16,0" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.6} />
    </g>
    <circle r={34} fill={`url(#${p}night)`} />
    <circle r={34} fill="none" stroke="#B4E6FF" strokeWidth={1.2} opacity={0.6} />
  </g>
);

const Moon = ({ p }: P) => (
  <g>
    <defs>
      <radialGradient id={`${p}m`} cx="0.38" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.5" stopColor="#D9D9E6" />
        <stop offset="1" stopColor="#7E7E96" />
      </radialGradient>
      <linearGradient id={`${p}shade`} x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0.5" stopColor="#0A0820" stopOpacity="0" />
        <stop offset="1" stopColor="#0A0820" stopOpacity="0.55" />
      </linearGradient>
    </defs>
    <circle r={30} fill={`url(#${p}m)`} />
    {[
      [-10, -8, 6],
      [8, 6, 8],
      [-4, 14, 4],
      [12, -12, 3.5],
      [-16, 6, 3],
    ].map(([x, y, r], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r={r} fill="#A3A3BA" />
        <circle cx={x - r * 0.25} cy={y - r * 0.25} r={r * 0.7} fill="#B9B9CC" />
      </g>
    ))}
    <circle r={30} fill={`url(#${p}shade)`} />
  </g>
);

const Planet = ({ p }: P) => (
  <g transform="rotate(-18)">
    <defs>
      <linearGradient id={`${p}bands`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFE0A8" />
        <stop offset="0.25" stopColor="#FF9A3C" />
        <stop offset="0.4" stopColor="#FFD08A" />
        <stop offset="0.6" stopColor="#E26A2C" />
        <stop offset="0.8" stopColor="#FFC27A" />
        <stop offset="1" stopColor="#B4471E" />
      </linearGradient>
      <linearGradient id={`${p}ring`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#C08BFF" stopOpacity="0.3" />
        <stop offset="0.5" stopColor="#F2E6FF" />
        <stop offset="1" stopColor="#C08BFF" stopOpacity="0.3" />
      </linearGradient>
      <radialGradient id={`${p}shade`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0.5" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#1A0630" stopOpacity="0.6" />
      </radialGradient>
    </defs>
    <path d="M-48,0 A48,12 0 0 1 48,0" fill="none" stroke={`url(#${p}ring)`} strokeWidth={5} />
    <circle r={26} fill={`url(#${p}bands)`} />
    <circle r={26} fill={`url(#${p}shade)`} />
    <path d="M-48,0 A48,12 0 0 0 48,0" fill="none" stroke={`url(#${p}ring)`} strokeWidth={5} />
  </g>
);

const ShadowCone = ({ p }: P) => (
  <g>
    <defs>
      <linearGradient id={`${p}umbra`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.65" />
        <stop offset="1" stopColor="#000" stopOpacity="0.35" />
      </linearGradient>
    </defs>
    <polygon points="-50,-34 50,-44 50,44 -50,34" fill="#000" opacity={0.16} />
    <polygon points="-50,-32 50,-8 50,8 -50,32" fill={`url(#${p}umbra)`} />
    <path d="M-50,-32 L50,-8 M-50,32 L50,8" stroke="#FF8589" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.6} />
  </g>
);

const puffs = (
  <>
    <ellipse cx={0} cy={12} rx={46} ry={14} />
    <circle cx={-24} cy={2} r={18} />
    <circle cx={-2} cy={-8} r={24} />
    <circle cx={22} cy={0} r={18} />
    <circle cx={36} cy={8} r={11} />
  </>
);

const Cloud = ({ p }: P) => (
  <g className="art-bob">
    <defs>
      <linearGradient id={`${p}c`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.2" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#C9DCF7" />
      </linearGradient>
    </defs>
    <g fill="#9FB6DA" opacity={0.5} transform="translate(3 4)">{puffs}</g>
    <g fill={`url(#${p}c)`}>{puffs}</g>
    <ellipse cx={-6} cy={-16} rx={12} ry={5} fill="#FFFFFF" opacity={0.8} />
  </g>
);

const RainCloud = ({ p }: P) => (
  <g>
    <defs>
      <linearGradient id={`${p}c`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#B7C1D8" />
        <stop offset="1" stopColor="#56617E" />
      </linearGradient>
      <clipPath id={`${p}rain`}>
        <rect x={-40} y={20} width={80} height={32} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${p}rain)`} stroke="#7FD4FF" strokeWidth={2.2} strokeLinecap="round">
      {[-30, -16, -2, 12, 26].map((x, i) => (
        <line key={i} x1={x} y1={14} x2={x - 3} y2={24} className="art-rain" style={{ animationDelay: `${-i * 0.17}s` }} />
      ))}
    </g>
    <g className="art-bob" transform="translate(0 -12)">
      <g fill={`url(#${p}c)`}>{puffs}</g>
    </g>
  </g>
);

const Mountain = ({ p }: P) => (
  <g>
    <defs>
      <linearGradient id={`${p}rock`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#A9845F" />
        <stop offset="1" stopColor="#3F2D20" />
      </linearGradient>
      <linearGradient id={`${p}snow`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0.3" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#B8D6F2" />
      </linearGradient>
    </defs>
    <polygon points="-50,42 -14,-18 22,42" fill="#5B4A7A" />
    <polygon points="-24,-6 -14,-18 -4,-4 -10,-1 -16,-6" fill="#E6EEFF" opacity={0.85} />
    <polygon points="-22,42 16,-40 52,42" fill={`url(#${p}rock)`} />
    <polygon points="16,-40 4,-14 10,-17 16,-10 23,-18 28,-14" fill={`url(#${p}snow)`} />
    <polygon points="16,-40 28,-14 52,42 30,42" fill="#000" opacity={0.18} />
    {[-40, -30, 30, 40].map((x, i) => (
      <polygon key={i} points={`${x},42 ${x - 5},42 ${x},28 ${x + 5},42`} fill="#2E9152" />
    ))}
  </g>
);

const Sea = ({ p }: P) => (
  <g>
    <defs>
      <linearGradient id={`${p}water`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2BB6FF" />
        <stop offset="1" stopColor="#0B3D78" />
      </linearGradient>
      <clipPath id={`${p}clip`}>
        <rect x={-50} y={-20} width={100} height={70} rx={6} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${p}clip)`}>
      <rect x={-50} y={-20} width={100} height={70} fill={`url(#${p}water)`} />
      <path className="art-wave" d="M-90,-12 q10,-6 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 V50 H-90Z" fill="#7FD4FF" opacity={0.4} />
      <path className="art-wave slow" d="M-90,4 q12,-6 24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 V50 H-90Z" fill="#1B8FD1" opacity={0.55} />
      <path d="M-40,20 h14 M-6,28 h18 M24,18 h12" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
    </g>
  </g>
);

const Rocket = ({ p }: P) => (
  <g>
    <defs>
      <linearGradient id={`${p}body`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7C86A0" />
        <stop offset="0.4" stopColor="#FFFFFF" />
        <stop offset="0.7" stopColor="#D3D9E7" />
        <stop offset="1" stopColor="#5E6882" />
      </linearGradient>
      <linearGradient id={`${p}red`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#B3122E" />
        <stop offset="0.45" stopColor="#FF5A6E" />
        <stop offset="1" stopColor="#8E0E25" />
      </linearGradient>
      <radialGradient id={`${p}glass`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#E6FBFF" />
        <stop offset="0.5" stopColor="#6EC8FF" />
        <stop offset="1" stopColor="#1B4FA8" />
      </radialGradient>
    </defs>
    <path d="M-14,14 L-27,36 L-14,31Z" fill={`url(#${p}red)`} />
    <path d="M14,14 L27,36 L14,31Z" fill={`url(#${p}red)`} />
    <path d="M0,-48 C12,-36 14,-16 14,10 L14,32 L-14,32 L-14,10 C-14,-16 -12,-36 0,-48Z" fill={`url(#${p}body)`} />
    <path d="M0,-48 C8,-40 11.5,-31 12.6,-24 L-12.6,-24 C-11.5,-31 -8,-40 0,-48Z" fill={`url(#${p}red)`} />
    <rect x={-14} y={16} width={28} height={4} fill={`url(#${p}red)`} />
    <circle cy={-7} r={7.5} fill={`url(#${p}glass)`} stroke="#3A4560" strokeWidth={2.4} />
    <circle cx={-2.5} cy={-9.5} r={2} fill="#FFFFFF" opacity={0.85} />
    <path d="M-1,26 L-1,32 L1,32 L1,26Z" fill="#7C86A0" />
    <rect x={-9} y={32} width={18} height={6} rx={1.5} fill="#3A4256" />
  </g>
);

// Flame points down: its top edge (y = -50) sits under a rocket nozzle.
const Flame = ({ p }: P) => (
  <g className="art-flicker">
    <defs>
      <linearGradient id={`${p}outer`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFB020" />
        <stop offset="0.6" stopColor="#FF3355" />
        <stop offset="1" stopColor="#FF3355" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${p}mid`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF6B0" />
        <stop offset="1" stopColor="#FFB020" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M-18,-50 C-22,-6 -6,24 0,50 C6,24 22,-6 18,-50Z" fill={`url(#${p}outer)`} />
    <path d="M-11,-50 C-12,-16 -4,8 0,26 C4,8 12,-16 11,-50Z" fill={`url(#${p}mid)`} />
    <path d="M-5,-50 C-5,-30 -2,-18 0,-8 C2,-18 5,-30 5,-50Z" fill="#FFFFFF" opacity={0.9} />
  </g>
);

const Smoke = ({ p }: P) => (
  <g>
    <defs>
      <radialGradient id={`${p}puff`} cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#B9BCC8" />
      </radialGradient>
    </defs>
    {[
      [-26, 18, 18],
      [0, 22, 22],
      [26, 18, 18],
      [-12, 2, 16],
      [14, 0, 17],
      [0, -14, 14],
    ].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill={`url(#${p}puff)`} className="art-puff" style={{ animationDelay: `${-i * 0.45}s` }} />
    ))}
  </g>
);

const LaunchPad = ({ p }: P) => (
  <g>
    <defs>
      <linearGradient id={`${p}steel`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5E6882" />
        <stop offset="0.5" stopColor="#C0C8D8" />
        <stop offset="1" stopColor="#4A5266" />
      </linearGradient>
    </defs>
    <rect x={22} y={-50} width={12} height={92} fill={`url(#${p}steel)`} />
    <path d="M22,-44 L34,-32 L22,-20 L34,-8 L22,4 L34,16 L22,28 L34,40" stroke="#3A4256" strokeWidth={1.4} fill="none" />
    <rect x={4} y={-30} width={18} height={4} fill="#9BA1A6" />
    <rect x={-50} y={40} width={100} height={10} rx={2} fill={`url(#${p}steel)`} />
    <rect x={-50} y={40} width={100} height={2} fill="#FFE600" opacity={0.8} />
    <circle cx={28} cy={-52} r={2.4} fill="#FF3355" className="art-blink" />
  </g>
);

const Drop = ({ p }: P) => (
  <g>
    <defs>
      <radialGradient id={`${p}d`} cx="0.38" cy="0.6" r="0.7">
        <stop offset="0" stopColor="#E6FBFF" />
        <stop offset="0.5" stopColor="#6EC8FF" />
        <stop offset="1" stopColor="#1B4FA8" />
      </radialGradient>
    </defs>
    <path d="M0,-46 C14,-22 30,-2 30,16 C30,34 16,46 0,46 C-16,46 -30,34 -30,16 C-30,-2 -14,-22 0,-46Z" fill={`url(#${p}d)`} />
    <ellipse cx={-10} cy={14} rx={5} ry={10} fill="#FFFFFF" opacity={0.6} />
  </g>
);

const Vapor = ({ p: _p }: P) => (
  <g fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.75}>
    {[-20, 0, 20].map((x, i) => (
      <path key={i} d={`M${x},40 q-8,-12 0,-24 t0,-24 t0,-24`} className="art-rise" style={{ animationDelay: `${-i * 0.6}s` }} />
    ))}
  </g>
);

const PIECES: Record<ArtName, (props: P) => React.ReactElement> = {
  sun: Sun,
  earth: Earth,
  moon: Moon,
  planet: Planet,
  "shadow-cone": ShadowCone,
  cloud: Cloud,
  "rain-cloud": RainCloud,
  mountain: Mountain,
  sea: Sea,
  rocket: Rocket,
  flame: Flame,
  smoke: Smoke,
  "launch-pad": LaunchPad,
  drop: Drop,
  vapor: Vapor,
};

// Memoised so a moving piece only updates its outer transform, never its artwork.
export const ArtPiece = memo(function ArtPiece({ name, p }: { name: ArtName; p: string }) {
  const Piece = PIECES[name];
  return <Piece p={p} />;
});
