"use client";

// Screen flashes and shakes. Both use the Web Animations API on transform/opacity only,
// so they run on the compositor and never trigger layout.

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let overlay: HTMLDivElement | null = null;

export function flash(colour = "#ffffff", strength = 0.7, ms = 380) {
  if (typeof document === "undefined" || reduced()) return;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "fx-flash";
    document.body.appendChild(overlay);
  }
  overlay.style.background = colour;
  overlay.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
}

export function shake(intensity = 8, ms = 420) {
  if (typeof document === "undefined" || reduced()) return;
  const el = document.querySelector<HTMLElement>(".page");
  if (!el) return;
  const i = intensity;
  el.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${-i}px, ${i * 0.4}px) rotate(-0.4deg)` },
      { transform: `translate(${i}px, ${-i * 0.3}px) rotate(0.4deg)` },
      { transform: `translate(${-i * 0.6}px, ${-i * 0.4}px)` },
      { transform: `translate(${i * 0.4}px, ${i * 0.3}px)` },
      { transform: "translate(0, 0)" },
    ],
    { duration: ms, easing: "ease-out" }
  );
}
