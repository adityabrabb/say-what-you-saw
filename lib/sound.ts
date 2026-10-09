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

// ---------- Film sound mix ----------

// One looping noise buffer shared by the projector rattle and the room tone.
let noiseBuf: AudioBuffer | null = null;
function loopNoise(ac: AudioContext) {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

// A long-running sound with a fade-in, a level and a fade-out. Survives mute: it stops when
// muted and starts again (if still wanted) when unmuted.
function bed(build: (ac: AudioContext, out: GainNode) => AudioScheduledSourceNode[], fadeIn: number) {
  let want = false;
  let level = 1;
  let live: { out: GainNode; srcs: AudioScheduledSourceNode[] } | null = null;
  const peak = () => level;

  const startNow = () => {
    const ac = audio();
    if (!ac || live) return;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak()), ac.currentTime + fadeIn);
    out.connect(ac.destination);
    const srcs = build(ac, out);
    srcs.forEach((s) => s.start());
    live = { out, srcs };
  };
  const stopNow = (fade: number) => {
    if (!live || !ctx) return;
    const { out, srcs } = live;
    live = null;
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    srcs.forEach((s) => s.stop(t + fade + 0.05));
  };
  onMuteChange((m) => (m ? stopNow(0.2) : want && startNow()));

  return {
    start() {
      want = true;
      startNow();
    },
    stop(fade = 1.2) {
      want = false;
      stopNow(fade);
    },
    // 0..1 relative loudness, eased so act changes never jump.
    level(v: number, over = 1.5) {
      level = Math.max(0.0001, v);
      if (live && ctx) live.out.gain.setTargetAtTime(level, ctx.currentTime, over / 3);
    },
  };
}

// Projector motor: low hum plus a soft gate rattle at 24 frames a second.
export const projector = bed((ac, out) => {
  const master = ac.createGain();
  master.gain.value = 0.05;
  master.connect(out);
  const hum = ac.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 48;
  const humLp = ac.createBiquadFilter();
  humLp.type = "lowpass";
  humLp.frequency.value = 220;
  const humGain = ac.createGain();
  humGain.gain.value = 0.35;
  hum.connect(humLp).connect(humGain).connect(master);

  const rattle = loopNoise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2200;
  bp.Q.value = 0.9;
  const gate = ac.createGain();
  gate.gain.value = 0.25;
  const lfo = ac.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 24;
  const depth = ac.createGain();
  depth.gain.value = 0.25;
  lfo.connect(depth).connect(gate.gain);
  rattle.connect(bp).connect(gate).connect(master);
  return [hum, rattle, lfo];
}, 1.2);

// Quiet ambient drone: two detuned low fifths and breathing room tone under a slow filter sweep.
export const drone = bed((ac, out) => {
  const master = ac.createGain();
  master.gain.value = 0.045;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  lp.Q.value = 2;
  lp.connect(master).connect(out);
  const srcs: AudioScheduledSourceNode[] = [];
  [55, 55.4, 82.4, 110.2].forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = i % 2 ? "triangle" : "sine";
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = i < 2 ? 0.5 : 0.22;
    o.connect(g).connect(lp);
    srcs.push(o);
  });
  const air = loopNoise(ac);
  const airLp = ac.createBiquadFilter();
  airLp.type = "lowpass";
  airLp.frequency.value = 600;
  const airGain = ac.createGain();
  airGain.gain.value = 0.08;
  air.connect(airLp).connect(airGain).connect(master);
  srcs.push(air);
  const sweep = ac.createOscillator();
  sweep.frequency.value = 0.05;
  const sweepDepth = ac.createGain();
  sweepDepth.gain.value = 180;
  sweep.connect(sweepDepth).connect(lp.frequency);
  srcs.push(sweep);
  return srcs;
}, 4);

export const filmSfx = {
  // Soft projector latch: a damped thump and two muffled clicks.
  projectorClick: () => {
    noise(0.025, 0.12, 0, 2400);
    tone({ freq: 140, to: 60, dur: 0.09, type: "sine", vol: 0.12 });
    noise(0.03, 0.07, 0.11, 1600);
  },
  // Countdown leader blip on every number; the classic "2-pop" is a touch brighter.
  leader: (n: number) => tone({ freq: n === 2 ? 1000 : 640, dur: n === 2 ? 0.12 : 0.05, type: "sine", vol: n === 2 ? 0.08 : 0.03 }),
  type: () => noise(0.015, 0.04, 0, 3000 + Math.random() * 1500),
  // Film burn: a soft rush of air.
  burn: () => whoosh(0.9, 0.08),
  accept: () => arpeggio([392, 587, 784], 0.07, "triangle", 0.05),
  nope: () => tone({ freq: 220, to: 180, dur: 0.16, type: "triangle", vol: 0.05 }),
};

// ---------- Act III: The Verdict ----------
export const verdictSfx = {
  // Two-tone police siren sweep.
  siren: () => {
    [0, 0.5].forEach((at) => tone({ freq: 640, to: 960, dur: 0.45, type: "triangle", vol: 0.035, at }));
  },
  // Retro OS error "ding".
  ding: () => {
    tone({ freq: 880, dur: 0.18, type: "sine", vol: 0.06 });
    tone({ freq: 660, dur: 0.3, type: "sine", vol: 0.05, at: 0.09 });
  },
  cursorClick: () => noise(0.015, 0.12, 0, 5000),
  // Glitch: two detuned saws sagging in pitch plus a burst of static.
  glitch: (dur = 1) => {
    tone({ freq: 220, to: 90, dur, type: "sawtooth", vol: 0.045 });
    tone({ freq: 233, to: 82, dur, type: "sawtooth", vol: 0.04 });
    noise(dur, 0.09, 0, 7000);
  },
  // The twist lands: low hit, then near-silence.
  hit: () => {
    tone({ freq: 70, to: 32, dur: 1.4, type: "sine", vol: 0.22 });
    noise(0.5, 0.12, 0, 900);
  },
  // Glass shattering: a crack and a shower of tiny bright shards.
  shatter: () => {
    noise(0.12, 0.3, 0, 9000);
    for (let i = 0; i < 18; i++) tone({ freq: 2400 + Math.random() * 4200, dur: 0.05 + Math.random() * 0.12, type: "sine", vol: 0.012, at: 0.02 + Math.random() * 0.7 });
  },
  whoosh: () => whoosh(0.7, 0.1),
  // Rubber stamp: a dull thud with a paper slap.
  thud: () => {
    tone({ freq: 95, to: 40, dur: 0.28, type: "sine", vol: 0.3 });
    noise(0.07, 0.25, 0, 1400);
  },
};
