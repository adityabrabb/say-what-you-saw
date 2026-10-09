import type { CaseFile, Charge } from "./schema";

// The funny fallback when no model answers: the charge is still built from the suspect's real words.
// Roasts only what was said. Never looks, body or identity.

function pick<T>(list: T[], seed: number, salt = 0): T {
  return list[Math.abs((seed + salt * 7919) % list.length)];
}

function hash(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const ALIASES = [
  "The Unreliable Narrator",
  "Two-Second Tony",
  "The Vague One",
  "Blink-and-Miss",
  "The Fog Machine",
  "Captain Approximately",
  "The Plot Hole",
  "Mister Close Enough",
  "The Eyewitness (Allegedly)",
];
const CRIMES = [
  "Describing a crime scene like a horoscope",
  "Inventing evidence and calling it a memory",
  "Impersonating a reliable witness for {n} rounds",
  "Seeing everything and remembering vibes",
  "Directing a film nobody asked for while under investigation",
  "Gross negligence of the human eye",
];
const REWARDS = [
  "$3 and a half-used bus pass",
  "One (1) slightly warm samosa",
  "A firm handshake, no eye contact",
  "Store credit at a closed video rental shop",
  "Two expired cinema tickets",
  "A participation sticker",
];
const MISS_NOTES = ["That was not in the scene", "Nobody else saw that", "Confidently wrong", "The jury laughed", "Objection: fiction"];
const DIRECTOR_NOTES = ["Said on camera, unprompted", "Directed with a straight face", "Self-incriminating", "Recorded on set"];
const SILENT = ["…", "(silence)", "(stared blankly)"];

export function offlineCharge(file: CaseFile): Charge {
  const seed = hash(file.name + file.rounds.map((r) => r.said).join("|") + file.directorLines.join("|"));
  // Worst testimony first, then the director's own lines.
  const testimony = file.rounds
    .filter((r) => r.said.trim())
    .sort((a, b) => a.score - b.score)
    .map((r, i) => ({ quote: r.said.trim(), note: r.score < 40 ? pick(MISS_NOTES, seed, i) : `Scored ${r.score}. Barely.` }));
  const directing = file.directorLines.map((l, i) => ({ quote: l.trim(), note: pick(DIRECTOR_NOTES, seed, i) }));
  const evidence = [...testimony, ...directing].slice(0, 3);
  while (evidence.length < 3) evidence.push({ quote: pick(SILENT, seed, evidence.length), note: "Refused to testify" });

  const rounds = file.rounds.length || 0;
  return {
    alias: pick(ALIASES, seed),
    crime: pick(CRIMES, seed, 1).replace("{n}", String(rounds || "several")),
    evidence: evidence.map((e) => ({ quote: e.quote.slice(0, 150), note: e.note.slice(0, 80) })),
    reward: pick(REWARDS, seed, 2),
  };
}
