import type { RoastRequest } from "./schema";

// The house roasts: used when no model answers, and for local commands (freeze, undo) that never
// need one. They quote the player's own words and roast the memory or the direction. Nothing here
// ever mentions anyone's face, body, appearance, voice or identity.

const SILENT = [
  "Silence. Bold. The critics will call it minimalist.",
  "Nothing? Not even a guess? I've had better dialogue from a potted fern.",
  "The talent has said nothing. A haunting performance.",
  "Radio silence. Even my agent returns calls faster.",
  "Zero words, zero facts. Efficient, at least.",
  "You watched the scene and said nothing. Method acting?",
  "An empty answer. The most honest thing you've done all night.",
  "Not a word. I've seen cliffhangers with more commitment.",
];
const GREAT = [
  "“{q}”. Fine. Adequate. Don't let it go to your head, there's room.",
  "I suppose “{q}” is almost correct. Hollywood is built on almost.",
  "“{q}”? Annoyingly accurate. I'll allow it.",
  "Okay, “{q}” was right. Even a stopped clock, darling.",
  "Competent. I hate it. “{q}”, indeed.",
  "“{q}”. Good. Don't expect a trophy. Maybe a nod.",
];
const MEH = [
  "“{q}”. Close, the way a mime is close to a speech.",
  "Half the scene, all the confidence. “{q}”.",
  "“{q}”? I've seen smoke machines with better recall.",
  "You said “{q}”. The scene had {t}. We call that creative editing.",
  "“{q}”. A bold rewrite of {t}.",
  "“{q}”. Not wrong, not right, just loud.",
];
const BAD = [
  "“{q}”? The scene had {t}. We watched different movies.",
  "“{q}”. Bold. Wrong, but bold.",
  "I've heard better alibis from a goldfish. “{q}”, really?",
  "“{q}”. That's not memory, that's fan fiction.",
  "Where did “{q}” come from? Certainly not the scene.",
  "You lost {t} and found “{q}”. Fascinating cinema.",
  "Wrong, and with such confidence. “{q}”. Chef's kiss.",
];
const DIRECT = [
  "“{q}”. Visionary. Or a cry for help. Hard to tell.",
  "Oh, “{q}”. Bold. My budget weeps.",
  "“{q}”? Spielberg never had to say that out loud.",
  "You say “{q}” like it's a plan.",
  "“{q}”. Noted. Ignored, but noted.",
  "I'd call “{q}” a creative choice, if I were being generous. I'm not.",
  "“{q}”. Take it from someone who peaked in 1994: no.",
  "“{q}”. Back when I made films, we had a script.",
  "Rolling on “{q}”. I'll be in my trailer.",
  "“{q}”? Fine. Cut! No, keep rolling, I'm enjoying this.",
];
const SHOT = [
  "Click. A masterpiece. Of something.",
  "Freeze! You found the button. Congratulations.",
  "Another still. Picasso is shaking.",
  "The shutter finally finds something worth capturing: a button press.",
  "Print it. Frame it. Never show it to me again.",
];
const UNDO = [
  "Cut. Already regretting it? Classic.",
  "Taking it back? That's called editing, amateur.",
  "Undo! The only honest direction you've given.",
  "Back to the previous take. Wise. The new one was a risk.",
];

const hash = (text: string) => {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};
const pick = <T,>(list: T[], seed: number) => list[Math.abs(seed) % list.length];

// First few words of what they said, tidy enough to quote.
export function quoteOf(said: string, words = 7) {
  const parts = said.replace(/[“”"]/g, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "…";
  return parts.slice(0, words).join(" ").replace(/[.,;:!?]+$/, "") + (parts.length > words ? "…" : "");
}

// "apple, apple, cat" -> "an apple and a cat"
function thingsIn(truth: string) {
  const items = [...new Set(truth.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 3);
  if (!items.length) return "a few things you missed";
  const a = (s: string) => (/^(a|an|the)\s/i.test(s) ? s : `${/^[aeiou]/i.test(s) ? "an" : "a"} ${s}`);
  const named = items.map(a);
  return named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}

export function offlineRoast(req: RoastRequest, seed = hash(`${req.kind}|${req.said}|${req.truth}|${req.score}`)): string {
  const fill = (t: string) => t.replace("{q}", quoteOf(req.said)).replace("{t}", thingsIn(req.truth));
  switch (req.kind) {
    case "shot":
      return pick(SHOT, seed);
    case "undo":
      return pick(UNDO, seed);
    case "direction":
      return req.said ? fill(pick(DIRECT, seed)) : pick(SILENT, seed);
    case "answer": {
      if (!req.said) return pick(SILENT, seed);
      const s = req.score ?? 0;
      return fill(pick(s >= 70 ? GREAT : s >= 35 ? MEH : BAD, seed));
    }
  }
}
