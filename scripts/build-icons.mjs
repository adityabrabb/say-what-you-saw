// Extracts the whitelisted Fluent Emoji icons into public/icons/*.svg and writes lib/icons.ts.
// Run with: node scripts/build-icons.mjs   (needs the @iconify-json/fluent-emoji dev dependency)
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const set = require("@iconify-json/fluent-emoji/icons.json");

// key (what scenes and the LLM use) -> [Fluent Emoji icon name, group for partial-credit matching]
const WHITELIST = {
  // sky & space
  sun: ["sun", "sun"], "sun-with-face": ["sun-with-face", "sun"], moon: ["full-moon", "moon"], "crescent-moon": ["crescent-moon", "moon"],
  "new-moon": ["new-moon", "moon"], earth: ["globe-showing-americas", "planet"], planet: ["ringed-planet", "planet"], star: ["star", "star"],
  "glowing-star": ["glowing-star", "star"], "shooting-star": ["shooting-star", "star"], comet: ["comet", "star"], rocket: ["rocket", "spacecraft"],
  ufo: ["flying-saucer", "spacecraft"], satellite: ["satellite", "spacecraft"], telescope: ["telescope", "tool"], alien: ["alien", "creature"],
  cloud: ["cloud", "cloud"], "sun-behind-cloud": ["sun-behind-cloud", "cloud"], rain: ["cloud-with-rain", "cloud"], lightning: ["high-voltage", "weather"],
  "storm-cloud": ["cloud-with-lightning", "cloud"], snowflake: ["snowflake", "weather"], rainbow: ["rainbow", "weather"], tornado: ["tornado", "weather"],
  umbrella: ["umbrella", "tool"], fire: ["fire", "fire"],
  // nature
  tree: ["deciduous-tree", "tree"], "pine-tree": ["evergreen-tree", "tree"], "palm-tree": ["palm-tree", "tree"], cactus: ["cactus", "plant"],
  flower: ["hibiscus", "flower"], tulip: ["tulip", "flower"], rose: ["rose", "flower"], sunflower: ["sunflower", "flower"], "cherry-blossom": ["cherry-blossom", "flower"],
  leaf: ["leaf-fluttering-in-wind", "plant"], "maple-leaf": ["maple-leaf", "plant"], seedling: ["seedling", "plant"], mushroom: ["mushroom", "plant"],
  mountain: ["mountain", "land"], "snow-mountain": ["snow-capped-mountain", "land"], volcano: ["volcano", "land"], island: ["desert-island", "land"],
  water: ["water-wave", "water"], droplet: ["droplet", "water"], rock: ["rock", "land"], wood: ["wood", "land"],
  // animals
  dog: ["dog", "dog"], cat: ["cat", "cat"], mouse: ["mouse", "rodent"], rabbit: ["rabbit", "rodent"], fox: ["fox", "dog"], bear: ["bear", "bear"],
  panda: ["panda", "bear"], lion: ["lion", "cat"], tiger: ["tiger", "cat"], horse: ["horse", "horse"], unicorn: ["unicorn", "horse"], cow: ["cow", "farm"],
  pig: ["pig", "farm"], sheep: ["ewe", "farm"], chicken: ["chicken", "bird"], chick: ["baby-chick", "bird"], bird: ["bird", "bird"], eagle: ["eagle", "bird"],
  owl: ["owl", "bird"], penguin: ["penguin", "bird"], duck: ["duck", "bird"], parrot: ["parrot", "bird"], frog: ["frog", "frog"], turtle: ["turtle", "reptile"],
  snake: ["snake", "reptile"], dragon: ["dragon", "reptile"], dinosaur: ["t-rex", "reptile"], fish: ["fish", "fish"], "tropical-fish": ["tropical-fish", "fish"],
  shark: ["shark", "fish"], whale: ["spouting-whale", "whale"], dolphin: ["dolphin", "whale"], octopus: ["octopus", "sea"], crab: ["crab", "sea"],
  butterfly: ["butterfly", "bug"], bee: ["honeybee", "bug"], ladybug: ["lady-beetle", "bug"], snail: ["snail", "bug"], spider: ["spider", "bug"],
  monkey: ["monkey", "monkey"], elephant: ["elephant", "elephant"], giraffe: ["giraffe", "giraffe"], koala: ["koala", "bear"],
  // food
  apple: ["red-apple", "fruit"], "green-apple": ["green-apple", "fruit"], banana: ["banana", "fruit"], orange: ["tangerine", "fruit"], lemon: ["lemon", "fruit"],
  grapes: ["grapes", "fruit"], strawberry: ["strawberry", "fruit"], watermelon: ["watermelon", "fruit"], cherries: ["cherries", "fruit"], pineapple: ["pineapple", "fruit"],
  carrot: ["carrot", "vegetable"], corn: ["ear-of-corn", "vegetable"], pizza: ["pizza", "meal"], burger: ["hamburger", "meal"], cake: ["birthday-cake", "sweet"],
  donut: ["doughnut", "sweet"], "ice-cream": ["soft-ice-cream", "sweet"], cookie: ["cookie", "sweet"], coffee: ["hot-beverage", "drink"], egg: ["egg", "meal"],
  // places & transport
  house: ["house", "building"], castle: ["castle", "building"], office: ["office-building", "building"], school: ["school", "building"], tent: ["tent", "building"],
  car: ["automobile", "vehicle"], "race-car": ["racing-car", "vehicle"], bus: ["bus", "vehicle"], train: ["locomotive", "vehicle"], bicycle: ["bicycle", "vehicle"],
  airplane: ["airplane", "aircraft"], helicopter: ["helicopter", "aircraft"], boat: ["sailboat", "boat"], ship: ["ship", "boat"], anchor: ["anchor", "boat"],
  // objects
  lightbulb: ["light-bulb", "light"], battery: ["battery", "tech"], magnet: ["magnet", "tool"], gear: ["gear", "tool"], hammer: ["hammer", "tool"],
  key: ["key", "tool"], lock: ["locked", "tool"], bell: ["bell", "music"], gift: ["wrapped-gift", "party"], balloon: ["balloon", "party"],
  "party-popper": ["party-popper", "party"], trophy: ["trophy", "award"], medal: ["1st-place-medal", "award"], crown: ["crown", "award"], gem: ["gem-stone", "award"],
  money: ["money-bag", "money"], coin: ["coin", "money"], clock: ["alarm-clock", "time"], hourglass: ["hourglass-not-done", "time"], book: ["open-book", "book"],
  pencil: ["pencil", "tool"], laptop: ["laptop", "tech"], phone: ["mobile-phone", "tech"], camera: ["camera", "tech"], robot: ["robot", "creature"],
  ghost: ["ghost", "creature"], heart: ["red-heart", "heart"], "blue-heart": ["blue-heart", "heart"], "green-heart": ["green-heart", "heart"],
  "yellow-heart": ["yellow-heart", "heart"], "purple-heart": ["purple-heart", "heart"], music: ["musical-note", "music"], guitar: ["guitar", "music"],
  football: ["soccer-ball", "ball"], basketball: ["basketball", "ball"], tennis: ["tennis", "ball"], dice: ["game-die", "game"], "video-game": ["video-game", "game"],
  bomb: ["bomb", "danger"], magnifier: ["magnifying-glass-tilted-left", "tool"], atom: ["atom-symbol", "science"], dna: ["dna", "science"],
  microscope: ["microscope", "science"], "test-tube": ["test-tube", "science"], map: ["world-map", "book"], compass: ["compass", "tool"],
  // people & faces
  smile: ["grinning-face", "face"], laugh: ["face-with-tears-of-joy", "face"], cool: ["smiling-face-with-sunglasses", "face"], love: ["smiling-face-with-heart-eyes", "face"],
  sad: ["crying-face", "face"], angry: ["angry-face", "face"], surprised: ["astonished-face", "face"], thinking: ["thinking-face", "face"], sleeping: ["sleeping-face", "face"],
  "thumbs-up": ["thumbs-up", "hand"], wave: ["waving-hand", "hand"], eyes: ["eyes", "face"], brain: ["brain", "science"],
};

const out = "public/icons";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const entries = [];
const missing = [];
for (const [key, [name, group]] of Object.entries(WHITELIST)) {
  const icon = set.icons[name] ?? (set.aliases?.[name] && set.icons[set.aliases[name].parent]);
  if (!icon) {
    missing.push(`${key} -> ${name}`);
    continue;
  }
  const w = icon.width ?? set.width ?? 32;
  const h = icon.height ?? set.height ?? 32;
  writeFileSync(`${out}/${key}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${icon.body}</svg>`);
  entries.push([key, group]);
}

const ts = `// Generated by scripts/build-icons.mjs from Fluent Emoji (MIT, Microsoft) via Iconify. Do not edit by hand.
// Each key maps to a public/icons/<key>.svg file and a group used for partial credit in Recall scoring.

export const ICON_GROUPS: Record<string, string> = {
${entries.map(([k, g]) => `  ${JSON.stringify(k)}: ${JSON.stringify(g)},`).join("\n")}
};

export const ICON_NAMES = Object.keys(ICON_GROUPS);

export const iconUrl = (name: string) => \`/icons/\${name}.svg\`;
`;
writeFileSync("lib/icons.ts", ts);

console.log(`wrote ${entries.length} icons`);
if (missing.length) console.log("missing:\n  " + missing.join("\n  "));
