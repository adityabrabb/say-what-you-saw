// The evidence trail. Recall reports, per round, what the witness missed and what they invented (names
// only). Act I files them as small tags; Act III puts the very same tags on the wanted poster as
// Exhibits A, B and C. Nothing here touches Recall: it only reads what Recall's report hooks hand over.

export interface EvidenceRound {
  said: string;
  score: number;
  missed?: string[];
  extra?: string[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const list = (names: string[], n: number) => names.slice(0, n).join(", ") + (names.length > n ? ` +${names.length - n}` : "");

export const hasEvidence = (r: EvidenceRound) => !!(r.missed?.length || r.extra?.length);

// Small tags for Act I: "missed trophy, pink star" / "invented red circle".
export function evidenceTags(r: EvidenceRound): string[] {
  const tags: string[] = [];
  if (r.missed?.length) tags.push(`missed ${clip(list(r.missed, 2), 30)}`);
  if (r.extra?.length) tags.push(`invented ${clip(list(r.extra, 2), 30)}`);
  return tags;
}

// One line for a poster exhibit: "Missed: trophy, pink star · Invented: red circle".
export function tagLine(r: EvidenceRound, max = 58): string {
  const parts: string[] = [];
  if (r.missed?.length) parts.push(`Missed: ${list(r.missed, 2)}`);
  if (r.extra?.length) parts.push(`Invented: ${list(r.extra, 2)}`);
  return clip(parts.join(" · "), max);
}

// Exhibits A, B, C: the witness's own worst statements, each with the mistakes filed in Act I.
// Rounds without tags (or an empty statement) fall back to `fallback` (the model's or house evidence).
export function exhibitsFrom<T extends { quote: string; note: string }>(rounds: EvidenceRound[], fallback: T[]): { quote: string; note: string }[] {
  const mine = rounds
    .filter((r) => r.said.trim() && hasEvidence(r))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((r) => ({ quote: clip(r.said.trim(), 150), note: tagLine(r) }));
  const used = new Set(mine.map((m) => m.quote.toLowerCase()));
  const rest = fallback.filter((f) => !used.has(f.quote.toLowerCase()));
  return [...mine, ...rest].slice(0, 3);
}
