"use client";

// MediaPipe tracking for Director mode, loaded lazily (WASM + models come from CDN only on this page).
// Segmentation runs on a small 256x144 copy of the frame; the face landmarker on 512x288.

const VERSION = "1.1.0";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const SEG_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const MASK_W = 256;
export const MASK_H = 144;

export interface Point {
  x: number;
  y: number;
}

type Segmenter = import("@mediapipe/tasks-vision").ImageSegmenter;
type Landmarker = import("@mediapipe/tasks-vision").FaceLandmarker;

export class Tracker {
  private segCanvas = document.createElement("canvas");
  private faceCanvas = document.createElement("canvas");
  private segCtx: CanvasRenderingContext2D;
  private faceCtx: CanvasRenderingContext2D;
  private smooth = new Float32Array(MASK_W * MASK_H);
  readonly mask = new Uint8Array(MASK_W * MASK_H);
  private lastTs = 0;
  private frame = 0;
  segEvery = 1;
  faceEvery = 2;

  private constructor(private seg: Segmenter, private face: Landmarker) {
    this.segCanvas.width = MASK_W;
    this.segCanvas.height = MASK_H;
    this.faceCanvas.width = 512;
    this.faceCanvas.height = 288;
    this.segCtx = this.segCanvas.getContext("2d", { willReadFrequently: false })!;
    this.faceCtx = this.faceCanvas.getContext("2d")!;
  }

  static async create(onStatus: (s: string) => void): Promise<Tracker> {
    onStatus("Loading vision engine…");
    const vision = await import("@mediapipe/tasks-vision");
    const files = await vision.FilesetResolver.forVisionTasks(WASM);
    const make = async <T,>(fn: (delegate: "GPU" | "CPU") => Promise<T>) => {
      try {
        return await fn("GPU");
      } catch {
        return fn("CPU"); // some machines have no usable GPU delegate
      }
    };
    onStatus("Loading person cut-out…");
    const seg = await make((delegate) =>
      vision.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: SEG_MODEL, delegate },
        runningMode: "VIDEO",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      })
    );
    onStatus("Loading face tracking…");
    const face = await make((delegate) =>
      vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      })
    );
    return new Tracker(seg, face);
  }

  // Run whichever trackers are due this frame. Returns what changed.
  process(video: HTMLVideoElement): { mask: boolean; landmarks: Point[] | null } {
    this.frame++;
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    let maskUpdated = false;
    let landmarks: Point[] | null = null;

    if (this.frame % this.segEvery === 0) {
      this.segCtx.drawImage(video, 0, 0, MASK_W, MASK_H);
      this.seg.segmentForVideo(this.segCanvas, ts, (result) => {
        const m = result.confidenceMasks?.[0];
        if (!m) return;
        const data = m.getAsFloat32Array();
        // Temporal smoothing kills edge flicker; then quantise for the GPU.
        for (let i = 0; i < data.length && i < this.smooth.length; i++) {
          this.smooth[i] = this.smooth[i] * 0.35 + data[i] * 0.65;
          this.mask[i] = this.smooth[i] * 255;
        }
        maskUpdated = true;
      });
    }

    if (this.frame % this.faceEvery === 0) {
      this.faceCtx.drawImage(video, 0, 0, 512, 288);
      const r = this.face.detectForVideo(this.faceCanvas, ts);
      landmarks = r.faceLandmarks?.[0]?.map((p) => ({ x: p.x, y: p.y })) ?? [];
    }
    return { mask: maskUpdated, landmarks };
  }

  // Back off when frames get slow so rendering stays at 30fps or better.
  adapt(frameMs: number) {
    if (frameMs > 30) {
      this.segEvery = Math.min(3, this.segEvery + 1);
      this.faceEvery = Math.min(4, this.faceEvery + 1);
    } else if (frameMs < 18) {
      this.segEvery = Math.max(1, this.segEvery - 1);
      this.faceEvery = Math.max(2, this.faceEvery - 1);
    }
  }

  close() {
    this.seg.close();
    this.face.close();
  }
}

// ---------- Face anchors ----------

export interface FaceAnchors {
  head: Point;
  "head-top": Point;
  forehead: Point;
  "left-eye": Point;
  "right-eye": Point;
  nose: Point;
  mouth: Point;
  chin: Point;
  "left-cheek": Point;
  "right-cheek": Point;
  faceW: number; // face width in screen uv-x units
  faceH: number;
  roll: number; // head tilt in radians
  mouthW: number;
  mouthH: number;
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Landmarks are normalised to the video frame; map them to screen uv (crop + mirror).
export function anchorsFromLandmarks(lm: Point[], crop: [number, number], mirror: boolean): FaceAnchors | null {
  if (lm.length < 468) return null;
  const s = (i: number): Point => {
    let x = lm[i].x;
    if (mirror) x = 1 - x;
    return { x: (x - 0.5) / crop[0] + 0.5, y: (lm[i].y - 0.5) / crop[1] + 0.5 };
  };
  const forehead = s(10);
  const chin = s(152);
  const eyeA = lm.length > 473 ? s(468) : mid(s(33), s(133));
  const eyeB = lm.length > 473 ? s(473) : mid(s(362), s(263));
  const [leftEye, rightEye] = eyeA.x < eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA]; // as seen on screen
  const cheekA = s(50);
  const cheekB = s(280);
  const [leftCheek, rightCheek] = cheekA.x < cheekB.x ? [cheekA, cheekB] : [cheekB, cheekA];
  const edgeL = s(234);
  const edgeR = s(454);
  const mouth = mid(s(13), s(14));
  const faceW = Math.hypot(edgeR.x - edgeL.x, (edgeR.y - edgeL.y) * (9 / 16)) || 0.15;
  const faceH = Math.hypot(chin.x - forehead.x, chin.y - forehead.y) || 0.3;
  return {
    head: lerp(s(1), forehead, 0.45),
    "head-top": lerp(chin, forehead, 1.38),
    forehead,
    "left-eye": leftEye,
    "right-eye": rightEye,
    nose: s(1),
    mouth,
    chin,
    "left-cheek": leftCheek,
    "right-cheek": rightCheek,
    faceW,
    faceH,
    roll: Math.atan2((rightEye.y - leftEye.y) * (9 / 16), rightEye.x - leftEye.x),
    mouthW: Math.abs(s(291).x - s(61).x) / 2 || 0.02,
    mouthH: Math.max(Math.abs(s(14).y - s(13).y) * 0.9, 0.012),
  };
}

// Ease the anchors toward the latest detection every frame, so tracking never jitters.
export function smoothAnchors(prev: FaceAnchors | null, next: FaceAnchors, k = 0.45): FaceAnchors {
  if (!prev) return next;
  const out = { ...next } as FaceAnchors;
  for (const key of Object.keys(next) as (keyof FaceAnchors)[]) {
    const a = prev[key];
    const b = next[key];
    if (typeof a === "number" && typeof b === "number") (out[key] as number) = a + (b - a) * k;
    else (out[key] as Point) = lerp(a as Point, b as Point, k);
  }
  return out;
}
