"use client";

import { motion, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Shatter from "./Shatter";
import { sfx } from "@/lib/sound";

const LINES = ["SAY WHAT", "YOU SAW"];

const letterHover: Variants = {
  rest: { y: 0 },
  hover: (i: number) => ({
    y: [0, -22, 0, -8, 0],
    transition: { duration: 0.6, delay: i * 0.03, ease: "easeOut" },
  }),
};

function Title({ still }: { still?: boolean }) {
  let n = 0;
  const lines = LINES.map((line, li) => (
    <span key={li} className="title-line">
      {line.split("").map((ch) => {
        const i = n++;
        return (
          <motion.span key={i} className="title-letter" custom={i} variants={still ? undefined : letterHover}>
            {ch === " " ? " " : ch}
          </motion.span>
        );
      })}
    </span>
  ));

  if (still) return <h1 className="title">{lines}</h1>;

  // Outer: roll in from deep space. Middle: idle float. Inner: hover glow + letter bounce.
  return (
    <div className="title-stage">
      <motion.div
        initial={{ scale: 0.04, rotateX: 720, rotateY: -200, rotateZ: -40, opacity: 0, z: -800 }}
        animate={{ scale: 1, rotateX: 0, rotateY: 0, rotateZ: 0, opacity: 1, z: 0 }}
        transition={{ duration: 2.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <motion.div
          animate={{ y: [0, -10, 0], rotateY: [-6, 6, -6], rotateX: [4, -2, 4] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2.1 }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <motion.h1
            className="title"
            initial="rest"
            animate="rest"
            whileHover="hover"
            whileTap={{ scale: 0.95 }}
            onHoverStart={() => sfx.hover()}
          >
            {lines}
          </motion.h1>
        </motion.div>
      </motion.div>
    </div>
  );
}

type Mode = "recall" | "studio";

function Content({ still, onPick }: { still?: boolean; onPick?: (mode: Mode, e: React.MouseEvent) => void }) {
  const button = (mode: Mode, label: string, sub: string, delay: number) => (
    <motion.button
      className={`arcade-btn ${mode === "recall" ? "pink" : "cyan"}`}
      onClick={(e) => onPick?.(mode, e)}
      onMouseEnter={() => !still && sfx.hover()}
      initial={still ? false : { opacity: 0, y: 60, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={still ? undefined : { y: -6, scale: 1.03 }}
      whileTap={still ? undefined : { y: 4, scale: 0.98 }}
      tabIndex={still ? -1 : undefined}
    >
      <span className="btn-cap">{label}</span>
      <span className="btn-sub">{sub}</span>
    </motion.button>
  );

  return (
    <main className="landing" data-nosfx>
      <Title still={still} />
      <motion.p
        className="tagline"
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.6 }}
      >
        SPEAK IT · SEE IT · SCORE IT
      </motion.p>
      <div className="modes">
        {button("recall", "RECALL", "A scene flashes. Say what you saw. Get scored.", 1.8)}
        {button("studio", "STUDIO", "Describe anything. Watch it come alive. Edit by voice.", 1.95)}
      </div>
      <p className="insert-coin">PRESS A BUTTON TO START</p>
    </main>
  );
}

export default function Landing() {
  const router = useRouter();
  const [shatter, setShatter] = useState<{ mode: Mode; origin: { x: number; y: number } } | null>(null);

  useEffect(() => {
    router.prefetch("/recall");
    router.prefetch("/studio");
  }, [router]);

  const pick = (mode: Mode, e: React.MouseEvent) => {
    if (shatter) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sfx.click();
      router.push(`/${mode}`);
      return;
    }
    sfx.shatter();
    // Keyboard activation has no pointer position; break from the button's centre instead.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const origin = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setShatter({ mode, origin });
  };

  const done = useCallback(() => {
    if (shatter) router.push(`/${shatter.mode}`);
  }, [router, shatter]);

  return (
    <>
      <div style={{ visibility: shatter ? "hidden" : "visible" }}>
        <Content onPick={pick} />
      </div>
      {shatter && (
        <Shatter origin={shatter.origin} onDone={done}>
          <Content still />
        </Shatter>
      )}
    </>
  );
}
