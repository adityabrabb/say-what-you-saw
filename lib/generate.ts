import "server-only";
import { ProviderSession, type Message } from "./providers";
import { buildOfflineScene, guessBackdrop } from "./offline";
import { BACKGROUNDS } from "./scene";
import { z } from "zod";
import { ART_NAMES } from "./art";
import { ICON_NAMES } from "./icons";
import { snapIcons } from "./iconMatch";
import { SHOWCASES } from "./showcases";
import { checkScene, clampToStage, scenesResponse } from "./schema";
import type { Scene } from "./scene";

const MAX_ATTEMPTS = 3;
// Without an explicit cap OpenRouter reserves the model's full output limit, which needs far more credits.
const MAX_TOKENS: Record<"recall" | "studio", number> = { recall: 3000, studio: 6000 };

export type GenerateMode = "recall" | "studio";

export const SYSTEM_PROMPT = `You turn a spoken description into an animated SVG scene. Reply with JSON only, no prose, no markdown fences.

Output shape: {"scenes": [Scene, ...]}

Scene: {"id": string, "title": string, "duration": seconds, "background": preset or hex, "particles"?: "sparkle"|"rain"|"snow", "camera"?: {"zoom": 1-1.2, "panX": px, "panY": px}, "entrance"?: "stagger", "glow"?: boolean, "caption"?: string, "objects": [Object], "timeline": [Animation]}
- "background" presets: "space" (deep space, twinkling stars), "sky" (daytime sky with clouds), "ocean" (sunset sea with waves, water below y=200), "city" (night skyline along the bottom), "grid" (neon synthwave grid, horizon at y=260). Or a hex colour; default "#10162a".
- "camera" slowly zooms/pans across the scene (end values; keep zoom <= 1.15, pan <= 40). "entrance": "stagger" pops objects in one after another. "glow": true makes every object glow (on by default for space, grid and city).

Stage is 800 wide x 450 tall. (0,0) is top-left, y grows downward. Centre is (400,225).

Object: {"id": unique string, "type": "circle"|"rect"|"star"|"text"|"arrow"|"icon"|"art", "x": number, "y": number, ...}
- x,y is the CENTRE of circle/rect/star/text/icon. For arrow, x,y is the tail and x2,y2 is the head.
- circle/star: "r" radius. rect: "w","h". text: "text","fontSize". arrow: "x2","y2","stroke","strokeWidth".
- icon: a glowing neon line icon. "icon": one name from ICONS below, "w": size in px (40-200), optional "fill" to recolour the neon. Use icons for real-world things (animals, vehicles, food, weather, buildings, objects); use circle/rect/star for plain geometric shapes.
- art: a detailed hand-drawn illustration for hero objects. "art": one of ${ART_NAMES.join(", ")}; "w" (and optional "h") is its box in px (60-360). Prefer art over an icon for these things. "flame" points down (attach under a rocket with "follow"), "shadow-cone" is a wide shadow from left to right, "sea" is a strip of water (use a wide w and h around 120).
- "fill": hex colour (or "none" for outlines with "stroke"). "opacity": 0-1 initial (use 0 for things that fade in). "scale": initial scale.
- "follow": id of another object; then x,y are an OFFSET from that object (use for labels that ride along with a moving object).
- "glow": true for suns/lights. Shapes are shaded with gradients automatically; moving objects get motion trails automatically.

ICONS: ${ICON_NAMES.join(", ")}

Animation (all have "target" object id, "start" seconds, "duration" seconds, optional "ease": "inOut" (default) | "out" | "back" (overshoot pop) | "bounce" (lands and bounces) | "elastic" | "linear"):
- {"action":"move","to":{"x":..,"y":..}}
- {"action":"fade","to": opacity 0-1}
- {"action":"grow","to": scale}
- {"action":"orbit","around": object id or {"x","y"},"radius": px,"turns": number (positive = anticlockwise),"startAngle": degrees}

Layout rules:
- Keep everything fully on stage with at least 30px margin. Space objects evenly; never overlap unless the description says so.
- Typical sizes: circle r 30-70, rect 80-160, star r 30-50, icon w 60-150, text fontSize 18-32.
- Palette: red #E5484D, blue #3E7BFA, yellow #F5C518, green #30A46C, orange #F76B15, purple #8E4EC6, pink #E93D82, white #F2F4F8, grey #9BA1A6, brown #8D5B3E, black #1C2024. Use natural colours for real things.
- Every id referenced by "follow", "target" or "around" must exist.`;

// The hand-made showcases double as few-shot style references for Studio.
const STUDIO_EXAMPLES = SHOWCASES.map((v) => JSON.stringify(v.scenes[0])).join("\n\n");

const MODE_RULES: Record<GenerateMode, string> = {
  recall: `This is a memory game. Recreate EXACTLY what the player describes, nothing more: same things, counts, colours, relative positions, sizes and motions. A named real thing ("a dog", "a rocket", "a palm tree") is an icon with the closest listed name (never "art" in this mode); a plain shape ("a red circle") is a shape. Set "background" only if the player describes the setting (space, sky, sea, city at night, neon grid) and "particles" only if they mention rain, snow or sparkles. Do not add decorations, labels, camera or entrance effects the player didn't mention. Return exactly ONE scene with duration 5 and all objects visible (opacity 1) unless the player says something fades.`,
  studio: `Think like a motion designer making a short animated explainer. Break the explanation into 1-3 scenes, each 8-12 seconds.

Every scene:
- ALWAYS picks the background preset that fits the story (space for astronomy, sky for weather/nature/outdoors, ocean for sea topics, city for urban/tech/night, grid for games/computers/retro). Use a hex colour only if nothing fits.
- Uses 6-12 objects in a layered composition: big hero icons in the middle ground, supporting icons around them, and a foreground of short UPPERCASE text labels and arrows that explain what is happening. Add a title text near the top.
- Uses an icon whenever a real thing is mentioned (sun, dog, rocket, tree, water...). Plain shapes are only for abstract ideas, highlights or shadows.
- Animates most objects: moves along the story, grows for emphasis ("back" ease), bounces for landings, fades labels in as each idea is introduced, orbits for anything that goes round. Stagger the timing so ideas appear one after another.
- Uses "entrance": "stagger", a gentle "camera" move, and particles when they suit the mood.
- Keeps everything on screen with good spacing: nothing within 30px of an edge, labels never covering icons, and labels attached with "follow" when their object moves.
- Has a one-sentence caption.

Three example scenes for style (don't copy their content):

${STUDIO_EXAMPLES}`,
};

export type { Message };

// Pull the JSON object out even if the model wraps it in fences or chatter.
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in reply");
  return JSON.parse(text.slice(start, end + 1));
}

// Call the model, run `accept` on the parsed JSON, and on failure retry with the error fed back.
export async function askWithRetries<T>(
  messages: Message[],
  maxTokens: number,
  accept: (json: unknown) => T,
  session = new ProviderSession()
): Promise<T> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await session.call(messages, maxTokens);
    try {
      return accept(extractJson(reply));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: `That JSON was invalid:
${lastError}
Return the corrected full JSON only.` }
      );
    }
  }
  throw new Error(`Model output failed validation after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

export type Engine = string; // provider name, or "offline"

// Ask the AI chain for scenes; if every provider fails, build the scene offline instead.
export async function generateScenes(description: string, mode: GenerateMode): Promise<{ scenes: Scene[]; engine: Engine; note?: string }> {
  const session = new ProviderSession();
  try {
    const scenes = await askAI(description, mode, session);
    return { scenes, engine: session.used };
  } catch (err) {
    console.warn("AI generation failed, using offline builder:", (err as Error).message);
    return { scenes: [buildOfflineScene(description, mode)], engine: "offline", note: (err as Error).message.slice(0, 200) };
  }
}

async function askAI(description: string, mode: GenerateMode, session: ProviderSession): Promise<Scene[]> {
  const messages: Message[] = [
    { role: "system", content: `${SYSTEM_PROMPT}

${MODE_RULES[mode]}` },
    { role: "user", content: description },
  ];
  return askWithRetries(messages, MAX_TOKENS[mode], (json) => {
    const parsed = scenesResponse.safeParse(json);
    if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
    // Unknown icon names snap to the closest whitelisted icon rather than costing a retry.
    const scenes = (parsed.data.scenes as Scene[]).map((sc) => snapIcons(sc).scene);
    const problems = scenes.flatMap(checkScene);
    if (problems.length) throw new Error(problems.join("; "));
    // Studio scenes always get a fitting backdrop preset, even if the model chose a flat colour.
    const dressed =
      mode === "studio"
        ? scenes.map((sc) =>
            (BACKGROUNDS as readonly string[]).includes(sc.background ?? "")
              ? sc
              : { ...sc, background: guessBackdrop(`${description} ${sc.title} ${sc.caption ?? ""}`) ?? "sky" }
          )
        : scenes;
    return dressed.map(clampToStage);
  }, session);
}
