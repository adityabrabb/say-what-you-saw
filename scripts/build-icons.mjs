// Builds the neon icon sprite (public/icons/neon.svg) and lib/icons.ts from outline icon sets.
// Sources, in priority order: Tabler (t:), Lucide (l:), Game Icons (g:, drawn as stroked outlines).
// All MIT/CC-BY licensed via Iconify. Run: node scripts/build-icons.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SETS = {
  t: require("@iconify-json/tabler/icons.json"),
  l: require("@iconify-json/lucide/icons.json"),
  g: require("@iconify-json/game-icons/icons.json"),
};

// key -> [group, ...candidates]. A bare candidate tries Tabler then Lucide.
const WHITELIST = {
  // sky & space
  sun: ["sun", "sun"], "sun-with-face": ["sun", "t:sun-high"], moon: ["moon", "moon"], "crescent-moon": ["moon", "t:moon-2", "moon"],
  "new-moon": ["moon", "t:moon-stars"], earth: ["planet", "t:world", "earth"], planet: ["planet", "t:planet"], star: ["star", "star"],
  "glowing-star": ["star", "t:stars", "sparkles"], "shooting-star": ["star", "t:meteor"], comet: ["star", "t:comet"], rocket: ["spacecraft", "rocket"],
  ufo: ["spacecraft", "t:ufo", "g:ufo"], satellite: ["spacecraft", "satellite", "l:satellite"], telescope: ["tool", "telescope"], alien: ["creature", "t:alien", "g:alien-stare"],
  cloud: ["cloud", "cloud"], "sun-behind-cloud": ["cloud", "l:cloud-sun", "t:sun-wind"], rain: ["cloud", "t:cloud-rain", "l:cloud-rain"], lightning: ["weather", "t:bolt", "l:zap"],
  "storm-cloud": ["cloud", "t:cloud-storm", "l:cloud-lightning"], snowflake: ["weather", "snowflake"], rainbow: ["weather", "rainbow"], tornado: ["weather", "tornado", "g:tornado"],
  umbrella: ["tool", "umbrella"], fire: ["fire", "t:flame", "l:flame"],
  // nature
  tree: ["tree", "t:tree", "tree"], "pine-tree": ["tree", "l:tree-pine", "t:christmas-tree"], "palm-tree": ["tree", "l:tree-palm", "t:beach"], cactus: ["plant", "cactus"],
  flower: ["flower", "flower"], tulip: ["flower", "l:flower-2", "flower"], rose: ["flower", "t:rosette", "flower"], sunflower: ["flower", "g:sunflower"], "cherry-blossom": ["flower", "l:flower", "flower"],
  leaf: ["plant", "leaf"], "maple-leaf": ["plant", "t:leaf-2", "leaf"], seedling: ["plant", "seedling", "sprout", "t:plant"], mushroom: ["plant", "mushroom"],
  mountain: ["land", "mountain"], "snow-mountain": ["land", "l:mountain-snow", "mountain"], volcano: ["land", "g:volcano"], island: ["land", "g:island", "t:beach"],
  water: ["water", "l:waves", "t:ripple"], droplet: ["water", "droplet"], rock: ["land", "g:rock", "l:mountain"], wood: ["land", "t:wood", "g:wood-pile"],
  // animals
  dog: ["dog", "dog"], cat: ["cat", "cat"], mouse: ["rodent", "t:mouse", "l:rat", "g:mouse"], rabbit: ["rodent", "rabbit"], fox: ["dog", "g:fox-head"], bear: ["bear", "g:bear-head"],
  panda: ["bear", "l:panda", "g:bear-face"], lion: ["cat", "g:lion"], tiger: ["cat", "g:tiger-head"], horse: ["horse", "horse"], unicorn: ["horse", "g:unicorn"], cow: ["farm", "g:cow"],
  pig: ["farm", "pig", "t:pig"], sheep: ["farm", "g:sheep", "g:ram"], chicken: ["bird", "g:chicken"], chick: ["bird", "t:egg", "g:chicken"], bird: ["bird", "bird", "l:bird"], eagle: ["bird", "g:eagle-head"],
  owl: ["bird", "g:owl", "g:barn-owl"], penguin: ["bird", "g:penguin"], duck: ["bird", "g:duck"], parrot: ["bird", "g:parrot-head"], frog: ["frog", "g:frog"], turtle: ["reptile", "turtle", "l:turtle", "g:turtle"],
  snake: ["reptile", "g:snake", "g:cobra"], dragon: ["reptile", "g:dragon-head", "g:spiked-dragon-head"], dinosaur: ["reptile", "g:dinosaur-rex"], fish: ["fish", "fish"], "tropical-fish": ["fish", "l:fish", "fish"],
  shark: ["fish", "g:shark-fin", "g:shark-jaws"], whale: ["whale", "g:sperm-whale", "g:whale-tail"], dolphin: ["whale", "g:dolphin"], octopus: ["sea", "g:octopus"], crab: ["sea", "g:crab", "l:shrimp"],
  butterfly: ["bug", "butterfly"], bee: ["bug", "g:bee"], ladybug: ["bug", "g:ladybug", "bug"], snail: ["bug", "snail", "l:snail", "g:snail"], spider: ["bug", "spider", "g:spider-face"],
  monkey: ["monkey", "g:monkey"], elephant: ["elephant", "g:elephant"], giraffe: ["giraffe", "g:giraffe", "g:elephant-head"], koala: ["bear", "g:koala"],
  // food
  apple: ["fruit", "apple"], "green-apple": ["fruit", "apple"], banana: ["fruit", "banana", "l:banana"], orange: ["fruit", "l:citrus", "t:lemon"], lemon: ["fruit", "t:lemon-2", "lemon"],
  grapes: ["fruit", "l:grape", "t:grape"], strawberry: ["fruit", "g:strawberry"], watermelon: ["fruit", "g:watermelon", "t:melon"], cherries: ["fruit", "l:cherry", "t:cherry"], pineapple: ["fruit", "g:pineapple"],
  carrot: ["vegetable", "carrot"], corn: ["vegetable", "g:corn", "l:wheat"], pizza: ["meal", "pizza"], burger: ["meal", "burger", "t:burger"], cake: ["sweet", "cake", "t:cake"],
  donut: ["sweet", "l:donut", "t:circle-dot"], "ice-cream": ["sweet", "ice-cream", "t:ice-cream"], cookie: ["sweet", "cookie"], coffee: ["drink", "coffee"], egg: ["meal", "egg"],
  // places & transport
  house: ["building", "home", "house"], castle: ["building", "castle", "g:castle"], office: ["building", "building", "t:building-skyscraper"], school: ["building", "school"], tent: ["building", "tent"],
  car: ["vehicle", "car"], "race-car": ["vehicle", "t:car-suv", "t:car"], bus: ["vehicle", "bus"], train: ["vehicle", "train", "l:train-front"], bicycle: ["vehicle", "bike"],
  airplane: ["aircraft", "plane"], helicopter: ["aircraft", "helicopter", "g:helicopter"], boat: ["boat", "sailboat"], ship: ["boat", "ship"], anchor: ["boat", "anchor"],
  // objects
  lightbulb: ["light", "bulb", "lightbulb"], battery: ["tech", "battery"], magnet: ["tool", "magnet"], gear: ["tool", "settings", "cog"], hammer: ["tool", "hammer"],
  key: ["tool", "key"], lock: ["tool", "lock"], bell: ["music", "bell"], gift: ["party", "gift"], balloon: ["party", "balloon", "t:balloon"],
  "party-popper": ["party", "l:party-popper", "t:confetti"], trophy: ["award", "trophy"], medal: ["award", "medal"], crown: ["award", "crown"], gem: ["award", "diamond", "gem"],
  money: ["money", "t:cash", "l:banknote"], coin: ["money", "coin", "t:coin"], clock: ["time", "alarm", "clock"], hourglass: ["time", "hourglass"], book: ["book", "book"],
  pencil: ["tool", "pencil"], laptop: ["tech", "laptop", "device-laptop"], phone: ["tech", "t:device-mobile", "smartphone"], camera: ["tech", "camera"], robot: ["creature", "robot", "l:bot"],
  ghost: ["creature", "ghost"], heart: ["heart", "heart"], "blue-heart": ["heart", "heart"], "green-heart": ["heart", "heart"],
  "yellow-heart": ["heart", "heart"], "purple-heart": ["heart", "heart"], music: ["music", "music"], guitar: ["music", "guitar", "t:guitar-pick"],
  football: ["ball", "t:ball-football"], basketball: ["ball", "t:ball-basketball"], tennis: ["ball", "t:ball-tennis"], dice: ["game", "dice", "dice-5"], "video-game": ["game", "t:device-gamepad-2", "l:gamepad-2"],
  bomb: ["danger", "bomb"], magnifier: ["tool", "search"], atom: ["science", "atom"], dna: ["science", "dna"],
  microscope: ["science", "microscope"], "test-tube": ["science", "test-pipe", "test-tube"], map: ["book", "map"], compass: ["tool", "compass"],
  // people & faces
  smile: ["face", "mood-happy", "smile"], laugh: ["face", "mood-crazy-happy", "laugh"], cool: ["face", "mood-cool", "t:sunglasses"], love: ["face", "mood-heart", "heart"],
  sad: ["face", "mood-sad", "frown"], angry: ["face", "mood-angry", "angry"], surprised: ["face", "mood-surprised", "l:annoyed"], thinking: ["face", "mood-confuzed", "t:mood-confused"], sleeping: ["face", "zzz", "t:zzz"],
  "thumbs-up": ["hand", "thumb-up", "thumbs-up"], wave: ["hand", "hand-stop", "hand"], eyes: ["face", "eye"], brain: ["science", "brain"],
};

// Neon palette per group, with a few per-icon overrides.
const GROUP_COLOURS = {
  sun: "#FFE600", star: "#FFE600", moon: "#DCD6FF", planet: "#FF9A3C", spacecraft: "#00F0FF", creature: "#39FF14", cloud: "#9FF4FF",
  weather: "#00F0FF", fire: "#FF7A1A", tree: "#39FF14", plant: "#7CFF4F", flower: "#FF2BD6", land: "#C08BFF", water: "#2BB6FF",
  dog: "#FFB347", cat: "#FF2BD6", rodent: "#F5A6FF", bear: "#E0A96D", horse: "#B388FF", farm: "#FFD6A5", bird: "#00F0FF", frog: "#39FF14",
  reptile: "#7CFF4F", fish: "#2BB6FF", whale: "#4D9BFF", sea: "#FF6B9A", bug: "#FFE600", monkey: "#E0A96D", elephant: "#B0B8D0",
  giraffe: "#FFC14D", fruit: "#FF3355", vegetable: "#FF9A3C", meal: "#FFB347", sweet: "#FF7AD9", drink: "#E0A96D", building: "#00F0FF",
  vehicle: "#FF3355", aircraft: "#00F0FF", boat: "#F2F4F8", light: "#FFE600", tech: "#00F0FF", tool: "#C0C8D8", music: "#FF2BD6",
  party: "#FF2BD6", award: "#FFE600", money: "#39FF14", time: "#F2F4F8", book: "#C08BFF", heart: "#FF3355", ball: "#FF9A3C",
  game: "#B388FF", danger: "#FF3355", science: "#00F0FF", face: "#FFE600", hand: "#FFD6A5",
};
const OVERRIDES = {
  earth: "#2BB6FF", "blue-heart": "#2BB6FF", "green-heart": "#39FF14", "yellow-heart": "#FFE600", "purple-heart": "#B388FF",
  "green-apple": "#39FF14", orange: "#FF9A3C", lemon: "#FFE600", banana: "#FFE600", snowflake: "#E6FBFF", lightning: "#FFE600",
  rainbow: "#FF2BD6", "snow-mountain": "#E6FBFF", cactus: "#39FF14", carrot: "#FF9A3C", corn: "#FFE600", "race-car": "#FF2BD6",
  bus: "#FFE600", train: "#C08BFF", tiger: "#FF9A3C", lion: "#FFC14D", fox: "#FF7A1A", penguin: "#E6FBFF", ghost: "#E6FBFF",
};

function lookup(candidate) {
  const [prefix, name] = candidate.includes(":") ? candidate.split(":") : [null, candidate];
  for (const p of prefix ? [prefix] : ["t", "l"]) {
    const set = SETS[p];
    const icon = set.icons[name] ?? (set.aliases?.[name] && set.icons[set.aliases[name].parent]);
    if (icon) return { set: p, name, icon, size: icon.width ?? set.width ?? 24 };
  }
  return null;
}

// Turn an icon body into neon-ready markup: stroke-only, with width driven by --sw from the <use>.
function neonBody({ set, icon, size }) {
  if (set === "g") {
    // Filled silhouette -> stroked outline. Game Icons are on a 512 grid.
    const scale = (size / 24) * 0.62;
    const body = icon.body.replace(/fill="currentColor"/g, 'fill="none"');
    return `<g fill="none" stroke="currentColor" stroke-linejoin="round" style="stroke-width:calc(var(--sw,2) * ${scale.toFixed(2)})">${body}</g>`;
  }
  const body = icon.body.replace(/\s?stroke-width="[\d.]+"/g, "");
  return `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="stroke-width:var(--sw,2)">${body}</g>`;
}

rmSync("public/icons", { recursive: true, force: true });
mkdirSync("public/icons", { recursive: true });

const symbols = [];
const groups = {};
const colours = {};
const sources = {};
const missing = [];
for (const [key, [group, ...candidates]] of Object.entries(WHITELIST)) {
  const found = candidates.map(lookup).find(Boolean);
  if (!found) {
    missing.push(`${key}: ${candidates.join(", ")}`);
    continue;
  }
  symbols.push(`<symbol id="${key}" viewBox="0 0 ${found.size} ${found.icon.height ?? found.size}">${neonBody(found)}</symbol>`);
  groups[key] = group;
  colours[key] = OVERRIDES[key] ?? GROUP_COLOURS[group] ?? "#00F0FF";
  sources[found.set] = (sources[found.set] ?? 0) + 1;
}

writeFileSync("public/icons/neon.svg", `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>`);

const ts = `// Generated by scripts/build-icons.mjs from Tabler, Lucide and Game Icons via Iconify. Do not edit by hand.
// Each key is a <symbol> in public/icons/neon.svg, drawn as glowing neon strokes.

export const ICON_GROUPS: Record<string, string> = ${JSON.stringify(groups, null, 2)};

// Default neon colour per icon (a scene can override it with "fill").
export const ICON_COLOURS: Record<string, string> = ${JSON.stringify(colours, null, 2)};

export const ICON_NAMES = Object.keys(ICON_GROUPS);

export const ICON_SPRITE = "/icons/neon.svg";
export const iconHref = (name: string) => \`\${ICON_SPRITE}#\${name}\`;
`;
writeFileSync("lib/icons.ts", ts);

console.log(`built ${symbols.length} icons`, sources);
if (missing.length) console.log("missing:\n  " + missing.join("\n  "));
