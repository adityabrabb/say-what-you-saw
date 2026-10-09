# Project: Say What You Saw

Hacker House Goa 2026 / Wispr Flow shortlisting task. Hard deadline Oct 11 12:00 AM IST. TARGET SUBMISSION: Fri Oct 10, 12:00 PM IST.

Live: https://say-what-you-saw.vercel.app · Repo: https://github.com/adityabrabb/say-what-you-saw (branch `main`)

## The rule
The owner (Adi) builds this ENTIRELY BY VOICE using Wispr Flow. He dictates prompts to you; you write all the code. Never ask him to type code. Keep replies short so he can respond by voice. Don't ask for exact syntax or filenames; infer them. Screen is being recorded: prefer visible, incremental progress over big silent changes. Dictated prompts are messy: infer intent (e.g. "blood" = blur, "Grok" = Groq, "3GS" = three.js), and say what you assumed.

The app's text boxes are plain inputs. Wispr Flow dictates into them. Do NOT build our own mic/speech input.

## The concept (current)
**A short film you star in, directed by your voice.** It is a GAME, not a utility: keep the game feel in everything (takes, shots, scores, sounds, arcade neon theme, playful copy). Don't turn Director into a dry "editing tool".

- **Opening (to build):** camera rolling, slate, cast/title cards with the player as the star.
- **Act 1 · Witness** = the existing **Recall** game (`/recall`). REQUIRED and NOT TO BE CHANGED: don't modify its gameplay, scoring, pools or UI unless Adi explicitly asks.
- **Act 2 · The Director's Stage** = **Director mode** (`/director`): your webcam, cut out and relit live; you direct the scene by voice; takes, shots and a photo strip. Should end with **end credits** (to build).
- **Studio** (the old explainer-video creator) is HIDDEN but KEPT: removed from navigation, still reachable at `/studio`. Don't delete it.

## What's built and working
**The Film (`/`, components/film/*, lib/film.ts)**: the whole home page is one short film. Pure black -> click/key -> soft projector click + 24fps whirr + ambient drone (Web Audio, lib/sound.ts `projector`, `drone`, `filmSfx`) -> flicker -> 5-to-1 leader with sweep -> "Say What You Saw" title (cream serif, light cone from top, floor pool + title shadow) -> direction box "roll camera" (fuzzy cue `isRollCue`, button for non-Wispr users) -> "Who's starring tonight?" name -> Act I card (typewriter) -> Recall (only change: `onFinish` prop) -> Act II card -> Director (`film` prop: WRAP ▸ CREDITS, hands over lines/takes/strip/photo credits) -> rolling end credits (photo strip in the middle; download strip, share/download credits card PNG, play again). Look: black, cream Cormorant Garamond titles, one amber accent, 2.39:1 letterbox on cards, film-burn / cut-to-black transitions, NO grain. Corner mute + Select Scene (hidden on very first opening). Progress saved in localStorage `swys-film`; a refresh resumes the scene (sessionStorage marker), a new visit/tab always starts at the opening (name kept). Respects prefers-reduced-motion. The old arcade Landing component is unused.

**Landing (`/`)**: neon arcade theme (pixel font, warp starfield, synthwave grid, CRT scanlines), 3D-ish title with CSS tilt, three.js neon moon (lazy), two arcade buttons RECALL and DIRECTOR, CRT power-off transition. Web Audio sound kit with mute toggle.

**Recall / Witness (`/recall`)**: How-to-Play tutorial (first visit), Easy/Medium/Hard (5s/3s/2s flash) with separate pools (11/8/8 hand-made scenes using neon icons, hand-drawn art, backdrops, particles), 3 or 5 rounds, 30s dictation countdown with auto-submit, description -> scene via `/api/generate`, deterministic scoring, reveal with missed/extra rings and names, count-up score, verdicts, confetti, best score in localStorage, end screen with Home / Change settings / Play again.

**Director (`/director`)**: intro screen "THE CAMERA IS NOW ON YOU" (Allow camera / Use demo subject); 1280x720 mirrored fullscreen webcam; neutral demo silhouette if camera denied/missing; MediaPipe selfie segmentation + face landmarks; single-pass WebGL2 render (background -> blur -> cut-out person -> face-aware key light/rim -> grade -> overlays -> grain -> light leaks); shot opens CLEAN (raw camera, no filter); each dictated line -> `/api/direct` -> small patch eased over 1s; subtitles with TAKE counter; local commands "freeze"/"click"/"take the shot" (flash + shutter, capture) and "cut"/"go back"/"undo" (revert); after 4 shots a 35mm photo strip PNG (download); orange vintage date stamp; film-slate direction box with 5 hint lines; photo credits for image backgrounds; FPS chip.

**Studio (`/studio`, hidden)**: dictated explanation -> 1-3 animated SVG scenes; voice-edit patches with history and undo; showcase bar (solar eclipse, water cycle, rocket launch, hand-drawn art).

## Framework / stack
Next.js 16 (App Router, Turbopack) + React 19 + TypeScript, Zod 4, Motion, three.js, canvas-confetti, @mediapipe/tasks-vision 1.1.0 (WASM + models from CDN, Director page only), Web Audio. Deployed on Vercel. Node 24 locally.

## File structure / where things live
```
app/
  page.tsx, layout.tsx, template.tsx, globals.css   landing, global chrome (starfield, grid, CRT, sound toggle), page power-on, ALL styles
  recall/page.tsx   studio/page.tsx   director/page.tsx
  api/generate/route.ts   description -> scenes (recall|studio)
  api/edit/route.ts       Studio voice edit -> patch
  api/direct/route.ts     Director line -> shot-settings patch (cache, rate limit, retry, repair, offline)
components/
  Landing, NeonMoon, Starfield, SoundToggle, PageHeader
  RecallGame, HowToPlay                     (Act 1)
  SceneRenderer, SceneBackground, Art       SVG scene renderer (3 GPU layers), backdrops/particles, hand-drawn art
  Studio, Player                            (hidden Studio)
  director/DirectorStage.tsx                (Act 2 UI + render loop)
lib/
  scene.ts schema.ts engine.ts             scene JSON types, zod validation, animation engine (easing, stagger, camera)
  score.ts                                 deterministic Recall scoring
  recallPool.ts                            easy/medium/hard target pools
  generate.ts providers.ts offline.ts      LLM generation, provider chain, offline scene builder + offline edits
  icons.ts iconMatch.ts art.ts             neon icon whitelist (generated), name snapping, art names
  patch.ts edit.ts showcases.ts examples.ts  Studio patches/edits/showcases
  sound.ts fx.ts confetti.ts colour.ts api.ts
  director/settings.ts   shot-settings schema, defaults, clamp, patch schema, applyShotPatch, repairPatch
  director/gl.ts         WebGL2 renderer (one fragment shader, all layers)
  director/tracking.ts   MediaPipe loader, segmentation/face processing, face anchors + smoothing
  director/overlays.ts   2D overlay layer (neon icons from sprite, text, halo, orbit, date stamp)
  director/grades.ts     grade presets as numeric looks
  director/catalog.ts    backgrounds.json types + bestBackground matcher
  director/prompt.ts     Director LLM prompt   director/offline.ts  keyword fallback director
  director/silhouette.ts demo subject          director/strip.ts    photo strip builder
public/icons/neon.svg          184-icon neon sprite (Tabler/Lucide/Game Icons) - regenerate with scripts/build-icons.mjs
public/backgrounds/*.jpg + backgrounds.json   10 Wikimedia Commons photos (CC/PD, credits in json) + 5 procedural ids
```

## Director shot settings (lib/director/settings.ts)
One object; the model only ever returns a patch; everything is clamped.
- `background`: `{ type: "camera"|"image"|"procedural", id, blur 0..1, color "#rrggbb" }` (procedural ids: neon-rain-city, star-field, sunset-gradient, studio-backdrop, foggy-forest; image ids from backgrounds.json)
- `grade`: `{ preset: natural|noir|golden-noir|teal-orange|kodak-portra|cyberpunk|dreamy|cinematic|bleach-bypass, exposure -2..2, contrast 0.5..2, saturation 0..2, temperature -1..1, tint -1..1, fade 0..1, vignette 0..1 }`
- `light`: `{ angle 0..360 (direction light comes FROM: 0 right, 90 above, 180 left), color, intensity 0..2, softness 0..1, rim 0..1 }`
- `grain`: `{ amount 0..1, size 1..3 }`, `leaks`: `{ amount 0..1, hue 0..360 }`, `face`: `{ teeth: none|gold }`
- `overlays` (max 8): `{ id, kind: icon|text|halo, icon?, text?, anchor: head|head-top|forehead|left-eye|right-eye|nose|mouth|chin|left-cheek|right-cheek, color, size 0.2..3, animation: none|orbit|float|pulse|spin|blink, offsetX/offsetY -3..3 (face widths) }`
- Patch = deep partial of the above, except `overlays: { add, update, remove (ids or ["all"]) }`.
- DEFAULT is clean: natural grade, vignette 0, grain 0, light 0, leaks 0, camera background. Effects only on request.

## API routes
- `POST /api/generate` `{ description, mode: "recall"|"studio" }` -> `{ scenes, engine }` (engine = provider name or "offline")
- `POST /api/edit` `{ video, instruction, currentScene }` -> `{ video, changes, scenes, summary, engine }`
- `POST /api/direct` `{ line, settings }` -> `{ patch, note, engine, cached? }`; 12 lines/min per IP (in-memory), 10-min cache keyed by line+settings, one retry with error feedback, then `repairPatch`, then offline keyword director.

## AI providers (lib/providers.ts)
Chain, first that answers wins (sticky per request): OpenRouter (`OPENROUTER_MODEL`, default `google/gemini-2.5-flash`; on 402 "can only afford N" it retries with fewer tokens) -> Google Gemini direct via OpenAI-compatible endpoint (models `gemini-flash-latest` then `gemini-flash-lite-latest`; pinned `gemini-2.5-flash` is NOT available to new keys) -> OpenRouter `:free` models (picked live from the model list) -> offline engines (no AI). Results from the offline path show an OFFLINE BUILD badge (Recall/Studio) or "Offline director" note.

## Environment variables (never commit values)
`.env.local` locally and Vercel Project -> Settings -> Environment Variables:
- `OPENROUTER_API_KEY` (alias accepted: `api_openrouter_API_key`)
- `OPENROUTER_MODEL` (optional)
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- `GEMINI_MODEL` (optional)
Both keys are set locally and on Vercel. OpenRouter credits are low; Gemini is the working backup. Groq was removed on purpose; don't re-add.

## Deploy / push
- Commit to `main`, `git push`. The Vercel project is NOT git-linked: deploy with `vercel deploy --prod --yes` from the repo (team "aahhhh", project `say-what-you-saw`), then check `https://say-what-you-saw.vercel.app`.
- Always run `npx next build` before committing; fix errors.
- Commit messages end with the Co-Authored-By line from the system reminder.

## Known bugs / limitations
- Director cut-out quality depends on webcam/lighting; segmentation runs at 256x144 (bicubic upsampling + feathering in the shader). Fine hair detail is soft.
- MediaPipe prints INFO logs via console.error, so Next dev shows a "1 Issue" badge on /director. Harmless; not in production.
- `/api/direct` rate limit and cache are per server instance (in-memory).
- Recall Hard (2s flash, 6-9 objects) may be too hard; consider 3s.
- Studio generation takes 10-30s.
- Director: gold teeth only shows when teeth are visible; head-top is estimated from forehead/chin; overlays hide when no face is found.
- Headless/no-GPU tests run Director at ~35-60 fps; real browsers are faster. Only tested with a fake webcam so far; Adi's real webcam is the true test.
- Windows dev: stopping `npm run dev` can orphan the Next process on port 3000; kill it by port before restarting. After changing a module's exports, restart the dev server (HMR serves stale modules).
- `vercel deploy` once printed a stray `"status": "error"` line while the deployment was Ready.

## Next steps
1. **Opening sequence**: "camera rolling" intro, slate clap, cast/title cards starring the player (ask for their name once, reuse it in Director overlays and credits).
2. **Film flow**: Opening -> Act 1 Witness (Recall, unchanged) -> Act 2 Director's Stage, with act title cards between; carry the Witness score into the film.
3. **End credits** after Act 2: rolling credits listing the director's lines as scenes, takes count, the photo strip, "Directed by <name>, by voice", background photo credits.
4. Polish Director lighting presets and the cut-out on Adi's real webcam.
5. README for the film concept; record the demo; submit.
