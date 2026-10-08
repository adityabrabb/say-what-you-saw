"use client";

import { useEffect, useState } from "react";
import { isMuted, onMuteChange, setMuted, sfx } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setState] = useState(false);
  useEffect(() => {
    setState(isMuted());
    return onMuteChange(setState);
  }, []);

  // Every button blips on hover and click, unless it brings its own sound (data-nosfx).
  useEffect(() => {
    let lastHover: Element | null = null;
    const target = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("button");
      return el && !el.hasAttribute("disabled") && !el.closest("[data-nosfx]") ? el : null;
    };
    const over = (e: Event) => {
      const el = target(e);
      if (el && el !== lastHover) sfx.hover();
      lastHover = el;
    };
    const click = (e: Event) => target(e) && sfx.click();
    document.addEventListener("mouseover", over);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("click", click);
    };
  }, []);

  return (
    <button
      className="sound-toggle"
      data-nosfx
      onClick={() => {
        setMuted(!muted);
        if (muted) sfx.click();
      }}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Sound off" : "Sound on"}
    >
      {muted ? "♪̸ OFF" : "♪ ON"}
    </button>
  );
}
