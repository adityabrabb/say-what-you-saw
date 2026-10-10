"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import RecallGame, { type RecallFinish, type RecallRound } from "@/components/RecallGame";
import Verdict from "./Verdict";
import DirectorHost from "./DirectorHost";
import { evidenceTags, hasEvidence } from "@/lib/evidence";
import { host } from "@/lib/roast/host";
import { requestRoast } from "@/lib/roast/client";
import type { DirectorWrap } from "@/components/director/DirectorStage";
import { blobToJpeg, FRESH, loadFilm, saveFilm, type FilmState, type SceneId, type VerdictResult } from "@/lib/film";
import { drone, filmSfx, isMuted, onMuteChange, projector, setMuted } from "@/lib/sound";
import { ActCard, Cast } from "./Cards";
import Credits from "./Credits";
import Opening from "./Opening";
import { CommercialBreak, NotFound } from "./Break";

// The trailer (canvas + Web Audio + recorder) loads only when asked for.
const Trailer = dynamic(() => import("./Trailer"), { ssr: false });

// WebGL + MediaPipe only load when the film reaches Act II.
const DirectorStage = dynamic(() => import("@/components/director/DirectorStage"), { ssr: false });

// Act 2.5 and the Memory+ break are a first-visit joke: once seen, a returning visitor goes straight to Act II.
const BREAK_KEY = "swys-break-seen";
const breakSeen = () => {
  try {
    return localStorage.getItem(BREAK_KEY) === "1";
  } catch {
    return false;
  }
};
const markBreakSeen = () => {
  try {
    localStorage.setItem(BREAK_KEY, "1");
  } catch {}
};

type Cut = "burn" | "cut" | "none";
const CUT_MS: Record<Exclude<Cut, "none">, [number, number]> = { burn: [700, 1500], cut: [180, 700] }; // [swap scene at, end]
const DRONE: Record<SceneId, number> = { opening: 1, cast: 1, "act1-card": 1, act1: 0.3, act25: 0.6, ad: 0.3, "act2-card": 1, act2: 0.2, act3: 0.15, credits: 0.8, trailer: 0.02 };

const MENU: { scene: SceneId; label: string }[] = [
  { scene: "opening", label: "Opening titles" },
  { scene: "act1-card", label: "Act I · The Witness" },
  { scene: "act25", label: "Act 2.5 · Not found" },
  { scene: "ad", label: "Commercial break" },
  { scene: "act2-card", label: "Act II · The Director's Stage" },
  { scene: "act3", label: "Act III · The Verdict" },
  { scene: "credits", label: "End credits" },
  { scene: "trailer", label: "Watch your trailer" },
];

// Scenes where the director may speak at all; the game's timed phases are quiet on top of this.
const TALKATIVE = new Set<SceneId>(["cast", "act1-card", "act1", "act25", "ad", "act2-card", "act2", "credits"]);
const RETAKE: Partial<Record<SceneId, SceneId>> = { act1: "act1-card", "act1-card": "act1-card", act2: "act2-card", "act2-card": "act2-card", act25: "act25", ad: "ad", act3: "act3" };

const ACT1 = ["Something happened tonight.", "It lasted only a few seconds.", "You're the only one who saw it.", "Tell us exactly what you saw."];
const ACT2 = ["You've told us what you saw.", "Now the camera's on you.", "Direct your own scene."];

export default function Film() {
  const [film, setFilm] = useState<FilmState | null>(null);
  const [fx, setFx] = useState<{ kind: Cut; key: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [menu, setMenu] = useState(false);
  const [recallPhase, setRecallPhase] = useState("pick");
  const [scoring, setScoring] = useState(false); // a Recall round is waiting for its score
  const [filed, setFiled] = useState<RecallRound[]>([]); // evidence filed so far in Act I (read from Recall's report hook)
  const settledAt = useRef(0);
  useSyncExternalStore(host.subscribe, host.getVersion, () => 0); // re-render when the director's voice is toggled
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
      host.setQuiet(true);
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

  // The director stays quiet in the opening, in Act III, and during Recall's timed phases.
  const timedPhase = scene === "act1" && ["ready", "flash", "describe"].includes(recallPhase);
  const reactionsOn = !!scene && TALKATIVE.has(scene) && !timedPhase;
  useEffect(() => host.setQuiet(!reactionsOn), [reactionsOn]);
  useEffect(() => {
    host.silence(); // a new scene never inherits the last scene's line
    setRecallPhase("pick");
    setScoring(false);
  }, [scene]);
  useEffect(() => {
    // Cleared when the round's score is reported (an empty answer is reported at once)
    setScoring(recallPhase === "result" && Date.now() - settledAt.current > 1500);
  }, [recallPhase]);

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
  const act1Done = useCallback(() => (setFiled([]), go("act1", "cut")), [go]);
  const act2Done = useCallback(() => go("act2", "cut"), [go]);
  const act25Done = useCallback(() => {
    markBreakSeen();
    go("ad", "cut");
  }, [go]);
  const adDone = useCallback(() => go("act2-card", "burn"), [go]);
  const witness = useCallback((r: RecallFinish) => update({ witness: r }), [update]);

  // The director's lines. Report-only hooks: Recall and Director never wait for any of this.
  const onRound = useCallback((r: RecallRound, i: number, total: number) => {
    setScoring(false);
    settledAt.current = Date.now();
    setFiled((f) => {
      const next = f.slice(0, i);
      next[i] = r;
      return next;
    });
    if (i + 1 < total) host.say(`Interruption. Round ${i + 2}. Try not to embarrass yourself.`, "interrupt", { maxAgeMs: 30_000 });
    const since = Date.now();
    void requestRoast({ kind: "answer", said: r.said, truth: r.truth, score: r.score }).then((res) => {
      host.say(res.line, "roast", { since });
      // The plant: the director files what the witness got wrong, and sounds far too interested.
      if (hasEvidence(r) && i < 2) host.say("Noted. Very interesting.", "react", { since });
    });
  }, []);
  // Recall reports a silent round in the same instant it enters the result screen, before React could
  // re-render the film. So the director's quiet time is lifted here, synchronously, not in an effect.
  const onPhase = useCallback((p: string) => {
    host.setQuiet(["ready", "flash", "describe"].includes(p));
    setRecallPhase(p);
  }, []);
  const directionSeq = useRef(0);
  const onLine = useCallback((l: { text: string; kind: "direction" | "shot" | "undo" }) => {
    const id = ++directionSeq.current;
    const since = Date.now();
    void requestRoast({ kind: l.kind, said: l.text, truth: "", score: null }).then((res) => {
      if (id === directionSeq.current) host.say(res.line, "roast", { since }); // a newer direction supersedes this one
    });
  }, []);
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
  const toTrailer = useCallback(() => go("trailer", "burn"), [go]);
  const backToCredits = useCallback(() => go("credits", "cut"), [go]);

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
          <div className="evidence-row" aria-label="Evidence on file">
            <span className="ev-count">
              Evidence on file <b>{String(filed.length).padStart(2, "0")}</b>
            </span>
            {filed.length > 0 &&
              evidenceTags(filed[filed.length - 1]).map((t) => (
                <span key={`${filed.length}-${t}`} className="ev-tag">
                  <i>{filed.length}</i>
                  {t}
                </span>
              ))}
          </div>
          <RecallGame onFinish={witness} onRound={onRound} onPhase={onPhase} />
          {film.witness && (
            <div className="film-next">
              <span>
                Testimony recorded: <strong>{film.witness.score}</strong> / {film.witness.max}
              </span>
              <button className="film-btn" onClick={() => go(breakSeen() ? "act2-card" : "act25", "burn")}>
                On to Act II ▸
              </button>
            </div>
          )}
        </main>
      )}
      {film.scene === "act25" && <NotFound onDone={act25Done} reduced={reduced} />}
      {film.scene === "ad" && <CommercialBreak score={film.witness?.score ?? null} max={film.witness?.max ?? 0} onDone={adDone} reduced={reduced} />}
      {film.scene === "act2-card" && <ActCard act="Act II" title="The Director's Stage" lines={ACT2} onDone={act2Done} reduced={reduced} />}
      {film.scene === "act2" && <DirectorStage film={{ onWrap: wrap, onLine }} />}
      {film.scene === "act3" && <Verdict film={film} reduced={reduced} onVerdict={verdict} onAppeal={replay} onCredits={toCredits} />}
      {film.scene === "credits" && <Credits film={film} onReplay={replay} onTrailer={toTrailer} reduced={reduced} />}
      {film.scene === "trailer" && <Trailer film={film} reduced={reduced} onBack={backToCredits} />}

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

      <DirectorHost
        scene={film.scene}
        reduced={reduced}
        reactions={reactionsOn}
        idleHold={scoring}
        soundMuted={muted}
        onToggleSound={() => setMuted(!muted)}
        onSelectScene={() => setMenu(true)}
        onRetake={RETAKE[film.scene] ? () => go(RETAKE[film.scene]!, "cut", film.scene === "act3" ? { verdict: null } : {}) : undefined}
      />

      {fx && fx.kind !== "none" && <div className={`film-fx ${fx.kind}`} key={fx.key} aria-hidden />}
    </div>
  );
}
