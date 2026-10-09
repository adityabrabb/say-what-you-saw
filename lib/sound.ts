"use client";

// Tiny chiptune sound kit synthesised with Web Audio, so there are no audio files to load.

let ctx: AudioContext | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("swys-muted") === "1";
} catch {
  // Storage blocked; default to sound on.
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || muted) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("swys-muted", m ? "1" : "0");
  } catch {}
  listeners.forEach((fn) => fn(m));
}

export function onMuteChange(fn: (m: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

interface Tone {
  freq: number;
  to?: number; // slide to this frequency
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number; // delay in seconds
}

function tone({ freq, to, dur, type = "square", vol = 0.08, at = 0 }: Tone) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.15, at = 0, filterFreq = 1800) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.frequency.exponentialRampToValueAtTime(200, t0 + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
}

// Noise through a band-pass filter that sweeps up then down: an arcade "whoosh".
function whoosh(dur = 0.45, vol = 0.22) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(300, t0);
  filter.frequency.exponentialRampToValueAtTime(3800, t0 + dur * 0.45);
  filter.frequency.exponentialRampToValueAtTime(500, t0 + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
}

const arpeggio = (notes: number[], step: number, type: OscillatorType = "square", vol = 0.07) =>
  notes.forEach((f, i) => tone({ freq: f, dur: step * 1.6, type, vol, at: i * step }));

export const sfx = {
  hover: () => tone({ freq: 880, dur: 0.04, vol: 0.025 }),
  click: () => tone({ freq: 520, to: 1040, dur: 0.08, vol: 0.06 }),
  back: () => tone({ freq: 700, to: 300, dur: 0.12, vol: 0.05 }),
  count: () => tone({ freq: 440, dur: 0.14, vol: 0.08 }),
  go: () => arpeggio([523, 659, 784, 1047], 0.06),
  flash: () => {
    whoosh(0.5);
    tone({ freq: 180, to: 1400, dur: 0.3, type: "sawtooth", vol: 0.025 });
  },
  tick: () => tone({ freq: 1200, dur: 0.03, vol: 0.02, type: "triangle" }),
  urgent: () => tone({ freq: 980, dur: 0.09, vol: 0.07 }),
  submit: () => arpeggio([392, 523, 784], 0.05),
  scoreTick: () => tone({ freq: 1500 + Math.random() * 300, dur: 0.025, vol: 0.02, type: "triangle" }),
  // Win jingle: rising arpeggio, then a held major chord.
  great: () => {
    arpeggio([523, 659, 784, 1047, 1319], 0.07);
    [1047, 1319, 1568].forEach((f) => tone({ freq: f, dur: 0.6, type: "square", vol: 0.04, at: 0.38 }));
  },
  good: () => {
    arpeggio([440, 554, 659], 0.08);
    [880, 1109].forEach((f) => tone({ freq: f, dur: 0.45, type: "square", vol: 0.04, at: 0.26 }));
  },
  // Loss buzzer: two harsh low blasts.
  bad: () => {
    [0, 0.32].forEach((at) => {
      tone({ freq: 110, dur: 0.26, type: "sawtooth", vol: 0.09, at });
      tone({ freq: 116, dur: 0.26, type: "square", vol: 0.05, at });
    });
  },
  // CRT switching off: high whine collapsing down, plus a static pop.
  powerOff: () => {
    tone({ freq: 1800, to: 60, dur: 0.38, type: "sawtooth", vol: 0.05 });
    noise(0.18, 0.18, 0, 5000);
  },
  // Camera shutter: sharp click, mirror slap, second click.
  shutter: () => {
    noise(0.04, 0.35, 0, 6000);
    tone({ freq: 180, to: 60, dur: 0.08, type: "square", vol: 0.06, at: 0.01 });
    noise(0.05, 0.25, 0.09, 4500);
  },
  slate: () => {
    noise(0.03, 0.3, 0, 3500);
    tone({ freq: 900, to: 400, dur: 0.06, type: "square", vol: 0.04 });
  },
  magic: () => arpeggio([659, 880, 1175, 1568], 0.05, "triangle", 0.06),
  error: () => tone({ freq: 160, dur: 0.25, type: "square", vol: 0.06 }),
};

// Sound for a final verdict based on a 0-100 score.
export function scoreSound(score: number) {
  if (score >= 80) sfx.great();
  else if (score >= 50) sfx.good();
  else sfx.bad();
}
