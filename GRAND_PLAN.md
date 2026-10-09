# Grand Plan: Say What You Saw

> Status: **Phase 1 DONE (Oct 9, 2026).** Next up: **Phase 2: The Director**.
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
- [ ] One character: an arrogant, washed-up film director who roasts you constantly.
- [ ] After **each Recall answer** and **each director line**, the model returns **one short roast quoting what you said**.
- [ ] New `POST /api/roast` route: text in, `{ line }` out, with zod, the provider chain, cache and rate limit, and a big pool of funny offline roasts that quote your words.
- [ ] The roast shows as a **typewriter subtitle** ("THE DIRECTOR:") and is **spoken with speech synthesis** using the deepest available English voice (low pitch, slow rate).
- [ ] A **mute toggle for the director's voice**, separate from the sound toggle.
- [ ] It never blocks gameplay: roasts arrive asynchronously, and a late roast is dropped.

**Interruptions in Recall (no timing changes)**
- [ ] Between rounds, the director cuts in with an overlay: **"Interruption. Round 2. Try not to embarrass yourself."**
- [ ] It only appears on Recall's result screen, before you press next, so the countdown and flash timing stay exactly the same.

**Fourth-wall reactions (local, no model)**
- [ ] Switch tabs and come back: **"Where did you go? The scene is still running."**
- [ ] Idle for 20 seconds or more: **"Hello? Is the talent asleep?"**
- [ ] Local time of day, e.g. **"It's 2 AM and you're still playing this. Respect."**
- [ ] Resizing the window: **"Stop touching the set."**
- [ ] Mouse heading to the top-left corner (towards back/close): **"Leaving already? Coward."**
- [ ] Copying text: **"Stealing evidence?"**
- [ ] Right-click opens a **custom film-style context menu** (Cut, Retake, Select Scene, Mute director…).
- [ ] For the judges who open dev tools, the console prints a styled **detective's note** with ASCII art.
- [ ] Each reaction is rate-limited so it never spams, and none of them fire during the Recall flash.

## Phase 3: The Spectacle

**Opening rebuilt in three.js (lazy-loaded, with a CSS fallback)**
- [ ] A projector beam cuts through the dark, with floating dust particles.
- [ ] **"Say What You Saw"** assembles out of particles inside the beam.
- [ ] Then the scene settles into today's title card and "roll camera" direction box.

**Transitions and credits**
- [ ] Act transitions become **film burns and reel changes** (cue marks in the corner), with projector sounds.
- [ ] Credits roll with **3D parallax layers**.

**Mid-film fake-out (between Act I and Act II)**
- [ ] A fake **"Act 2.5: NOT FOUND (404)"** card in a broken, glitching font.
- [ ] The director, blaming **budget cuts**, cuts to a **15-second commercial break**.
- [ ] The ad is for **"Memory+ — for people like you"**, with a **Skip** button that only works on the second click.
- [ ] Then on to Act II.

## Phase 4: The Trailer (finale)

- [ ] After the credits, a **"Watch your trailer"** button (and a Select Scene entry) plays a **25-second trailer auto-edited from the session**.
- [ ] It renders to a **1280×720 canvas** in letterbox format.
- [ ] The model writes **four trailer title lines** ("In a world…" style) from the session text, with funny fallbacks.
- [ ] The sequence:
  - [ ] Black screen with the first line.
  - [ ] A flash of a Recall target.
  - [ ] The player's real dictated sentences as quoted subtitles.
  - [ ] The score slamming in.
  - [ ] The takes with **Ken Burns** zooms.
  - [ ] The director lines as a fast, on-the-beat cut montage.
  - [ ] The wanted poster with the GUILTY stamp.
  - [ ] Final title: **"Starring <name>. Directed by voice. Coming soon to a browser near you."**
- [ ] A **generated score** in Web Audio: trailer "braams", risers, a sub drop, and **silence just before the title**.
- [ ] **MediaRecorder** records the canvas and audio into a **downloadable WebM**. Where recording isn't supported, it falls back to play-only.
- [ ] Session data needed for the trailer (takes, lines, scores, poster) is kept on the device.

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
