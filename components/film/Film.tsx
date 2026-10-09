"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import RecallGame, { type RecallFinish } from "@/components/RecallGame";
import Verdict from "./Verdict";
import type { DirectorWrap } from "@/components/director/DirectorStage";
import { blobToJpeg, FRESH, loadFilm, saveFilm, type FilmState, type SceneId, type VerdictResult } from "@/lib/film";
import { drone, filmSfx, isMuted, onMuteChange, projector, setMuted } from "@/lib/sound";
import { ActCard, Cast } from "./Cards";
import Credits from "./Credits";
import Opening from "./Opening";

// WebGL + MediaPipe only load when the film reaches Act II.
const DirectorStage = dynamic(() => import("@/components/director/DirectorStage"), { ssr: false });

type Cut = "burn" | "cut" | "none";
const CUT_MS: Record<Exclude<Cut, "none">, [number, number]> = { burn: [700, 1500], cut: [180, 700] }; // [swap scene at, end]
const DRONE: Record<SceneId, number> = { opening: 1, cast: 1, "act1-card": 1, act1: 0.3, "act2-card": 1, act2: 0.2, act3: 0.15, credits: 0.8 };

const MENU: { scene: SceneId; label: string }[] = [
  { scene: "opening", label: "Opening titles" },
  { scene: "act1-card", label: "Act I · The Witness" },
  { scene: "act2-card", label: "Act II · The Director's Stage" },
  { scene: "act3", label: "Act III · The Verdict" },
  { scene: "credits", label: "End credits" },
];

const ACT1 = ["Something happened tonight.", "It lasted only a few seconds.", "You're the only one who saw it.", "Tell us exactly what you saw."];
const ACT2 = ["You've told us what you saw.", "Now the camera's on you.", "Direct your own scene."];

export default function Film() {
  const [film, setFilm] = useState<FilmState | null>(null);
  const [fx, setFx] = useState<{ kind: Cut; key: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [menu, setMenu] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Resume where the viewer left off.
  useEffect(() => {
    setFilm(loadFilm());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener("change", onMq);
    setMutedState(isMuted());
    const offMute = onMuteChange(setMutedState);
    return () => {
      mq.removeEventListener("change", onMq);
      offMute();
      timers.current.forEach(clearTimeout);
      drone.stop(0.5);
      projector.stop(0.3);
    };
  }, []);

  useEffect(() => {
    if (film) saveFilm(film);
  }, [film]);

  // Audio needs a gesture: after a refresh mid-film, the drone comes back on the first touch or key.
  useEffect(() => {
    if (!film || film.scene === "opening") return;
    const wake = () => drone.start();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [film?.scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const scene = film?.scene;
  useEffect(() => {
    if (!scene) return;
    drone.level(DRONE[scene]);
    document.body.classList.add("film-on");
    document.body.classList.toggle("film-arcade", scene === "act1");
    return () => document.body.classList.remove("film-on", "film-arcade");
  }, [scene]);

  const update = useCallback((patch: Partial<FilmState>) => setFilm((f) => ({ ...(f ?? FRESH), ...patch })), []);

  // Every scene change is a film burn or a cut to black; the swap happens while the screen is covered.
  const go = useCallback(
    (next: SceneId, kind: Cut = "burn", patch: Partial<FilmState> = {}) => {
      timers.current.forEach(clearTimeout);
      setMenu(false);
      // A hard cut with no transition: Act III has to look like the frame simply froze.
      if (kind === "none") {
        setFx(null);
        update({ ...patch, scene: next });
        return;
      }
      const k = reduced ? "cut" : kind;
      const [at, end] = CUT_MS[k];
      if (k === "burn") filmSfx.burn();
      setFx({ kind: k, key: Date.now() });
      timers.current = [
        setTimeout(() => update({ ...patch, scene: next }), at),
        setTimeout(() => setFx(null), end),
      ];
    },
    [reduced, update]
  );

  const openingDone = useCallback(() => go("cast", "burn", { seen: true }), [go]);
  const castDone = useCallback((name: string) => go("act1-card", "cut", { name }), [go]);
  const act1Done = useCallback(() => go("act1", "cut"), [go]);
  const act2Done = useCallback(() => go("act2", "cut"), [go]);
  const witness = useCallback((r: RecallFinish) => update({ witness: r }), [update]);
  const wrap = useCallback(
    async (w: DirectorWrap) => {
      const strip = w.strip ? await blobToJpeg(w.strip).catch(() => null) : null;
      go("act3", "none", { director: { lines: w.lines, takes: w.takes, credits: w.credits, strip, freeze: w.freeze, demo: w.demo }, verdict: null });
    },
    [go]
  );
  const replay = useCallback(() => go("act1-card", "burn", { witness: null, director: null, verdict: null }), [go]);
  const verdict = useCallback((v: VerdictResult) => update({ verdict: v }), [update]);
  const toCredits = useCallback(() => go("credits", "burn"), [go]);

  if (!film) return <div className="film-root" />;

  const chrome = film.scene !== "opening" || film.seen;
  return (
    <div className={`film-root scene-${film.scene}`}>
      {film.scene === "opening" && <Opening onDone={openingDone} reduced={reduced} />}
      {film.scene === "cast" && <Cast initial={film.name} onDone={castDone} reduced={reduced} />}
      {film.scene === "act1-card" && <ActCard act="Act I" title="The Witness" lines={ACT1} onDone={act1Done} reduced={reduced} />}
      {film.scene === "act1" && (
        <main className="film-act1">
          <p className="act-label">Act I · The Witness</p>
          <RecallGame onFinish={witness} />
          {film.witness && (
            <div className="film-next">
              <span>
                Testimony recorded: <strong>{film.witness.score}</strong> / {film.witness.max}
              </span>
              <button className="film-btn" onClick={() => go("act2-card", "burn")}>
                On to Act II ▸
              </button>
            </div>
          )}
        </main>
      )}
      {film.scene === "act2-card" && <ActCard act="Act II" title="The Director's Stage" lines={ACT2} onDone={act2Done} reduced={reduced} />}
      {film.scene === "act2" && <DirectorStage film={{ onWrap: wrap }} />}
      {film.scene === "act3" && <Verdict film={film} reduced={reduced} onVerdict={verdict} onAppeal={replay} onCredits={toCredits} />}
      {film.scene === "credits" && <Credits film={film} onReplay={replay} reduced={reduced} />}

      {chrome && (
        <div className="film-chrome">
          <button className="film-chip" onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Sound off" : "Sound on"}>
            {muted ? "♪̸" : "♪"}
          </button>
          <button className="film-chip" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
            Select scene
          </button>
          {menu && (
            <div className="scene-menu" role="menu">
              {MENU.map((m) => (
                <button
                  key={m.scene}
                  role="menuitem"
                  className={film.scene === m.scene || film.scene === m.scene.replace("-card", "") ? "current" : ""}
                  onClick={() => go(m.scene, "cut", m.scene === "act3" ? { verdict: null } : {})}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {fx && <div className={`film-fx ${fx.kind}`} key={fx.key} aria-hidden />}
    </div>
  );
}
