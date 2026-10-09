"use client";

import { useEffect, useRef, useState } from "react";
import { isRollCue } from "@/lib/film";
import { drone, filmSfx, projector } from "@/lib/sound";

type Beat = "black" | "flicker" | "leader" | "title";
const LEADER_MS = 900;

// Pure black until the viewer acts (browsers only allow sound after a gesture), then the projector
// clicks on, the light flickers up, a 5-to-1 leader counts down and the title card is lit from above.
export default function Opening({ onDone, reduced }: { onDone: () => void; reduced: boolean }) {
  const [beat, setBeat] = useState<Beat>("black");
  const [count, setCount] = useState(5);
  const started = useRef(false);

  const roll = () => {
    if (started.current) return;
    started.current = true;
    filmSfx.projectorClick();
    projector.start();
    drone.start();
    setBeat("flicker");
  };

  useEffect(() => {
    if (beat !== "black") return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Tab") roll();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [beat]);

  useEffect(() => {
    if (beat === "flicker") {
      const t = setTimeout(() => setBeat("leader"), reduced ? 300 : 1500);
      return () => clearTimeout(t);
    }
    if (beat === "leader") {
      filmSfx.leader(count);
      const t = setTimeout(() => {
        if (count > 1) setCount(count - 1);
        else {
          projector.level(0.45);
          setBeat("title");
        }
      }, LEADER_MS);
      return () => clearTimeout(t);
    }
  }, [beat, count, reduced]);

  if (beat === "black") {
    return (
      <button className="film-black" onClick={roll} aria-label="Start the film">
        <span className="film-black-hint">click anywhere · or press any key · to roll the film</span>
      </button>
    );
  }

  return (
    <div className={`letterbox ${beat === "flicker" ? "flickering" : ""}`}>
      <div className="frame">
        {beat === "flicker" && <div className="projector-light" aria-hidden />}
        {beat === "leader" && <Leader n={count} />}
        {beat === "title" && <div className="synth-floor" aria-hidden />}
        {beat === "title" && <TitleCard onRoll={onDone} />}
      </div>
    </div>
  );
}

function Leader({ n }: { n: number }) {
  return (
    <div className="leader" role="img" aria-label={`Countdown ${n}`}>
      <div className="leader-dial">
        <div className="leader-sweep" key={n} />
        <span className="leader-ring outer" />
        <span className="leader-ring inner" />
        <span className="leader-cross" />
        <span className="leader-num">{n}</span>
      </div>
    </div>
  );
}

function TitleCard({ onRoll }: { onRoll: () => void }) {
  const [line, setLine] = useState("");
  const [miss, setMiss] = useState("");
  const [rolling, setRolling] = useState(false);

  const go = () => {
    if (rolling) return;
    setRolling(true);
    filmSfx.accept();
    projector.stop(1.6);
    setTimeout(onRoll, 500);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!line.trim() || isRollCue(line)) go();
    else {
      filmSfx.nope();
      setMiss(`“${line.trim()}” isn't a cue. Try “roll camera” or “action”.`);
      setLine("");
    }
  };

  // Dictation lands without an Enter key, so check the cue as the text arrives.
  useEffect(() => {
    if (line.trim().split(/\s+/).length >= 2 && isRollCue(line)) {
      const t = setTimeout(go, 600);
      return () => clearTimeout(t);
    }
  });

  return (
    <div className="title-stage">
      <div className="spot-lamp" aria-hidden />
      <div className="spot-beam" aria-hidden />
      <div className="floor-pool" aria-hidden>
        <span className="floor-shadow">Say What You Saw</span>
      </div>
      <h1 className="film-title">Say What You Saw</h1>
      <p className="film-kicker">a short film · starring you · directed by your voice</p>

      <form className="direction-box" onSubmit={submit}>
        <label className="direction-label" htmlFor="roll-line">
          Direction
        </label>
        <div className="direction-row">
          <input
            id="roll-line"
            className="direction-input"
            value={line}
            onChange={(e) => {
              setLine(e.target.value);
              setMiss("");
            }}
            placeholder="Say “roll camera” to begin"
            autoComplete="off"
            autoFocus
          />
          <button type="button" className="film-btn" onClick={go} disabled={rolling}>
            Roll camera ▸
          </button>
        </div>
        <p className="direction-hint" aria-live="polite">
          {miss || "Dictate it with Wispr Flow, type it, or just press the button."}
        </p>
      </form>
    </div>
  );
}
