import { ICON_GROUPS, ICON_NAMES } from "./icons";
import { isArtName } from "./art";
import type { Scene, SceneObject } from "./scene";

// Snap whatever icon name the model invents to the closest whitelisted icon,
// so "puppy" becomes "dog" and "space-shuttle" becomes "rocket" instead of failing validation.

export const SYNONYMS: Record<string, string> = {
  puppy: "dog", doggy: "dog", hound: "dog", retriever: "dog", labrador: "dog", poodle: "dog", "rain-cloud": "rain", pinetree: "pine-tree", "christmas-tree": "pine-tree", wolf: "fox", kitten: "cat", kitty: "cat", tabby: "cat",
  bunny: "rabbit", hare: "rabbit", rat: "mouse", hamster: "mouse", pony: "horse", bull: "cow", calf: "cow",
  lamb: "sheep", hen: "chicken", rooster: "chicken", seagull: "bird", gull: "bird", sparrow: "bird", pigeon: "bird",
  crow: "bird", hawk: "eagle", lizard: "snake", croc: "dinosaur", crocodile: "dinosaur", trex: "dinosaur",
  goldfish: "fish", salmon: "fish", orca: "whale", jellyfish: "octopus", squid: "octopus", lobster: "crab",
  insect: "bee", bug: "ladybug", ant: "ladybug", worm: "snail", ape: "monkey", gorilla: "monkey",
  globe: "earth", world: "earth", planet: "planet", saturn: "planet", jupiter: "planet", mars: "planet",
  sunshine: "sun", sunny: "sun", lunar: "moon", "half-moon": "crescent-moon", starlight: "star", stars: "star",
  meteor: "comet", asteroid: "rock", shuttle: "rocket", spaceship: "rocket", "space-shuttle": "rocket", spacecraft: "rocket",
  "flying-saucer": "ufo", martian: "alien", astronaut: "rocket",
  storm: "storm-cloud", thunder: "lightning", "lightning-bolt": "lightning", bolt: "lightning", rainy: "rain", raincloud: "rain",
  snow: "snowflake", ice: "snowflake", flame: "fire", fireball: "fire", heat: "fire", wind: "tornado",
  sea: "water", ocean: "water", wave: "water", waves: "water", river: "water", lake: "water", drop: "droplet", raindrop: "droplet",
  hill: "mountain", hills: "mountain", peak: "mountain", stone: "rock", log: "wood", forest: "pine-tree", plant: "seedling",
  sprout: "seedling", grass: "seedling", bush: "tree", oak: "tree", palm: "palm-tree", daisy: "flower", blossom: "cherry-blossom",
  automobile: "car", taxi: "car", truck: "bus", van: "bus", lorry: "bus", locomotive: "train", bike: "bicycle", plane: "airplane",
  jet: "airplane", aeroplane: "airplane", chopper: "helicopter", sailboat: "boat", yacht: "boat", canoe: "boat", ferry: "ship",
  submarine: "ship", home: "house", city: "office", skyline: "office", downtown: "office", town: "house", village: "house", cottage: "house", cabin: "house", building: "office", skyscraper: "office", tower: "office", palace: "castle", hut: "tent",
  bulb: "lightbulb", "light-bulb": "lightbulb", idea: "lightbulb", lamp: "lightbulb", cog: "gear", wrench: "gear", tool: "hammer",
  padlock: "lock", present: "gift", prize: "trophy", cup: "trophy", diamond: "gem", jewel: "gem", cash: "money", dollar: "money",
  timer: "clock", watch: "clock", sandglass: "hourglass", books: "book", pen: "pencil", computer: "laptop", pc: "laptop",
  smartphone: "phone", mobile: "phone", photo: "camera", bot: "robot", spirit: "ghost", love: "heart", note: "music",
  song: "music", soccer: "football", ball: "football", die: "dice", controller: "video-game", gamepad: "video-game",
  explosion: "bomb", search: "magnifier", magnifying: "magnifier", science: "atom", molecule: "atom", gene: "dna",
  happy: "smile", joy: "laugh", crying: "sad", mad: "angry", shocked: "surprised", sleep: "sleeping", hand: "wave",
  "thumbs": "thumbs-up", eye: "eyes", mind: "brain", hamburger: "burger", fries: "burger", pie: "cake", sweet: "donut",
  candy: "cookie", tea: "coffee", drink: "coffee", juice: "orange", tangerine: "orange", fruit: "apple", veggie: "carrot",
  vegetable: "carrot", hive: "bee", honey: "bee", nectar: "flower",
};

const normalise = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/^(a|an|the)-/, "")
    .replace(/-(icon|emoji|face)$/, "");

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function closestIcon(raw: string | undefined): string {
  if (!raw) return "star";
  const name = normalise(raw);
  if (name in ICON_GROUPS) return name;
  if (SYNONYMS[name]) return SYNONYMS[name];
  const singular = name.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
  if (singular in ICON_GROUPS) return singular;
  if (SYNONYMS[singular]) return SYNONYMS[singular];
  // A listed name hiding inside a compound ("red-sports-car" -> "car"), longest first.
  const parts = name.split("-");
  for (const part of parts) if (SYNONYMS[part]) return SYNONYMS[part];
  const inside = ICON_NAMES.filter((n) => name.includes(n) || parts.includes(n)).sort((a, b) => b.length - a.length);
  if (inside.length) return inside[0];
  // Otherwise the nearest spelling.
  let best = ICON_NAMES[0];
  let bestD = Infinity;
  for (const n of ICON_NAMES) {
    const d = editDistance(name, n);
    if (d < bestD) [best, bestD] = [n, d];
  }
  return best;
}

// Replace unknown icon names in place on a copy; returns the scene and what was swapped.
export function snapIcons(scene: Scene): { scene: Scene; swaps: string[] } {
  const swaps: string[] = [];
  const objects = scene.objects.map((o): SceneObject => {
    if (o.type === "art" && !isArtName(o.art)) {
      const icon = closestIcon(o.art);
      swaps.push(`art ${o.art} -> icon ${icon}`);
      return { ...o, type: "icon", icon, art: undefined };
    }
    if (o.type !== "icon" || (o.icon && o.icon in ICON_GROUPS)) return o;
    const icon = closestIcon(o.icon);
    swaps.push(`${o.icon} -> ${icon}`);
    return { ...o, icon };
  });
  return { scene: swaps.length ? { ...scene, objects } : scene, swaps };
}
