"use client";

import { useEffect, useRef } from "react";
import { host } from "@/lib/roast/host";
import type { SceneId } from "@/lib/film";

// The director notices two things, and only two: you leaving the tab and you going quiet. Everything
// is local (no model) and rate limited so it never nags. `enabled` is false whenever the game needs
// quiet (Recall's timed phases, the opening, Act III): nothing fires then.

const GAP_MS = 8000; // minimum gap between any two reactions

// `idleHold`: the game is working (scoring a round), so the player isn't idle, the app is.
export function useFourthWall(enabled: boolean, _scene: SceneId, idleHold = false) {
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
    const last: Record<string, number> = {};
    let lastAny = 0;
    const fire = (key: string, text: string, cooldown: number) => {
      const now = Date.now();
      if (!on.current || now - lastAny < GAP_MS || now - (last[key] ?? 0) < cooldown) return false;
      last[key] = lastAny = now;
      host.say(text, "react");
      return true;
    };

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

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", touch, { passive: true });
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    window.addEventListener("input", touch, true);
    window.addEventListener("wheel", touch, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    return () => {
      clearInterval(idle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", touch);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("input", touch, true);
      window.removeEventListener("wheel", touch);
      window.removeEventListener("touchstart", touch);
    };
  }, []);
}
