"use client";

// The director's one voice, in text only (no speech synthesis, no robotic voice). A single queue shows
// one line at a time as a typewriter subtitle. Nothing here touches gameplay: when the game needs quiet (timed Recall
// phases, the opening, Act III) the film sets `quiet` and every line is dropped.

export type LineKind = "roast" | "interrupt" | "react";
export interface HostLine {
  id: number;
  text: string;
  kind: LineKind;
}
interface Queued {
  text: string;
  kind: LineKind;
  expires: number; // a roast that arrives this late is dropped
}

const MAX_QUEUE = 3;
const LATE_ROAST_MS = 10_000;
const STALE_REACTION_MS = 12_000;
// Interruptions and roasts are about the game; reactions are chatter and give way to them.
const RANK: Record<LineKind, number> = { react: 1, roast: 2, interrupt: 3 };

class Host {
  version = 0;
  line: HostLine | null = null;
  quiet = true;

  private queue: Queued[] = [];
  private listeners = new Set<() => void>();
  private seq = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  // Show a line now, or queue it behind the one on screen.
  // `since` is when the thing being roasted happened: a roast that arrives too long after is dropped.
  say(text: string, kind: LineKind, opts: { since?: number; maxAgeMs?: number } = {}) {
    if (this.quiet || !text.trim()) return;
    const expires = (opts.since ?? Date.now()) + (opts.maxAgeMs ?? (kind === "roast" ? LATE_ROAST_MS : kind === "react" ? STALE_REACTION_MS : 60_000));
    if (expires < Date.now()) return;
    const item: Queued = { text, kind, expires };
    if (!this.line) return this.show(item);
    // Chatter on screen gives way to the game's own lines (and queued chatter is dropped).
    if (RANK[kind] > RANK[this.line.kind] && this.line.kind === "react") {
      this.queue = this.queue.filter((q) => q.kind !== "react");
      return this.show(item);
    }
    // Newer reactions replace queued reactions; the queue stays short.
    if (kind === "react") this.queue = this.queue.filter((q) => q.kind !== "react");
    this.queue.push(item);
    while (this.queue.length > MAX_QUEUE) {
      const drop = this.queue.findIndex((q) => q.kind === "roast");
      this.queue.splice(drop === -1 ? 0 : drop, 1);
    }
    this.emit();
  }

  // The current line has been read and held long enough: move on.
  next(id: number) {
    if (!this.line || this.line.id !== id) return;
    let item = this.queue.shift();
    while (item && item.expires < Date.now()) item = this.queue.shift();
    if (item) this.show(item);
    else {
      this.line = null;
      this.emit();
    }
  }

  // Quiet time: drop everything, stop talking.
  silence() {
    this.queue = [];
    this.line = null;
    this.emit();
  }

  setQuiet(quiet: boolean) {
    if (this.quiet === quiet) return;
    this.quiet = quiet;
    if (quiet) this.silence();
  }

  private show(item: Queued) {
    this.line = { id: ++this.seq, text: item.text, kind: item.kind };
    this.emit();
  }
}

export const host = new Host();
