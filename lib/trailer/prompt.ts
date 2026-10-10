import type { TrailerRequest } from "./schema";

export const TRAILER_SYSTEM = `You write the four title cards of a 25-second movie trailer for a short film about a person's own session.
Style: the deep-voiced "In a world..." trailer narrator, funny, dry, a little arrogant, PG-13.

You get the star's name, what they said when asked to remember scenes, the lines they used to direct their own scene,
their score and a criminal alias.

Rules:
- Exactly four lines, in order: (1) the opener, starting like "In a world where..." (2) about the memory test, riffing on something they really said, (3) about them directing their own scene, (4) the twist: the witness was really the suspect.
- Each line is at most 85 characters. No hashtags, no emoji.
- You may quote their real words in "curly quotes". Never invent quotes.
- Roast ONLY what they said and how well they remembered. NEVER mention or joke about face, body, appearance, voice, age, gender, ethnicity, religion or any identity trait.
Reply with JSON only: {"lines": ["...", "...", "...", "..."]}`;

export function trailerUser(r: TrailerRequest) {
  const said = r.said.length ? r.said.map((s, i) => `Round ${i + 1}: "${s || "(nothing)"}"`).join("\n") : "(skipped the memory test)";
  const dir = r.directorLines.length ? r.directorLines.map((l) => `- "${l}"`).join("\n") : "(no directions)";
  const score = r.witnessScore === null ? "not taken" : `${r.witnessScore}/${r.witnessMax}`;
  return `Star: ${r.name || "Unknown"}\nScore: ${score}\nAlias: ${r.alias || "none"}\nCrime: ${r.crime || "none"}\n\nThey said:\n${said}\n\nThey directed:\n${dir}`;
}
