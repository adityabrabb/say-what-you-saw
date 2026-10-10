# Grand Plan: Say What You Saw

> Status: **Phases 1, 2, 3 and 4 DONE (Oct 10, 2026).** Next up: **Phase 6: Polish and ship** (Phase 5 is skipped). Phase 5 (Most Wanted Wall) is deliberately SKIPPED for now (no database provisioned); keep its plan as written.
> A fresh session should read `CLAUDE.md`, then this file, and continue from the first unchecked phase.

## The vision

**Say What You Saw** is a short film you star in, directed by your voice. The tone is **funny and roasty**.
The site itself is a character: an **arrogant, washed-up AI film director** who roasts you the whole way through
and breaks the fourth wall. At the end comes the twist: **you were never the witness. You were the suspect.**

Final running order (once every phase is in):
Opening -> Cast ("Who's starring tonight?") -> Act I · The Witness (Recall) -> fake Act 2.5 + commercial break ->
Act II · The Director's Stage -> **Act III · The Verdict** (wanted poster) -> End credits -> Trailer -> Most Wanted wall.

## Rules for every phase

- [ ] Build the phases in order.
- [ ] Commit and push after each phase (and deploy with `vercel deploy --prod --yes`).
- [ ] The app must fully work after every commit, with zero known bugs. Test it end to end (headless Chrome + fake camera + phone viewport + reduced motion) before committing, and say exactly what was tested.
- [ ] After each phase, tick the boxes here and update `CLAUDE.md` so a fresh session can continue.
- [ ] **Never change Recall's gameplay, timing or scoring.** Recall data is read **only through its hooks** (`onFinish`, plus a new `onRound` hook added in Phase 1). Hooks only report; they never alter what Recall does.
- [ ] **Roast only what was said and the memory descriptions.** Never roast anyone's face, body, appearance or identity. This goes into every prompt and every fallback line.
- [ ] Never use real browser `alert`, `confirm` or `prompt` dialogs. Everything is a styled in-film overlay.
- [ ] **The camera never leaves the browser.** Only text goes to the model. Images (frames, poster, trailer) are made and kept on the device.
- [ ] All model calls go through the existing provider chain (OpenRouter -> Gemini -> free models) with the existing cache and rate limits, **zod schema validation**, and **funny offline fallback lines** when the model fails or is slow.
- [ ] Respect `prefers-reduced-motion` everywhere (static or crossfade versions of every effect).
- [ ] If a phase takes too long, ship a simpler version of it and move on.
- [ ] Nothing may feel laggy: heavy work (three.js, shatter, trailer encode) loads lazily, and the main thread never blocks long enough to drop the camera frame rate.

---

## Phase 1: Act III · The Verdict

The twist. It replaces the photo-strip popup after the fourth shot when Director runs inside the film.

**Trigger**
- [x] In film mode, the **4th "freeze" / shot** on the Director's Stage starts Act III. Standalone `/director` keeps today's photo strip. The Director's **THAT'S A WRAP ▸** button also starts Act III early, freezing the current frame.
- [x] The camera frame **freezes** on that 4th shot.

**Breaking the fourth wall**
- [x] The tab title changes to **"Suspect Detected"**, and the favicon swaps to a **red siren** (drawn on a canvas and blinking). Both are restored afterwards.
- [x] A **fake cursor** glides around the screen and "clicks" things.
- [x] **Fake system error windows** stack up (styled, never real dialogs):
  - "Memory.exe has stopped responding"
  - "Witness credibility: not found"
  - plus 2–3 more in the same voice.
- [x] Glitch hits the frozen frame: about 1 second of static plus warping, an RGB split and a detuned tone (Web Audio). This is the only grain allowed in the whole film, and it's gone once the glitch ends.
- [x] Type out: **"Plot twist: you were never the witness. You are the suspect."**

**The shatter (three.js, lazy-loaded)**
- [x] The frozen frame shatters into **~80 shards** that fly through 3D space in slow motion…
- [x] …then reassemble into the **wanted poster**, seen from the back.
- [x] The poster **spins around to reveal** its front.
- [x] Reduced motion: a simple crossfade from the frame to the poster.

**The charge (model)**
- [x] New `POST /api/verdict` route. It sends **text only**: the star's name, each Recall target vs. what the player said, the scores, and the director lines.
- [x] It returns JSON validated by zod: `{ alias, crime, evidence: [A, B, C], reward }`.
  - `evidence` = three rows quoting the player's **real words** (worst Recall descriptions or director lines).
  - `reward` = unsettlingly small and specific (e.g. "$3 and a half-used bus pass").
- [x] It uses the provider chain, cache and rate limits, with a funny offline fallback that builds the charge from the real lines.
- [x] Recall gets an `onRound` hook (target, what was said, round score), and `onFinish` also passes the round list. These are report-only and Recall's behaviour doesn't change.

**The wanted poster (canvas, on device)**
- [x] Old toned paper with stains and burned edges.
- [x] **WANTED** headline, the player's **best still in sepia** (the frozen 4th shot), the real name, and **"a.k.a. <alias>"**.
- [x] **The crime**, **Evidence A, B and C** (quoting the player's worst real lines), and the **reward**.
- [x] A **GUILTY** stamp slams down with a thud sound and a camera shake.
- [x] No camera (demo subject): the fake cursor **drags a sketchy police-sketch mugshot** into the photo slot, captioned **"Suspect refuses to be photographed. Suspicious."**
- [x] Buttons: **Download poster (PNG)**, **Appeal** (the director lets you restart Act I), **Roll credits**.
- [x] Credits gain the alias, the crime and the poster; the credits card can include the poster.
- [x] Save the verdict in the film state so a refresh resumes it, and add "Act III · The Verdict" to Select Scene.

## Phase 2: The Director (one voice for the whole film)

**The voice**
- [x] One character: an arrogant, washed-up film director who roasts you constantly.
- [x] After **each Recall answer** and **each director line**, the model returns **one short roast quoting what you said**.
- [x] New `POST /api/roast` route: text in, `{ line }` out, with zod, the provider chain, cache and rate limit, and a big pool of funny offline roasts that quote your words.
- [x] The roast shows as a **typewriter subtitle** ("THE DIRECTOR:") and is **spoken with speech synthesis** using the deepest available English voice (low pitch, slow rate).
- [x] A **mute toggle for the director's voice**, separate from the sound toggle.
- [x] It never blocks gameplay: roasts arrive asynchronously, and a late roast is dropped.

**Interruptions in Recall (no timing changes)**
- [x] Between rounds, the director cuts in with an overlay: **"Interruption. Round 2. Try not to embarrass yourself."**
- [x] It only appears on Recall's result screen, before you press next, so the countdown and flash timing stay exactly the same. (It shows the moment the round's score is in; if you press Next first, you miss it. Nothing is ever shown or spoken during the countdown, the flash or the 30s describe phase.)

**Fourth-wall reactions (local, no model)**
- [x] Switch tabs and come back: **"Where did you go? The scene is still running."**
- [x] Idle for 20 seconds or more: **"Hello? Is the talent asleep?"**
- [x] Local time of day, e.g. **"It's 2 AM and you're still playing this. Respect."**
- [x] Resizing the window: **"Stop touching the set."**
- [x] Mouse heading to the top-left corner (towards back/close): **"Leaving already? Coward."**
- [x] Copying text: **"Stealing evidence?"**
- [x] Right-click opens a **custom film-style context menu** (Cut, Retake, Select Scene, Mute director…).
- [x] For the judges who open dev tools, the console prints a styled **detective's note** with ASCII art.
- [x] Each reaction is rate-limited so it never spams, and none of them fire during the Recall flash.

## Phase 3: The Spectacle

**Opening rebuilt in three.js (lazy-loaded, with a CSS fallback)**
- [x] A projector beam cuts through the dark, with floating dust particles.
- [x] **"Say What You Saw"** assembles out of particles inside the beam.
- [x] Then the scene settles into today's title card and "roll camera" direction box.

**Transitions and credits**
- [x] Act transitions become **film burns and reel changes** (cue marks in the corner), with projector sounds.
- [x] Credits roll with **3D parallax layers**.

**Mid-film fake-out (between Act I and Act II)**
- [x] A fake **"Act 2.5: NOT FOUND (404)"** card in a broken, glitching font.
- [x] The director, blaming **budget cuts**, cuts to a **15-second commercial break**.
- [x] The ad is for **"Memory+ — for people like you"**, with a **Skip** button that only works on the second click.
- [x] Then on to Act II.

## Phase 4: The Trailer (finale)

- [x] After the credits, a **"Watch your trailer"** button (and a Select Scene entry) plays a **25-second trailer auto-edited from the session**.
- [x] It renders to a **1280×720 canvas** in letterbox format.
- [x] The model writes **four trailer title lines** ("In a world…" style) from the session text, with funny fallbacks.
- [x] The sequence:
  - [x] Black screen with the first line.
  - [x] A flash of a Recall target.
  - [x] The player's real dictated sentences as quoted subtitles.
  - [x] The score slamming in.
  - [x] The takes with **Ken Burns** zooms.
  - [x] The director lines as a fast, on-the-beat cut montage.
  - [x] The wanted poster with the GUILTY stamp.
  - [x] Final title: **"Starring <name>. Directed by voice. Coming soon to a browser near you."**
- [x] A **generated score** in Web Audio: trailer "braams", risers, a sub drop, and **silence just before the title**.
- [x] **MediaRecorder** records the canvas and audio into a **downloadable WebM**. Where recording isn't supported, it falls back to play-only.
- [x] Session data needed for the trailer (takes, lines, scores, poster) is kept on the device.

## Phase 5: The Most Wanted Wall

- [ ] A shared public wall stored in **Upstash Redis** (Vercel's Marketplace replacement for Vercel KV). Provisioning it needs Adi's go-ahead.
- [ ] At the end, the player can **opt in** to post their crime and one line. It's **text only**: never photos, never real names (alias only).
- [ ] Profanity and slur filter, length caps, and a server-side rate limit.
- [ ] The wall is a board of many small wanted posters, with **pins and red string** between them, **newest first**.
- [ ] Plus a **Most Wanted top 10**: the **lowest Witness scores** (the worst witnesses are the most wanted). No voting.
- [ ] If the database isn't configured, the wall hides gracefully: no errors, no broken buttons.

## Phase 6: Polish and ship

- [ ] No layout jumps (reserved sizes, fonts preloaded).
- [ ] Eased transitions everywhere.
- [ ] Consistent typography (cream serif titles, Chakra Petch UI, pixel font only for arcade bits).
- [ ] Nothing that looks like a default browser element (inputs, scrollbars, focus rings, selects, downloads).
- [ ] Loading states: a film countdown leader, a styled camera warm-up, and styled fallback screens (no camera, no WebGL, model down).
- [ ] Performance check on a normal laptop, on mobile, and with reduced motion.
- [ ] Select Scene includes every act, the trailer and the wall.
- [ ] Rewrite the README to describe the full film, and say it was **built entirely by voice with Wispr Flow**.
- [ ] Run a production build, fix every error, then commit, push and deploy to production.

---

## Decisions (answered by Adi)

1. **Poster move:** after the shatter, the poster reassembles from the back, then spins around to reveal its front.
2. **Grain:** about 1 second of static during the Act III glitch only. No grain anywhere else.
3. **No camera:** the fake cursor drags a police-sketch mugshot into the photo slot, captioned "Suspect refuses to be photographed. Suspicious."
4. **Recall interruption:** shown on the result screen only, so Recall's timing doesn't change.
5. **Most Wanted top 10:** lowest Witness score. No voting.

## Progress log

- **Phase 1 (Oct 9, 2026): Act III · The Verdict, shipped.**
  - Files: `components/film/Verdict.tsx` (the act), `lib/verdict/{schema,offline,prompt,poster,shatter}.ts`, `app/api/verdict/route.ts`. Recall got a report-only `onRound` hook and a `rounds` list in `onFinish`. Director (film mode) hands over `freeze` + `demo` on the 4th shot or WRAP. Film: scene `act3`, `verdict` in the saved state, Select Scene entry, credits and credits card show the alias, crime and poster.
  - Timeline: freeze (0.9s) -> 8 fake error windows + fake cursor (~4s) -> glitch with static/RGB split/warp (1.1s) -> typed twist (~4s) -> shatter 80 shards (2.6s) -> reassemble with staggered arrival (1.7s) -> spin reveal (1.2s) -> (no camera: sketch dragged in) -> GUILTY stamp + thud + shake -> buttons. "Skip to the verdict" appears after 1.5s.
  - `/api/verdict`: text only, zod-validated, provider chain, 10-min cache, 6/min rate limit (over the limit = house verdict). Evidence must quote real words and be unique, otherwise it's swapped for real lines. Funny offline fallback in `lib/verdict/offline.ts`. Client times out at 14s and falls back too.
  - Tested in headless Chrome: fake camera (full sequence, title/favicon swap and restore, PNG download, refresh resumes the stamped poster, credits), demo subject (sketch drag), model blocked (offline charge), reduced motion (no 3D, 4.5s), phone 390x844, and a real 3-round Recall game in the film.
  - Fixed along the way: on phones in the film, the demo notice covered the WRAP button.
- **Phase 2 (Oct 10, 2026): The Director, shipped.**
  - Files: `lib/roast/{schema,offline,prompt,client,host,voice,console}.ts`, `app/api/roast/route.ts`, `components/film/{DirectorHost.tsx,useFourthWall.ts}`; edits in `Film.tsx`, `RecallGame.tsx`, `DirectorStage.tsx`, `globals.css`.
  - **One voice:** `lib/roast/host.ts` is a single queue (interrupt > roast > chatter) that shows a line as a typewriter subtitle ("THE DIRECTOR") and speaks it via speech synthesis (deepest English voice by name heuristic in `voice.ts`: David / Google UK English Male / Daniel; pitch 0.35, rate 0.88). Muting all sound also silences the voice. Separate chip "Director on/off" in the corner (saved in localStorage `swys-director-voice`) and the same toggle in the right-click menu. Subtitles stay when the voice is off.
  - **Roasts:** after every Recall answer (`onRound`) and every director line (`onLine`). `/api/roast` is text only: zod, provider chain, 10-min cache, 24/min per IP (over the limit = house roast, never an error), one retry, and an on-brief check (must quote a real word the player said; no looks/body/voice/age/identity words unless the player said them). Silence, "freeze" and "cut" come from the house pool with no model call. 80+ house roasts (`offline.ts`) all pass the same off-limits filter (960 combinations swept). A roast arriving more than 10s after its moment is dropped; a newer direction supersedes an older one.
  - **Interruption:** "Interruption. Round N. Try not to embarrass yourself." on Recall's result screen when another round follows. Recall gained report-only hooks: `onRound(r, i, total)` and `onPhase(phase)`.
  - **Quiet rules:** the host is silenced in the opening, in Act III, and in Recall's ready/flash/describe phases (set synchronously from `onPhase`), and a new scene never inherits the last scene's line.
  - **Fourth wall (local, rate limited: 8s between any two, own cooldowns):** back from another tab (4s+ away), idle 20s (held while a round is being scored), the clock (once per visit, a few seconds into Act I), resize (not on touch, not in the first 4s), mouse heading for the top-left corner or leaving the window there (not over buttons), copying text. Right-click: film-style action menu (Retake this act, Select scene, Director's voice, Sound), but the browser's own menu stays on text fields and on touch. Console prints a styled detective's note with ASCII art, once.
  - **Tested** in headless Chrome against a production build: real 3-round Recall game with speech stubbed (interruptions before rounds 2 and 3 only, roasts quote the answers, silent through every timed phase, 7 utterances all low and slow), every reaction including the 20s idle, the context menu and both voice toggles, Director direction roasts on desktop and a 390px phone (layout fixed: the "DIRECTOR MODE" chip is hidden on phones so the top bar fits in two rows), reduced motion (line shows fully typed), Act III re-run (camera, reduced, phone) with the director silent through it, standalone `/recall` and `/director` unchanged, API cases (bad answer, great answer, direction, prompt-injection attempt, silence, freeze, bad input).
  - Fixed along the way: a silent round's lines were dropped because Recall reports a round the same instant it enters the result screen; the idle line fired while a round was being scored; chatter could age out a round's roast.
- **Housekeeping before Phase 3 (Oct 10, 2026):**
  - **Recall's description -> scene step is fast now** (about 1.5-2s from Submit to score; was 6-23s). Short prompt (`lib/recallPrompt.ts`), fastest models (OpenRouter `google/gemini-2.5-flash-lite`, 10s timeout -> Gemini `gemini-flash-lite-latest`, 6s -> local keyword builder), lenient tidy step, 10-min cache, 18s hard deadline. Benchmarked first: the old default fell through on low credits to the thinking model `gemini-flash-latest` (6-19s); Flash-Lite answers in ~0.8-1.9s. Tested: normal, OpenRouter hanging (11.9s then Gemini), both hanging (16.1s then local), no keys (0.1s local). Loading state: "The director is reviewing the footage" with a film reel. Recall's gameplay, timing, pools and scoring are untouched (verified: no diff in score/pool/engine files).
  - **README rewritten** (the film contract, all acts, Recall, deterministic scoring, Director mode, the director, credits, tech stack, run locally with both env vars, live URL, built by voice with Wispr Flow). `.env.example` updated.
  - **Vercel is git-linked** to the GitHub repo; a push to `main` deploys to production automatically (verified: git-triggered deployments exist, alias `say-what-you-saw-git-main-aahhhh.vercel.app`).
- **Noir restyle (Oct 10, 2026, requested by Adi):** the whole film, Recall and Director HUD moved from arcade neon to a film-noir evidence file (charcoal, warm grey, aged paper, one blood-red accent, typewriter type, analog sounds). Recall: case-file HUD, Rookie/Detective/Chief folder tabs, CCTV footage frame, Witness Statement form, File Statement stamp, taped evidence photos with inked circles, stamped score. Visual and sound only: scoring, timings, scene JSON and icon names unchanged (verified: no diff in score/pool/scene/schema/icon/engine/generation files; one full timed round measured ready 3.71s, look 3.03s, statement 29.98s with auto-submit; score equals the sum of its categories). Phases 3-6 should be designed in this look, not arcade.
- **Phase 3 (Oct 10, 2026): The Spectacle, shipped.**
  - **Opening:** `components/film/BeamTitle.tsx` (three.js, lazy via `next/dynamic`, one shader pass, ~4k points): a projector beam is thrown down the dark frame in <1s, dust floats in it, and "Say What You Saw" assembles left to right out of that dust (sampled from the real title's letters, so it lands exactly on the DOM `h1`), then the real title fades in over it and the kicker + "roll camera" box appear. The beam and dust stay on behind the card. Fallbacks: reduced motion, WebGL failure, or 7s without finishing -> the old CSS title card. Hooked in `Opening.tsx` (`mode: gl|css`, classes `.title-stage.gl.lit`).
  - **Transitions:** new cut kind `reel` (class `.film-fx.changeover`, NOT `.reel`, which is Recall's loading reel): two cue marks (rings, top-right corner) tick with clicks, a reel-change clunk, then the film burn. Used for opening->cast, Act I->2.5, ad->Act II, Verdict->credits. `filmSfx.cue/reelChange`. Reduced motion falls back to a plain cut.
  - **Act 2.5 (`components/film/Break.tsx` `NotFound`, scene `act25`):** "Act 2.5 / NOT FOUND / 404" in a glitching typewriter font (chromatic slices, jitter, glitch sound), then the director says "Kidding. Budget cuts. A word from our sponsors." and the title gets struck through. Auto-continues after ~9.5s, with a Skip button.
  - **Commercial break (`CommercialBreak`, scene `ad`):** 15s "Memory+ ... for people like you" ad on cheap paper (4 slides; slide 3 quotes the Witness score; jingle), progress bar and countdown. **Skip ad only works on the second click**: the first click shakes the button, buzzes, shows "Skipping is a Memory+ feature." and the director says "Skip is a Memory+ feature. Try again. I dare you." Then on to the Act II card. Both new scenes are in Select Scene, TALKATIVE (the director may speak) and RETAKE.
  - **Credits in 3D:** CSS `perspective` layers at different depths and speeds: a ghost title far back, film strips with sprocket holes beside the roll, dust right in front; the camera tilts with the pointer. Reduced motion: static.
  - **Recall copy (no logic):** leftover arcade copy rewritten in the witness-statement tone: verdict lines (`VERDICTS` strings in `lib/score.ts`, tiers/thresholds untouched), "Witness Briefing" tutorial, "You get 3 seconds. Once.", "Cross-checking...", "No statement, no sketch.", "Open the file", "Close the case", etc. Scoring, timings, pools and scene JSON untouched.
  - **Tested** (headless Chrome, production build, software GL): opening (beam, particle assembly, lit title, no console errors), reduced motion (CSS title, no canvas), 390x844 phone (opening, 404, ad, credits), Act 2.5 -> ad auto-advance, director line spoken/shown, ad Skip first click denied / second click goes to Act II card, reel-change cue marks positioned top-right, credits layers, standalone `/recall` renders the new briefing.
- **Phase 4 (Oct 10, 2026): The Trailer, shipped.**
  - **Where:** credits get a **Watch your trailer** button; also in Select Scene ("Watch your trailer"). Scene `trailer` (`components/film/Trailer.tsx`, lazy via `next/dynamic`, wrapped in an error boundary that sends the viewer back to the credits; there is always a "Back to credits" button). The credits flow never depends on it.
  - **Render (`lib/trailer/render.ts`):** a pure `drawTrailer(g, t, session, assets, fonts)` on a 1280x720 canvas, 2.39:1 letterbox, noir look, no grain (dust specks only). Cut list `CUTS`: 0-3.4 opener line on black in a projector cone; 3.4-5 flash + CCTV "Exhibit A" with a Recall target's real description; 5-10.4 the player's real dictated sentences as typed quotes (up to 3); 10.4-12.4 title line 2; 12.4-14.2 the score slams in (shake, stamp); 14.2-18.2 the four takes with Ken Burns (cropped from the saved photo strip; no strip -> lit wall) and title line 3; 18.2-20.4 the director's lines as a cut montage on a 0.4s beat; 20.4-22.4 the wanted poster slams in with GUILTY and title line 4 (no poster -> a bare wanted card); 22.4-23.0 black silence; 23.0-25 "Starring <name>. Directed by voice. Coming soon to a browser near you." Reduced motion: same cuts, no flashes, shakes or slams (`setCalm`).
  - **Score (`lib/trailer/score.ts`):** all Web Audio on its own AudioContext, scheduled on the same marks: risers, braams, clock ticks, a pulse, kicks and hats on the beat, a sub drop, the stamp hit, then the master gain is cut to true silence 22.4-23.0 (measured RMS 0.000), then a quiet chord and typewriter keys. Feeds the speakers (muted if the film is muted) and a MediaStream for the recorder (always).
  - **Narration (`/api/trailer`, `lib/trailer/*`):** text only, zod, provider chain, 10-min cache, 6/min per IP, one retry, on-brief check (anything in curly quotes must be something the player really said; no looks/body/voice/age/identity words) and funny house fallback lines built from the session (`offline.ts`). The client times out at 9s and falls back; the trailer never waits on it.
  - **Recorder (`lib/trailer/record.ts`):** `canvas.captureStream(30)` + the score's audio track -> `MediaRecorder` (vp9/opus, else vp8/h264, else mp4 on Safari). Unsupported or throwing -> null -> the trailer plays watch-only with a quiet note and no download button. A download needs more than 1KB of data.
  - **Tested** (headless Chrome, production build, software GL, real-time 25s runs): full run with strip + poster + AI lines; model blocked (house lines); demo subject (no strip/poster); `MediaRecorder` deleted (watch-only, no Download button, Back to credits works); `AudioContext` deleted (silent picture still plays); reduced motion; 390px phone; skip mid-trailer; credits -> trailer -> back. **The recorded file was checked: EBML header, tracks V_VP9 + A_OPUS, decodes at 1280x720, ~25.8s, and the decoded audio has real energy (RMS 0.02-0.10) with exact silence at 22.55-22.95s.**
  - Recall's gameplay, timing and scoring are untouched (the trailer only reads the data Recall already reports through `onFinish`).
- **Voice removed (Oct 10, 2026, Adi's call):** no voiceovers, no robotic or AI-generated voice anywhere. `lib/roast/host.ts` is text-only (typewriter subtitles, held longer for longer lines); `lib/roast/voice.ts`, the "Director on/off" chip and the context-menu voice toggle are gone. The Phase 2 "spoken with speech synthesis" and "mute toggle for the director's voice" items above are superseded. Sound effects and the generated music score stay.
- **Fix: Act II "Allow camera" could hang forever (Oct 10, 2026).** If the permission prompt was ignored or the browser never answered, `getUserMedia` never settled, the button stayed on "Rolling…" and "Use demo subject" was disabled, so Act II never started (reproduced on the previous production build). Now: an 8s wait, then the demo silhouette with a notice; "Use demo subject" works at any time; `video.play()` has a 4s limit; a late stream is released. Smoke test (`smoke.mjs`, kept in the job dir, plays the film from camera roll to credits with real hit-tested clicks) passes with fake camera, denied, prompt ignored and a phone viewport.
- **Fix: phone zoom-out on Recall's result screen (Oct 10, 2026).** The verdict line slams in at 2.2x scale for ~1.25s; on a 390px phone that made the page 547px wide, so the browser zoomed out and taps on "Next round" / "Close the case" landed in the wrong place (found by the phone smoke test with real taps; `innerWidth` read 547). `.recall-card { overflow-x: clip }` fixes it; the look is unchanged.
- **Opening feedback:** "Roll camera" shows "Rolling…" at once, its box appears ~1.5s sooner (while the last particles land), and opening -> cast uses the shorter film burn (the reel-change version left ~2s of apparent dead time). Decorative layers (`.beam-host`, `.film-fx`, `.cr-layer`, floor/spot/leader pieces, the trailer note) are explicitly `pointer-events: none`; an audit of every scene found no decorative overlay taking clicks.
- **Smoke test:** `npm run smoke` (`scripts/smoke.mjs`, needs a running production build; `fake|denied|none|hang` camera modes and a `phone` flag) plays opening -> name -> Act I (3 rounds) -> 2.5 -> ad (2nd-click skip) -> Act II -> 4 shots -> Verdict -> credits -> trailer -> Select scene with hit-tested clicks, and counts any speech utterances (must be 0).
- **Backgrounds (Oct 10, 2026):** +15 moody dark cinematic Director backgrounds (`noir-*`): rainy avenue, foggy alley, neon window, lamplit room, parking garage, harbor dawn, misty pines, skyline dusk, subway platform, diner night, long corridor, desert dusk road, old theater, rooftop night, lone lamp in fog. All from Wikimedia Commons file pages marked CC0 or public domain (many are former Unsplash CC0 uploads); resized to 1920x1080, darkened/desaturated with sharp, JPEG 0.1-0.5 MB. Tagged with `tags`/`moods`/`time` in `backgrounds.json`; `credits.md` lists every photo. The Director prompt gained a 4-line "how to pick an image" block (match the place, then time of day, then mood; example "Put me on top of a rooftop at night."). Known compromises: no CC0/PD neon *street* without readable signs was found (the neon pick is a window sign reading CLEANERS, no brand); the diner photo has small staff silhouettes through the windows and partial lettering; the desert pick is Monument Valley at dusk with a lit road, not a night highway.
- **Purpose pass (Oct 10, 2026, Adi's call):** the film now has a through-line and fewer tricks.
  - **Premise** under the title: "The Director: A crime was committed. You saw it. Prove it." (text only).
  - **The plant (Act I) and the payoff (Act III):** Recall's report hooks now also carry, per round, the names of what was `missed` and what was invented (`extra`), read straight from its existing scoring (no gameplay, timing or scoring change). Act I shows an "Evidence on file NN" counter and small tags for the latest round ("missed trophy, pink star", "invented red circle"), and the director says "Noted. Very interesting." (`lib/evidence.ts`). In Act III the wanted poster's Exhibits A, B and C are the witness's own worst statements with those same tags ("Missed: dog, ball +1 · Invented: cat, lamp"), so players see their own mistakes; if no tags exist the model's evidence is used.
  - **Cut as gimmicky:** the fourth-wall resize / top-left corner / copy / clock lines, the credits' 3D parallax layers and pointer tilt, and the reel-change cue marks (act changes are the plain film burn again). Kept: tab-away and idle lines, the right-click menu, the console note.
  - **Act 2.5 (404) + Memory+ ad are a first-visit joke:** shown once (`localStorage swys-break-seen`); the ad is now 10 seconds and its Skip still only works on the second click. Select Scene can replay both.
  - **Photos first in Director mode:** the picker (`bestBackground`) prefers photos, every generated backdrop has a stand-in photo (`PHOTO_FOR_PROCEDURAL` in `lib/director/catalog.ts`), `/api/direct` swaps any procedural id the model returns, the demo subject stands in the lamplit room photo, and the model prompt no longer lists generated backdrops.
  - **Polish:** `scripts/smoke.mjs` now runs at 1366x768 (and 390x844 with `phone`) and checks after every step for page overflow, text off-screen or clipped, overlapping text blocks, and reports layout shift (CLS). Trailer controls reserve their space so nothing jumps.

