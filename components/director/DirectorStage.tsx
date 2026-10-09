"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Catalog, Credit } from "@/lib/director/catalog";
import { DirectorRenderer, type FrameUniforms } from "@/lib/director/gl";
import { lookFor } from "@/lib/director/grades";
import { dateStamp, OverlayLayer } from "@/lib/director/overlays";
import { applyShotPatch, DEFAULT_SETTINGS, type ShotPatch, type ShotSettings } from "@/lib/director/settings";
import { Silhouette } from "@/lib/director/silhouette";
import { buildPhotoStrip } from "@/lib/director/strip";
import { anchorsFromLandmarks, MASK_H, MASK_W, smoothAnchors, Tracker, type FaceAnchors } from "@/lib/director/tracking";
import { sfx } from "@/lib/sound";

const HINTS = [
  "Put me on a Tokyo rooftop at night with neon rain",
  "Golden hour, warm light from the left",
  "Black and white noir, heavy grain",
  "Make the moon orbit my head",
  "Write ADI under my chin in gold",
];
const SHOT = /^(freeze|take (the |a )?(shot|picture|photo|pic)|click|snap|capture|shoot|say cheese|cheese)\b/;
const UNDO = /^(cut|go back|undo|revert|back)\b/;
const STRIP_SIZE = 4;
const EASE_MS = 1000;

type RGB = [number, number, number];
const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const hueRgb = (h: number): RGB => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};
const BG_CODE: Record<string, number> = { camera: 0, image: 1, "neon-rain-city": 2, "star-field": 3, "sunset-gradient": 4, "studio-backdrop": 5, "foggy-forest": 6 };

// Everything that eases numerically between shots.
interface Params {
  studio: RGB; lightAngle: number; lightColor: RGB; lightInt: number; lightSoft: number; rim: number;
  exposure: number; contrast: number; saturation: number; temperature: number; tint: number; fade: number; mono: number; bleach: number;
  vignette: number; shadows: RGB; highlights: RGB; grain: number; grainSize: number; leaks: number; leakColor: RGB; teeth: number; blur: number;
}
function paramsFor(s: ShotSettings): Params {
  const look = lookFor(s.grade);
  return {
    studio: hexRgb(s.background.color), lightAngle: s.light.angle, lightColor: hexRgb(s.light.color), lightInt: s.light.intensity,
    lightSoft: s.light.softness, rim: s.light.rim, exposure: look.exposure, contrast: look.contrast, saturation: look.saturation,
    temperature: look.temperature, tint: look.tint, fade: look.fade, mono: look.mono, bleach: look.bleach, vignette: s.grade.vignette,
    shadows: look.shadows, highlights: look.highlights, grain: s.grain.amount, grainSize: s.grain.size, leaks: s.leaks.amount,
    leakColor: hueRgb(s.leaks.hue), teeth: s.face.teeth === "gold" ? 1 : 0, blur: s.background.blur,
  };
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function mixParams(a: Params, b: Params, t: number): Params {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(b) as (keyof Params)[]) {
    const x = a[k];
    const y = b[k];
    if (Array.isArray(x)) out[k] = (x as number[]).map((v, i) => v + ((y as number[])[i] - v) * t);
    else if (k === "lightAngle") {
      const d = ((((y as number) - (x as number)) % 360) + 540) % 360 - 180; // shortest way round
      out[k] = (x as number) + d * t;
    } else out[k] = (x as number) + ((y as number) - (x as number)) * t;
  }
  return out as unknown as Params;
}

interface Slot {
  type: number;
  key: string; // "image:tokyo-neon-street" etc.
  blur: number;
}

export default function DirectorStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"intro" | "starting" | "live">("intro");
  const [source, setSource] = useState<"camera" | "demo">("camera");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const [take, setTake] = useState(0);
  const [subtitle, setSubtitle] = useState<{ take: number; text: string; note: string; key: number } | null>(null);
  const [shots, setShots] = useState(0);
  const [strip, setStrip] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [fps, setFps] = useState(0);
  const [credit, setCredit] = useState<Credit | null>(null);

  // Mutable engine state lives in refs so the render loop never waits on React.
  const eng = useRef({
    settings: DEFAULT_SETTINGS as ShotSettings,
    history: [] as ShotSettings[],
    from: paramsFor(DEFAULT_SETTINGS),
    to: paramsFor(DEFAULT_SETTINGS),
    tweenStart: 0,
    slotA: { type: 0, key: "camera:camera", blur: 0 } as Slot,
    slotB: null as Slot | null,
    mixStart: 0,
    capture: false,
    frames: [] as HTMLCanvasElement[],
    lines: [] as string[],
    catalog: null as Catalog | null,
    renderer: null as DirectorRenderer | null,
    overlays: null as OverlayLayer | null,
    demo: false,
    loadId: 0,
  });

  // Hide the arcade backdrop while directing; it would only cost frames behind the canvas.
  useEffect(() => {
    document.body.classList.add("director-active");
    fetch("/backgrounds/backgrounds.json")
      .then((r) => r.json())
      .then((c: Catalog) => (eng.current.catalog = c))
      .catch(() => {});
    return () => document.body.classList.remove("director-active");
  }, []);

  const currentParams = useCallback((now: number) => {
    const e = eng.current;
    return mixParams(e.from, e.to, ease(Math.min(1, (now - e.tweenStart) / EASE_MS)));
  }, []);

  // Start a background crossfade (images load first so nothing ever flashes black).
  const changeBackground = useCallback((s: ShotSettings) => {
    const e = eng.current;
    const bg = s.background;
    let type = bg.type === "image" ? 1 : bg.type === "procedural" ? BG_CODE[bg.id] ?? 5 : 0;
    if (type === 0 && e.demo) type = 5; // the demo has no real room behind it
    const key = `${bg.type}:${bg.id}`;
    if (key === e.slotA.key && !e.slotB) return;
    const id = ++e.loadId;
    const start = () => {
      if (id !== e.loadId) return;
      if (e.slotB) {
        // A crossfade was still running: finish it instantly, then fade to the new one.
        e.renderer?.swapBackgrounds();
        e.slotA = e.slotB;
      }
      e.slotB = { type, key, blur: bg.blur };
      e.mixStart = performance.now();
    };
    const img = e.catalog?.images.find((i) => i.id === bg.id);
    setCredit(bg.type === "image" && img ? img.credit : null);
    if (type === 1 && img) {
      const el = new Image();
      el.src = `/backgrounds/${img.file}`;
      el.decode()
        .then(() => {
          if (id !== e.loadId || !e.renderer) return;
          if (e.slotB) {
            e.renderer.swapBackgrounds();
            e.slotA = e.slotB;
            e.slotB = null;
          }
          e.renderer.setBackgroundImage("bgB", el);
          start();
        })
        .catch(() => {});
    } else start();
  }, []);

  const applySettings = useCallback(
    (next: ShotSettings) => {
      const e = eng.current;
      const now = performance.now();
      e.from = currentParams(now);
      e.to = paramsFor(next);
      e.tweenStart = now;
      e.settings = next;
      e.overlays?.sync(next.overlays);
      changeBackground(next);
    },
    [changeBackground, currentParams]
  );

  // ---------- Start the camera (or the demo subject) and the render loop ----------
  const start = useCallback(
    async (wantCamera: boolean) => {
      setPhase("starting");
      const e = eng.current;
      const video = videoRef.current!;
      let useCamera = wantCamera;
      if (wantCamera) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
            audio: false,
          });
          video.srcObject = stream;
          await video.play();
        } catch (err) {
          const name = (err as DOMException)?.name;
          setNotice(
            name === "NotAllowedError"
              ? "Camera permission was denied, so you're directing the demo subject. Allow the camera in your browser to step in yourself."
              : "No camera found, so you're directing the demo subject."
          );
          useCamera = false;
        }
      }
      e.demo = !useCamera;
      setSource(useCamera ? "camera" : "demo");

      let renderer: DirectorRenderer;
      try {
        renderer = new DirectorRenderer(canvasRef.current!);
      } catch (err) {
        setNotice(`This browser can't run Director mode: ${(err as Error).message}`);
        setPhase("intro");
        return;
      }
      e.renderer = renderer;
      e.overlays = new OverlayLayer();
      const silhouette = e.demo ? new Silhouette() : null;
      if (e.demo) applySettings({ ...e.settings, background: { ...e.settings.background, type: "procedural", id: "studio-backdrop" } });
      setPhase("live");

      let tracker: Tracker | null = null;
      if (useCamera)
        Tracker.create(setStatus)
          .then((t) => {
            tracker = t;
            setStatus("");
          })
          .catch((err) => setStatus(`Tracking unavailable (${(err as Error).message.slice(0, 60)})`));

      let anchors: FaceAnchors | null = null;
      let target: FaceAnchors | null = null;
      let lastSeen = 0;
      let last = performance.now();
      let frames = 0;
      let frameMsAvg = 16;
      let fpsAt = last;
      let crop: [number, number] = [1, 1];
      let raf = 0;

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - last) / 1000);
        frameMsAvg = frameMsAvg * 0.9 + (now - last) * 0.1;
        last = now;
        const t = now / 1000;

        // Source frame + tracking
        const p = currentParams(now);
        const needMips = e.slotA.type === 0 && (p.blur > 0.01 || (e.slotB?.type === 0 && e.slotB.blur > 0.01));
        if (silhouette) {
          target = silhouette.draw(t);
          renderer.setVideo(silhouette.canvas, 1280, 720, needMips);
        } else if (video.readyState >= 2 && video.videoWidth) {
          const va = video.videoWidth / video.videoHeight;
          crop = va > 16 / 9 ? [16 / 9 / va, 1] : [1, va / (16 / 9)];
          renderer.setVideo(video, video.videoWidth, video.videoHeight, needMips);
          if (tracker) {
            const r = tracker.process(video);
            if (r.mask) renderer.setMask(tracker.mask, MASK_W, MASK_H);
            if (r.landmarks) {
              const a = anchorsFromLandmarks(r.landmarks, crop, true);
              if (a) {
                target = a;
                lastSeen = now;
              } else if (now - lastSeen > 1200) target = null;
            }
          }
        }
        anchors = target ? smoothAnchors(anchors, target, 0.4) : null;

        // Background crossfade
        let bgMix = 0;
        if (e.slotB) {
          bgMix = ease(Math.min(1, (now - e.mixStart) / EASE_MS));
          if (bgMix >= 1) {
            renderer.swapBackgrounds();
            e.slotA = e.slotB;
            e.slotB = null;
            bgMix = 0;
          }
        }
        e.slotA.blur += (e.settings.background.blur - e.slotA.blur) * (1 - Math.exp(-dt * 4.5));

        // Overlays + date stamp
        const ov = e.overlays!.draw(anchors, t, dt, dateStamp());
        if (ov.redrawn) renderer.setOverlay("ovFront", e.overlays!.front);
        if (ov.back) renderer.setOverlay("ovBack", e.overlays!.back);

        const face: FrameUniforms["face"] = anchors
          ? [(anchors.forehead.x + anchors.chin.x) / 2, (anchors.forehead.y + anchors.chin.y) / 2, anchors.faceW * 0.55, anchors.faceH * 0.62]
          : [0.5, 0.4, 0.08, 0.17];
        const mouth: FrameUniforms["mouth"] = anchors
          ? [anchors.mouth.x, anchors.mouth.y, anchors.mouthW * 1.15, anchors.mouthH + anchors.mouthW * 0.45]
          : [0.5, 0.55, 0.01, 0.01];
        const rad = (p.lightAngle * Math.PI) / 180;

        renderer.render({
          time: t,
          mirror: !silhouette,
          useAlphaMask: !!silhouette,
          crop: silhouette ? [1, 1] : crop,
          maskSize: [MASK_W, MASK_H],
          bgA: { type: e.slotA.type, blur: e.slotA.blur },
          bgB: { type: e.slotB?.type ?? 0, blur: e.slotB ? e.settings.background.blur : 0 },
          bgMix,
          studio: p.studio,
          face,
          mouth,
          teeth: anchors ? p.teeth : 0,
          lightDir: [Math.cos(rad), Math.sin(rad)],
          lightColor: p.lightColor,
          lightInt: p.lightInt,
          lightSoft: p.lightSoft,
          rim: p.rim,
          exposure: p.exposure,
          contrast: p.contrast,
          saturation: p.saturation,
          temperature: p.temperature,
          tint: p.tint,
          fade: p.fade,
          mono: p.mono,
          bleach: p.bleach,
          vignette: p.vignette,
          shadows: p.shadows,
          highlights: p.highlights,
          grain: p.grain,
          grainSize: p.grainSize,
          leaks: p.leaks,
          leakColor: p.leakColor,
          overlayFront: true,
          overlayBack: ov.back,
        });

        // Capture right after drawing, while the frame is still in the buffer.
        if (e.capture) {
          e.capture = false;
          const shot = document.createElement("canvas");
          shot.width = 1280;
          shot.height = 720;
          shot.getContext("2d")!.drawImage(canvasRef.current!, 0, 0, 1280, 720);
          e.frames.push(shot);
          const n = e.frames.length;
          setShots(n);
          setFlashKey((k) => k + 1);
          sfx.shutter();
          if (n >= STRIP_SIZE) {
            const batch = e.frames.splice(0, STRIP_SIZE);
            buildPhotoStrip(batch, e.lines.filter((l) => !SHOT.test(l.toLowerCase())))
              .then((blob) => {
                setStrip(URL.createObjectURL(blob));
                setShots(0);
              })
              .catch(() => {});
          }
        }

        frames++;
        if (now - fpsAt > 1000) {
          setFps(Math.round((frames * 1000) / (now - fpsAt)));
          frames = 0;
          fpsAt = now;
          tracker?.adapt(frameMsAvg);
        }
      };
      raf = requestAnimationFrame(loop);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        tracker?.close();
        (video.srcObject as MediaStream | null)?.getTracks().forEach((tr) => tr.stop());
      };
    },
    [applySettings, currentParams]
  );

  const cleanupRef = useRef<() => void>(() => {});
  useEffect(() => () => cleanupRef.current(), []);

  // ---------- Directing ----------
  const showSubtitle = (n: number, text: string, note: string) => setSubtitle({ take: n, text, note, key: Date.now() });

  const direct = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    const e = eng.current;
    const bare = text.toLowerCase().replace(/[.!?,;:]+$/g, "").trim();
    const n = take + 1;
    setTake(n);
    setLine("");
    e.lines.push(text);

    if (SHOT.test(bare)) {
      e.capture = true;
      showSubtitle(n, text, `Shot ${(e.frames.length % STRIP_SIZE) + 1} of ${STRIP_SIZE}`);
      return;
    }
    if (UNDO.test(bare)) {
      const prev = e.history.pop();
      if (prev) {
        applySettings(prev);
        showSubtitle(n, text, "Back to the previous setup");
        sfx.back();
      } else showSubtitle(n, text, "Nothing to undo yet");
      return;
    }

    setThinking(true);
    sfx.slate();
    showSubtitle(n, text, "Setting up the shot…");
    try {
      const res = await fetch("/api/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line: text, settings: e.settings }),
      });
      const data = (await res.json().catch(() => ({}))) as { patch?: ShotPatch; note?: string; error?: string; engine?: string };
      if (!res.ok || !data.patch) throw new Error(data.error || `Request failed (${res.status})`);
      const next = applyShotPatch(e.settings, data.patch);
      e.history.push(e.settings);
      if (e.history.length > 30) e.history.shift();
      applySettings(next);
      showSubtitle(n, text, data.note || (data.engine === "offline" ? "Offline director" : "Action"));
    } catch (err) {
      showSubtitle(n, text, (err as Error).message);
      sfx.error();
    } finally {
      setThinking(false);
    }
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className="director-root" data-nosfx>
      <canvas ref={canvasRef} className="director-canvas" width={1280} height={720} />
      <video ref={videoRef} className="director-video" playsInline muted />

      {phase !== "live" && (
        <div className="director-intro">
          <div className="intro-card">
            <p className="intro-rec">
              <span className="rec-dot" /> REC
            </p>
            <h1>THE CAMERA IS NOW ON YOU</h1>
            <p className="intro-sub">
              Director mode puts you in the shot. Speak a direction and the scene, lighting, colour and effects change around you, live.
            </p>
            {notice && <p className="intro-notice">{notice}</p>}
            <div className="row-end centered">
              <button className="ghost" onClick={() => start(false)} disabled={phase === "starting"}>
                Use demo subject
              </button>
              <button className="primary" onClick={() => start(true)} disabled={phase === "starting"}>
                {phase === "starting" ? "Rolling…" : "Allow camera"}
              </button>
            </div>
            <p className="intro-fine">Your video never leaves this device. Only your typed or dictated directions are sent.</p>
          </div>
        </div>
      )}

      {phase === "live" && (
        <>
          <div className="director-top">
            <Link href="/" className="dir-chip" onClick={() => sfx.back()}>
              ◄ HOME
            </Link>
            <span className="dir-chip title">DIRECTOR MODE</span>
            <span className="dir-spacer" />
            <span className="dir-chip rec">
              <span className="rec-dot" /> TAKE {take}
            </span>
            <span className="dir-chip">
              SHOT {shots}/{STRIP_SIZE}
            </span>
            <span className={fps >= 30 ? "dir-chip" : "dir-chip warn"}>{fps} FPS</span>
            <button className="dir-chip btn" onClick={fullscreen} aria-label="Toggle fullscreen">
              ⛶
            </button>
          </div>

          {(status || source === "demo" || notice) && (
            <div className="dir-status">
              {status || (source === "demo" ? "Demo subject: allow your camera to step into the shot yourself." : notice)}
              {source === "demo" && (
                <button className="dir-link" onClick={() => window.location.reload()}>
                  Try camera
                </button>
              )}
            </div>
          )}

          {subtitle && (
            <div className="dir-subtitle" key={subtitle.key}>
              <span className="sub-take">TAKE {subtitle.take}</span>
              <span className="sub-line">“{subtitle.text}”</span>
              {subtitle.note && <span className="sub-note">{subtitle.note}</span>}
            </div>
          )}

          {flashKey > 0 && <div className="dir-flash" key={flashKey} />}

          <form
            className={thinking ? "slate thinking" : "slate"}
            onSubmit={(ev) => {
              ev.preventDefault();
              void direct(line);
            }}
          >
            <div className="slate-clapper" aria-hidden>
              <span />
            </div>
            <div className="slate-body">
              <div className="slate-meta">
                <span>SCENE 1</span>
                <span>TAKE {take + 1}</span>
                <span>{source === "demo" ? "DEMO" : "LIVE"}</span>
              </div>
              <div className="slate-row">
                <input
                  className="slate-input"
                  value={line}
                  onChange={(ev) => setLine(ev.target.value)}
                  placeholder="Direct the shot… or say “freeze”, “cut”"
                  autoFocus
                />
                <button className="primary" type="submit" disabled={thinking || !line.trim()}>
                  {thinking ? "Rolling" : "Action"}
                </button>
              </div>
            </div>
            <div className="slate-hints">
              {HINTS.map((h) => (
                <button key={h} type="button" className="hint" onClick={() => void direct(h)} disabled={thinking}>
                  {h}
                </button>
              ))}
            </div>
          </form>

          {credit && (
            <a className="dir-credit" href={credit.url} target="_blank" rel="noreferrer">
              Photo: {credit.title} · {credit.author} · {credit.license}
            </a>
          )}

          {strip && (
            <div className="strip-modal" onClick={() => setStrip(null)}>
              <div className="strip-card" onClick={(ev) => ev.stopPropagation()}>
                <h2>THAT&apos;S A WRAP</h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={strip} alt="Photo strip of your four shots" className="strip-img" />
                <div className="row-end centered">
                  <button className="ghost" onClick={() => setStrip(null)}>
                    Keep shooting
                  </button>
                  <a className="primary strip-dl" href={strip} download={`director-strip-${Date.now()}.png`}>
                    Download PNG
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

