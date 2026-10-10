"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Opening title, built in three.js: a projector beam cuts down through the dark, dust floats in it,
// and "Say What You Saw" assembles itself out of that dust. When it is whole, the real (DOM) title
// takes over from the particles and the beam stays on as quiet dust behind the card.
// One unit = one CSS pixel; the shaders place everything themselves, so no camera maths is needed.

const BEAM = /* glsl */ `
uniform float uW; uniform float uH; uniform float uReach;
float beam(vec2 p) {
  float cx = uW * 0.5;
  float hw = uW * 0.035 + max(p.y, 0.0) * 0.32;
  float side = 1.0 - smoothstep(hw * 0.55, hw, abs(p.x - cx));
  float reach = 1.0 - smoothstep(uReach * uH - 40.0, uReach * uH + 90.0, p.y);
  float fall = mix(1.0, 0.45, clamp(p.y / uH, 0.0, 1.0));
  return side * reach * fall;
}`;

const BEAM_VERT = /* glsl */ `
varying vec2 vPx; uniform float uW; uniform float uH;
void main() { vPx = vec2(uv.x * uW, (1.0 - uv.y) * uH); gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BEAM_FRAG = /* glsl */ `
varying vec2 vPx; uniform float uTime; uniform float uFlick;
${BEAM}
void main() {
  float b = beam(vPx);
  float band = 0.94 + 0.06 * sin(vPx.y * 0.05 - uTime * 3.0 + sin(vPx.x * 0.01));
  gl_FragColor = vec4(vec3(0.94, 0.9, 0.8) * b * 0.2 * uFlick * band, 1.0);
}`;

const PT_VERT = /* glsl */ `
attribute vec2 aStart; attribute vec2 aTarget; attribute vec4 aRand; attribute float aKind;
uniform float uTime; uniform float uDpr; uniform float uTitleFade;
varying float vAlpha;
${BEAM}
void main() {
  float k = clamp((uTime - (0.9 + aRand.x * 1.5)) / 1.7, 0.0, 1.0);
  float e = k * k * (3.0 - 2.0 * k);
  vec2 drift = vec2(sin(uTime * aRand.y + aRand.z * 6.28), cos(uTime * aRand.y * 0.8 + aRand.z * 9.0)) * mix(16.0, 1.2, e);
  vec2 p;
  if (aKind < 0.5) {
    p = vec2(aStart.x + drift.x, mod(aStart.y + uTime * (6.0 + aRand.w * 14.0), uH));
  } else {
    p = mix(aStart + drift, aTarget, e) + vec2(0.0, (1.0 - e) * e * -40.0 * aRand.w);
  }
  float lit = beam(p);
  vAlpha = aKind < 0.5 ? lit * (0.25 + 0.6 * aRand.w) : mix(lit * 0.7, 1.0, e) * uTitleFade;
  gl_PointSize = (aKind < 0.5 ? 1.2 + aRand.w * 2.2 : 2.6) * uDpr;
  gl_Position = vec4(p.x / uW * 2.0 - 1.0, 1.0 - p.y / uH * 2.0, 0.0, 1.0);
}`;
const PT_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.18, 0.5, d)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * a, a);
}`;

interface Props {
  title: string;
  target: React.RefObject<HTMLElement | null>; // the real title: the particles land exactly on its letters
  onAssembled: () => void;
  onFail: () => void;
}

export default function BeamTitle({ title, target, onAssembled, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onAssembled, onFail });
  cb.current = { onAssembled, onFail };

  useEffect(() => {
    const el = host.current;
    const h1 = target.current;
    if (!el || !h1) return;
    let raf = 0;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];

    const run = async () => {
      try {
        await document.fonts?.ready;
        if (disposed) return;
        const stage = el.getBoundingClientRect();
        const W = Math.max(320, Math.round(stage.width));
        const H = Math.max(240, Math.round(stage.height));
        const r = h1.getBoundingClientRect();
        const cs = getComputedStyle(h1);

        // Sample the title's letters from an offscreen canvas, at the title's real size and place.
        const tw = Math.ceil(r.width) + 8;
        const th = Math.ceil(r.height) + 8;
        const off = document.createElement("canvas");
        off.width = tw;
        off.height = th;
        const g = off.getContext("2d", { willReadFrequently: true })!;
        g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "#fff";
        g.fillText(title, tw / 2, th / 2 + parseFloat(cs.fontSize) * 0.04);
        const px = g.getImageData(0, 0, tw, th).data;
        const step = Math.max(2, Math.round(parseFloat(cs.fontSize) / 34));
        const pts: [number, number][] = [];
        for (let y = 0; y < th; y += step) {
          for (let x = 0; x < tw; x += step) {
            if (px[(y * tw + x) * 4 + 3] > 140) pts.push([r.left - stage.left - 4 + x + (Math.random() - 0.5) * step, r.top - stage.top - 4 + y + (Math.random() - 0.5) * step]);
          }
        }
        while (pts.length > 4200) pts.splice(Math.floor(Math.random() * pts.length), 1);
        if (!pts.length) throw new Error("no glyphs");

        const DUST = Math.round(Math.min(700, (W * H) / 1800));
        const n = pts.length + DUST;
        const start = new Float32Array(n * 2);
        const tgt = new Float32Array(n * 2);
        const rnd = new Float32Array(n * 4);
        const kind = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const isTitle = i < pts.length;
          const y = Math.random() * H;
          const hw = W * 0.035 + y * 0.32;
          start[i * 2] = W / 2 + (Math.random() * 2 - 1) * hw * 0.8;
          start[i * 2 + 1] = y;
          if (isTitle) {
            tgt[i * 2] = pts[i][0];
            tgt[i * 2 + 1] = pts[i][1];
          }
          // x = arrival delay (left to right), y = drift speed, z = phase, w = size/brightness
          rnd[i * 4] = isTitle ? Math.min(1, Math.max(0, (pts[i][0] - (r.left - stage.left)) / Math.max(1, r.width))) * 0.8 + Math.random() * 0.4 : Math.random();
          rnd[i * 4 + 1] = 0.4 + Math.random() * 1.2;
          rnd[i * 4 + 2] = Math.random();
          rnd[i * 4 + 3] = Math.random();
          kind[i] = isTitle ? 1 : 0;
        }

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H, false);
        renderer.setClearColor(0x000000, 0);
        const cv = renderer.domElement;
        cv.className = "beam-canvas";
        el.appendChild(cv);

        const scene = new THREE.Scene();
        const cam = new THREE.Camera();
        const shared = { uTime: { value: 0 }, uW: { value: W }, uH: { value: H }, uReach: { value: 0 } };

        const quadGeo = new THREE.PlaneGeometry(2, 2);
        const quadMat = new THREE.ShaderMaterial({
          vertexShader: BEAM_VERT,
          fragmentShader: BEAM_FRAG,
          uniforms: { ...shared, uFlick: { value: 1 } },
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        const quad = new THREE.Mesh(quadGeo, quadMat);
        quad.frustumCulled = false;
        scene.add(quad);

        const pg = new THREE.BufferGeometry();
        pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        pg.setAttribute("aStart", new THREE.BufferAttribute(start, 2));
        pg.setAttribute("aTarget", new THREE.BufferAttribute(tgt, 2));
        pg.setAttribute("aRand", new THREE.BufferAttribute(rnd, 4));
        pg.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
        const pm = new THREE.ShaderMaterial({
          vertexShader: PT_VERT,
          fragmentShader: PT_FRAG,
          uniforms: { ...shared, uDpr: { value: dpr }, uTitleFade: { value: 1 } },
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        const points = new THREE.Points(pg, pm);
        points.frustumCulled = false;
        scene.add(points);
        geos.push(quadGeo, pg);
        mats.push(quadMat, pm);

        const t0 = performance.now();
        let told = false;
        const frame = (now: number) => {
          const t = (now - t0) / 1000;
          shared.uTime.value = t;
          shared.uReach.value = Math.min(1.25, t / 0.9); // the beam is thrown down the frame in under a second
          quadMat.uniforms.uFlick.value = 0.93 + 0.07 * Math.sin(t * 151) * Math.sin(t * 37);
          if (t > 3.9) {
            if (!told) {
              told = true;
              cb.current.onAssembled();
            }
            pm.uniforms.uTitleFade.value = Math.max(0, 1 - (t - 3.9) / 0.9);
          }
          renderer!.render(scene, cam);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch {
        if (!disposed) cb.current.onFail();
      }
    };
    void run();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
    };
  }, [title, target]);

  return <div className="beam-host" ref={host} aria-hidden />;
}
