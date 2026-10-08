"use client";

import { useEffect, useRef, useState } from "react";
import SceneRenderer from "./SceneRenderer";
import { requestScenes } from "@/lib/api";
import { DESCRIBE_SECONDS, DIFFICULTIES, recallPool, type Difficulty } from "@/lib/recallPool";
import { CATEGORY_LABELS, POINTS_PER_CATEGORY, scoreScenes, verdictFor, type Category, type ScoreResult } from "@/lib/score";
import type { Scene } from "@/lib/scene";

type Phase = "pick" | "ready" | "flash" | "describe" | "result" | "final";

interface RoundResult {
  target: Scene;
  said: string;
  generated: Scene | null;
  score: ScoreResult | null;
  error: string;
}

const READY_SECONDS = 3;
const ROUND_OPTIONS = [3, 5] as const;
const MISSED_COLOUR = "#E5484D";
const EXTRA_COLOUR = "#F5C518";

// Pick a target not seen yet this session; reshuffle once the pool runs out.
function nextTarget(seen: Set<string>): Scene {
  let fresh = recallPool.filter((s) => !seen.has(s.id));
  if (fresh.length === 0) {
    seen.clear();
    fresh = recallPool;
  }
  const pick = fresh[Math.floor(Math.random() * fresh.length)];
  seen.add(pick.id);
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

// Animate a number from 0 up to `value`.
function useCountUp(value: number, ms = 1200): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function ScoreBreakdown({ score, seed }: { score: ScoreResult; seed: number }) {
  const total = useCountUp(score.total);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="breakdown">
      <div className="total-score">
        <span className="total-number">{total}</span>
        <span className="total-of">/ 100</span>
      </div>
      <p className="verdict">{verdictFor(score.total, seed)}</p>
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

function FinalTotal({ total }: { total: number }) {
  return <>{useCountUp(total, 1600)}</>;
}

export default function RecallGame() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [rounds, setRounds] = useState<number>(5);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [description, setDescription] = useState("");
  const [phaseStart, setPhaseStart] = useState(0);
  const [now, setNow] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const seen = useRef(new Set<string>());
  const gameId = useRef(0);
  const descriptionRef = useRef(description);
  descriptionRef.current = description;

  useEffect(() => setBest(readBest(rounds, difficulty)), [rounds, difficulty]);

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
    setResults((rs) => [...rs, { target: nextTarget(seen.current), said: "", generated: null, score: null, error: "" }]);
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
      .then((scenes) => updateRound(game, index, { generated: scenes[0], score: scoreScenes(target, scenes[0]) }))
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
  };

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
        Total <strong>{runningTotal}</strong>
      </span>
    </div>
  );

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
        <button className="primary" onClick={startGame}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <>
        {hud}
        <div className="recall-card center">
          <div className="big-count" key={Math.ceil(remaining)}>
            {Math.ceil(remaining)}
          </div>
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
        <div className="recall-card">
          <div className="describe-head">
            <h2>What did you see?</h2>
            <div className={secs <= 5 ? "timer urgent" : "timer"}>{secs}</div>
          </div>
          <div className="timer-bar">
            <span style={{ width: `${(remaining / DESCRIBE_SECONDS) * 100}%` }} />
          </div>
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shapes, colours, where things were, how they moved…"
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
                  <span className="dot" style={{ background: MISSED_COLOUR }} /> You missed {score.missed.length}
                </p>
              )}
            </div>
            <div>
              <p className="label">Your scene</p>
              {generated ? (
                <SceneRenderer scene={generated} time={5} highlights={highlightsPlayer} />
              ) : (
                <div className="stage-placeholder">
                  {!said ? "Nothing to draw." : error ? "Couldn't build your scene." : <span className="spinner" />}
                </div>
              )}
              {score && score.extra.length > 0 && (
                <p className="legend">
                  <span className="dot" style={{ background: EXTRA_COLOUR }} /> Not in the original: {score.extra.length}
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
            <FinalTotal total={runningTotal} />
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
        <div className="row-end centered">
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
