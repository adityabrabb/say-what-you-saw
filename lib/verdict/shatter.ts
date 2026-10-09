"use client";

import * as THREE from "three";

// The frozen frame shatters into 80 shards that drift in slow motion, then fly back together as the
// BACK of the wanted poster, which spins round to reveal the front. One unit = one CSS pixel, so the
// finished poster lands exactly where the on-screen poster takes over.

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Shard {
  mesh: THREE.Mesh;
  home: THREE.Vector3; // where it sat in the frame
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  target: THREE.Vector3; // where it sits on the poster's back
  fromPos: THREE.Vector3;
  fromRot: THREE.Euler;
  delay: number; // staggered arrival, so they never all turn edge-on at once
}

const COLS = 8;
const ROWS = 5; // 8 x 5 cells, two triangles each = 80 shards
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
uniform sampler2D uFrame;
uniform sampler2D uPaper;
uniform float uMix;
varying vec2 vUv;
void main() {
  vec3 frame = texture2D(uFrame, vUv).rgb;
  vec3 paper = texture2D(uPaper, vUv).rgb;
  // Shards catch a little warm light on their backs while they turn
  vec3 c = mix(frame, paper, uMix);
  if (!gl_FrontFacing) c = mix(c * 0.7, paper * 0.85, 0.6);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Shatter {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private shards: Shard[] = [];
  private material: THREE.ShaderMaterial;
  private textures: THREE.Texture[] = [];
  private poster: THREE.Group | null = null;
  private raf = 0;
  private start = performance.now();
  private phase: "explode" | "assemble" | "spin" | "done" = "explode";
  private phaseAt = 0;
  private resolveDone: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    frame: TexImageSource,
    back: HTMLCanvasElement,
    private vw: number,
    private vh: number,
    private rect: Rect
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(vw, vh);
    this.renderer.domElement.className = "shatter-canvas";
    container.appendChild(this.renderer.domElement);

    const fov = 35;
    const dist = vh / 2 / Math.tan(((fov / 2) * Math.PI) / 180);
    this.camera = new THREE.PerspectiveCamera(fov, vw / vh, 10, dist * 4);
    this.camera.position.z = dist;

    const frameTex = new THREE.Texture(frame as HTMLCanvasElement);
    frameTex.colorSpace = THREE.SRGBColorSpace;
    frameTex.needsUpdate = true;
    const paperTex = new THREE.CanvasTexture(back);
    paperTex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(frameTex, paperTex);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uFrame: { value: frameTex }, uPaper: { value: paperTex }, uMix: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });

    this.buildShards(frame as HTMLCanvasElement);
    this.raf = requestAnimationFrame(this.tick);
  }

  // Jittered grid -> triangles. UVs are cropped the way the frozen frame is shown (object-fit: cover).
  private buildShards(frame: { width: number; height: number }) {
    const fa = frame.width / frame.height;
    const va = this.vw / this.vh;
    const su = fa > va ? va / fa : 1;
    const sv = fa > va ? 1 : fa / va;
    const uvOf = (u: number, v: number) => [(1 - su) / 2 + u * su, (1 - sv) / 2 + v * sv];

    const pts: [number, number][][] = [];
    for (let i = 0; i <= COLS; i++) {
      pts[i] = [];
      for (let j = 0; j <= ROWS; j++) {
        const edgeU = i === 0 || i === COLS;
        const edgeV = j === 0 || j === ROWS;
        pts[i][j] = [(i + (edgeU ? 0 : (Math.random() - 0.5) * 0.7)) / COLS, (j + (edgeV ? 0 : (Math.random() - 0.5) * 0.7)) / ROWS];
      }
    }
    const tris: [number, number][][] = [];
    for (let i = 0; i < COLS; i++)
      for (let j = 0; j < ROWS; j++) {
        const [a, b, c, d] = [pts[i][j], pts[i + 1][j], pts[i + 1][j + 1], pts[i][j + 1]];
        if (Math.random() < 0.5) tris.push([a, b, c], [a, c, d]);
        else tris.push([a, b, d], [b, c, d]);
      }

    const impact = new THREE.Vector2((Math.random() - 0.5) * this.vw * 0.2, (Math.random() - 0.5) * this.vh * 0.2);
    const posterCentre = new THREE.Vector3(this.rect.x + this.rect.w / 2 - this.vw / 2, this.vh / 2 - (this.rect.y + this.rect.h / 2), 0);

    for (const tri of tris) {
      const cu = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
      const cv = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const home = new THREE.Vector3((cu - 0.5) * this.vw, (cv - 0.5) * this.vh, 0);
      const pos: number[] = [];
      const uv: number[] = [];
      for (const [u, v] of tri) {
        pos.push((u - 0.5) * this.vw - home.x, (v - 0.5) * this.vh - home.y, 0);
        uv.push(...uvOf(u, v));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.position.copy(home);
      this.scene.add(mesh);

      const out = new THREE.Vector2(home.x - impact.x, home.y - impact.y);
      const dist = out.length() || 1;
      out.normalize().multiplyScalar(50 + Math.random() * 190 + dist * 0.18);
      this.shards.push({
        mesh,
        home,
        vel: new THREE.Vector3(out.x, out.y, 40 + Math.random() * 260),
        spin: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2.4),
        // Seen from behind, the poster's x is mirrored
        target: new THREE.Vector3(posterCentre.x - (cu - 0.5) * this.rect.w, posterCentre.y + (cv - 0.5) * this.rect.h, 0),
        fromPos: new THREE.Vector3(),
        fromRot: new THREE.Euler(),
        delay: Math.random() * 0.4,
      });
    }
  }

  // Fly the shards together into the poster's back, then spin it round to show `front`.
  assemble(front: HTMLCanvasElement): Promise<void> {
    if (this.phase !== "explode") return Promise.resolve();
    for (const s of this.shards) {
      s.fromPos.copy(s.mesh.position);
      s.fromRot.copy(s.mesh.rotation);
    }
    this.phase = "assemble";
    this.phaseAt = performance.now();

    const frontTex = new THREE.CanvasTexture(front);
    frontTex.colorSpace = THREE.SRGBColorSpace;
    frontTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures.push(frontTex);
    const group = new THREE.Group();
    const plane = new THREE.PlaneGeometry(this.rect.w, this.rect.h);
    const face = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: frontTex }));
    const backMesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: this.material.uniforms.uPaper.value }));
    backMesh.rotation.y = Math.PI;
    group.add(face, backMesh);
    group.position.set(this.rect.x + this.rect.w / 2 - this.vw / 2, this.vh / 2 - (this.rect.y + this.rect.h / 2), 0);
    group.rotation.y = Math.PI;
    group.visible = false;
    this.scene.add(group);
    this.poster = group;
    return new Promise((res) => (this.resolveDone = res));
  }

  private tick = (now: number) => {
    const t = (now - this.start) / 1000;
    if (this.phase === "explode") {
      // Slow motion: fast at first, then easing towards a near-standstill
      const k = 1 - Math.exp(-t / 0.9);
      const r = 1 - Math.exp(-t / 1.4);
      for (const s of this.shards) {
        s.mesh.position.set(s.home.x + s.vel.x * k, s.home.y + s.vel.y * k, s.vel.z * k);
        s.mesh.rotation.set(s.spin.x * r, s.spin.y * r, s.spin.z * r);
      }
    } else if (this.phase === "assemble") {
      const p = Math.min(1, (now - this.phaseAt) / 1700);
      const sx = this.rect.w / this.vw;
      const sy = this.rect.h / this.vh;
      for (const s of this.shards) {
        const e = easeInOut(Math.min(1, Math.max(0, (p - s.delay) / (1 - s.delay))));
        s.mesh.position.lerpVectors(s.fromPos, s.target, e);
        s.mesh.rotation.set(s.fromRot.x * (1 - e), s.fromRot.y * (1 - e) + Math.PI * e, s.fromRot.z * (1 - e));
        s.mesh.scale.set(1 + (sx - 1) * e, 1 + (sy - 1) * e, 1);
      }
      this.material.uniforms.uMix.value = Math.min(1, p * 1.6);
      if (p >= 1) {
        this.shards.forEach((s) => (s.mesh.visible = false));
        if (this.poster) this.poster.visible = true;
        this.phase = "spin";
        this.phaseAt = now;
      }
    } else if (this.phase === "spin" && this.poster) {
      const p = Math.min(1, (now - this.phaseAt) / 1200);
      this.poster.rotation.y = Math.PI * (1 - easeOutBack(p));
      if (p >= 1) {
        this.poster.rotation.y = 0;
        this.phase = "done";
        this.resolveDone?.();
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (this.phase !== "done") this.raf = requestAnimationFrame(this.tick);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (o.material !== this.material) (o.material as THREE.Material).dispose();
      }
    });
    this.material.dispose();
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
