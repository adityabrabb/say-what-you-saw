"use client";

// Analog-style sound kit synthesised with Web Audio, so there are no audio files to load.

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

// A very short band-passed noise burst: a typewriter key, a relay, a switch, a clock.
function snap(freq: number, vol = 0.08, at = 0, dur = 0.018) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 2.2;
  const gain = ac.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
}

// Low-key analog sounds for the evidence-file look (no chiptune): keys, clicks, a clock, a stamp,
// a heartbeat, warm low chords. Same names as before, so every caller keeps working.
export const sfx = {
  hover: () => snap(3400, 0.016, 0, 0.01),
  // A typewriter key: the strike and the dull knock of the type bar.
  click: () => {
    snap(2600, 0.07);
    tone({ freq: 120, to: 70, dur: 0.05, type: "sine", vol: 0.05 });
  },
  back: () => {
    snap(1300, 0.05);
    tone({ freq: 170, to: 90, dur: 0.09, type: "sine", vol: 0.04 });
  },
  // Countdown: a heavy clock tick.
  count: () => {
    snap(1700, 0.09, 0, 0.024);
    tone({ freq: 210, dur: 0.07, type: "sine", vol: 0.035 });
  },
  // LOOK: a camera shutter and a low thump.
  go: () => {
    snap(4200, 0.12, 0, 0.02);
    tone({ freq: 95, to: 48, dur: 0.2, type: "sine", vol: 0.12 });
    snap(2400, 0.08, 0.075, 0.025);
  },
  // The footage rolls: a relay clicks, tape hiss, a mains hum underneath.
  flash: () => {
    snap(1100, 0.1, 0, 0.03);
    noise(0.35, 0.05, 0.02, 3200);
    tone({ freq: 60, dur: 0.6, type: "sine", vol: 0.035, at: 0.02 });
  },
  // Each second of the statement: a soft clock tick.
  tick: () => snap(2200, 0.022, 0, 0.012),
  // The last five seconds: a low heartbeat.
  urgent: () => {
    tone({ freq: 72, to: 54, dur: 0.14, type: "sine", vol: 0.13 });
    tone({ freq: 68, to: 50, dur: 0.12, type: "sine", vol: 0.08, at: 0.17 });
  },
  // Statement filed: a rubber stamp coming down on paper.
  submit: () => {
    tone({ freq: 105, to: 45, dur: 0.22, type: "sine", vol: 0.2 });
    noise(0.06, 0.16, 0, 1300);
  },
  scoreTick: () => snap(2700 + Math.random() * 500, 0.03, 0, 0.012),
  // High score: a warm, low major chord, no fanfare.
  great: () => {
    [196, 247, 294, 392].forEach((f, i) => tone({ freq: f, dur: 1.2, type: "triangle", vol: 0.03, at: i * 0.05 }));
  },
  good: () => {
    tone({ freq: 220, dur: 0.6, type: "triangle", vol: 0.035 });
    tone({ freq: 277, dur: 0.7, type: "triangle", vol: 0.03, at: 0.14 });
  },
  // Low score: two muffled thuds, like a door closing on the case.
  bad: () => {
    [0, 0.3].forEach((at) => tone({ freq: 66, to: 44, dur: 0.3, type: "sine", vol: 0.15, at }));
    noise(0.12, 0.08, 0, 420);
  },
  // Tape stopping.
  powerOff: () => {
    tone({ freq: 220, to: 38, dur: 0.45, type: "triangle", vol: 0.045 });
    snap(900, 0.08, 0.02, 0.03);
  },
  // Camera shutter: sharp click, mirror slap, second click.
  shutter: () => {
    noise(0.04, 0.35, 0, 6000);
    tone({ freq: 180, to: 60, dur: 0.08, type: "square", vol: 0.06, at: 0.01 });
    noise(0.05, 0.25, 0.09, 4500);
  },
  // A wooden clapper.
  slate: () => {
    snap(1800, 0.22, 0, 0.03);
    tone({ freq: 310, to: 150, dur: 0.05, type: "triangle", vol: 0.05 });
  },
  magic: () => {
    tone({ freq: 392, dur: 0.5, type: "triangle", vol: 0.03 });
    tone({ freq: 523, dur: 0.6, type: "triangle", vol: 0.025, at: 0.09 });
  },
  error: () => tone({ freq: 92, dur: 0.25, type: "triangle", vol: 0.07 }),
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
  accept: () => {
    snap(1500, 0.12, 0, 0.03);
    tone({ freq: 196, dur: 0.6, type: "triangle", vol: 0.04, at: 0.03 });
  },
  nope: () => tone({ freq: 220, to: 180, dur: 0.16, type: "triangle", vol: 0.05 }),
  // Reel change: the small "cigarette burn" cue mark ticks in the corner (a click each).
  cue: () => snap(2100, 0.1, 0, 0.02),
  // Changeover: gate clunk, the take-up reel spinning down, then the next reel catching.
  reelChange: () => {
    noise(0.06, 0.16, 0, 800);
    tone({ freq: 120, to: 55, dur: 0.14, type: "sine", vol: 0.14 });
    tone({ freq: 90, to: 40, dur: 0.7, type: "sawtooth", vol: 0.018, at: 0.1 });
    noise(0.04, 0.1, 0.62, 1500);
    tone({ freq: 140, to: 70, dur: 0.1, type: "sine", vol: 0.1, at: 0.62 });
  },
};

// ---------- Act 2.5 and the commercial break ----------
export const breakSfx = {
  // A broken page: stuttering static and a sagging buzz.
  glitch: () => {
    noise(0.18, 0.08, 0, 6000);
    tone({ freq: 150, to: 60, dur: 0.5, type: "sawtooth", vol: 0.035 });
    noise(0.1, 0.07, 0.3, 4000);
  },
  // The sponsor's jingle: a cheerful major chord, slightly detuned, a little too proud of itself.
  jingle: () => {
    [392, 494, 587, 784].forEach((f, i) => tone({ freq: f * (i % 2 ? 1.012 : 1), dur: 0.5, type: "triangle", vol: 0.035, at: i * 0.16 }));
    tone({ freq: 196, dur: 1.2, type: "sine", vol: 0.05, at: 0.5 });
  },
  // The skip button refuses: a flat buzz and a muted thunk.
  deny: () => {
    tone({ freq: 130, to: 110, dur: 0.22, type: "square", vol: 0.04 });
    tone({ freq: 90, to: 60, dur: 0.18, type: "sine", vol: 0.1, at: 0.03 });
  },
  tick: () => snap(1700, 0.05, 0, 0.012),
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
