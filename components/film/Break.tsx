"use client";

import { useEffect, useRef, useState } from "react";
import { host } from "@/lib/roast/host";
import { breakSfx } from "@/lib/sound";

// Between Act I and Act II: a fake "Act 2.5" that does not exist, then a commercial break nobody asked for.

// Act 2.5 · NOT FOUND (404), in a glitching font. The director admits it is budget cuts.
export function NotFound({ onDone, reduced }: { onDone: () => void; reduced: boolean }) {
  const [fixed, setFixed] = useState(false);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    breakSfx.glitch();
    const stutter = setInterval(() => breakSfx.glitch(), 1700);
    t.push(
      setTimeout(() => {
        clearInterval(stutter);
        setFixed(true);
        host.say("Kidding. Budget cuts. A word from our sponsors.", "interrupt", { maxAgeMs: 20_000 });
      }, reduced ? 2000 : 2800),
      setTimeout(onDone, reduced ? 6000 : 6800)
    );
    return () => {
      clearInterval(stutter);
      t.forEach(clearTimeout);
    };
  }, [onDone, reduced]);

  return (
    <div className="letterbox">
      <div className={fixed ? "frame nf fixed" : "frame nf"}>
        <div className="card-stage nf-stage">
          <p className="card-kicker nf-kick">Act 2.5</p>
          <h2 className="nf-title" data-text="NOT FOUND">
            NOT FOUND
          </h2>
          <p className="nf-code" data-text="404">
            404
          </p>
          <p className="nf-msg">{fixed ? "Act 2.5 was cancelled. Budget cuts." : "The requested act could not be found. It may have been moved, deleted, or never funded."}</p>
          <button className="film-btn ghost" onClick={onDone}>
            Skip ▸
          </button>
        </div>
      </div>
    </div>
  );
}

const AD_SECONDS = 10;

// The sponsor: "Memory+ — for people like you". The Skip button only works on the second click.
export function CommercialBreak({ score, max, onDone, reduced }: { score: number | null; max: number; onDone: () => void; reduced: boolean }) {
  const [t, setT] = useState(0);
  const [tries, setTries] = useState(0);
  const [shake, setShake] = useState(0);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setT(s);
      if (s >= AD_SECONDS) {
        clearInterval(id);
        finish();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slide = Math.min(3, Math.floor(t / (AD_SECONDS / 4)));
  useEffect(() => {
    if (slide === 1) breakSfx.jingle();
  }, [slide]);

  const skip = () => {
    if (tries === 0) {
      setTries(1);
      setShake((n) => n + 1);
      breakSfx.deny();
      host.say("Skip is a Memory+ feature. Try again. I dare you.", "interrupt", { maxAgeMs: 12_000 });
    } else finish();
  };

  const left = Math.max(0, Math.ceil(AD_SECONDS - t));
  const slides = [
    <p key="a" className="ad-q">
      Do you ever forget
      <br />
      what you just saw?
    </p>,
    <div key="b" className="ad-logo">
      <span>
        Memory<b>+</b>
      </span>
      <em>for people like you</em>
    </div>,
    <p key="c" className="ad-q">
      {score !== null ? (
        <>
          Testified <strong>{score}</strong> out of {max}?
          <br />
          There&apos;s a plan for that.
        </>
      ) : (
        <>
          Say nothing, remember nothing.
          <br />
          Now with a monthly fee.
        </>
      )}
    </p>,
    <div key="d" className="ad-logo small">
      <span>
        Memory<b>+</b>
      </span>
      <em>First 30 seconds free. Then we remember how you paid.</em>
    </div>,
  ];

  return (
    <div className="letterbox">
      <div className="frame ad">
        <div className="ad-bar" aria-hidden>
          <span style={{ width: `${Math.min(100, (t / AD_SECONDS) * 100)}%` }} />
        </div>
        <div className="ad-top">
          <span>Commercial break</span>
          <span>Ad · 0:{String(left).padStart(2, "0")}</span>
        </div>
        <div className="ad-card" key={slide}>
          {slides[slide]}
        </div>
        <p className="ad-legal">Memory+ may not remember you. Terms and conditions apply. Not a real product, obviously.</p>
        <div className="ad-skip">
          {tries > 0 && <span className="ad-denied">Skipping is a Memory+ feature.</span>}
          <button key={shake} className={shake && !reduced ? "film-btn ghost shake" : "film-btn ghost"} onClick={skip}>
            Skip ad ▸
          </button>
        </div>
      </div>
    </div>
  );
}
