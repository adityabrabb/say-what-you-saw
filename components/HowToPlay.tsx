"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import SceneRenderer from "./SceneRenderer";
import { mediumPool } from "@/lib/recallPool";
import { CATEGORY_LABELS } from "@/lib/score";
import { sfx } from "@/lib/sound";

const DEMO_SCENE = mediumPool[0]; // dog chasing a football in the park
const DEMO_TEXT = "a sunny park, a tree on the left, the sun top right, a dog running right after a football";
const DEMO_SCORES = [20, 18, 17, 19, 20];

// Loops the demo scene so step 1 shows exactly what a flash looks like.
function WatchDemo() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setT(((now - t0) / 1000) % 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="demo">
      <div className="flash-bar">
        <span style={{ width: `${(1 - t / 4) * 100}%` }} />
      </div>
      <SceneRenderer scene={DEMO_SCENE} time={t} />
    </div>
  );
}

// Types the sample answer out like live dictation.
function SayDemo() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v >= DEMO_TEXT.length + 25 ? 0 : v + 1)), 45);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(1, 30 - Math.floor(n / 6));
  return (
    <div className="demo">
      <div className="describe-head">
        <span className="label" style={{ margin: 0 }}>Hold your Wispr Flow key and talk</span>
        <div className="timer small">{secs}</div>
      </div>
      <div className="demo-terminal">
        {DEMO_TEXT.slice(0, n)}
        <span className="caret" />
      </div>
    </div>
  );
}

function ScoreDemo() {
  return (
    <div className="demo">
      <div className="categories">
        {Object.values(CATEGORY_LABELS).map((name, i) => (
          <div key={name} className="cat">
            <span className="cat-name">{name}</span>
            <div className="cat-bar">
              <span className="demo-fill" style={{ width: `${(DEMO_SCORES[i] / 20) * 100}%`, animationDelay: `${i * 0.15}s` }} />
            </div>
            <span className="cat-points">{DEMO_SCORES[i]}/20</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "1 · WATCH",
    text: "A scene flashes for 5, 3 or 2 seconds depending on difficulty. Memorise everything: what's there, colours, the backdrop, where things sit and how they move.",
    demo: <WatchDemo />,
  },
  {
    title: "2 · SAY IT",
    text: "The scene vanishes. You get 30 seconds to describe it from memory. Dictate it with Wispr Flow straight into the box. It auto-submits at zero (or press Ctrl+Enter).",
    demo: <SayDemo />,
  },
  {
    title: "3 · SCORE",
    text: "Your words are rebuilt into a scene and compared with the original, object by object, across five categories. Missed things get red rings. Beat your best!",
    demo: <ScoreDemo />,
  },
];

export default function HowToPlay({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const go = (to: number) => {
    sfx.click();
    setStep(to);
  };

  return (
    <div className="recall-card tutorial" data-nosfx>
      <div className="tutorial-head">
        <h2>HOW TO PLAY</h2>
        <div className="dots">
          {STEPS.map((_, i) => (
            <button key={i} className={i === step ? "dot-btn active" : "dot-btn"} onClick={() => go(i)} aria-label={`Step ${i + 1}`} />
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
          className="tutorial-step"
        >
          <div>
            <h3 className="step-title">{STEPS[step].title}</h3>
            <p className="step-text">{STEPS[step].text}</p>
          </div>
          {STEPS[step].demo}
        </motion.div>
      </AnimatePresence>
      <div className="row-end">
        <button className="ghost" onClick={() => (sfx.back(), onClose())}>
          Skip
        </button>
        {step > 0 && (
          <button className="ghost" onClick={() => go(step - 1)}>
            Back
          </button>
        )}
        {last ? (
          <button className="primary" onClick={() => (sfx.go(), onStart())}>
            Start game
          </button>
        ) : (
          <button className="primary" onClick={() => go(step + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
