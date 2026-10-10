"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import HowToPlay from "./HowToPlay";
import SceneRenderer from "./SceneRenderer";
import { celebrate } from "@/lib/confetti";
import { flash, shake } from "@/lib/fx";
import { scoreSound, sfx } from "@/lib/sound";
import { requestScenes } from "@/lib/api";
import { ICON_SPRITE } from "@/lib/icons";
import { DESCRIBE_SECONDS, DIFFICULTIES, poolFor, type Difficulty } from "@/lib/recallPool";
import { CATEGORY_LABELS, describeObject, POINTS_PER_CATEGORY, scoreScenes, verdictFor, type Category, type ScoreResult } from "@/lib/score";
import type { Scene } from "@/lib/scene";

type Phase = "pick" | "ready" | "flash" | "describe" | "result" | "final";

interface RoundResult {
  target: Scene;
  said: string;
  generated: Scene | null;
  score: ScoreResult | null;
  error: string;
  offline?: boolean;
}

const READY_SECONDS = 3.7; // 3, 2, 1, then a beat of "LOOK!"
const LOOK_BEAT = 0.7;
const ROUND_OPTIONS = [3, 5] as const;
const MISSED_COLOUR = "#E5484D";
const EXTRA_COLOUR = "#F5C518";

// Pick a target from the difficulty's pool not seen yet this session; reshuffle once it runs out.
function nextTarget(seen: Set<string>, difficulty: Difficulty): Scene {
  const pool = poolFor(difficulty);
  let fresh = pool.filter((s) => !seen.has(s.id));
  if (fresh.length === 0) {
    pool.forEach((s) => seen.delete(s.id));
    fresh = pool;
  }
  const pick = fresh[Math.floor(Math.random() * fresh.length)];
  seen.add(pick.id);
  // Warm the cache so icons are already there when the 2-second flash starts.
  if (pick.objects.some((o) => o.type === "icon")) new Image().src = ICON_SPRITE;
  return pick;
}

const bestKey = (rounds: number, difficulty: Difficulty) => `swys-best-${rounds}-${difficulty}`;

function readBest(rounds: number, difficulty: Difficulty): number {
  try {
    return Number(localStorage.getItem(bestKey(rounds, difficulty))) || 0;
  } catch {
    return 0;
  }
}

function writeBest(rounds: number, difficulty: Difficulty, score: number) {
  try {
    localStorage.setItem(bestKey(rounds, difficulty), String(score));
  } catch {
    // Storage blocked (private mode); best score just won't persist.
  }
}

// Ease that shoots past the target and settles back: the number counts up, then down.
const easeOutBack = (p: number) => 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2);

// Animate a number from wherever it currently shows to `value`, overshooting slightly.
function useCountTo(value: number, ms = 1200, from = 0): number {
  const [shown, setShown] = useState(from);
  const shownRef = useRef(from);
  useEffect(() => {
    const start = shownRef.current;
    if (start === value) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const v = Math.max(0, Math.round(start + (value - start) * easeOutBack(p)));
      shownRef.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

const useCountUp = (value: number, ms = 1200) => useCountTo(value, ms, 0);

// HUD total that rolls from the old total to the new one.
function RollingNumber({ value }: { value: number }) {
  return <>{useCountTo(value, 900, value)}</>;
}

function ScoreBreakdown({ score, seed }: { score: ScoreResult; seed: number }) {
  const total = useCountUp(score.total);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (total > 0 && total % 2 === 0) sfx.scoreTick();
  }, [total]);
  // When the count lands: win jingle + green flash (+ confetti), or buzzer + red flash + shake.
  useEffect(() => {
    const id = setTimeout(() => {
      scoreSound(score.total);
      if (score.total >= 50) {
        flash("#39ff14", 0.28);
        if (score.total >= 80) celebrate(score.total >= 95);
      } else {
        flash("#ff3355", 0.35);
        shake(score.total < 25 ? 12 : 7);
      }
    }, 1250);
    return () => clearTimeout(id);
  }, [score.total]);

  return (
    <div className="breakdown">
      <div className="total-score">
        <motion.span
          className={`total-number ${score.total >= 80 ? "hot" : score.total < 25 ? "cold" : ""}`}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.15, 1], opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {total}
        </motion.span>
        <span className="total-of">/ 100</span>
      </div>
      <motion.p
        className="verdict"
        initial={{ opacity: 0, scale: 2.2, rotate: -6 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 1.25, type: "spring", stiffness: 300, damping: 14 }}
      >
        {verdictFor(score.total, seed)}
      </motion.p>
      <div className="categories">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c, i) => (
          <div key={c} className="cat">
            <span className="cat-name">{CATEGORY_LABELS[c]}</span>
            <div className="cat-bar">
              <span
                style={{
                  width: filled ? `${(score.categories[c] / POINTS_PER_CATEGORY) * 100}%` : 0,
                  transitionDelay: `${i * 120}ms`,
                }}
              />
            </div>
            <span className="cat-points">
              {score.categories[c]}/{POINTS_PER_CATEGORY}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalTotal({ total, celebrateIt }: { total: number; celebrateIt: boolean }) {
  const shown = useCountUp(total, 1600);
  useEffect(() => {
    if (shown > 0 && shown % 5 === 0) sfx.scoreTick();
  }, [shown, total]);
  useEffect(() => {
    const id = setTimeout(() => {
      if (celebrateIt) {
        sfx.great();
        flash("#39ff14", 0.3);
        celebrate(true);
      } else sfx.good();
    }, 1650);
    return () => clearTimeout(id);
  }, [celebrateIt]);
  return <>{shown}</>;
}

// What the film reads from the game. Report-only hooks: gameplay, timing and scoring never depend on them.
export interface RecallRound {
  title: string;
  truth: string; // what was really in the scene, in words
  said: string;
  score: number;
}

export interface RecallFinish {
  score: number;
  max: number;
  best: number;
  bestLine: string;
  rounds: RecallRound[];
}

const roundReport = (r: RoundResult): RecallRound => ({
  title: r.target.title,
  truth: r.target.objects.map(describeObject).join(", "),
  said: r.said,
  score: r.score?.total ?? 0,
});

export default function RecallGame({
  onFinish,
  onRound,
  onPhase,
}: {
  onFinish?: (r: RecallFinish) => void;
  onRound?: (r: RecallRound, index: number, total: number) => void;
  onPhase?: (phase: string) => void;
} = {}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [rounds, setRounds] = useState<number>(5);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [description, setDescription] = useState("");
  const [phaseStart, setPhaseStart] = useState(0);
  const [now, setNow] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const seen = useRef(new Set<string>());
  const gameId = useRef(0);
  const descriptionRef = useRef(description);
  descriptionRef.current = description;

  useEffect(() => setBest(readBest(rounds, difficulty)), [rounds, difficulty]);

  // Tell the film which phase the game is in, so it can stay quiet during the timed ones.
  useEffect(() => onPhase?.(phase), [phase, onPhase]);

  // Report each round once, when its score (or its failure) is known.
  const reported = useRef(new Set<string>());
  useEffect(() => {
    if (!onRound) return;
    results.forEach((r, i) => {
      const key = `${gameId.current}:${i}`;
      const submitted = i < results.length - 1 || phase === "result" || phase === "final";
      const settled = !!r.score || !!r.error || !r.said;
      if (reported.current.has(key) || !submitted || !settled) return;
      reported.current.add(key);
      onRound(roundReport(r), i, rounds);
    });
  }, [results, phase, onRound, rounds]);

  // First visit: show How to Play before the first game.
  useEffect(() => {
    try {
      if (!localStorage.getItem("swys-tutorial-seen")) setTutorial(true);
    } catch {
      setTutorial(true);
    }
  }, []);
  const closeTutorial = () => {
    setTutorial(false);
    try {
      localStorage.setItem("swys-tutorial-seen", "1");
    } catch {}
  };

  const current = results[results.length - 1];
  const roundNumber = results.length;
  const runningTotal = results.reduce((sum, r) => sum + (r.score?.total ?? 0), 0);

  const flashSeconds = DIFFICULTIES[difficulty].flashSeconds;
  const phaseLength =
    phase === "ready" ? READY_SECONDS : phase === "flash" ? flashSeconds : phase === "describe" ? DESCRIBE_SECONDS : 0;
  const elapsed = Math.max(0, (now - phaseStart) / 1000);
  const remaining = Math.max(0, phaseLength - elapsed);

  const enter = (p: Phase) => {
    const t = performance.now();
    setPhaseStart(t);
    setNow(t);
    setPhase(p);
  };

  const updateRound = (game: number, index: number, patch: Partial<RoundResult>) => {
    if (game !== gameId.current) return; // a newer game started; drop stale responses
    setResults((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const startRound = () => {
    setDescription("");
    setResults((rs) => [...rs, { target: nextTarget(seen.current, difficulty), said: "", generated: null, score: null, error: "" }]);
    enter("ready");
  };

  const startGame = () => {
    gameId.current += 1;
    setResults([]);
    setNewBest(false);
    startRound();
  };

  const generate = (index: number, target: Scene, text: string) => {
    const game = gameId.current;
    updateRound(game, index, { error: "", generated: null, score: null });
    requestScenes(text, "recall")
      .then((scenes) => updateRound(game, index, { generated: scenes[0], score: scoreScenes(target, scenes[0]), offline: scenes.engine === "offline" }))
      .catch((err) => updateRound(game, index, { error: err.message }));
  };

  // Reads from a ref so the auto-submit at 0s gets the latest dictated text.
  const submit = () => {
    const text = descriptionRef.current.trim();
    const index = results.length - 1;
    const round = results[index];
    if (!round) return;
    updateRound(gameId.current, index, { said: text });
    enter("result");
    if (text) generate(index, round.target, text);
  };

  const finishGame = () => {
    const total = results.reduce((sum, r) => sum + (r.score?.total ?? 0), 0);
    if (total > best) {
      writeBest(rounds, difficulty, total);
      setBest(total);
      setNewBest(true);
    }
    setPhase("final");
    const top = results.reduce<RoundResult | null>((a, r) => (r.said && (!a || (r.score?.total ?? 0) > (a.score?.total ?? 0)) ? r : a), null);
    onFinish?.({ score: total, max: rounds * 100, best: Math.max(best, total), bestLine: top?.said ?? "", rounds: results.map(roundReport) });
  };

  // Sound cues: a beep per countdown number, ticks while describing, alarms in the last 5 seconds.
  const beat =
    phase === "ready" ? (remaining > LOOK_BEAT ? Math.ceil(remaining - LOOK_BEAT) : 0) : phase === "describe" ? Math.ceil(remaining) : -1;
  useEffect(() => {
    if (phase === "ready") {
      if (beat > 0) sfx.count();
      else {
        sfx.go();
        flash("#ff2bd6", 0.25, 250);
      }
    } else if (phase === "describe" && beat < DESCRIBE_SECONDS) {
      if (beat <= 5) {
        sfx.urgent();
        shake(3 + (5 - beat), 260);
      } else sfx.tick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, phase]);
  useEffect(() => {
    if (phase === "flash") {
      sfx.flash();
      flash("#ffffff", 0.75, 450);
    }
    if (phase === "result") sfx.submit();
  }, [phase]);

  // Drive the clock during timed phases and advance when each one runs out.
  useEffect(() => {
    if (phaseLength === 0) return;
    let raf = 0;
    const tick = (t: number) => {
      setNow(t);
      if ((t - phaseStart) / 1000 >= phaseLength) {
        if (phase === "ready") enter("flash");
        else if (phase === "flash") enter("describe");
        else if (phase === "describe") submit();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, phaseStart, phaseLength]);

  const hud = phase !== "pick" && phase !== "final" && (
    <div className="hud">
      <span>
        Round <strong>{roundNumber}</strong>/{rounds}
      </span>
      <span>{DIFFICULTIES[difficulty].label}</span>
      <span>
        Total <strong><RollingNumber value={runningTotal} /></strong>
      </span>
    </div>
  );

  if (phase === "pick" && tutorial) {
    return (
      <HowToPlay
        onClose={closeTutorial}
        onStart={() => {
          closeTutorial();
          startGame();
        }}
      />
    );
  }

  if (phase === "pick") {
    return (
      <div className="recall-card center">
        <h2>Pick a difficulty</h2>
        <p className="muted">
          The scene flashes, then disappears. You get {DESCRIBE_SECONDS} seconds to describe it.
        </p>
        <div className="difficulties">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button key={d} className={d === difficulty ? "diff active" : "diff"} onClick={() => setDifficulty(d)}>
              <strong>{DIFFICULTIES[d].label}</strong>
              <span>{DIFFICULTIES[d].flashSeconds}s look</span>
            </button>
          ))}
        </div>
        <div className="difficulties rounds">
          {ROUND_OPTIONS.map((n) => (
            <button key={n} className={n === rounds ? "diff active" : "diff"} onClick={() => setRounds(n)}>
              <strong>{n} rounds</strong>
              <span>out of {n * 100}</span>
            </button>
          ))}
        </div>
        <p className="muted best">Best: {best > 0 ? `${best} / ${rounds * 100}` : "none yet"}</p>
        <div className="row-end centered">
          <button className="ghost" onClick={() => setTutorial(true)}>
            How to play
          </button>
          <button className="primary" onClick={startGame}>
            Start
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <>
        {hud}
        <div className="recall-card center ready-card">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={beat}
              className={beat > 0 ? "big-count" : "big-count look"}
              initial={{ scale: 3, opacity: 0, rotate: beat > 0 ? -12 : 0 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
              {beat > 0 ? beat : "LOOK!"}
            </motion.div>
          </AnimatePresence>
          <p className="muted">Get ready to look…</p>
        </div>
      </>
    );
  }

  if (phase === "flash" && current) {
    return (
      <>
        {hud}
        <div className="recall-card">
          <div className="flash-bar">
            <span style={{ width: `${(remaining / flashSeconds) * 100}%` }} />
          </div>
          <SceneRenderer scene={current.target} time={elapsed} />
          <p className="muted center-text">Memorise it! {remaining.toFixed(1)}s</p>
        </div>
      </>
    );
  }

  if (phase === "describe") {
    const secs = Math.ceil(remaining);
    return (
      <>
        {hud}
        <div className={secs <= 5 ? "recall-card urgent-card" : "recall-card"}>
          <div className="describe-head">
            <h2>What did you see?</h2>
            <motion.div
              key={secs}
              className={secs <= 5 ? "timer urgent" : "timer"}
              initial={{ scale: secs <= 5 ? 1.6 : 1.25 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              {secs}
            </motion.div>
          </div>
          <div className="timer-bar">
            <span style={{ width: `${(remaining / DESCRIBE_SECONDS) * 100}%` }} />
          </div>
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
            placeholder="Things, colours, the backdrop, where everything was, how it moved…"
            rows={6}
          />
          <div className="row-end">
            <button className="primary" onClick={submit}>
              Submit
            </button>
          </div>
        </div>
      </>
    );
  }

  if (phase === "result" && current) {
    const { target, said, generated, score, error } = current;
    const lastRound = roundNumber >= rounds;
    const waiting = !!said && !score && !error;
    const highlightsTarget = score ? score.missed.map((id) => ({ id, colour: MISSED_COLOUR })) : [];
    const highlightsPlayer = score ? score.extra.map((id) => ({ id, colour: EXTRA_COLOUR })) : [];

    return (
      <>
        {hud}
        <div className="recall-card">
          <div className="result-grid">
            <div>
              <p className="label">The scene</p>
              <SceneRenderer scene={target} time={5} highlights={highlightsTarget} />
              {score && score.missed.length > 0 && (
                <p className="legend">
                  <span className="dot" style={{ background: MISSED_COLOUR }} /> Missed:{" "}
                  {score.missed
                    .map((id) => target.objects.find((o) => o.id === id))
                    .filter((o) => o)
                    .map((o) => describeObject(o!))
                    .join(", ")}
                </p>
              )}
            </div>
            <div>
              <p className="label">
                Your scene{current.offline && <span className="offline-badge">OFFLINE BUILD</span>}
              </p>
              {generated ? (
                <SceneRenderer scene={generated} time={5} highlights={highlightsPlayer} />
              ) : (
                <div className={!said || error ? "stage-placeholder" : "stage-placeholder reviewing"} role={!said || error ? undefined : "status"}>
                  {!said ? (
                    "Nothing to draw."
                  ) : error ? (
                    "Couldn't build your scene."
                  ) : (
                    <>
                      <span className="reel" aria-hidden />
                      <span className="reviewing-text">
                        The director is reviewing the footage<span className="dots" aria-hidden />
                      </span>
                    </>
                  )}
                </div>
              )}
              {score && score.extra.length > 0 && (
                <p className="legend">
                  <span className="dot" style={{ background: EXTRA_COLOUR }} /> Not in the original:{" "}
                  {score.extra
                    .map((id) => generated?.objects.find((o) => o.id === id))
                    .filter((o) => o)
                    .map((o) => describeObject(o!))
                    .join(", ")}
                </p>
              )}
              {error && <p className="error">{error}</p>}
            </div>
          </div>

          {score ? (
            <ScoreBreakdown score={score} seed={roundNumber + target.id.length} />
          ) : !said ? (
            <div className="breakdown">
              <div className="total-score">
                <span className="total-number">0</span>
                <span className="total-of">/ 100</span>
              </div>
              <p className="verdict">Nothing. Silence. Bold strategy.</p>
            </div>
          ) : waiting ? (
            <p className="muted center-text">Scoring…</p>
          ) : null}

          <p className="label" style={{ marginTop: 16 }}>
            You said
          </p>
          <blockquote className="said">{said || <em className="muted">…crickets…</em>}</blockquote>

          <div className="row-end">
            {error && (
              <button className="ghost" onClick={() => generate(roundNumber - 1, target, said)}>
                Retry
              </button>
            )}
            {lastRound ? (
              <button className="primary" onClick={finishGame} disabled={waiting}>
                See final score
              </button>
            ) : (
              <button className="primary" onClick={startRound} disabled={waiting}>
                Next round
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  if (phase === "final") {
    const max = rounds * 100;
    return (
      <div className="recall-card center">
        <p className="label">Final score</p>
        <div className="total-score">
          <span className="total-number">
            <FinalTotal total={runningTotal} celebrateIt={newBest} />
          </span>
          <span className="total-of">/ {max}</span>
        </div>
        {newBest ? <p className="new-best">New best!</p> : <p className="muted">Best: {best} / {max}</p>}
        <p className="verdict">{verdictFor(Math.round((runningTotal / max) * 100), runningTotal)}</p>
        <div className="round-list">
          {results.map((r, i) => (
            <div key={i} className="round-row">
              <span className="muted">Round {i + 1}</span>
              <span className="round-title">{r.target.title}</span>
              <strong>{r.score?.total ?? 0}</strong>
            </div>
          ))}
        </div>
        <div className="row-end centered end-actions">
          <Link href="/" className="ghost" data-nosfx onClick={() => sfx.back()}>
            ◄ Home
          </Link>
          <button className="ghost" onClick={() => setPhase("pick")}>
            Change settings
          </button>
          <button className="primary" onClick={startGame}>
            Play again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
