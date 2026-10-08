"use client";

import { useEffect, useRef, useState } from "react";
import SceneRenderer from "./SceneRenderer";
import { requestScenes } from "@/lib/api";
import { DESCRIBE_SECONDS, DIFFICULTIES, recallPool, type Difficulty } from "@/lib/recallPool";
import type { Scene } from "@/lib/scene";

type Phase = "pick" | "ready" | "flash" | "describe" | "result";

const READY_SECONDS = 3;

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

export default function RecallGame() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [target, setTarget] = useState<Scene | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [round, setRound] = useState(0);
  const [phaseStart, setPhaseStart] = useState(0);
  const [now, setNow] = useState(0);
  const [generated, setGenerated] = useState<Scene | null>(null);
  const [genError, setGenError] = useState("");
  const seen = useRef(new Set<string>());
  const roundRef = useRef(0);
  const descriptionRef = useRef(description);
  descriptionRef.current = description;

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

  const startRound = () => {
    setTarget(nextTarget(seen.current));
    setDescription("");
    setSubmitted("");
    setGenerated(null);
    setGenError("");
    roundRef.current += 1;
    setRound(roundRef.current);
    enter("ready");
  };

  // Reads from a ref so the auto-submit at 0s gets the latest dictated text.
  const submit = () => {
    const text = descriptionRef.current.trim();
    setSubmitted(text);
    enter("result");
    if (!text) return;
    const thisRound = roundRef.current;
    requestScenes(text, "recall")
      .then((scenes) => thisRound === roundRef.current && setGenerated(scenes[0]))
      .catch((err) => thisRound === roundRef.current && setGenError(err.message));
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
        <button className="primary" onClick={startRound}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="recall-card center">
        <p className="muted">
          Round {round} · {DIFFICULTIES[difficulty].label}
        </p>
        <div className="big-count" key={Math.ceil(remaining)}>
          {Math.ceil(remaining)}
        </div>
        <p className="muted">Get ready to look…</p>
      </div>
    );
  }

  if (phase === "flash" && target) {
    return (
      <div className="recall-card">
        <div className="flash-bar">
          <span style={{ width: `${(remaining / flashSeconds) * 100}%` }} />
        </div>
        <SceneRenderer scene={target} time={elapsed} />
        <p className="muted center-text">Memorise it! {remaining.toFixed(1)}s</p>
      </div>
    );
  }

  if (phase === "describe") {
    const secs = Math.ceil(remaining);
    return (
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
    );
  }

  if (phase === "result" && target) {
    return (
      <div className="recall-card">
        <h2>Round {round} result</h2>
        <div className="result-grid">
          <div>
            <p className="label">The scene</p>
            <SceneRenderer scene={target} time={5} />
            <p className="muted">{target.title}</p>
          </div>
          <div>
            <p className="label">Your scene</p>
            {generated ? (
              <SceneRenderer scene={generated} time={5} />
            ) : (
              <div className="stage-placeholder">
                {!submitted ? "Nothing to draw." : genError ? "Couldn't build your scene." : <span className="spinner" />}
              </div>
            )}
            {genError && <p className="error">{genError}</p>}
          </div>
        </div>
        <p className="label" style={{ marginTop: 16 }}>You said</p>
        <blockquote className="said">
          {submitted || <em className="muted">Nothing. Silence. Bold strategy.</em>}
        </blockquote>
        <div className="row-end">
          <button className="ghost" onClick={() => setPhase("pick")}>
            Change difficulty
          </button>
          <button className="primary" onClick={startRound}>
            Next round
          </button>
        </div>
      </div>
    );
  }

  return null;
}
