// Director mode renderer: every layer is composited in ONE fullscreen WebGL2 pass.
// Back to front: background (image / procedural / real room, blurred via mipmaps) ->
// person cut out with a feathered mask -> face-aware key light + rim -> colour grade ->
// overlays (behind-the-head items are occluded by the mask) -> film grain -> light leaks.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // (0,0) = top-left
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVideo, uMask, uBgA, uBgB, uOvFront, uOvBack;
uniform vec2 uRes, uCrop, uMaskTexel;
uniform float uTime, uMirror, uUseAlpha, uLite;
uniform float uBgTypeA, uBgTypeB, uBgBlurA, uBgBlurB, uBgMix;
uniform vec3 uStudio;
uniform vec4 uFace, uMouth;
uniform float uTeeth;
uniform vec2 uLightDir;
uniform vec3 uLightColor;
uniform float uLightInt, uLightSoft, uRim;
uniform float uExposure, uContrast, uSat, uTemp, uTint, uFade, uMono, uBleach, uVignette;
uniform vec3 uShadows, uHighlights;
uniform float uGrain, uGrainSize, uLeaks;
uniform vec3 uLeakColor;
uniform float uOvFrontOn, uOvBackOn;

const vec3 W = vec3(0.2126, 0.7152, 0.0722);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

vec2 videoUv(vec2 uv) {
  vec2 v = (uv - 0.5) * uCrop + 0.5;
  if (uMirror > 0.5) v.x = 1.0 - v.x;
  return v;
}

// ---------- Procedural backgrounds ----------
vec3 neonCity(vec2 uv, float blur) {
  float y = 1.0 - uv.y;
  vec3 col = mix(vec3(0.32, 0.04, 0.34), vec3(0.02, 0.01, 0.07), smoothstep(0.3, 1.0, y));
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float n = 9.0 + fk * 9.0;
    float cell = floor(uv.x * n + fk * 3.7);
    float h = 0.22 + hash(vec2(cell, fk)) * (0.42 - fk * 0.1);
    if (y < h) {
      vec3 b = mix(vec3(0.06, 0.03, 0.12), vec3(0.015, 0.01, 0.04), fk / 2.0);
      vec2 w = vec2(uv.x * n * 5.0, y * n * 7.0);
      float lit = step(0.62, hash(floor(w) + fk * 13.0)) * step(0.2, fract(w.x)) * step(fract(w.x), 0.7) * step(0.25, fract(w.y)) * step(fract(w.y), 0.75);
      vec3 neon = mix(vec3(1.0, 0.17, 0.84), vec3(0.0, 0.94, 1.0), hash(floor(w) * 1.7));
      neon = mix(neon, vec3(1.0, 0.85, 0.3), step(0.8, hash(floor(w) * 2.3)));
      b += neon * lit * (0.75 + 0.25 * sin(uTime * 2.0 + cell)) * (1.0 - blur * 0.7);
      col = b;
    }
  }
  float c = floor(uv.x * 150.0);
  float sp = 0.7 + hash(vec2(c, 1.0));
  float d = fract(uv.y * 2.5 - uTime * sp * 1.6 + hash(vec2(c, 2.0)));
  float rain = smoothstep(0.0, 0.03, d) * smoothstep(0.1, 0.03, d) * step(0.55, hash(vec2(c, 3.0)));
  col += vec3(0.55, 0.7, 1.0) * rain * 0.3 * (1.0 - blur);
  col += vec3(0.9, 0.2, 0.8) * smoothstep(0.12, 0.0, y) * 0.25; // wet street glow
  return col;
}

vec3 starField(vec2 uv, float blur) {
  vec3 col = mix(vec3(0.01, 0.01, 0.04), vec3(0.05, 0.02, 0.12), uv.y);
  float neb = fbm(uv * vec2(3.0, 2.0) + vec2(uTime * 0.01, 0.0));
  col += mix(vec3(0.35, 0.08, 0.5), vec3(0.0, 0.35, 0.45), fbm(uv * 4.0 + 7.0)) * pow(neb, 2.2) * 0.9;
  for (int k = 0; k < 2; k++) {
    vec2 g = uv * (k == 0 ? vec2(170.0, 96.0) : vec2(60.0, 34.0));
    vec2 id = floor(g);
    float h = hash(id + float(k) * 31.0);
    float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 20.0);
    float s = step(k == 0 ? 0.975 : 0.93, h) * smoothstep(0.45, 0.0, length(fract(g) - 0.5)) * tw;
    col += vec3(0.85, 0.9, 1.0) * s * (1.0 - blur * 0.8) * (k == 0 ? 0.8 : 1.2);
  }
  return col;
}

vec3 sunset(vec2 uv, float blur) {
  float y = 1.0 - uv.y;
  vec3 col = mix(vec3(1.0, 0.55, 0.2), vec3(0.95, 0.32, 0.45), smoothstep(0.25, 0.55, y));
  col = mix(col, vec3(0.22, 0.08, 0.35), smoothstep(0.5, 1.0, y));
  float sun = length((uv - vec2(0.5, 0.62)) * vec2(1.78, 1.0));
  col += vec3(1.0, 0.85, 0.5) * smoothstep(0.1, 0.09, sun) + vec3(1.0, 0.6, 0.3) * exp(-sun * 6.0) * 0.6;
  col += vec3(1.0, 0.7, 0.6) * (fbm(vec2(uv.x * 3.0 + uTime * 0.02, y * 18.0)) - 0.5) * 0.12 * (1.0 - blur);
  float hill = 0.2 + 0.035 * sin(uv.x * 7.0 + 1.0) + 0.025 * noise(vec2(uv.x * 12.0, 1.0));
  col = mix(col, vec3(0.12, 0.04, 0.16), smoothstep(hill + 0.004, hill - 0.004, y));
  return col;
}

vec3 studio(vec2 uv) {
  float d = length((uv - vec2(0.5, 0.42)) * vec2(1.0, 1.25));
  vec3 col = uStudio * (1.18 - d * 0.95);
  col *= 1.0 - smoothstep(0.7, 1.0, uv.y) * 0.18; // floor sweep
  return col + (hash(uv * 900.0) - 0.5) * 0.015;
}

vec3 forest(vec2 uv, float blur) {
  float y = 1.0 - uv.y;
  vec3 fog = mix(vec3(0.62, 0.68, 0.7), vec3(0.82, 0.86, 0.86), y);
  vec3 col = fog;
  for (int k = 2; k >= 0; k--) {
    float fk = float(k);
    float n = 7.0 + fk * 6.0;
    float cell = floor(uv.x * n + fk * 5.3);
    float cx = (cell + 0.5 + (hash(vec2(cell, fk)) - 0.5) * 0.6) / n;
    float w = (0.006 + hash(vec2(cell, fk + 9.0)) * 0.012) * (2.6 - fk * 0.7);
    float trunk = smoothstep(w, w * 0.5, abs(uv.x - cx)) * step(hash(vec2(cell, fk + 3.0)), 0.8);
    vec3 tc = mix(vec3(0.1, 0.12, 0.11), fog, 0.25 + fk * 0.25 + blur * 0.3);
    col = mix(col, tc, trunk);
  }
  col = mix(col, fog * 1.05, (fbm(uv * vec2(3.0, 6.0) + vec2(uTime * 0.03, 0.0)) - 0.35) * 0.6);
  col = mix(col, vec3(0.16, 0.2, 0.15), smoothstep(0.12, 0.0, y));
  return col;
}

vec3 sampleBlur(sampler2D t, vec2 uv, float lod) {
  if (uLite > 0.5) return textureLod(t, uv, lod).rgb; // lite: one tap, mips already blur
  vec2 o = vec2(0.0018, 0.0032) * (1.0 + lod);
  return (textureLod(t, uv, lod).rgb * 2.0 + textureLod(t, uv + o, lod).rgb + textureLod(t, uv - o, lod).rgb
        + textureLod(t, uv + vec2(o.x, -o.y), lod).rgb + textureLod(t, uv + vec2(-o.x, o.y), lod).rgb) / 6.0;
}

vec3 background(float type, float blur, sampler2D img, vec2 uv) {
  if (type < 0.5) return blur > 0.01 ? sampleBlur(uVideo, videoUv(uv), blur * 5.5) : texture(uVideo, videoUv(uv)).rgb;
  if (type < 1.5) return blur > 0.01 ? sampleBlur(img, uv, blur * 5.5) : texture(img, uv).rgb;
  if (type < 2.5) return neonCity(uv, blur);
  if (type < 3.5) return starField(uv, blur);
  if (type < 4.5) return sunset(uv, blur);
  if (type < 5.5) return studio(uv);
  return forest(uv, blur);
}

float maskAt(vec2 v) { return uUseAlpha > 0.5 ? texture(uVideo, v).a : texture(uMask, v).r; }

// Bicubic (B-spline) mask lookup from 4 bilinear taps: removes the stair-steps you get
// from stretching a 256x144 mask over a 1280x720 frame.
float maskCubic(vec2 uv) {
  if (uUseAlpha > 0.5) return texture(uVideo, uv).a;
  vec2 res = 1.0 / uMaskTexel;
  vec2 st = uv * res - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (w1 / g0 - 1.0 + i + 0.5) * uMaskTexel;
  vec2 h1 = (w3 / g1 + 1.0 + i + 0.5) * uMaskTexel;
  return g0.y * (g0.x * texture(uMask, vec2(h0.x, h0.y)).r + g1.x * texture(uMask, vec2(h1.x, h0.y)).r)
       + g1.y * (g0.x * texture(uMask, vec2(h0.x, h1.y)).r + g1.x * texture(uMask, vec2(h1.x, h1.y)).r);
}

// Feathered matte: bicubic centre plus a ring of 8 soft samples (~2 mask texels out).
float softMask(vec2 v) {
  if (uLite > 0.5) return maskAt(v); // lite: plain bilinear mask, no bicubic or feather ring
  vec2 r = uMaskTexel * 2.2;
  float s = maskCubic(v) * 4.0;
  s += maskAt(v + vec2(r.x, 0.0)) + maskAt(v - vec2(r.x, 0.0)) + maskAt(v + vec2(0.0, r.y)) + maskAt(v - vec2(0.0, r.y));
  vec2 d = r * 0.7071;
  s += maskAt(v + d) + maskAt(v - d) + maskAt(v + vec2(d.x, -d.y)) + maskAt(v + vec2(-d.x, d.y));
  return s / 12.0;
}

void main() {
  vec2 uv = vUv;
  vec2 vuv = videoUv(uv);

  // ---- Background (two slots, crossfaded) ----
  vec3 bg = uBgMix < 0.999 ? background(uBgTypeA, uBgBlurA, uBgA, uv) : vec3(0.0);
  if (uBgMix > 0.001) bg = mix(bg, background(uBgTypeB, uBgBlurB, uBgB, uv), uBgMix);

  // ---- Person and feathered mask ----
  vec3 person = texture(uVideo, vuv).rgb;
  vec2 o = uMaskTexel * 1.6;
  float mx1 = maskAt(vuv + vec2(o.x, 0.0)), mx0 = maskAt(vuv - vec2(o.x, 0.0));
  float my1 = maskAt(vuv + vec2(0.0, o.y)), my0 = maskAt(vuv - vec2(0.0, o.y));
  // Soft, smooth edge that sits just inside the body so no background halo leaks in.
  float m = smoothstep(0.42, 0.78, softMask(vuv));
  float edge = m * (1.0 - m) * 4.0;
  vec2 grad = vec2(mx1 - mx0, my0 - my1); // points into the person (screen space, y up)
  if (uMirror > 0.5) grad.x = -grad.x;

  // ---- Key light shaped by the face ----
  vec2 fc = uFace.xy;
  vec2 fr = max(uFace.zw, vec2(0.01));
  vec2 d = (uv - fc) / fr;
  float r2 = dot(d, d);
  float inFace = 1.0 - smoothstep(0.75, 1.15, sqrt(r2));
  vec3 n = normalize(vec3(d.x, -d.y, sqrt(max(0.0, 1.0 - min(r2, 1.0)))));
  vec3 L = normalize(vec3(uLightDir, 0.7 - uLightSoft * 0.3));
  float ndl = (dot(n, L) + uLightSoft * 0.6) / (1.0 + uLightSoft * 0.6);
  float body = clamp(dot((uv - fc) / max(fr.y * 3.0, 0.05) * vec2(1.0, -1.0), uLightDir) * 0.5 + 0.5, 0.0, 1.0);
  float lit = clamp(mix(body * 0.75, ndl, inFace), 0.0, 1.0);
  float amt = uLightInt * lit * m;
  float shade = uLightInt * (1.0 - lit) * 0.2 * m; // gentle fall-off on the shadow side, flattering not harsh
  person = person * (1.0 - shade) + person * uLightColor * amt * 0.85 + uLightColor * amt * 0.05;
  person += person * uLightColor * inFace * uLightInt * 0.12; // lift the inside of the face
  float rim = edge * max(dot(normalize(-grad + 1e-5), uLightDir), 0.0) * uRim * 1.6;
  person += uLightColor * rim * (0.6 + uLightInt * 0.4);

  // ---- Gold teeth: bright, low-saturation pixels inside the mouth ----
  if (uTeeth > 0.01 && uLite < 0.5) {
    vec2 dm = (uv - uMouth.xy) / max(uMouth.zw, vec2(0.004));
    float inMouth = 1.0 - smoothstep(0.75, 1.0, length(dm));
    float l = dot(person, W);
    float sat = max(person.r, max(person.g, person.b)) - min(person.r, min(person.g, person.b));
    float t = inMouth * smoothstep(0.32, 0.55, l) * (1.0 - smoothstep(0.1, 0.28, sat)) * uTeeth;
    vec3 gold = vec3(1.0, 0.76, 0.24) * (0.45 + l * 0.85) + pow(l, 6.0) * 0.6;
    person = mix(person, gold, t);
  }

  // Light wrap: let a little background bleed onto the cut-out edges so it sits in the scene.
  if (uLite < 0.5) person = mix(person, bg, edge * 0.22);
  vec3 col = mix(bg, person, m);

  // ---- Colour grade ----
  col *= exp2(uExposure);
  col *= vec3(1.0 + uTemp * 0.12 + uTint * 0.05, 1.0 - uTint * 0.08, 1.0 - uTemp * 0.12 + uTint * 0.05);
  float lum = dot(col, W);
  col = mix(vec3(lum), col, uSat);
  col = mix(col, vec3(lum), uMono);
  col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.4);
  float l2 = clamp(dot(col, W), 0.0, 1.0);
  col += uShadows * (1.0 - l2) * (1.0 - l2) + uHighlights * l2 * l2;
  if (uBleach > 0.01) {
    vec3 b = vec3(l2);
    vec3 ov = mix(2.0 * col * b, 1.0 - 2.0 * (1.0 - col) * (1.0 - b), step(0.5, b));
    col = mix(col, mix(ov, b, 0.35), uBleach);
  }
  col = mix(col, col * 0.8 + 0.1, uFade);
  col *= 1.0 - uVignette * smoothstep(0.35, 0.95, length((uv - 0.5) * vec2(1.25, 1.0)) * 1.25);

  // ---- Overlays: behind-the-head layer is hidden by the person, front layer on top ----
  if (uOvBackOn > 0.5) { vec4 ob = texture(uOvBack, uv); col = col * (1.0 - ob.a * (1.0 - m)) + ob.rgb * (1.0 - m); }
  if (uOvFrontOn > 0.5) { vec4 of = texture(uOvFront, uv); col = col * (1.0 - of.a) + of.rgb; }

  // ---- Film grain ----
  if (uLite < 0.5 && uGrain > 0.001) {
  float g = hash(floor(gl_FragCoord.xy / uGrainSize) + fract(uTime * 7.31) * vec2(91.7, 13.3)) - 0.5;
  g += (hash(floor(gl_FragCoord.xy / (uGrainSize * 2.0)) + fract(uTime * 3.17) * vec2(17.3, 47.9)) - 0.5) * 0.6;
  float mid = 1.0 - abs(clamp(dot(col, W), 0.0, 1.0) - 0.5) * 1.4;
  col += g * uGrain * 0.2 * (0.5 + 0.5 * mid);
  }

  // ---- Light leaks (screen blend) ----
  if (uLeaks > 0.01 && uLite < 0.5) {
    float a = exp(-dot((uv - vec2(-0.06, 0.3 + 0.2 * sin(uTime * 0.37))) * vec2(1.5, 1.0), (uv - vec2(-0.06, 0.3 + 0.2 * sin(uTime * 0.37))) * vec2(1.5, 1.0)) * 5.0);
    float b = exp(-dot((uv - vec2(1.06, 0.78 + 0.15 * sin(uTime * 0.29 + 2.0))) * vec2(1.4, 1.0), (uv - vec2(1.06, 0.78 + 0.15 * sin(uTime * 0.29 + 2.0))) * vec2(1.4, 1.0)) * 4.0);
    float leak = (a + 0.7 * b) * (0.75 + 0.25 * sin(uTime * 1.3));
    col = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - uLeakColor * leak * uLeaks);
  }

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export interface FrameUniforms {
  time: number;
  mirror: boolean;
  useAlphaMask: boolean;
  crop: [number, number];
  maskSize: [number, number];
  bgA: { type: number; blur: number };
  bgB: { type: number; blur: number };
  bgMix: number;
  studio: [number, number, number];
  face: [number, number, number, number];
  mouth: [number, number, number, number];
  teeth: number;
  lightDir: [number, number];
  lightColor: [number, number, number];
  lightInt: number;
  lightSoft: number;
  rim: number;
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  fade: number;
  mono: number;
  bleach: number;
  vignette: number;
  shadows: [number, number, number];
  highlights: [number, number, number];
  grain: number;
  grainSize: number;
  leaks: number;
  leakColor: [number, number, number];
  overlayFront: boolean;
  overlayBack: boolean;
  lite?: boolean;
}

type Tex = "video" | "mask" | "bgA" | "bgB" | "ovFront" | "ovBack";

export class DirectorRenderer {
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private loc = new Map<string, WebGLUniformLocation | null>();
  private tex: Record<Tex, WebGLTexture>;
  private videoSize: [number, number] = [0, 0];
  private videoMips = false;
  private maskSize: [number, number] = [0, 0];

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not available in this browser");
    this.gl = gl;
    this.program = this.link(VERT, FRAG);
    gl.useProgram(this.program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const make = (unit: number, name: string) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // 1x1 placeholder so every sampler is always complete.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.uniform1i(this.u(name), unit);
      return t;
    };
    this.tex = { video: make(0, "uVideo"), mask: make(1, "uMask"), bgA: make(2, "uBgA"), bgB: make(3, "uBgB"), ovFront: make(4, "uOvFront"), ovBack: make(5, "uOvBack") };
  }

  private link(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    return p;
  }

  private u(name: string) {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(this.program, name));
    return this.loc.get(name)!;
  }

  private bind(t: Tex) {
    const unit = { video: 0, mask: 1, bgA: 2, bgB: 3, ovFront: 4, ovBack: 5 }[t];
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex[t]);
  }

  // Upload the camera (or demo silhouette) frame. Mipmaps only when the room is shown blurred.
  setVideo(source: TexImageSource, width: number, height: number, mips: boolean) {
    const gl = this.gl;
    this.bind("video");
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (this.videoSize[0] !== width || this.videoSize[1] !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.videoSize = [width, height];
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    if (mips !== this.videoMips) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      this.videoMips = mips;
    }
  }

  setMask(data: Uint8Array, width: number, height: number) {
    const gl = this.gl;
    this.bind("mask");
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (this.maskSize[0] !== width || this.maskSize[1] !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      this.maskSize = [width, height];
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  setBackgroundImage(slot: "bgA" | "bgB", img: TexImageSource) {
    const gl = this.gl;
    this.bind(slot);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }

  // Swap the background slots after a crossfade so B becomes the new A.
  swapBackgrounds() {
    [this.tex.bgA, this.tex.bgB] = [this.tex.bgB, this.tex.bgA];
    this.bind("bgA");
    this.bind("bgB");
  }

  setOverlay(slot: "ovFront" | "ovBack", canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = this.gl;
    this.bind(slot);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  render(f: FrameUniforms) {
    const gl = this.gl;
    const u = (n: string) => this.u(n);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    // Re-bind every unit (slots may have been swapped).
    (["video", "mask", "bgA", "bgB", "ovFront", "ovBack"] as Tex[]).forEach((t) => this.bind(t));
    gl.uniform2f(u("uRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(u("uCrop"), f.crop[0], f.crop[1]);
    gl.uniform2f(u("uMaskTexel"), 1 / Math.max(1, f.maskSize[0]), 1 / Math.max(1, f.maskSize[1]));
    gl.uniform1f(u("uTime"), f.time);
    gl.uniform1f(u("uLite"), f.lite ? 1 : 0);
    gl.uniform1f(u("uMirror"), f.mirror ? 1 : 0);
    gl.uniform1f(u("uUseAlpha"), f.useAlphaMask ? 1 : 0);
    gl.uniform1f(u("uBgTypeA"), f.bgA.type);
    gl.uniform1f(u("uBgTypeB"), f.bgB.type);
    gl.uniform1f(u("uBgBlurA"), f.bgA.blur);
    gl.uniform1f(u("uBgBlurB"), f.bgB.blur);
    gl.uniform1f(u("uBgMix"), f.bgMix);
    gl.uniform3fv(u("uStudio"), f.studio);
    gl.uniform4fv(u("uFace"), f.face);
    gl.uniform4fv(u("uMouth"), f.mouth);
    gl.uniform1f(u("uTeeth"), f.teeth);
    gl.uniform2fv(u("uLightDir"), f.lightDir);
    gl.uniform3fv(u("uLightColor"), f.lightColor);
    gl.uniform1f(u("uLightInt"), f.lightInt);
    gl.uniform1f(u("uLightSoft"), f.lightSoft);
    gl.uniform1f(u("uRim"), f.rim);
    gl.uniform1f(u("uExposure"), f.exposure);
    gl.uniform1f(u("uContrast"), f.contrast);
    gl.uniform1f(u("uSat"), f.saturation);
    gl.uniform1f(u("uTemp"), f.temperature);
    gl.uniform1f(u("uTint"), f.tint);
    gl.uniform1f(u("uFade"), f.fade);
    gl.uniform1f(u("uMono"), f.mono);
    gl.uniform1f(u("uBleach"), f.bleach);
    gl.uniform1f(u("uVignette"), f.vignette);
    gl.uniform3fv(u("uShadows"), f.shadows);
    gl.uniform3fv(u("uHighlights"), f.highlights);
    gl.uniform1f(u("uGrain"), f.grain);
    gl.uniform1f(u("uGrainSize"), f.grainSize);
    gl.uniform1f(u("uLeaks"), f.leaks);
    gl.uniform3fv(u("uLeakColor"), f.leakColor);
    gl.uniform1f(u("uOvFrontOn"), f.overlayFront ? 1 : 0);
    gl.uniform1f(u("uOvBackOn"), f.overlayBack ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
