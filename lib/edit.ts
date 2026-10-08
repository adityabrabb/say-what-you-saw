import "server-only";
import { z } from "zod";
import { askWithRetries, SYSTEM_PROMPT, type Message } from "./generate";
import { applyPatch, patchSchema } from "./patch";
import type { Video } from "./scene";

const EDIT_RULES = `You are now EDITING an existing video. Do NOT rewrite it. Return a small patch:

{"summary": "one short sentence", "ops": [Op, ...]}

Op is one of ("scene" is the 0-based scene index):
- {"op":"updateObject","scene":0,"id":"moon","set":{ only the changed fields, e.g. "r": 3 }}
- {"op":"addObject","scene":0,"object":{ full new object with a NEW unique id }}
- {"op":"removeObject","scene":0,"id":"..."}
- {"op":"addAnimation","scene":0,"animation":{ full animation }}
- {"op":"updateAnimation","scene":0,"target":"earth","action":"orbit","set":{ only changed fields, e.g. "turns": 0.5 }}
- {"op":"removeAnimation","scene":0,"target":"...","action":"fade"}
- {"op":"updateScene","scene":0,"set":{"duration": 20}}

Guidance:
- Use the fewest ops that do what was asked. Never touch unrelated objects.
- "smaller"/"bigger": multiply r, or w and h, or fontSize by about 0.6 / 1.6.
- "slow down X": for an orbit, lower "turns" (keep duration); for a move, raise "duration". "speed up" is the reverse. If a longer animation would run past the scene end, also raise the scene duration.
- "add a label saying Y": addObject type "text" near the relevant object, ideally with "follow" set to that object's id and a small x/y offset (e.g. y: 30). Keep it on stage.
- Colours: use the palette above. Keep ids stable.
- If the user doesn't say which scene, prefer the scene they are currently viewing.`;

const MAX_TOKENS = 3000;

// Ask the model for a patch, apply it, and retry with the error if the patch doesn't fit the video.
export async function editVideo(video: Video, instruction: string, currentScene: number) {
  const messages: Message[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${EDIT_RULES}` },
    {
      role: "user",
      content: `Current video JSON:\n${JSON.stringify(video)}\n\nThe user is viewing scene index ${currentScene}.\n\nInstruction: ${instruction}`,
    },
  ];
  return askWithRetries(messages, MAX_TOKENS, (json) => {
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
    const result = applyPatch(video, parsed.data);
    return { ...result, summary: parsed.data.summary, ops: parsed.data.ops };
  });
}
