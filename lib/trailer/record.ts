"use client";

// Records the trailer canvas and its score into one downloadable file with MediaRecorder.
// Everything here is best-effort: where recording isn't supported (or throws), callers get null and the
// trailer simply plays without a download. It must never break the film or the credits.

const MIMES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // Safari
  "video/mp4",
];

export function pickMime(): string | null {
  try {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return null;
    return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
  } catch {
    return null;
  }
}

export interface Recording {
  mime: string;
  ext: "webm" | "mp4";
  stop(): Promise<Blob | null>;
  cancel(): void;
}

export function startRecording(canvas: HTMLCanvasElement, audio: MediaStream | null): Recording | null {
  try {
    const mime = pickMime();
    if (!mime || typeof canvas.captureStream !== "function") return null;
    const video = canvas.captureStream(30);
    const tracks = [...video.getVideoTracks(), ...(audio ? audio.getAudioTracks() : [])];
    if (!tracks.length) return null;
    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    let failed = false;
    rec.onerror = () => {
      failed = true;
    };
    rec.start(500);
    return {
      mime,
      ext: mime.startsWith("video/mp4") ? "mp4" : "webm",
      stop: () =>
        new Promise<Blob | null>((resolve) => {
          if (failed || rec.state === "inactive") return resolve(chunks.length && !failed ? new Blob(chunks, { type: mime }) : null);
          rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: mime }) : null);
          try {
            rec.stop();
          } catch {
            resolve(null);
          }
        }),
      cancel: () => {
        try {
          rec.ondataavailable = null;
          if (rec.state !== "inactive") rec.stop();
        } catch {
          // Already stopped.
        }
      },
    };
  } catch {
    return null;
  }
}
