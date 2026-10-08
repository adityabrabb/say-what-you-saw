"use client";

import { useState } from "react";
import Player from "./Player";
import { requestEdit, requestScenes } from "@/lib/api";
import { solarSystem } from "@/lib/examples";
import type { Video } from "@/lib/scene";
import { sfx } from "@/lib/sound";

interface HistoryEntry {
  instruction: string;
  summary: string;
  changes: string[];
  before: Video; // snapshot to restore on undo
  beforeScene: number;
}

export default function Studio() {
  const [video, setVideo] = useState<Video>(solarSystem);
  const [version, setVersion] = useState(0);
  const [startScene, setStartScene] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Swap in a new video and remount the player so it replays from the given scene.
  const show = (next: Video, scene: number) => {
    setVideo(next);
    setStartScene(Math.min(scene, next.scenes.length - 1));
    setVersion((v) => v + 1);
  };

  const generate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    try {
      const scenes = await requestScenes(text, "studio");
      show({ title: text, scenes }, 0);
      sfx.magic();
      setHistory([]); // edits belong to the previous video
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      sfx.error();
    } finally {
      setLoading(false);
    }
  };

  const edit = async () => {
    const text = instruction.trim();
    if (!text || editing) return;
    setEditing(true);
    setEditError("");
    try {
      const result = await requestEdit(video, text, currentScene);
      setHistory((h) => [
        { instruction: text, summary: result.summary, changes: result.changes, before: video, beforeScene: currentScene },
        ...h,
      ]);
      setInstruction("");
      show(result.video, result.scenes[0] ?? currentScene);
      sfx.magic();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Edit failed");
      sfx.error();
    } finally {
      setEditing(false);
    }
  };

  const undo = () => {
    const [last, ...rest] = history;
    if (!last) return;
    setHistory(rest);
    show(last.before, last.beforeScene);
    sfx.back();
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
      <Player key={version} video={video} startScene={startScene} onSceneChange={setCurrentScene} />

      <div className="edit-panel">
        <p className="label">Edit by voice</p>
        <div className="edit-row">
          <input
            className="edit-input"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") edit();
            }}
            placeholder={`e.g. "make the moon smaller", "slow down the earth", "add a label saying umbra"`}
            disabled={editing}
          />
          <button className="primary" onClick={edit} disabled={editing || !instruction.trim()}>
            {editing ? "Editing…" : "Apply"}
          </button>
          <button className="ghost" data-nosfx onClick={undo} disabled={history.length === 0 || editing}>
            Undo
          </button>
        </div>
        {editError && <p className="error">{editError}</p>}

        {history.length > 0 && (
          <ol className="history">
            {history.map((h, i) => (
              <li key={history.length - i} className={i === 0 ? "latest" : undefined}>
                <p className="history-instruction">“{h.instruction}”</p>
                <p className="history-summary">{h.summary}</p>
                <ul className="history-changes">
                  {h.changes.slice(0, 6).map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                  {h.changes.length > 6 && <li className="muted">+{h.changes.length - 6} more</li>}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
