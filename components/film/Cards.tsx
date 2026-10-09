"use client";

import { useEffect, useState } from "react";
import { cleanName } from "@/lib/film";
import { filmSfx } from "@/lib/sound";

// "Who's starring tonight?" -> the name, then a cast card with it in lights.
export function Cast({ initial, onDone, reduced }: { initial: string; onDone: (name: string) => void; reduced: boolean }) {
  const [name, setName] = useState(initial);
  const [star, setStar] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = cleanName(name) || "You";
    filmSfx.accept();
    setStar(n);
  };

  useEffect(() => {
    if (star === null) return;
    const t = setTimeout(() => onDone(star), reduced ? 1600 : 3000);
    return () => clearTimeout(t);
  }, [star, onDone, reduced]);

  return (
    <div className="letterbox">
      <div className="frame">
        <div className="card-stage">
          {star === null ? (
            <form className="cast-form" onSubmit={submit}>
              <h2 className="card-title">Who&apos;s starring tonight?</h2>
              <div className="direction-box">
                <label className="direction-label" htmlFor="star-name">
                  Your name
                </label>
                <div className="direction-row">
                  <input
                    id="star-name"
                    className="direction-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Say or type your name"
                    autoComplete="given-name"
                    maxLength={40}
                    autoFocus
                  />
                  <button type="submit" className="film-btn">
                    That&apos;s me ▸
                  </button>
                </div>
                <p className="direction-hint">Press Enter when it&apos;s in the box. Leave it empty to stay anonymous.</p>
              </div>
            </form>
          ) : (
            <div className="cast-card">
              <p className="card-kicker">Starring</p>
              <h2 className="card-star">{star}</h2>
              <p className="card-sub">as The Witness · and The Director</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Act title card: act number, title, then the lines typed out one by one.
export function ActCard({ act, title, lines, onDone, reduced }: { act: string; title: string; lines: string[]; onDone: () => void; reduced: boolean }) {
  const full = lines.join("\n");
  const [n, setN] = useState(reduced ? full.length : 0);
  const done = n >= full.length;

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 3200);
      return () => clearTimeout(t);
    }
    const ch = full[n];
    const delay = n === 0 ? 1400 : ch === "\n" ? 650 : /[.,]/.test(full[n - 1] ?? "") ? 260 : 38;
    const t = setTimeout(() => {
      setN(n + 1);
      if (n % 2 === 0 && ch !== " " && ch !== "\n") filmSfx.type();
    }, delay);
    return () => clearTimeout(t);
  }, [n, done, full, onDone]);

  const shown = full.slice(0, n).split("\n");
  return (
    <div className="letterbox">
      <div className="frame" onClick={() => !done && setN(full.length)}>
        <div className="card-stage act-card">
          <p className="card-kicker">{act}</p>
          <h2 className="card-title big">{title}</h2>
          <div className="typed" aria-label={lines.join(" ")}>
            {shown.map((l, i) => (
              <p key={i} aria-hidden>
                {l}
                {i === shown.length - 1 && !done && <span className="caret" />}
              </p>
            ))}
          </div>
          <button className={done ? "film-btn" : "film-btn ghost"} onClick={(e) => (e.stopPropagation(), onDone())}>
            {done ? "Action ▸" : "Skip ▸"}
          </button>
        </div>
      </div>
    </div>
  );
}
