"use client";

import { useState } from "react";
import Player from "./Player";
import { requestScenes } from "@/lib/api";
import { solarSystem } from "@/lib/examples";
import type { Video } from "@/lib/scene";

export default function Studio() {
  const [video, setVideo] = useState<Video>(solarSystem);
  const [version, setVersion] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    try {
      const scenes = await requestScenes(text, "studio");
      setVideo({ title: text, scenes });
      setVersion((v) => v + 1); // remount the player so it restarts from 0
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="studio-input">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate();
          }}
          placeholder="Explain something… e.g. The earth goes around the sun, the moon goes around the earth, that's why we get eclipses."
          rows={3}
        />
        <div className="row-end">
          {error && <p className="error grow">{error}</p>}
          <button className="primary" onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
      <p className="muted now-playing">{video.title}</p>
      <Player key={version} video={video} />
    </>
  );
}
