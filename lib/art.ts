// Names of the hand-drawn illustration pieces (components/Art.tsx). Kept separate so the server
// (schema, prompt, scoring) can use the list without importing React components.

export const ART_NAMES = [
  "sun",
  "earth",
  "moon",
  "planet",
  "shadow-cone",
  "cloud",
  "rain-cloud",
  "mountain",
  "sea",
  "rocket",
  "flame",
  "smoke",
  "launch-pad",
  "drop",
  "vapor",
] as const;

export type ArtName = (typeof ART_NAMES)[number];

// Dominant colour of each piece, used for its glow halo.
export const ART_COLOURS: Record<ArtName, string> = {
  sun: "#FFB020",
  earth: "#2F86E8",
  moon: "#D9D9E6",
  planet: "#FF9A3C",
  "shadow-cone": "#000000",
  cloud: "#FFFFFF",
  "rain-cloud": "#7D8AA8",
  mountain: "#8B6B4E",
  sea: "#2BB6FF",
  rocket: "#E6EAF2",
  flame: "#FF9A1F",
  smoke: "#C9CCD6",
  "launch-pad": "#9BA1A6",
  drop: "#2B7BE0",
  vapor: "#FFFFFF",
};

export const isArtName = (n: string | undefined): n is ArtName => !!n && (ART_NAMES as readonly string[]).includes(n);
