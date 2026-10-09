"use client";

// Builds a 35mm-style photo strip from four takes: film base, sprocket holes, frame numbers,
// orange date stamp and a "directed by voice" caption. Returns a PNG blob.

export async function buildPhotoStrip(frames: HTMLCanvasElement[], lines: string[]): Promise<Blob> {
  const FW = 640;
  const FH = 360;
  const SIDE = 70;
  const GAP = 26;
  const TOP = 70;
  const BOTTOM = 120;
  const W = FW + SIDE * 2;
  const H = TOP + frames.length * FH + (frames.length - 1) * GAP + BOTTOM;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  // Film base with a faint warm sheen
  const base = g.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0, "#120d0a");
  base.addColorStop(0.5, "#1d1611");
  base.addColorStop(1, "#120d0a");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // Sprocket holes down both edges
  g.fillStyle = "#f4efe6";
  for (let y = 18; y < H - 18; y += 34) {
    for (const x of [18, W - 18 - 26]) {
      g.beginPath();
      g.roundRect(x, y, 26, 18, 4);
      g.fill();
    }
  }

  // Edge print
  g.fillStyle = "#e0a040";
  g.font = "700 15px ui-monospace, 'Courier New', monospace";
  g.textAlign = "left";
  g.fillText("SWYS 400  ·  DIRECTOR MODE", SIDE, 44);
  g.textAlign = "right";
  g.fillText("SAFETY FILM", W - SIDE, 44);

  // Frames
  frames.forEach((frame, i) => {
    const y = TOP + i * (FH + GAP);
    g.fillStyle = "#000";
    g.fillRect(SIDE - 6, y - 6, FW + 12, FH + 12);
    g.drawImage(frame, SIDE, y, FW, FH);
    // Frame number and stamp
    g.font = "700 14px ui-monospace, 'Courier New', monospace";
    g.fillStyle = "#e0a040";
    g.textAlign = "left";
    g.fillText(`${i + 1}A`, SIDE + 4, y + FH + 20); // each frame already carries its own orange date stamp
  });

  // Caption
  const cy = H - BOTTOM + 40;
  g.textAlign = "center";
  g.fillStyle = "#f4efe6";
  g.font = "700 26px ui-sans-serif, system-ui, sans-serif";
  g.fillText("DIRECTED BY VOICE", W / 2, cy);
  g.fillStyle = "#e0a040";
  g.font = "500 15px ui-sans-serif, system-ui, sans-serif";
  const caption = lines.length ? `“${lines.slice(-2).join("” · “")}”` : "Say What You Saw";
  g.fillText(caption.length > 80 ? caption.slice(0, 77) + "…”" : caption, W / 2, cy + 30);
  g.fillStyle = "#8a7a66";
  g.font = "500 13px ui-monospace, monospace";
  g.fillText(`${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}  ·  say-what-you-saw.vercel.app`, W / 2, cy + 56);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}
