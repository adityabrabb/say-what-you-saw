"use client";

import type { FaceAnchors } from "./tracking";

// Built-in demo subject for when there's no camera: a neutral head-and-shoulders silhouette
// drawn on a transparent canvas (its alpha doubles as the cut-out mask). It sways gently.

export class Silhouette {
  readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext("2d")!;
  }

  draw(t: number): FaceAnchors {
    const g = this.ctx;
    const sway = Math.sin(t * 0.7) * 18;
    const bob = Math.sin(t * 1.4) * 4;
    const tilt = Math.sin(t * 0.55) * 0.05;
    const hx = 640 + sway;
    const hy = 285 + bob;
    g.clearRect(0, 0, 1280, 720);

    // Shoulders and torso
    const body = g.createLinearGradient(0, 430, 0, 720);
    body.addColorStop(0, "#5d6270");
    body.addColorStop(1, "#30333c");
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(330 + sway * 0.4, 720);
    g.bezierCurveTo(345 + sway * 0.4, 560, 420 + sway * 0.6, 505, hx - 70, 488);
    g.lineTo(hx - 42, 430);
    g.lineTo(hx + 42, 430);
    g.lineTo(hx + 70, 488);
    g.bezierCurveTo(860 + sway * 0.6, 505, 935 + sway * 0.4, 560, 950 + sway * 0.4, 720);
    g.closePath();
    g.fill();

    // Neck
    g.fillStyle = "#6a6f7c";
    g.fillRect(hx - 40, 380 + bob, 80, 70);

    // Head with soft shading so lighting reads on it
    g.save();
    g.translate(hx, hy);
    g.rotate(tilt);
    const head = g.createRadialGradient(-28, -40, 20, 0, 0, 140);
    head.addColorStop(0, "#9aa0ad");
    head.addColorStop(0.6, "#737886");
    head.addColorStop(1, "#4a4e59");
    g.fillStyle = head;
    g.beginPath();
    g.ellipse(0, 0, 98, 122, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Synthetic face anchors in screen uv
    const P = (x: number, y: number) => {
      const c = Math.cos(tilt);
      const s = Math.sin(tilt);
      return { x: (hx + x * c - y * s) / 1280, y: (hy + x * s + y * c) / 720 };
    };
    return {
      head: P(0, -20),
      "head-top": P(0, -150),
      forehead: P(0, -95),
      "left-eye": P(-36, -18),
      "right-eye": P(36, -18),
      nose: P(0, 18),
      mouth: P(0, 62),
      chin: P(0, 118),
      "left-cheek": P(-56, 30),
      "right-cheek": P(56, 30),
      faceW: 196 / 1280,
      faceH: 213 / 720,
      roll: tilt,
      mouthW: 30 / 1280,
      mouthH: 10 / 720,
    };
  }
}
