"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { download, starName, type FilmState } from "@/lib/film";
import { isMuted } from "@/lib/sound";
import { requestTrailerLines } from "@/lib/trailer/client";
import { startRecording, type Recording } from "@/lib/trailer/record";
import { DURATION, H, W, drawTrailer, readFonts, setCalm, type TrailerAssets, type TrailerFonts, type TrailerSession } from "@/lib/trailer/render";
import type { TrailerRequest } from "@/lib/trailer/schema";
import { startScore, type TrailerAudio } from "@/lib/trailer/score";

// "Watch your trailer": a 25-second trailer auto-edited from the session, drawn on a 1280x720 canvas
// with a generated score. It is recorded to a downloadable file where the browser can (play-only
// otherwise). Nothing in here may break the credits: it is lazy, caught, and always has a way back.

type Phase = "preparing" | "ready" | "playing" | "done";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });

// The photo strip holds the takes: 70px sides, 70px top, 640x360 frames 26px apart.
function cropStrip(img: HTMLImageElement): HTMLCanvasElement[] {
  const k = img.naturalWidth / 780;
  const n = Math.min(4, Math.max(0, Math.round((img.naturalHeight / k - 190 + 26) / 386)));
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    c.getContext("2d")!.drawImage(img, 70 * k, (70 + i * 386) * k, 640 * k, 360 * k, 0, 0, 640, 360);
    out.push(c);
  }
  return out;
}

function requestFor(f: FilmState): TrailerRequest {
  return {
    name: f.name.slice(0, 40),
    witnessScore: f.witness ? Math.min(1000, Math.round(f.witness.score)) : null,
    witnessMax: f.witness ? Math.min(1000, Math.round(f.witness.max)) : null,
    said: (f.witness?.rounds ?? []).slice(0, 5).map((r) => r.said.slice(0, 300)),
    directorLines: (f.director?.lines ?? []).slice(-20).map((l) => l.slice(0, 200)),
    alias: (f.verdict?.alias ?? "").slice(0, 40),
    crime: (f.verdict?.crime ?? "").slice(0, 160),
  };
}

function TrailerPlayer({ film, reduced, onBack }: { film: FilmState; reduced: boolean; onBack: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("preparing");
  const [file, setFile] = useState<{ url: string; ext: string } | null>(null);
  const [recorded, setRecorded] = useState<boolean | null>(null); // null until a run has finished
  const data = useRef<{ session: TrailerSession; assets: TrailerAssets; fonts: TrailerFonts } | null>(null);
  const live = useRef<{ raf: number; audio: TrailerAudio | null; rec: Recording | null }>({ raf: 0, audio: null, rec: null });
  const alive = useRef(true);

  const paint = useCallback((t: number) => {
    const g = canvas.current?.getContext("2d");
    if (g && data.current) drawTrailer(g, t, data.current.session, data.current.assets, data.current.fonts);
  }, []);

  // Get the four narration lines and the images while the viewer reads the poster text.
  useEffect(() => {
    alive.current = true;
    setCalm(reduced);
    (async () => {
      const req = requestFor(film);
      const [lines, strip, freeze, poster] = await Promise.all([
        requestTrailerLines(req),
        film.director?.strip ? loadImage(film.director.strip) : null,
        film.director?.freeze && !film.director.demo ? loadImage(film.director.freeze) : null,
        film.verdict?.poster ? loadImage(film.verdict.poster) : null,
        document.fonts?.ready,
      ]);
      if (!alive.current) return;
      const rounds = (film.witness?.rounds ?? []).map((r) => ({ title: r.title, truth: r.truth, said: r.said, score: r.score }));
      data.current = {
        session: {
          name: starName(film),
          score: film.witness ? film.witness.score : null,
          max: film.witness?.max ?? 0,
          rounds,
          directorLines: film.director?.lines ?? [],
          takes: film.director?.takes ?? 0,
          alias: film.verdict?.alias ?? "",
          crime: film.verdict?.crime ?? "",
          lines: lines.lines,
        },
        assets: { frames: strip ? cropStrip(strip) : [], freeze, poster },
        fonts: readFonts(),
      };
      paint(0);
      setPhase("ready");
    })().catch(() => alive.current && onBack()); // anything unexpected: straight back to the credits
    return () => {
      alive.current = false;
      cancelAnimationFrame(live.current.raf);
      live.current.rec?.cancel();
      live.current.audio?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke the old download when a new run replaces it.
  useEffect(
    () => () => {
      if (file) URL.revokeObjectURL(file.url);
    },
    [file]
  );

  const play = useCallback(() => {
    if (!data.current || !canvas.current) return;
    if (file) {
      URL.revokeObjectURL(file.url);
      setFile(null);
    }
    setRecorded(null);
    setPhase("playing");
    let audio: TrailerAudio | null = null;
    try {
      audio = startScore(isMuted());
    } catch {
      audio = null; // no audio: the picture still plays
    }
    const rec = startRecording(canvas.current, audio?.stream ?? null);
    live.current = { raf: 0, audio, rec };
    const wall = performance.now();
    const clock = () => (audio ? audio.now() : (performance.now() - wall) / 1000 - 0.2);

    const finish = async () => {
      cancelAnimationFrame(live.current.raf);
      paint(DURATION - 0.001);
      let blob: Blob | null = null;
      try {
        blob = (await rec?.stop()) ?? null;
      } catch {
        blob = null;
      }
      audio?.stop();
      if (!alive.current) return;
      if (blob && blob.size > 1000 && rec) setFile({ url: URL.createObjectURL(blob), ext: rec.ext });
      setRecorded(!!(blob && blob.size > 1000));
      setPhase("done");
    };

    const frame = () => {
      const t = Math.max(0, clock());
      if (t >= DURATION + 0.15) {
        void finish();
        return;
      }
      paint(Math.min(t, DURATION - 0.001));
      live.current.raf = requestAnimationFrame(frame);
    };
    live.current.raf = requestAnimationFrame(frame);
  }, [file, paint]);

  const skip = () => {
    cancelAnimationFrame(live.current.raf);
    live.current.rec?.cancel();
    live.current.audio?.stop();
    live.current = { raf: 0, audio: null, rec: null };
    paint(DURATION - 0.001);
    setRecorded(null);
    setPhase("done");
  };

  const star = starName(film).toLowerCase().replace(/\W+/g, "-");

  return (
    <div className="trailer" data-phase={phase} data-recorded={recorded === null ? "" : String(recorded)}>
      <div className="trailer-stage">
        <canvas ref={canvas} width={W} height={H} className="trailer-canvas" aria-label="The trailer for your film" />
        {phase === "preparing" && <p className="trailer-note">Cutting your trailer…</p>}
      </div>
      <div className="trailer-actions">
        {phase === "ready" && (
          <button className="film-btn" onClick={play} autoFocus>
            Roll trailer ▸
          </button>
        )}
        {phase === "playing" && (
          <button className="film-btn ghost" onClick={skip}>
            Skip
          </button>
        )}
        {phase === "done" && (
          <>
            <button className="film-btn" onClick={play}>
              Watch again
            </button>
            {file && (
              <button className="film-btn ghost" onClick={() => download(file.url, `${star || "my"}-trailer.${file.ext}`)}>
                Download trailer (.{file.ext})
              </button>
            )}
          </>
        )}
        <button className={phase === "done" ? "film-btn ghost" : "film-btn ghost quiet"} onClick={onBack}>
          Back to credits
        </button>
      </div>
      {phase === "done" && recorded === false && <p className="trailer-note small">Your browser can&apos;t record the trailer, so it is watch-only. It still counts.</p>}
      {phase === "playing" && <p className="trailer-note small">Sound on. Trust me.</p>}
    </div>
  );
}

// If anything in the trailer throws, the viewer lands back in the credits instead of on a blank screen.
class TrailerGuard extends Component<{ onBack: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onBack();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Trailer(props: { film: FilmState; reduced: boolean; onBack: () => void }) {
  return (
    <TrailerGuard onBack={props.onBack}>
      <TrailerPlayer {...props} />
    </TrailerGuard>
  );
}
