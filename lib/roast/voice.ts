// Picking the director's voice. Pure, so it can be tested against fake voice lists.

// Male-sounding English voices, deepest guesses first. Browsers don't report pitch, so this is a
// heuristic over the voice name; pitch and rate are then pushed low and slow.
const DEEP = [/google uk english male/i, /\bdaniel\b/i, /\bgeorge\b/i, /\bdavid\b/i, /\balex\b/i, /\bfred\b/i, /\bguy\b/i, /\bmark\b/i, /\bjames\b/i, /\brishi\b/i, /\bthomas\b/i, /\boliver\b/i, /\bryan\b/i, /\bchristopher\b/i, /\barthur\b/i, /\bmale\b/i];
const NOT_DEEP = /(female|zira|samantha|susan|hazel|karen|moira|victoria|aria|jenny|libby|sonia|fiona|tessa|allison|ava|serena|heera|linda)/i;

export function deepestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang) && !NOT_DEEP.test(v.name));
  for (const re of DEEP) {
    const hit = en.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  return en.find((v) => v.localService) ?? en[0] ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
}
