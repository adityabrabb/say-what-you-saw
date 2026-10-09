"use client";

import { isMuted, onMuteChange } from "@/lib/sound";
import { deepestVoice } from "./voice";

// The director's one voice. A single queue shows one line at a time (typewriter subtitle) and speaks
// it with speech synthesis. Nothing here touches gameplay: when the game needs quiet (timed Recall
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

const VOICE_KEY = "swys-director-voice";
const MAX_QUEUE = 3;
const LATE_ROAST_MS = 10_000;
const STALE_REACTION_MS = 12_000;
// Interruptions and roasts are about the game; reactions are chatter and give way to them.
const RANK: Record<LineKind, number> = { react: 1, roast: 2, interrupt: 3 };

class Host {
  version = 0;
  line: HostLine | null = null;
  speaking = false;
  quiet = true;
  voiceMuted = false;

  private queue: Queued[] = [];
  private listeners = new Set<() => void>();
  private seq = 0;
  private voice: SpeechSynthesisVoice | null = null;
  private failSafe: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.voiceMuted = localStorage.getItem(VOICE_KEY) === "0";
    } catch {
      // Storage blocked: the voice just defaults to on.
    }
    const ss = window.speechSynthesis;
    if (ss) {
      const load = () => (this.voice = deepestVoice(ss.getVoices()));
      load();
      ss.addEventListener?.("voiceschanged", load);
    }
    // Muting all sound also silences the director's voice (the subtitle stays).
    onMuteChange((m) => m && this.stopSpeech());
  }

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
      this.stopSpeech(false);
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
    this.stopSpeech();
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
    this.stopSpeech();
    this.emit();
  }

  setQuiet(quiet: boolean) {
    if (this.quiet === quiet) return;
    this.quiet = quiet;
    if (quiet) this.silence();
  }

  setVoiceMuted(muted: boolean) {
    this.voiceMuted = muted;
    try {
      localStorage.setItem(VOICE_KEY, muted ? "0" : "1");
    } catch {}
    if (muted) this.stopSpeech();
    this.emit();
  }

  private show(item: Queued) {
    this.line = { id: ++this.seq, text: item.text, kind: item.kind };
    this.speak(item.text);
    this.emit();
  }

  private speak(text: string) {
    this.stopSpeech(false);
    const ss = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!ss || this.voiceMuted || isMuted()) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, ""));
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? "en-US";
      u.pitch = 0.35; // low
      u.rate = 0.88; // slow, theatrical
      u.volume = 1;
      const done = () => {
        if (this.failSafe) clearTimeout(this.failSafe);
        if (this.speaking) {
          this.speaking = false;
          this.emit();
        }
      };
      u.onend = done;
      u.onerror = done;
      this.speaking = true;
      // Some browsers never fire onend (hidden tab, voice failure): don't wait forever.
      this.failSafe = setTimeout(done, 1500 + text.length * 95);
      ss.cancel();
      ss.speak(u);
    } catch {
      this.speaking = false;
    }
  }

  private stopSpeech(notify = true) {
    if (this.failSafe) clearTimeout(this.failSafe);
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    if (this.speaking) {
      this.speaking = false;
      if (notify) this.emit();
    }
  }
}

export const host = new Host();
