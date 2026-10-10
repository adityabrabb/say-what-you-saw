"use client";

import { BEAT, CUTS, DURATION } from "./render";

// The trailer's generated score, all Web Audio, no files: riser, braam, clock ticks, kicks on the
// beat, a sub drop, then SILENCE just before the final title. It runs on its own AudioContext so it
// can feed the speakers AND a MediaStream for the recorder; the page's mute only silences the speakers.

export interface TrailerAudio {
  ctx: AudioContext;
  stream: MediaStream; // what the recorder hears
  t0: number; // ctx time at trailer second 0
  now(): number; // trailer seconds
  stop(): void;
}

export function startScore(muted: boolean): TrailerAudio | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  void ctx.resume();
  const t0 = ctx.currentTime + 0.2;

  // master -> compressor -> speakers (muteable) and -> stream (always)
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  const speakers = ctx.createGain();
  speakers.gain.value = muted ? 0 : 0.9;
  const streamNode = ctx.createMediaStreamDestination();
  master.connect(comp);
  comp.connect(speakers).connect(ctx.destination);
  comp.connect(streamNode);

  // Silence just before the title: everything is cut, ringing tails included.
  const [sa, sb] = CUTS.silence;
  master.gain.setValueAtTime(1, t0 + sa - 0.28);
  master.gain.linearRampToValueAtTime(0.0001, t0 + sa - 0.04);
  master.gain.setValueAtTime(1, t0 + sb);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const at = (s: number) => t0 + s;

  const osc = (type: OscillatorType, f0: number, f1: number | null, start: number, dur: number, vol: number, attack = 0.01) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at(start));
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, at(start + dur));
    g.gain.setValueAtTime(0.0001, at(start));
    g.gain.exponentialRampToValueAtTime(vol, at(start + attack));
    g.gain.exponentialRampToValueAtTime(0.0001, at(start + dur));
    o.connect(g).connect(master);
    o.start(at(start));
    o.stop(at(start + dur + 0.05));
  };

  const noise = (start: number, dur: number, vol: number, kind: BiquadFilterType, f0: number, f1: number, rise = false) => {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = kind;
    flt.Q.value = 1.2;
    flt.frequency.setValueAtTime(f0, at(start));
    flt.frequency.exponentialRampToValueAtTime(f1, at(start + dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at(start));
    if (rise) {
      g.gain.exponentialRampToValueAtTime(vol, at(start + dur * 0.96));
      g.gain.linearRampToValueAtTime(0.0001, at(start + dur));
    } else {
      g.gain.exponentialRampToValueAtTime(vol, at(start + 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, at(start + dur));
    }
    n.connect(flt).connect(g).connect(master);
    n.start(at(start), Math.random());
    n.stop(at(start + dur + 0.05));
  };

  const kick = (s: number, vol = 0.5) => {
    osc("sine", 150, 42, s, 0.22, vol, 0.004);
    noise(s, 0.03, vol * 0.25, "highpass", 2500, 2500);
  };
  const tick = (s: number, vol = 0.1) => noise(s, 0.025, vol, "bandpass", 2400, 2400);
  const hat = (s: number, vol = 0.06) => noise(s, 0.04, vol, "highpass", 7000, 7000);

  // A braam: a low brass-like stack that blooms and decays, over a thump.
  const braam = (s: number, vol = 0.22, len = 2.4) => {
    [55, 82.4, 110, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * (i % 2 ? 1.006 : 0.995), at(s));
      o.frequency.exponentialRampToValueAtTime(f * 0.97, at(s + len));
      flt.type = "lowpass";
      flt.frequency.setValueAtTime(900, at(s));
      flt.frequency.exponentialRampToValueAtTime(160, at(s + len));
      g.gain.setValueAtTime(0.0001, at(s));
      g.gain.exponentialRampToValueAtTime(vol / (1 + i * 0.4), at(s + 0.04));
      g.gain.exponentialRampToValueAtTime(0.0001, at(s + len));
      o.connect(flt).connect(g).connect(master);
      o.start(at(s));
      o.stop(at(s + len + 0.05));
    });
    osc("sine", 70, 30, s, 1.1, vol * 1.6, 0.005);
    noise(s, 0.5, vol * 0.7, "lowpass", 1400, 200);
  };

  const riser = (from: number, to: number, vol = 0.1) => {
    const d = to - from;
    noise(from, d, vol, "bandpass", 180, 5200, true);
    osc("triangle", 110, 440, from, d, vol * 0.7, d * 0.9);
    osc("sine", 55, 80, from, d, vol * 0.9, d * 0.9);
  };

  // A. 0 - 5.0: a held sub tone and a riser into the first braam
  riser(0.1, CUTS.target[0], 0.1);
  braam(CUTS.target[0], 0.24);
  // C. 7.4 - 16.4: a clock and a slow pulse under the testimony
  for (let s = CUTS.said[0]; s < CUTS.said[1] - 0.1; s += 0.6) tick(s, 0.07);
  for (let s = CUTS.said[0]; s < CUTS.said[1] - 0.3; s += 1.2) osc("sine", 52, 44, s, 0.7, 0.14, 0.04);
  // D. 16.4 - 19.0: second riser, then the score slams in
  riser(CUTS.title2[0] + 0.2, CUTS.slam[0], 0.12);
  braam(CUTS.slam[0], 0.3, 2.2);
  kick(CUTS.slam[0], 0.6);
  // F. 21.6 - 27.6: a pulse that builds under the takes
  for (let s = CUTS.takes[0], i = 0; s < CUTS.takes[1] - 0.05; s += 0.5, i++) {
    kick(s, 0.22 + i * 0.03);
    if (i % 2) hat(s + 0.25, 0.04);
  }
  // G. 27.6 - 31.6: kicks on the beat with the hats, cut for cut
  for (let s = CUTS.montage[0]; s < CUTS.montage[1] - 0.02; s += BEAT) {
    kick(s, 0.5);
    hat(s + BEAT / 2, 0.08);
  }
  // H. 31.6 - 34.6: sub drop, then the stamp hits
  osc("sine", 96, 24, CUTS.poster[0], 1.6, 0.4, 0.02);
  riser(CUTS.poster[0], CUTS.poster[0] + 0.6, 0.06);
  const hit = CUTS.poster[0] + 0.6;
  osc("sine", 95, 40, hit, 0.4, 0.5, 0.004);
  noise(hit, 0.12, 0.3, "lowpass", 1800, 300);
  // I. Silence (the master gain is already down). J. A quiet warm chord under the title, and keys
  [110, 164.8, 220].forEach((f) => osc("sine", f, null, CUTS.final[0] + 0.15, 2.4, 0.07, 0.5));
  [0.2, 0.9, 1.45].forEach((d) => {
    tick(CUTS.final[0] + d, 0.09);
    tick(CUTS.final[0] + d + 0.05, 0.05);
  });

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      streamNode.stream.getTracks().forEach((tr) => tr.stop());
      if (ctx.state !== "closed") ctx.close().catch(() => {});
    } catch {
      // Already closed.
    }
  };
  // Safety: close the context after the trailer, whatever else happens.
  setTimeout(stop, (DURATION + 3) * 1000);

  return { ctx, stream: streamNode.stream, t0, now: () => ctx.currentTime - t0, stop };
}
