"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SceneId } from "@/lib/film";
import { printDetectiveNote } from "@/lib/roast/console";
import { host, type HostLine } from "@/lib/roast/host";
import { useFourthWall } from "./useFourthWall";

// The director's presence: the typewriter subtitle, the fourth-wall reactions and the right-click
// "action" menu. It reads the one host queue and never touches the game.

function Line({ line, reduced, scene }: { line: HostLine; reduced: boolean; scene: SceneId }) {
  const [typed, setTyped] = useState(reduced ? line.text.length : 0);
  const done = typed >= line.text.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setTyped((n) => n + 1), line.kind === "interrupt" ? 26 : 32);
    return () => clearTimeout(t);
  }, [typed, done, line.kind]);

  // Read, then held a moment (longer for longer lines) before the next one. Text only: the director has no voice.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => host.next(line.id), 1700 + line.text.length * 30);
    return () => clearTimeout(t);
  }, [done, line.id, line.text.length]);

  return (
    <div className={`host-line ${line.kind} in-${scene}`} role="status" aria-label={`The director: ${line.text}`}>
      <span className="host-tag" aria-hidden>
        {line.kind === "interrupt" && <i className="host-siren" />}
        THE DIRECTOR
      </span>
      <span className="host-text" aria-hidden>
        {line.text.slice(0, typed)}
        {!done && <span className="caret" />}
      </span>
    </div>
  );
}

interface Props {
  scene: SceneId;
  reduced: boolean;
  reactions: boolean; // false during quiet time
  idleHold: boolean; // the game is scoring: the player isn't idle
  soundMuted: boolean;
  onToggleSound: () => void;
  onSelectScene: () => void;
  onRetake?: () => void;
}

export default function DirectorHost({ scene, reduced, reactions, idleHold, soundMuted, onToggleSound, onSelectScene, onRetake }: Props) {
  useSyncExternalStore(host.subscribe, host.getVersion, () => 0);
  useFourthWall(reactions, scene, idleHold);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => printDetectiveNote(), []);

  // A film-style context menu, except where the browser's own is useful (text fields) or on touch.
  useEffect(() => {
    if (scene === "opening") return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onContext = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (coarse || el?.closest("input,textarea,select,[contenteditable='true']")) return;
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", onContext);
    return () => document.removeEventListener("contextmenu", onContext);
  }, [scene]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
        e.preventDefault();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    window.addEventListener("scroll", close, true);
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const pick = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };
  // Keep the menu inside the viewport
  const pos = menu && { left: Math.min(menu.x, window.innerWidth - 236), top: Math.min(menu.y, window.innerHeight - 220) };

  return (
    <>
      {host.line && <Line key={host.line.id} line={host.line} reduced={reduced} scene={scene} />}
      {menu && pos && (
        <div className="ctx-menu" role="menu" aria-label="Action menu" style={pos} ref={menuRef} onContextMenu={(e) => e.preventDefault()}>
          <p className="ctx-head">ACTION</p>
          {onRetake && (
            <button role="menuitem" onClick={pick(onRetake)}>
              Retake this act
            </button>
          )}
          <button role="menuitem" onClick={pick(onSelectScene)}>
            Select scene…
          </button>
          <button role="menuitem" onClick={pick(onToggleSound)}>
            Sound: {soundMuted ? "off" : "on"}
          </button>
        </div>
      )}
    </>
  );
}
