import "server-only";
import { z } from "zod";
import { ICON_NAMES } from "./icons";
import { checkScene, clampToStage, scenesResponse } from "./schema";
import type { Scene } from "./scene";

const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
const MAX_ATTEMPTS = 3;
// Without an explicit cap OpenRouter reserves the model's full output limit, which needs far more credits.
const MAX_TOKENS: Record<"recall" | "studio", number> = { recall: 4000, studio: 8000 };

export type GenerateMode = "recall" | "studio";

export const SYSTEM_PROMPT = `You turn a spoken description into an animated SVG scene. Reply with JSON only, no prose, no markdown fences.

Output shape: {"scenes": [Scene, ...]}

Scene: {"id": string, "title": string, "duration": seconds, "background": preset or hex, "particles"?: "sparkle"|"rain"|"snow", "camera"?: {"zoom": 1-1.2, "panX": px, "panY": px}, "entrance"?: "stagger", "glow"?: boolean, "caption"?: string, "objects": [Object], "timeline": [Animation]}
- "background" presets: "space" (deep space, twinkling stars), "sky" (daytime sky with clouds), "ocean" (sunset sea with waves, water below y=200), "city" (night skyline along the bottom), "grid" (neon synthwave grid, horizon at y=260). Or a hex colour; default "#10162a".
- "camera" slowly zooms/pans across the scene (end values; keep zoom <= 1.15, pan <= 40). "entrance": "stagger" pops objects in one after another. "glow": true makes every object glow (on by default for space, grid and city).

Stage is 800 wide x 450 tall. (0,0) is top-left, y grows downward. Centre is (400,225).

Object: {"id": unique string, "type": "circle"|"rect"|"star"|"text"|"arrow"|"icon", "x": number, "y": number, ...}
- x,y is the CENTRE of circle/rect/star/text/icon. For arrow, x,y is the tail and x2,y2 is the head.
- circle/star: "r" radius. rect: "w","h". text: "text","fontSize". arrow: "x2","y2","stroke","strokeWidth".
- icon: a colourful illustrated picture. "icon": one name from ICONS below, "w": size in px (40-200). Use icons for real-world things (animals, vehicles, food, weather, planets, buildings, objects); use circle/rect/star for plain geometric shapes.
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

const MODE_RULES: Record<GenerateMode, string> = {
  recall: `This is a memory game. Recreate EXACTLY what the player describes, nothing more: same things, counts, colours, relative positions, sizes and motions. A named real thing ("a dog", "a rocket", "a palm tree") is an icon with the closest listed name; a plain shape ("a red circle") is a shape. Set "background" only if the player describes the setting (space, sky, sea, city at night, neon grid) and "particles" only if they mention rain, snow or sparkles. Do not add decorations, labels, camera or entrance effects the player didn't mention. Return exactly ONE scene with duration 5 and all objects visible (opacity 1) unless the player says something fades.`,
  studio: `This is an explainer video that should look impressive. Break the explanation into 1-4 scenes, each 6-14 seconds. Pick a fitting background preset, prefer icons for real things, use "entrance": "stagger", a gentle camera move and particles where they suit the story. Add short text labels and a title, use eases ("back" for pop-ins, "bounce" for landings) and motion to show what is happening. Give each scene a one-sentence caption.`,
};

export type Message = { role: "system" | "user" | "assistant"; content: string };

async function callModel(messages: Message[], maxTokens: number): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY || process.env.api_openrouter_API_key;
  if (!key) throw new Error("Missing OPENROUTER_API_KEY environment variable");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Say What You Saw",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenRouter returned no content");
  return content;
}

// Pull the JSON object out even if the model wraps it in fences or chatter.
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in reply");
  return JSON.parse(text.slice(start, end + 1));
}

// Call the model, run `accept` on the parsed JSON, and on failure retry with the error fed back.
export async function askWithRetries<T>(messages: Message[], maxTokens: number, accept: (json: unknown) => T): Promise<T> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await callModel(messages, maxTokens);
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

// Ask the model for scenes and validate them.
export async function generateScenes(description: string, mode: GenerateMode): Promise<Scene[]> {
  const messages: Message[] = [
    { role: "system", content: `${SYSTEM_PROMPT}

${MODE_RULES[mode]}` },
    { role: "user", content: description },
  ];
  return askWithRetries(messages, MAX_TOKENS[mode], (json) => {
    const parsed = scenesResponse.safeParse(json);
    if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
    const scenes = parsed.data.scenes as Scene[];
    const problems = scenes.flatMap(checkScene);
    if (problems.length) throw new Error(problems.join("; "));
    return scenes.map(clampToStage);
  });
}
