# Project: Say What You Saw

Hacker House Goa 2026 / Wispr Flow shortlisting task. Hard deadline Oct 11 12:00 AM IST. TARGET SUBMISSION: Fri Oct 10, 12:00 PM IST.

Live: https://say-what-you-saw.vercel.app · Repo: https://github.com/adityabrabb/say-what-you-saw (branch `main`)

## The rule
The owner (Adi) builds this ENTIRELY BY VOICE using Wispr Flow. He dictates prompts to you; you write all the code. Never ask him to type code. Keep replies short so he can respond by voice. Don't ask for exact syntax or filenames; infer them. Screen is being recorded: prefer visible, incremental progress over big silent changes. Dictated prompts are messy: infer intent (e.g. "blood" = blur, "Grok" = Groq, "3GS" = three.js), and say what you assumed.

The app's text boxes are plain inputs. Wispr Flow dictates into them. Do NOT build our own mic/speech input.

## The concept (current)
**A short film you star in, directed by your voice.** It is a GAME, not a utility: keep the game feel in everything (takes, shots, scores, sounds, playful copy).

**LOOK (Oct 10, 2026, Adi's call): film noir / evidence file, NOT arcade.** Near-black charcoal, warm grey, aged paper for text, ONE blood-red accent (`--blood` #b3161c / `--blood-hot`), amber only sparingly. Every label and number in Courier Prime (`--font-body`), typed notes/stamps/statements in Special Elite (`--type`), big film titles in Cormorant Garamond. No neon, no glow, no synthwave, no CRT/starfield/grid, no 8-bit sounds, no confetti. The noir block at the END of `app/globals.css` overrides the older arcade rules above it (remapped tokens `--green/--pink/--cyan/--yellow`, `--amber` = blood red in the film). Sounds are low-key analog Web Audio (`lib/sound.ts` `snap()` clicks, clock ticks, stamp, heartbeat, warm low chords). Don't turn Director into a dry "editing tool".

- **Opening (to build):** camera rolling, slate, cast/title cards with the player as the star.
- **Act 1 · Witness** = the existing **Recall** game (`/recall`). REQUIRED and NOT TO BE CHANGED: don't modify its gameplay, scoring, pools or UI unless Adi explicitly asks.
- **Act 2 · The Director's Stage** = **Director mode** (`/director`): your webcam, cut out and relit live; you direct the scene by voice; takes, shots and a photo strip. Should end with **end credits** (to build).
- **Studio** (the old explainer-video creator) is HIDDEN but KEPT: removed from navigation, still reachable at `/studio`. Don't delete it.

## What's built and working
**The Film (`/`, components/film/*, lib/film.ts)**: the whole home page is one short film. Pure black -> click/key -> soft projector click + 24fps whirr + ambient drone (Web Audio, lib/sound.ts `projector`, `drone`, `filmSfx`) -> flicker -> 5-to-1 leader with sweep -> "Say What You Saw" title (cream serif, light cone from top, floor pool + title shadow) -> direction box "roll camera" (fuzzy cue `isRollCue`, button for non-Wispr users) -> "Who's starring tonight?" name -> Act I card (typewriter) -> Recall (only change: `onFinish` prop) -> Act II card -> Director (`film` prop; in the film the 4th shot or THAT'S A WRAP freezes the frame and hands over lines/takes/strip/photo credits/freeze/demo) -> **Act III · The Verdict** (see below) -> rolling end credits (photo strip in the middle; download strip, share/download credits card PNG, play again). Look: black, cream Cormorant Garamond titles, one amber accent, 2.39:1 letterbox on cards, film-burn / cut-to-black transitions, NO grain. Corner mute + Select Scene (hidden on very first opening). Progress saved in localStorage `swys-film`; a refresh resumes the scene (sessionStorage marker), a new visit/tab always starts at the opening (name kept). Respects prefers-reduced-motion. The old arcade Landing component is unused.

**Landing (`/`)**: neon arcade theme (pixel font, warp starfield, synthwave grid, CRT scanlines), 3D-ish title with CSS tilt, three.js neon moon (lazy), two arcade buttons RECALL and DIRECTOR, CRT power-off transition. Web Audio sound kit with mute toggle.

**The Director (Phase 2; `lib/roast/*`, `components/film/DirectorHost.tsx` + `useFourthWall.ts`, `/api/roast`)**: the film's one voice, an arrogant washed-up director. `lib/roast/host.ts` is the single queue + speech (deepest English voice via `voice.ts`, pitch .35, rate .88; own "Director on/off" chip + right-click menu item; global mute also silences it). Roasts after every Recall answer (`onRound`) and director line (`onLine`), quoting the player; `/api/roast` is text-only with cache, rate limit, zod, on-brief check and a big house pool (never errors; silence/freeze/cut never call the model). Interruption overlay "Interruption. Round N. Try not to embarrass yourself." on Recall's result screen. Quiet (nothing shown or spoken) in the opening, Act III and Recall's ready/flash/describe phases. Local fourth-wall reactions: tab away, 20s idle, clock (once a visit), resize, mouse to top-left, copy; film-style right-click menu; console detective note. Roasts only what was said, never looks/body/voice/age/identity.

**Act III · The Verdict (`components/film/Verdict.tsx`, `lib/verdict/*`, `/api/verdict`)**: the plot twist (you were the suspect). The frozen frame, then the tab title becomes "Suspect Detected" with a blinking red-siren favicon (restored after), fake retro error windows stack up while a fake cursor clicks them, then a ~1s glitch (static, RGB split, warp, detuned tone; the ONLY grain in the film), the typed twist, then a three.js shatter (`lib/verdict/shatter.ts`, lazy, 80 shards, slow-mo, staggered reassembly into the poster's back, spin reveal). The wanted poster is a canvas (`lib/verdict/poster.ts`, 1200x1600: aged paper, sepia still, name, alias, crime, Exhibits A-C quoting real words, tiny reward, GUILTY stamp with thud and shake). No camera: the fake cursor drags a police sketch in, captioned "Suspect refuses to be photographed. Suspicious." Buttons: Download poster (PNG), Appeal (restart Act I), Roll credits. "Skip to the verdict" chip. Reduced motion: no cursor, no 3D, crossfade. The charge comes from `/api/verdict` (text only) with a funny offline fallback. A refresh shows the stamped poster (saved as JPEG in film state).

**Recall noir restyle (visual only)**: case-file HUD ("Case File 001 · Round 2 of 3 · Detective · Evidence score"), difficulty = Rookie/Detective/Chief on manila folder tabs (display names only, keys unchanged), the target in a CCTV frame (`Cctv` in RecallGame: REC, CAM 3, running timestamp, EXHIBIT A, crop marks, scanlines, flicker), "Memorize it in N seconds", thin red bar, Witness Statement on lined paper with a red margin and typewriter caret, "File Statement" stamp button, results as two taped evidence photos with hand-inked red (missed) / amber (invented) circles, stamped score, typed notes and verdict. Scene renderer: no glow halos, flat two-tone fills lit top-left, one hard drop shadow on the object layer (CSS), icons with no JSON colour use a toned-down version of their default (`naturalTone`); backdrops redrawn as muted real places with one light + fog (sky = overcast, ocean = grey harbour, city = night street with one lamp, grid = interrogation room, space = cold night sky, hex = lit wall). Preset names, scene JSON, icon names, scoring and timings are untouched.

**Recall / Witness (`/recall`)**: How-to-Play tutorial (first visit), Easy/Medium/Hard (5s/3s/2s flash) with separate pools (11/8/8 hand-made scenes using neon icons, hand-drawn art, backdrops, particles), 3 or 5 rounds, 30s dictation countdown with auto-submit, description -> scene via `/api/generate`, deterministic scoring, reveal with missed/extra rings and names, count-up score, verdicts, confetti, best score in localStorage, end screen with Home / Change settings / Play again.

**Director (`/director`)**: intro screen "THE CAMERA IS NOW ON YOU" (Allow camera / Use demo subject); 1280x720 mirrored fullscreen webcam; neutral demo silhouette if camera denied/missing; MediaPipe selfie segmentation + face landmarks; single-pass WebGL2 render (background -> blur -> cut-out person -> face-aware key light/rim -> grade -> overlays -> grain -> light leaks); shot opens CLEAN (raw camera, no filter); each dictated line -> `/api/direct` -> small patch eased over 1s; subtitles with TAKE counter; local commands "freeze"/"click"/"take the shot" (flash + shutter, capture) and "cut"/"go back"/"undo" (revert); after 4 shots a 35mm photo strip PNG (download); orange vintage date stamp; film-slate direction box with 5 hint lines; photo credits for image backgrounds; synthwave frame overlay (CSS `.dir-synth`, view only, not in captured shots); no FPS chip.

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
  api/roast/route.ts      one director roast line (text in, line out; cache, rate limit, retry, on-brief check, house fallback)
  api/verdict/route.ts    Act III case file (text) -> charge sheet {alias, crime, evidence[3], reward} (cache, rate limit, retry, real-quote check, offline)
components/
  Landing, NeonMoon, Starfield, SoundToggle, PageHeader
  RecallGame, HowToPlay                     (Act 1)
  SceneRenderer, SceneBackground, Art       SVG scene renderer (3 GPU layers), backdrops/particles, hand-drawn art
  Studio, Player                            (hidden Studio)
  director/DirectorStage.tsx                (Act 2 UI + render loop)
  film/Film.tsx Opening.tsx Cards.tsx Credits.tsx Verdict.tsx   the film shell, opening, cast/act cards, credits, Act III
  film/DirectorHost.tsx useFourthWall.ts   the director: subtitle, right-click menu, reactions
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
  roast/schema offline prompt client host voice console .ts   Phase 2: roast schemas, house roasts, prompt, client, host queue + speech, voice picker, console note
  film.ts              film state (scenes, saved progress, cue matcher, credits card)
  verdict/schema.ts offline.ts prompt.ts poster.ts shatter.ts   Act III: zod schemas, fallback charge, prompt, poster canvas, three.js shatter
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
- `POST /api/roast` `{ kind: answer|direction|shot|undo, said, truth, score }` -> `{ line, engine }`; always 200 (house roast on any failure), 24/min per IP, 10-min cache, one retry, line must quote a real word of `said` and avoid off-limits words.
- `POST /api/verdict` `{ name, witnessScore, witnessMax, rounds[{title,truth,said,score}], directorLines[] }` -> `{ alias, crime, evidence[3]{quote,note}, reward, engine }`; 6/min per IP (over the limit returns the offline charge), 10-min cache, one retry, evidence must quote real, unique words.

## AI providers (lib/providers.ts)
Chain, first that answers wins (sticky per request): OpenRouter (`OPENROUTER_MODEL`, default `google/gemini-2.5-flash`; on 402 "can only afford N" it retries with fewer tokens) -> Google Gemini direct via OpenAI-compatible endpoint (models `gemini-flash-latest` then `gemini-flash-lite-latest`; pinned `gemini-2.5-flash` is NOT available to new keys) -> OpenRouter `:free` models (picked live from the model list) -> offline engines (no AI). Results from the offline path show an OFFLINE BUILD badge (Recall/Studio) or "Offline director" note.
**Recall's fast path** (`lib/generate.ts` `generateRecall`, `FAST_CHAIN` in providers.ts, prompt in `lib/recallPrompt.ts`): short prompt (no art/camera/Studio rules, same output shape, so validation and scoring are untouched), OpenRouter `google/gemini-2.5-flash-lite` (`OPENROUTER_FAST_MODEL`, 10s timeout) -> Gemini `gemini-flash-lite-latest` (`GEMINI_FAST_MODEL`, 6s timeout) -> local keyword builder (`buildOfflineScene`), plus an 18s hard deadline in `/api/generate` and a 10-min cache. One attempt per provider; a lenient `tidyRecallJson` maps odd shapes (triangle -> star), drops bad particles, fills defaults. Measured: ~1.4-1.9s per scene (was 6-23s because the default `gemini-2.5-flash` fails with 402 low credits and fell through to the thinking model `gemini-flash-latest`, which takes 6-19s). Do NOT use `gemini-flash-latest` or other thinking models on this path. Studio still uses the long prompt and the old chain.

## Environment variables (never commit values)
`.env.local` locally and Vercel Project -> Settings -> Environment Variables:
- `OPENROUTER_API_KEY` (alias accepted: `api_openrouter_API_key`)
- `OPENROUTER_MODEL` (optional; Studio and other long generations)
- `OPENROUTER_FAST_MODEL` (optional; Recall, default `google/gemini-2.5-flash-lite`)
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- `GEMINI_MODEL` (optional; Studio)
- `GEMINI_FAST_MODEL` (optional; Recall, default `gemini-flash-lite-latest`)
Both keys are set locally and on Vercel. OpenRouter credits are low; Gemini is the working backup. Groq was removed on purpose; don't re-add.

## Deploy / push
- Commit to `main`, `git push`. The Vercel project IS git-linked to https://github.com/adityabrabb/say-what-you-saw (`vercel git connect` reports "already connected"; git-triggered deployments carry a `say-what-you-saw-git-main-aahhhh.vercel.app` alias), so **a push to `main` deploys to production by itself**. Check with `vercel ls` and `https://say-what-you-saw.vercel.app`. A manual `vercel deploy --prod --yes` (team "aahhhh") is only a fallback if no git deployment appears.
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
- Recall changes are limited to report-only hooks: `onFinish` (with `rounds`), `onRound(r, i, total)`, `onPhase(phase)`. Film consumes all three (Act III case file, roasts/interruptions, quiet time). A round's roast and interruption appear once its score is in (about 2s since the fast path; the wait shows "The director is reviewing the footage" with a film reel instead of a spinner, in `RecallGame.tsx` result screen + `.reel`/`.reviewing` CSS: the only visual change to Recall, requested by Adi).
- The director's voice quality depends on the browser's installed voices; Chrome's Google voices ignore pitch.
- Act III: if the AI director set a dark backdrop and no person is found, the frozen frame (and shards) is dark. That's real content, not a bug.

## Next steps
**THE GRAND PLAN is in `GRAND_PLAN.md` (phases 1-6, rules, open questions). It supersedes the list below; continue from its first unchecked phase.**

1. **Opening sequence**: "camera rolling" intro, slate clap, cast/title cards starring the player (ask for their name once, reuse it in Director overlays and credits).
2. **Film flow**: Opening -> Act 1 Witness (Recall, unchanged) -> Act 2 Director's Stage, with act title cards between; carry the Witness score into the film.
3. **End credits** after Act 2: rolling credits listing the director's lines as scenes, takes count, the photo strip, "Directed by <name>, by voice", background photo credits.
4. Polish Director lighting presets and the cut-out on Adi's real webcam.
5. README for the film concept; record the demo; submit.
