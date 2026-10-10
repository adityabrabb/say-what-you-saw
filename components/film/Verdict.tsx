"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { download, starName, type FilmState, type VerdictResult } from "@/lib/film";
import { drone, filmSfx, verdictSfx } from "@/lib/sound";
import { exhibitsFrom } from "@/lib/evidence";
import { offlineCharge } from "@/lib/verdict/offline";
import { drawPoster, mugshotSketch, PHOTO, POSTER_H, POSTER_W, posterBack, posterRect, STAMP, stampCanvas } from "@/lib/verdict/poster";
import type { CaseFile, Charge } from "@/lib/verdict/schema";

// Act III · The Verdict. The frame freezes, the "system" crashes, the fourth wall breaks, the frame
// shatters and reassembles into a wanted poster, and a GUILTY stamp comes down.

type Beat = "freeze" | "crash" | "glitch" | "twist" | "shatter" | "poster" | "final";
type Filed = Charge & { engine: string };

interface ErrWin {
  id: number;
  title: string;
  msg: string;
  buttons: string[];
  x: number;
  y: number;
}

const ERRORS: Omit<ErrWin, "id" | "x" | "y">[] = [
  { title: "Memory.exe", msg: "Memory.exe has stopped responding.", buttons: ["Close program", "Wait"] },
  { title: "Witness Credibility", msg: "Witness credibility: not found (404).", buttons: ["OK"] },
  { title: "Testimony Checker", msg: "Testimony contains 0% facts. Continue anyway?", buttons: ["Yes", "Also yes"] },
  { title: "Director.dll", msg: "Director.dll is judging you.", buttons: ["Fair"] },
  { title: "Alibi Loader", msg: "Error: alibi could not be loaded.", buttons: ["Retry"] },
  { title: "Plot.sys", msg: "Critical: plot twist imminent.", buttons: ["Brace"] },
];
const AGAIN: Omit<ErrWin, "id" | "x" | "y">[] = [
  { title: "Memory.exe", msg: "Memory.exe has stopped responding. Again.", buttons: ["Wait harder"] },
  { title: "Alibi Loader", msg: "Retrying… no.", buttons: ["OK"] },
];
const TWIST = ["Plot twist:", "you were never the witness.", "You are the suspect."];
const WIN_W = 320;

const caseFile = (f: FilmState): CaseFile => ({
  name: f.name.slice(0, 40),
  witnessScore: f.witness ? Math.min(1000, Math.round(f.witness.score)) : null,
  witnessMax: f.witness ? Math.min(1000, Math.round(f.witness.max)) : null,
  rounds: (f.witness?.rounds ?? []).slice(0, 5).map((r) => ({
    title: r.title.slice(0, 80),
    truth: r.truth.slice(0, 400),
    said: r.said.slice(0, 400),
    score: Math.max(0, Math.min(100, Math.round(r.score))),
  })),
  directorLines: (f.director?.lines ?? []).slice(-20).map((l) => l.slice(0, 200)),
});

// Text only goes to the model; a slow or failed call gets the house verdict.
async function fileCharges(file: CaseFile): Promise<Filed> {
  try {
    const res = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(file),
      signal: AbortSignal.timeout(14_000),
    });
    const data = (await res.json()) as Partial<Filed>;
    if (!res.ok || !data.alias || !data.evidence || data.evidence.length !== 3) throw new Error("bad verdict");
    return data as Filed;
  } catch {
    return { ...offlineCharge(file), engine: "offline" };
  }
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

function noFootage(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 720;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b0710";
  g.fillRect(0, 0, 1280, 720);
  g.fillStyle = "rgba(243,233,210,0.35)";
  g.font = "600 40px 'Courier New', monospace";
  g.textAlign = "center";
  g.fillText("NO FOOTAGE", 640, 370);
  return c;
}

// Red siren favicon frame.
function sirenIcon(on: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  if (on) {
    const glow = g.createRadialGradient(32, 34, 4, 32, 34, 32);
    glow.addColorStop(0, "rgba(255,60,40,0.9)");
    glow.addColorStop(1, "rgba(255,60,40,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, 64, 64);
  }
  g.fillStyle = on ? "#ff2d1f" : "#6b1610";
  g.beginPath();
  g.moveTo(14, 46);
  g.quadraticCurveTo(14, 14, 32, 14);
  g.quadraticCurveTo(50, 14, 50, 46);
  g.closePath();
  g.fill();
  g.fillStyle = "#222";
  g.fillRect(8, 46, 48, 10);
  return c.toDataURL("image/png");
}

// Takes over the tab: title and blinking siren favicon. Returns a restore function.
function takeOverTab() {
  const title = document.title;
  const links = [...document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")];
  const hrefs = links.map((l) => l.href);
  let link = links[0];
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  const icons = [sirenIcon(true), sirenIcon(false)];
  let i = 0;
  document.title = "Suspect Detected";
  link.href = icons[0];
  const blink = setInterval(() => {
    i ^= 1;
    link.href = icons[i];
    document.title = i ? "⚠ Suspect Detected" : "Suspect Detected";
  }, 450);
  return () => {
    clearInterval(blink);
    document.title = title;
    if (links.length) links.forEach((l, k) => (l.href = hrefs[k]));
    else link.remove();
  };
}

// Pull out one colour channel of the frozen frame, for the RGB-split glitch.
function channel(src: CanvasImageSource, w: number, h: number, keep: 0 | 1 | 2) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) for (let k = 0; k < 3; k++) if (k !== keep) img.data[i + k] = 0;
  g.putImageData(img, 0, 0);
  return c;
}

const dataUrl = (c: HTMLCanvasElement, w: number) => {
  const s = document.createElement("canvas");
  s.width = w;
  s.height = Math.round((c.height / c.width) * w);
  s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height);
  return s.toDataURL("image/jpeg", 0.85);
};

export default function Verdict({
  film,
  reduced,
  onVerdict,
  onAppeal,
  onCredits,
}: {
  film: FilmState;
  reduced: boolean;
  onVerdict: (v: VerdictResult) => void;
  onAppeal: () => void;
  onCredits: () => void;
}) {
  const done = film.verdict?.poster ? film.verdict : null;
  const [beat, setBeat] = useState<Beat>(done ? "final" : "freeze");
  const [wins, setWins] = useState<ErrWin[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number; click: number; show: boolean }>({ x: 0, y: 0, click: 0, show: false });
  const [typed, setTyped] = useState(0);
  const [poster, setPoster] = useState<string | null>(done?.poster ?? null);
  const [drag, setDrag] = useState<{ src: string; at: "off" | "slot" } | null>(null);
  const [stamped, setStamped] = useState(!!done);
  const [shake, setShake] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [size, setSize] = useState({ w: 1280, h: 720 });

  const stage = useRef<HTMLDivElement>(null);
  const glitchCanvas = useRef<HTMLCanvasElement>(null);
  const run = useRef(0); // bumps on skip/unmount so a running script stops
  const stampedPoster = useRef<HTMLCanvasElement | null>(null);
  const stampUrl = useRef<string>("");
  const restoreTab = useRef<() => void>(() => {});
  const shatterRef = useRef<{ dispose: () => void } | null>(null);

  const freezeSrc = film.director?.freeze ?? null;
  const demo = film.director ? !!film.director.demo || !freezeSrc : true;
  const file = useRef(caseFile(film)).current;

  // Charges are filed the moment the frame freezes, so they're ready by the time the poster forms.
  const charge = useRef<Promise<Filed> | null>(null);
  if (!done && !charge.current && typeof window !== "undefined")
    // Exhibits A, B and C are the witness's own mistakes from Act I (the same tags they watched being filed).
    charge.current = fileCharges(file).then((f) => ({ ...f, evidence: exhibitsFrom(film.witness?.rounds ?? [], f.evidence) as Filed["evidence"] }));

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Builds both posters, the stamp, and hands the result to the film.
  const makePosters = useCallback(
    async (filed: Filed) => {
      const photo = demo ? null : await loadImage(freezeSrc!).catch(() => null);
      const sketch = demo ? mugshotSketch() : null;
      const base = { name: starName(film), charge: filed, sepia: !demo, refused: demo };
      const front = drawPoster({ ...base, photo: demo ? null : photo, stamp: false });
      const full = drawPoster({ ...base, photo: demo ? sketch : photo, stamp: false });
      const stampedC = drawPoster({ ...base, photo: demo ? sketch : photo, stamp: true });
      stampedPoster.current = stampedC;
      stampUrl.current = stampCanvas().toDataURL("image/png");
      return { front, full, sketch, stampedC };
    },
    [demo, freezeSrc, film]
  );

  const finish = useCallback(
    (filed: Filed, stampedC: HTMLCanvasElement) => {
      restoreTab.current();
      drone.level(0.5);
      const stampedUrl = dataUrl(stampedC, 900);
      setPoster(stampedUrl);
      onVerdict({ ...filed, poster: stampedUrl });
    },
    [onVerdict]
  );

  // The whole sequence, as one cancellable script.
  useEffect(() => {
    if (done) return;
    const id = ++run.current;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const alive = () => run.current === id;
    const sleep = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));
    let glitchRaf = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = posterRect(vw, vh);
    restoreTab.current = takeOverTab();
    drone.level(0.15);
    const skipTimer = setTimeout(() => setShowSkip(true), 1500);

    (async () => {
      // 1. Freeze
      verdictSfx.siren();
      await sleep(reduced ? 300 : 900);
      if (!alive()) return;

      // 2. The fake crash: error windows stack up while a fake cursor makes it worse
      setBeat("crash");
      const ww = Math.min(WIN_W, vw - 32);
      const place = (i: number) => ({
        x: Math.min(vw - ww - 16, vw * 0.06 + i * Math.min(56, vw * 0.06)),
        y: Math.min(vh - 170, vh * 0.12 + i * Math.min(58, vh * 0.065)),
      });
      const spawn = (w: Omit<ErrWin, "id" | "x" | "y">, i: number) => {
        verdictSfx.ding();
        setWins((ws) => [...ws, { ...w, id: ws.length, ...place(i) }]);
      };
      const buttonAt = (i: number) => {
        const p = place(i);
        return { x: p.x + ww - 60, y: p.y + 118 };
      };
      if (!reduced) setCursor({ x: vw * 0.82, y: vh * 0.8, click: 0, show: true });
      for (let i = 0; i < ERRORS.length; i++) {
        spawn(ERRORS[i], i);
        await sleep(reduced ? 150 : 430);
        if (!alive()) return;
        if (!reduced && i === 1) setCursor((c) => ({ ...c, ...buttonAt(0) }));
        if (!reduced && i === 3) {
          verdictSfx.cursorClick();
          setCursor((c) => ({ ...c, click: c.click + 1 }));
          spawn(AGAIN[0], 6);
          setCursor((c) => ({ ...c, ...buttonAt(4) }));
        }
      }
      await sleep(reduced ? 200 : 600);
      if (!alive()) return;
      if (!reduced) {
        verdictSfx.cursorClick();
        setCursor((c) => ({ ...c, click: c.click + 1 }));
        spawn(AGAIN[1], 7);
        await sleep(500);
        setCursor((c) => ({ ...c, x: vw * 0.5, y: vh * 0.55 }));
        await sleep(500);
      }
      if (!alive()) return;

      // 3. Glitch: about a second of static, RGB split and warp, under a detuned tone
      setBeat("glitch");
      verdictSfx.glitch(1);
      await sleep(30); // let the glitch canvas mount
      const src = freezeSrc ? await loadImage(freezeSrc).catch(() => noFootage()) : noFootage();
      if (!reduced && glitchCanvas.current) {
        const gc = glitchCanvas.current;
        const W = 640;
        const H = 360;
        gc.width = W;
        gc.height = H;
        const parts = [channel(src, W, H, 0), channel(src, W, H, 1), channel(src, W, H, 2)];
        const g = gc.getContext("2d")!;
        const noise = g.createImageData(W / 4, H / 4);
        const tmp = document.createElement("canvas");
        tmp.width = W / 4;
        tmp.height = H / 4;
        const t0 = performance.now();
        const draw = (now: number) => {
          const p = (now - t0) / 1000;
          g.globalCompositeOperation = "source-over";
          g.fillStyle = "#000";
          g.fillRect(0, 0, W, H);
          g.globalCompositeOperation = "lighter";
          const dx = 6 + Math.random() * 18;
          g.drawImage(parts[0], dx, (Math.random() - 0.5) * 6);
          g.drawImage(parts[1], 0, 0);
          g.drawImage(parts[2], -dx, (Math.random() - 0.5) * 6);
          // Torn scanline bands
          g.globalCompositeOperation = "source-over";
          for (let b = 0; b < 4; b++) {
            const y = Math.random() * H;
            const h = 4 + Math.random() * 22;
            g.drawImage(gc, 0, y, W, h, (Math.random() - 0.5) * 60, y, W, h);
          }
          // Static (the only grain in the film, and only for this second)
          for (let i = 0; i < noise.data.length; i += 4) {
            const v = Math.random() * 255;
            noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = v;
            noise.data[i + 3] = 70;
          }
          tmp.getContext("2d")!.putImageData(noise, 0, 0);
          g.imageSmoothingEnabled = false;
          g.drawImage(tmp, 0, 0, W, H);
          if (p < 1.1) glitchRaf = requestAnimationFrame(draw);
        };
        glitchRaf = requestAnimationFrame(draw);
      }
      await sleep(reduced ? 300 : 1100);
      if (!alive()) return;

      // 4. The twist, typed out
      setWins([]);
      setCursor((c) => ({ ...c, show: false }));
      setBeat("twist");
      const total = TWIST.join("").length;
      if (reduced) setTyped(total);
      else {
        let n = 0;
        for (let li = 0; li < TWIST.length; li++) {
          if (li === 2) {
            await sleep(500);
            verdictSfx.hit();
          }
          for (let k = 0; k < TWIST[li].length; k++) {
            n++;
            setTyped(n);
            if (k % 2 === 0) filmSfx.type();
            await sleep(li === 2 ? 70 : 45);
            if (!alive()) return;
          }
          await sleep(li === 0 ? 380 : 260);
        }
      }
      await sleep(reduced ? 900 : 1600);
      if (!alive()) return;

      // 5. Shatter (three.js), reassemble into the back of the poster, spin round to the front
      const filed = await charge.current!;
      if (!alive()) return;
      const posters = await makePosters(filed);
      if (!alive()) return;
      setBeat("shatter");
      let shattered = false;
      if (!reduced && stage.current) {
        try {
          const { Shatter } = await import("@/lib/verdict/shatter");
          if (!alive()) return;
          const s = new Shatter(stage.current, src as HTMLCanvasElement, posterBack(), vw, vh, rect);
          shatterRef.current = s;
          verdictSfx.shatter();
          await sleep(2600);
          if (!alive()) return;
          verdictSfx.whoosh();
          await s.assemble(posters.front);
          shattered = true;
        } catch {
          // No WebGL: fall through to the simple crossfade
        }
      }
      if (!alive()) return;
      setPoster(posters.front.toDataURL("image/jpeg", 0.9));
      setBeat("poster");
      if (!shattered) await sleep(reduced ? 400 : 900);
      shatterRef.current?.dispose();
      shatterRef.current = null;
      if (!alive()) return;

      // 6. No camera: the fake cursor drags a police sketch into the empty photo slot
      if (demo && posters.sketch) {
        const sketchUrl = posters.sketch.toDataURL("image/jpeg", 0.9);
        if (reduced) setPoster(posters.full.toDataURL("image/jpeg", 0.9));
        else {
          const scale = rect.w / POSTER_W;
          setDrag({ src: sketchUrl, at: "off" });
          setCursor({ x: vw - 40, y: rect.y + rect.h * 0.5, click: 0, show: true });
          await sleep(350);
          setDrag({ src: sketchUrl, at: "slot" });
          setCursor((c) => ({ ...c, x: rect.x + (PHOTO.x + PHOTO.w * 0.6) * scale, y: rect.y + (PHOTO.y + PHOTO.h * 0.55) * scale }));
          await sleep(1300);
          if (!alive()) return;
          verdictSfx.cursorClick();
          setPoster(posters.full.toDataURL("image/jpeg", 0.9));
          setDrag(null);
          await sleep(300);
          setCursor((c) => ({ ...c, show: false }));
        }
        await sleep(400);
        if (!alive()) return;
      }

      // 7. GUILTY
      setStamped(true);
      await sleep(reduced ? 0 : 170);
      verdictSfx.thud();
      if (!reduced) {
        setShake(true);
        await sleep(450);
        setShake(false);
      }
      if (!alive()) return;
      setBeat("final");
      finish(filed, posters.stampedC);
    })();

    return () => {
      run.current++;
      timers.forEach(clearTimeout);
      clearTimeout(skipTimer);
      cancelAnimationFrame(glitchRaf);
      shatterRef.current?.dispose();
      shatterRef.current = null;
      restoreTab.current();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Skip straight to the stamped poster.
  const skip = async () => {
    run.current++;
    setWins([]);
    setCursor((c) => ({ ...c, show: false }));
    setDrag(null);
    shatterRef.current?.dispose();
    shatterRef.current = null;
    const filed = await charge.current!;
    const posters = await makePosters(filed);
    setPoster(posters.full.toDataURL("image/jpeg", 0.9));
    setStamped(true);
    setBeat("final");
    finish(filed, posters.stampedC);
  };

  const downloadPoster = () => {
    const name = `${(film.verdict?.alias ?? starName(film)).toLowerCase().replace(/\W+/g, "-")}-wanted`;
    if (stampedPoster.current)
      stampedPoster.current.toBlob((b) => {
        if (!b) return;
        const url = URL.createObjectURL(b);
        download(url, `${name}.png`);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, "image/png");
    else if (film.verdict?.poster) download(film.verdict.poster, `${name}.jpg`);
  };

  const rect = posterRect(size.w, size.h);
  const showFrame = beat === "freeze" || beat === "crash" || beat === "glitch" || beat === "twist";
  const scale = rect.w / POSTER_W;
  const typedLines = (() => {
    let left = typed;
    return TWIST.map((l) => {
      const s = l.slice(0, Math.max(0, left));
      left -= l.length;
      return s;
    });
  })();

  return (
    <div className={`verdict-root ${shake ? "shake" : ""} beat-${beat}`} ref={stage}>
      {showFrame && (
        <div className={`verdict-frame ${beat === "twist" ? "dim" : ""}`}>
          {freezeSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={freezeSrc} alt="The frozen frame" />
          ) : (
            <div className="verdict-nofootage">NO FOOTAGE</div>
          )}
          {beat === "glitch" && !reduced && <canvas ref={glitchCanvas} className="verdict-glitch" aria-hidden />}
        </div>
      )}
      {beat === "glitch" && reduced && <div className="verdict-glitch-still" aria-hidden />}

      {wins.map((w) => (
        <div key={w.id} className="err-win" style={{ left: w.x, top: w.y, width: Math.min(WIN_W, size.w - 32) }} role="alert">
          <div className="err-title">
            <span>{w.title}</span>
            <span className="err-x" aria-hidden>
              ✕
            </span>
          </div>
          <div className="err-body">
            <span className="err-icon" aria-hidden>
              ✕
            </span>
            <p>{w.msg}</p>
          </div>
          <div className="err-buttons">
            {w.buttons.map((b) => (
              <span key={b} className="err-btn">
                {b}
              </span>
            ))}
          </div>
        </div>
      ))}

      {beat === "twist" && (
        <div className="twist" aria-live="polite">
          {typedLines.map((l, i) => (
            <p key={i} className={`twist-line l${i}`}>
              {l}
              {l.length > 0 && l.length < TWIST[i].length && <span className="caret" />}
            </p>
          ))}
        </div>
      )}

      {(beat === "poster" || beat === "final") && poster && (
        <div className="verdict-poster" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt={`Wanted poster for ${starName(film)}`} />
          {drag && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={drag.src}
              alt=""
              className={`verdict-drag ${drag.at}`}
              style={{
                left: `${(PHOTO.x / POSTER_W) * 100}%`,
                top: `${(PHOTO.y / POSTER_H) * 100}%`,
                width: PHOTO.w * scale,
                height: PHOTO.h * scale,
                transform: drag.at === "off" ? `translate(${size.w - rect.x}px, 40px) rotate(8deg)` : "none",
              }}
            />
          )}
          {stamped && !film.verdict?.poster && stampUrl.current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stampUrl.current}
              alt="Guilty"
              className={reduced ? "verdict-stamp still" : "verdict-stamp"}
              style={
                {
                  left: `${(STAMP.cx / POSTER_W) * 100}%`,
                  top: `${(STAMP.cy / POSTER_H) * 100}%`,
                  width: `${(STAMP.w / POSTER_W) * 100}%`,
                  "--rot": `${STAMP.rot}deg`,
                } as React.CSSProperties
              }
            />
          )}
        </div>
      )}

      {cursor.show && (
        <div className="fake-cursor" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }} aria-hidden>
          <svg viewBox="0 0 24 24" width="26" height="26" key={cursor.click} className={cursor.click ? "clicking" : ""}>
            <path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.4 L17.5 13.4 Z" fill="#fff" stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {beat === "final" && (
        <div className="verdict-actions" style={{ top: rect.y + rect.h + 14 }}>
          <button className="film-btn ghost" onClick={downloadPoster}>
            Download poster
          </button>
          <button className="film-btn ghost" onClick={onAppeal}>
            Appeal
          </button>
          <button className="film-btn" onClick={onCredits}>
            Roll credits ▸
          </button>
        </div>
      )}

      {beat !== "final" && showSkip && (
        <button className="verdict-skip film-chip" onClick={() => void skip()}>
          Skip to the verdict ▸
        </button>
      )}
    </div>
  );
}
