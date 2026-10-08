"use client";

import { useEffect, useRef, useState } from "react";
import SceneRenderer from "./SceneRenderer";
import { locate } from "@/lib/engine";
import type { Video } from "@/lib/scene";

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

interface PlayerProps {
  video: Video;
  startScene?: number; // begin playback at this scene (e.g. the one just edited)
  onSceneChange?: (index: number) => void;
}

export default function Player({ video, startScene = 0, onSceneChange }: PlayerProps) {
  const durations = video.scenes.map((s) => s.duration);
  const total = durations.reduce((a, b) => a + b, 0);
  const [time, setTime] = useState(() => durations.slice(0, startScene).reduce((a, b) => a + b, 0));
  const [playing, setPlaying] = useState(true);
  const last = useRef<number | null>(null);

  // Advance the clock while playing; stop at the end.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000;
      last.current = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing, total]);

  const toggle = () => {
    if (!playing && time >= total) setTime(0);
    setPlaying((p) => !p);
  };

  // Space bar toggles play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const { index, local } = locate(durations, time);
  useEffect(() => onSceneChange?.(index), [index, onSceneChange]);
  const scene = video.scenes[index];
  const sceneStarts = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="player">
      <SceneRenderer scene={scene} time={local} />
      {scene.caption && <p className="caption">{scene.caption}</p>}

      <div className="controls">
        <button className="play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="scrubber">
          <input
            type="range"
            min={0}
            max={total}
            step={0.01}
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
            aria-label="Scrub timeline"
          />
          <div className="ticks">
            {sceneStarts.map((start, i) => (
              <span key={i} style={{ left: `${(start / total) * 100}%` }} />
            ))}
          </div>
        </div>
        <span className="time">
          {fmt(time)} / {fmt(total)}
        </span>
      </div>

      <div className="scenes">
        {video.scenes.map((s, i) => (
          <button key={s.id} className={i === index ? "chip active" : "chip"} onClick={() => setTime(sceneStarts[i])}>
            {i + 1}. {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}
