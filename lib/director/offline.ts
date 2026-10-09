import { bestBackground, type Catalog } from "./catalog";
import type { ShotPatch, ShotSettings } from "./settings";

// Keyword fallback for director lines when no AI provider answers. Covers the common asks.

const COLOURS: Record<string, string> = {
  gold: "#ffd34d", golden: "#ffd34d", red: "#ff3355", pink: "#ff2bd6", blue: "#3e7bfa", cyan: "#00f0ff", green: "#39ff14",
  purple: "#b388ff", orange: "#ff9a3c", white: "#ffffff", yellow: "#ffe600", silver: "#d6dbe6", teal: "#2ec4b6",
};

export function offlineDirect(line: string, settings: ShotSettings, catalog: Catalog): { patch: ShotPatch; note: string } {
  const t = line.toLowerCase();
  const patch: ShotPatch = {};
  const notes: string[] = [];
  const colourIn = (s: string) => Object.entries(COLOURS).find(([w]) => new RegExp(`\\b${w}\\b`).test(s))?.[1];

  // Background
  const bg = bestBackground(catalog, t);
  if (bg) {
    patch.background = { type: bg.type, id: bg.id };
    notes.push(bg.id.replace(/-/g, " "));
  }
  if (/\b(blur|bokeh|out of focus|soft background)\b/.test(t)) patch.background = { ...patch.background, blur: 0.65 };
  if (/\b(real|my room|original|no background|remove the background effect)\b/.test(t)) patch.background = { type: "camera", id: "camera", blur: 0 };

  // Grade
  const grade: ShotPatch["grade"] = {};
  if (/\b(black and white|b&w|monochrome|noir)\b/.test(t)) grade.preset = /gold/.test(t) ? "golden-noir" : "noir";
  else if (/\bteal\b.*\borange\b|\borange\b.*\bteal\b|blockbuster/.test(t)) grade.preset = "teal-orange";
  else if (/\b(portra|film look|kodak|analog)\b/.test(t)) grade.preset = "kodak-portra";
  else if (/\b(cyberpunk|neon look|blade runner)\b/.test(t)) grade.preset = "cyberpunk";
  else if (/\b(dreamy|soft and dreamy|ethereal)\b/.test(t)) grade.preset = "dreamy";
  else if (/\b(bleach)/.test(t)) grade.preset = "bleach-bypass";
  else if (/\b(cinematic|movie|film)\b/.test(t)) grade.preset = "cinematic";
  else if (/\b(natural|normal|reset the colou?r)/.test(t)) grade.preset = "natural";
  if (/\b(warmer|warm|golden hour)\b/.test(t)) grade.temperature = 0.5;
  if (/\b(cooler|cold|cool)\b/.test(t)) grade.temperature = -0.5;
  if (/\b(brighter|lighter)\b/.test(t)) grade.exposure = settings.grade.exposure + 0.4;
  if (/\b(darker|moodier)\b/.test(t)) grade.exposure = settings.grade.exposure - 0.4;
  if (/\bmore contrast|punchy\b/.test(t)) grade.contrast = 1.3;
  if (/\b(vintage|faded)\b/.test(t)) grade.fade = 0.4;
  if (Object.keys(grade).length) (patch.grade = grade), notes.push(grade.preset ?? "grade");

  // Light
  const light: ShotPatch["light"] = {};
  const dir = t.match(/light (?:from|on) (?:the |my )?(left|right|above|top|below|behind|back)/)?.[1];
  if (dir) {
    light.angle = { left: 180, right: 0, above: 90, top: 90, below: 270, behind: 90, back: 90 }[dir];
    light.intensity = Math.max(settings.light.intensity, 1);
    if (dir === "behind" || dir === "back") light.rim = 0.9;
  }
  if (/\b(rim light|backlight|edge light)\b/.test(t)) light.rim = 0.9;
  if (/\bgolden hour\b/.test(t)) Object.assign(light, { color: "#ffb25a", intensity: Math.max(1, light.intensity ?? 0) });
  if (/\b(no light|lights off|kill the light)\b/.test(t)) light.intensity = 0;
  const lightColour = t.match(/(\w+) light/)?.[1];
  if (lightColour && COLOURS[lightColour]) Object.assign(light, { color: COLOURS[lightColour], intensity: Math.max(1, light.intensity ?? settings.light.intensity) });
  if (Object.keys(light).length) (patch.light = light), notes.push("light");

  // Grain, leaks
  if (/\bheavy grain|lots of grain|grainy\b/.test(t)) patch.grain = { amount: 0.75 };
  else if (/\bgrain|noise\b/.test(t)) patch.grain = { amount: 0.45 };
  if (/\bno grain\b/.test(t)) patch.grain = { amount: 0 };
  if (/\blight leak/.test(t)) patch.leaks = { amount: 0.6 };

  // Face
  if (/\bgold(en)? teeth|teeth.*gold/.test(t)) (patch.face = { teeth: "gold" }), notes.push("gold teeth");
  if (/\bnormal teeth|remove the gold/.test(t)) patch.face = { teeth: "none" };

  // Overlays
  const add: NonNullable<NonNullable<ShotPatch["overlays"]>["add"]> = [];
  if (/\bhalo\b/.test(t)) add.push({ kind: "halo", anchor: "head-top", color: colourIn(t) ?? "#ffe9a6", size: 1, animation: "float" });
  const orbiter = t.match(/\b(moon|star|planet|rocket|heart|bee|butterfly|sun)\b.*\b(orbit|around|circl)/)?.[1];
  if (orbiter) add.push({ kind: "icon", icon: orbiter, anchor: "head", color: colourIn(t) ?? "#dcd6ff", size: 0.6, animation: "orbit" });
  const name = line.match(/(?:write|put|add)\s+(?:my name\s+)?["“]?([A-Za-z][\w .'-]{0,24}?)["”]?\s+(?:under|below|on|above|over|across)/i)?.[1];
  if (name && !/^(my name|text|a|the)$/i.test(name)) {
    const anchor = /under|below/.test(t) ? "chin" : /above|over/.test(t) ? "head-top" : "forehead";
    add.push({ kind: "text", text: name.toUpperCase(), anchor, color: colourIn(t) ?? "#ffd34d", size: 1, animation: "none", offsetY: anchor === "chin" ? 0.45 : -0.3 });
  }
  if (add.length) (patch.overlays = { add }), notes.push(add.map((a) => a.icon ?? a.text ?? a.kind).join(", "));
  if (/\b(clear|remove) (all |the )?(overlays|effects|stickers|icons)\b/.test(t)) patch.overlays = { remove: ["all"] };

  return { patch, note: notes.length ? `Offline: ${notes.join(" · ")}` : "Offline: didn't catch that one" };
}
