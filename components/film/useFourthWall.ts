"use client";

import { useEffect, useRef } from "react";
import { host } from "@/lib/roast/host";
import type { SceneId } from "@/lib/film";

// The director breaks the fourth wall. Everything here is local (no model) and rate limited so it
// never nags. `enabled` is false whenever the game needs quiet (Recall's timed phases, the opening,
// Act III): nothing fires then.

const GAP_MS = 8000; // minimum gap between any two reactions

const hourLine = (d: Date) => {
  const h = d.getHours();
  const time = d.toLocaleTimeString([], { hour: "numeric" }); // "2 AM"
  if (h < 5) return `It's ${time} and you're still playing this. Respect.`;
  if (h < 12) return `It's ${time}. Directing before noon. Brave.`;
  if (h < 18) return `It's ${time}. A matinee. Nobody comes to matinees. Except you.`;
  return `It's ${time}. Prime time. Try to deserve it.`;
};

// `idleHold`: the game is working (scoring a round), so the player isn't idle, the app is.
export function useFourthWall(enabled: boolean, scene: SceneId, idleHold = false) {
  const on = useRef(enabled);
  on.current = enabled;
  const hold = useRef(idleHold);
  hold.current = idleHold;
  const lastInput = useRef(Date.now());
  const idleFired = useRef(false);

  // Coming back from quiet time: the idle clock starts fresh.
  useEffect(() => {
    if (enabled) {
      lastInput.current = Date.now();
      idleFired.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    const born = Date.now();
    const last: Record<string, number> = {};
    let lastAny = 0;
    const fire = (key: string, text: string, cooldown: number) => {
      const now = Date.now();
      if (!on.current || now - lastAny < GAP_MS || now - (last[key] ?? 0) < cooldown) return false;
      last[key] = lastAny = now;
      host.say(text, "react");
      return true;
    };
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    // Came back from another tab
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 4000) fire("away", "Where did you go? The scene is still running.", 60_000);
    };

    // Idle for 20 seconds
    const touch = () => {
      lastInput.current = Date.now();
      idleFired.current = false;
    };
    const idle = setInterval(() => {
      if (hold.current) touch();
      else if (on.current && !idleFired.current && Date.now() - lastInput.current >= 20_000 && !document.hidden) {
        idleFired.current = fire("idle", "Hello? Is the talent asleep?", 45_000);
      }
    }, 1000);

    // Touching the set: resizing the window (not mobile toolbars, not the first seconds)
    let size = { w: window.innerWidth, h: window.innerHeight };
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (coarse || Date.now() - born < 4000) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const moved = Math.abs(window.innerWidth - size.w) > 60 || Math.abs(window.innerHeight - size.h) > 60;
        size = { w: window.innerWidth, h: window.innerHeight };
        if (moved) fire("resize", "Stop touching the set.", 45_000);
      }, 700);
    };

    // Mouse heading for the top-left corner (the back button): leaving already?
    let prev = { x: 9999, y: 9999 };
    const onMove = (e: PointerEvent) => {
      touch();
      if (e.pointerType !== "mouse") return;
      const heading = e.clientX < 90 && e.clientY < 90 && e.clientX + e.clientY < prev.x + prev.y;
      prev = { x: e.clientX, y: e.clientY };
      if (heading && !(e.target as Element | null)?.closest?.("button,a,input,textarea,select")) fire("corner", "Leaving already? Coward.", 60_000);
    };
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 4 && e.clientX < 240 && !e.relatedTarget) fire("corner", "Leaving already? Coward.", 60_000);
    };

    // Copying text
    const onCopy = () => {
      const sel = window.getSelection()?.toString() ?? "";
      const field = document.activeElement as HTMLInputElement | null;
      const inField = field && typeof field.selectionStart === "number" && field.selectionStart !== field.selectionEnd;
      if (sel.trim() || inField) fire("copy", "Stealing evidence?", 30_000);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    window.addEventListener("input", touch, true);
    window.addEventListener("wheel", touch, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("copy", onCopy);
    return () => {
      clearInterval(idle);
      clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("input", touch, true);
      window.removeEventListener("wheel", touch);
      window.removeEventListener("touchstart", touch);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("copy", onCopy);
    };
  }, []);

  // The clock, once per visit: a few seconds into the memory game, whenever it's quiet enough to say.
  useEffect(() => {
    if (scene !== "act1") return;
    try {
      if (sessionStorage.getItem("swys-clock-said") === "1") return;
    } catch {}
    const born = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - born < 3500 || !on.current) return;
      clearInterval(poll);
      try {
        sessionStorage.setItem("swys-clock-said", "1");
      } catch {}
      host.say(hourLine(new Date()), "react");
    }, 1000);
    return () => clearInterval(poll);
  }, [scene]);
}
