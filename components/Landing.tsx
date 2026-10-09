"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flash } from "@/lib/fx";
import { sfx } from "@/lib/sound";

// three.js only loads in the browser, after the landing has painted.
const NeonMoon = dynamic(() => import("./NeonMoon"), { ssr: false });

const LINES = ["SAY WHAT", "YOU SAW"];
const POWER_OFF_MS = 420;

// Mouse-follow tilt: writes CSS variables directly, so moving the pointer never re-renders React.
function tiltHandlers(max: number) {
  return {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      e.currentTarget.style.setProperty("--ry", `${x * max}deg`);
      e.currentTarget.style.setProperty("--rx", `${-y * max}deg`);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.style.setProperty("--ry", "0deg");
      e.currentTarget.style.setProperty("--rx", "0deg");
    },
  };
}

type Mode = "recall" | "director";

export default function Landing() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    router.prefetch("/recall");
    router.prefetch("/director");
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  const pick = (mode: Mode) => {
    if (leaving) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sfx.click();
      router.push(`/${mode}`);
      return;
    }
    // CRT power-off: the screen squashes to a glowing line, then to nothing.
    sfx.powerOff();
    flash(mode === "recall" ? "#ff2bd6" : "#00f0ff", 0.35, 300);
    setLeaving(true);
    timer.current = setTimeout(() => router.push(`/${mode}`), POWER_OFF_MS);
  };

  let n = 0;
  return (
    <main className={leaving ? "landing powering-off" : "landing"} data-nosfx>
      <div className="hero">
        <NeonMoon />
        <div className="title-float">
          <h1 className="title tilt" onPointerEnter={() => sfx.hover()} {...tiltHandlers(14)}>
            {LINES.map((line, li) => (
              <span key={li} className="title-line">
                {line.split("").map((ch) => {
                  const i = n++;
                  return (
                    <span key={i} className="title-letter" style={{ "--i": i } as React.CSSProperties}>
                      {ch === " " ? " " : ch}
                    </span>
                  );
                })}
              </span>
            ))}
          </h1>
        </div>
      </div>
      <p className="tagline">SPEAK IT · SEE IT · SCORE IT</p>
      <div className="modes">
        <button className="arcade-btn pink tilt" style={{ animationDelay: "1.1s" }} onClick={() => pick("recall")} onPointerEnter={() => sfx.hover()} {...tiltHandlers(10)}>
          <span className="btn-cap">RECALL</span>
          <span className="btn-sub">A scene flashes. Say what you saw. Get scored.</span>
        </button>
        <button className="arcade-btn cyan tilt" style={{ animationDelay: "1.25s" }} onClick={() => pick("director")} onPointerEnter={() => sfx.hover()} {...tiltHandlers(10)}>
          <span className="btn-cap">DIRECTOR</span>
          <span className="btn-sub">Step into the shot. Direct the scene, light and look with your voice.</span>
        </button>
      </div>
      <p className="insert-coin">PRESS A BUTTON TO START</p>
    </main>
  );
}
