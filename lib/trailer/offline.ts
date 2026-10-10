import type { TrailerRequest } from "./schema";

// The house narration when no model answers. Four lines, "In a world..." style. Each one riffs on the
// session's real words or score and never on anyone's looks, body, voice or identity.

const hash = (t: string) => {
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};
const pick = <T,>(list: T[], seed: number, salt = 0): T => list[Math.abs(seed + salt * 7919) % list.length];

const short = (t: string, words = 6) => {
  const w = t.replace(/\s+/g, " ").trim().split(" ").slice(0, words).join(" ");
  return w.replace(/[.,;:!?]+$/, "");
};

const OPEN = [
  "In a world where nobody remembers anything…",
  "In a city that forgets everything…",
  "In a world of blurry details…",
  "In a world with only two seconds to look…",
];
const MIDDLE = [
  "One witness. One memory. Zero accuracy.",
  "One witness stood between the truth and a decent guess.",
  "The footage was clear. The testimony was not.",
  "They saw everything. They remembered vibes.",
];
const DIRECTING = [
  "Then the camera turned on them.",
  "Then they took the director's chair, uninvited.",
  "Then came the direction nobody asked for.",
  "Then somebody started giving orders.",
];
const CLOSE = [
  "The witness was the suspect all along.",
  "Plot twist: the witness did it.",
  "The verdict is in. The film is guilty.",
  "And the one who said it all was the one who did it.",
];

export function offlineTrailerLines(req: TrailerRequest): [string, string, string, string] {
  const seed = hash(req.name + req.said.join("|") + req.directorLines.join("|"));
  const said = req.said.find((s) => s.trim());
  const dir = req.directorLines[req.directorLines.length - 1];
  const score = req.witnessScore !== null && req.witnessMax ? `${req.witnessScore} out of ${req.witnessMax}` : null;

  const middle = said
    ? pick(
        [
          `One witness. One statement: “${short(said)}”.`,
          `“${short(said)}.” That was the testimony.`,
          `They saw it all. They said “${short(said)}.”`,
        ],
        seed,
        1
      )
    : pick(["One witness. Not one word.", "A witness who said nothing. Riveting."], seed, 1);
  const scored = score ? pick([`${score}. The jury gasped.`, `They scored ${score}. Roll the cameras anyway.`], seed, 2) : pick(MIDDLE, seed, 2);
  const directing = dir ? pick([`Then they said “${short(dir)}” and meant it.`, `“${short(dir)}.” Cinema, apparently.`], seed, 3) : pick(DIRECTING, seed, 3);

  return [pick(OPEN, seed), said ? middle : scored, dir ? directing : pick(DIRECTING, seed, 4), pick(CLOSE, seed, 5)];
}
