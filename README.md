# Say What You Saw

**A short film you star in, directed by your voice.**

Live: **https://say-what-you-saw.vercel.app**

Say What You Saw is a film that plays in your browser, and you're the lead. A washed-up film director (the site itself) narrates, interrupts and roasts you the whole way through. You describe a scene from memory, then direct yourself on camera, and then, in the last act, the film reveals that **you were never the witness. You were the suspect.**

It was built for the Hacker House Goa 2026 × Wispr Flow challenge, and it was built **entirely by voice** with **Wispr Flow**: every prompt was dictated into Claude Code (see [Built by voice](#built-by-voice-with-wispr-flow)). It's also a game about exactly that skill: how well you can **say what you saw**.

---

## The film contract

This is what the film promises, in the order it plays. If a change breaks one of these lines, it's a bug.

| # | Scene | What happens | Where |
|---|---|---|---|
| 1 | **Opening** | Pure black. A click (or any key) rolls the film: a soft projector click, a flicker, a 5-to-1 countdown leader with a rotating sweep, then the lit title and a direction box ("roll camera"). | `/` |
| 2 | **Cast** | "Who's starring tonight?" Your name goes on a "Starring" card and is reused in the credits and on the wanted poster. | `/` |
| 3 | **Act I · The Witness** | A typed title card, then the **Recall** memory game, untouched. The director roasts each answer and interrupts between rounds. | `/` (and standalone at `/recall`) |
| 4 | **Act II · The Director's Stage** | A typed title card, then your webcam, cut out and relit live. You direct the scene by voice. | `/` (and standalone at `/director`) |
| 5 | **Act III · The Verdict** | After your fourth shot (or "That's a wrap") the frame freezes and the fourth wall breaks. The twist, a shattering frame, a **wanted poster** and a GUILTY stamp. | `/` |
| 6 | **End credits** | A slow roll with your name, your scores, your best line, your alias and crime, the photo strip and the crew, then downloads and Play again. | `/` |

The rules that hold for every scene:

- **Recall is never changed by the film.** Its gameplay, timings, pools and scoring are the same standalone or inside the film. The film only *listens* to it through report-only hooks (`onRound`, `onPhase`, `onFinish`).
- **Your camera never leaves your browser.** Only text (what you said, what the scene was, your scores) is ever sent to a model. Frames, the poster and the photo strip are made and kept on your device.
- **The director roasts only what you said.** Wrong memories, silly directions, silences. Never your face, body, looks, voice, age, name or identity. The prompts say so, the server checks for it, and the built-in fallback lines are swept against the same filter.
- **No browser dialogs.** There is no `alert`, `confirm` or `prompt` anywhere. Every "error window" in Act III is a styled prop.
- **Nothing hangs.** Every model call has a timeout and a funny, local fallback, so the film keeps playing with no keys, no network, or a slow model.
- **No film grain**, except one second of static in the middle of Act III's glitch.
- **Reduced motion is respected** everywhere: flicker, sweeps, shatter, fake cursor and credits roll are replaced by plain crossfades or still frames.
- **It works on phones.** The letterboxed cards, the Director's top bar and the poster all re-lay out for narrow screens.

Around the acts: a corner **mute**, and **Select scene** (jump to any act or the credits). Your progress is saved, so a **refresh resumes the same scene**, while a new visit always starts at the opening (your name is kept).

---

## The acts

### Opening and cast

The page starts completely black, because browsers only allow sound after a gesture. Click or press any key and the projector rolls: a soft click, a whirring motor and a quiet ambient drone, all synthesised with Web Audio (there are no audio files). The title ("Say What You Saw", cream serif, lit from above with its shadow pooling on the floor) appears with a direction box.

Say or type **"roll camera"** to begin. It accepts loose matches ("role camera", "action", "start", "pick it") because Wispr Flow dictates into the box, and there's a button for anyone without it. Then the film asks who's starring tonight and uses your name from there on.

### Act I · The Witness (Recall, `/recall`)

1. A **How to Play** tutorial with live mini-demos opens on your first visit.
2. Pick a difficulty and 3 or 5 rounds:
   - **Easy:** the target shows for 5 seconds. 11 simple scenes.
   - **Medium:** 3 seconds. 8 illustrated scenes with backdrops and motion.
   - **Hard:** 2 seconds. 8 busy scenes with 6–9 objects, weather and camera moves.
3. A neon 3‑2‑1‑LOOK countdown, then the target flashes and disappears.
4. You get **30 seconds** to describe it. Dictate with Wispr Flow straight into the box. It auto-submits at zero (or press Ctrl+Enter).
5. Your words are rebuilt into a scene by a fast model (about two seconds; see [The generator](#the-generator-fast-with-a-fallback-that-never-hangs)). While it works, **the director is reviewing the footage**.
6. **Reveal:** your scene sits beside the original. Things you missed get red rings and are named, things you invented get yellow rings. The score counts up, each category bar fills, and you get a one-line verdict.
7. Running total, win jingle or loss buzzer, confetti on high scores, and a best score saved per difficulty and round count.

In the film, Recall is wrapped in an "Act I" frame with an **On to Act II** bar once your game ends. Nothing about how it plays changes.

### Act II · The Director's Stage (`/director`)

1. **"The camera is now on you."** Allow your camera (1280×720, mirrored, fullscreen), or play with the built-in demo silhouette if you don't have one.
2. The shot opens **clean**: just you, no filters.
3. Dictate a direction into the film slate: "Put me on a Tokyo rooftop at night with neon rain", "golden hour, warm light from the left", "black and white noir, hard light from above", "make the moon orbit my head", "write ADI under my chin in gold".
4. The model returns a small change to the shot, and every change **eases in over a second**, so the picture never freezes while it thinks. Each line shows as a director's note with a **TAKE** counter.
5. **"Freeze"**, **"click"** or **"take the shot"** captures a frame with a flash and a shutter sound. **"Cut"**, **"go back"** or **"undo"** reverts to the previous setup.
6. In the film, your **fourth shot** (or **That's a wrap**) ends the act and starts the verdict. On the standalone page it makes a **35mm photo strip** instead (sprocket holes, frame numbers, orange date stamp) to download as a PNG.

#### How Director mode works

**MediaPipe** cuts you out of the background (selfie segmentation, feathered and smoothed) and tracks your face (head top, forehead, eyes, nose, mouth, chin, cheeks). Everything is drawn in **one WebGL pass**, back to front:

1. the background (a real photo, one of five procedural scenes, or your own room blurred)
2. you
3. a key light shaped around your face, plus a rim light
4. the colour grade
5. overlays that stick to your face (and pass behind your head when they orbit)
6. film grain (only if you ask for it)
7. light leaks

The whole look is one small settings object with clamped ranges, so the model can only ever nudge it, never break it. The route `/api/direct` has caching, rate limiting, one retry with the validation error fed back, patch repair, and an offline keyword director. A synthwave frame is drawn over the live view only; your captured shots stay clean.

### Act III · The Verdict

The twist. In order:

1. **The frame freezes.** The tab title becomes **"Suspect Detected"** and its icon a blinking red siren (both restored afterwards).
2. **The fourth wall breaks.** Fake system error windows ("Memory.exe has stopped responding", "Witness credibility: not found") stack up while a fake cursor clicks them.
3. **A glitch**: about a second of static, an RGB split and warping, under a detuned tone.
4. **The twist is typed out:** *Plot twist: you were never the witness. You are the suspect.*
5. **The shatter.** The frozen frame breaks into 80 shards (three.js) that drift in slow motion, fly back together as the back of a poster, and spin around to reveal the front.
6. **The wanted poster**, drawn on a canvas on your device: aged paper, your sepia still (or, with no camera, a police sketch the fake cursor drags in, captioned "Suspect refuses to be photographed. Suspicious."), your name, an **alias**, the **crime**, **Exhibits A, B and C quoting your real words**, a tiny reward, and a **GUILTY** stamp with a thud and a camera shake.
7. Buttons: **Download poster** (PNG), **Appeal** (restart Act I) and **Roll credits**.

The charge sheet comes from `/api/verdict`, which receives **text only** (your name, what each memory scene really held, what you said, your scores, your director lines). Each exhibit must quote something you actually said, and no two exhibits can be the same line. If the model is down or slow, a funny local charge is built from your own words. Everything is validated with Zod.

### Background photos

Director mode has 25 photo backgrounds: 15 moody, dark, cinematic ones (rainy avenue, foggy alley, neon window, lamplit room, parking garage, harbor at dawn, misty pines, skyline at dusk, subway platform, diner at night, long corridor, desert road at dusk, old theater, rooftop at night, lone lamp in fog) and 10 earlier ones. Each is tagged with mood and time of day in `public/backgrounds/backgrounds.json` so the model can pick the right one ("Put me on top of a rooftop at night."). Every photo's title, photographer, license and source URL is listed in [`public/backgrounds/credits.md`](public/backgrounds/credits.md).

### The credits

A slow roll over the same dark synthwave floor: **Starring** your name, then Act I (your Witness score, your best Recall score, your best line), the **photo strip** in the middle, Act II (your takes and every line you directed as a numbered scene), Act III (your alias, the crime and the poster), the crew (Wispr Flow, made by Adi, Claude Code), and photo credits for any background photos you used. You can:

- **Download the photo strip**
- **Share the credits card:** a ready-made 4:5 image of your title, scores, best line and the poster (the phone share sheet where available, a PNG download on desktop)
- **Play again**

---

## The director (the film's one voice)

Every line comes from one character: an arrogant, washed-up film director whose last good movie was in 1994.

- **Roasts.** After every Recall answer and every direction you give, he fires one short line that **quotes you**: "A 'dragon eating a sandwich'? Did you even look at the screen?" It appears as a typewriter subtitle ("THE DIRECTOR") and is **never spoken: the film has sound effects and music, but no voice**. The line comes from `/api/roast`, which has a cache, a rate limit and a Zod check, requires the line to quote a real word you said, and rejects anything about looks, body, voice, age or identity. If the model fails, over 80 built-in roasts take over. "Freeze", "cut" and silences never call a model at all.
- **Interruptions.** Between Recall rounds he cuts in: *"Interruption. Round 2. Try not to embarrass yourself."*
- **Quiet time.** He says nothing in the opening, in Act III, or during Recall's countdown, flash and 30-second describe phases.
- **Fourth-wall reactions** (local, rate limited, only two): coming back from another tab ("Where did you go? The scene is still running.") and 20 seconds of idleness ("Hello? Is the talent asleep?"). The right-click action menu and a console detective's note for people who open dev tools remain.
- **Right-click** opens a film-style action menu (Retake this act, Select scene, the director's voice, sound), except in text fields and on touch screens, where the browser's own menu stays.
- **For anyone who opens dev tools:** there's a detective's note in the console.


---

## How the scoring works (deterministic, no AI)

The generator is a language model, but **the judge is not**. Scoring is plain code ([`lib/score.ts`](lib/score.ts)), so the same two scenes always get the same score.

**1. Match objects.** Every target object is paired with at most one of your objects, greedily, in this priority order:
- same **kind** first (circle ↔ circle; icons and illustrations match by **name**, so "dog" ↔ "dog"),
- then closest **colour** (colours are bucketed by hue: red, orange, yellow, green, blue, purple, pink, brown, white, grey, black) or, for pictures, the same name (a related one like tree ↔ pine tree earns partial credit),
- then nearest **position**.

A different kind of thing only stands in for the original if the colour or name is exactly right, so a pink star never passes for a red circle.

**2. Weight each match by confidence.** The right thing in the right colour gets full weight. The right shape in the wrong colour gets about a quarter. All other credit is scaled by this weight, so a random guess can't collect points everywhere.

**3. Score five categories, 20 points each (total 100):**

| Category | What it checks |
|---|---|
| **Objects & count** | Matched objects vs. everything in both scenes (an F1 score). Misses *and* made-up extras cost points. |
| **Colour** | The same colour family (or the same icon) = full credit, a neighbouring shade or related icon = partial. |
| **Position** | Mostly *relative* layout: is A still above / left of B? Plus a little for absolute placement. |
| **Size** | Ratio of sizes. Within 15% is full marks. |
| **Motion** | The same kind of motion (move / fade / grow / orbit) in the same direction. A still scene only earns these points for things you actually remembered. |

Things you didn't mention count as zero everywhere, so naming half the scene can't score more than about half. Your total over all rounds is your **Witness score**, and it travels with you into the verdict and the credits.

---

## The generator: fast, with a fallback that never hangs

Recall waits on one model call, the one that turns your description into a scene, while you look at your score. It's built to be quick and to always answer:

1. **A short prompt.** Recall only needs shapes, 184 neon icons, colours, positions, sizes and a few motions, so it gets its own compact prompt instead of the long one Studio uses.
2. **The fastest model.** OpenRouter's `google/gemini-2.5-flash-lite` first (about one second), with a **10-second timeout**.
3. **Gemini next.** If that misses, times out or returns something invalid, Google Gemini (`gemini-flash-lite-latest`) gets up to 6 seconds.
4. **A local keyword builder last.** If that also misses, a simple offline engine builds the scene from keywords in your sentence (marked **OFFLINE BUILD**), instantly. A hard 18-second deadline in the route backs all of it up.

A healthy round goes from "Submit" to a score in about two seconds. Unusual shapes ("a triangle") and invented icon names are mapped to the nearest real ones instead of costing a retry, and an identical description is answered from a 10-minute cache.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, deployed on **Vercel**. **Zod 4** validates every model reply.
- **Scene engine:** scenes are JSON (objects plus a timeline of `move` / `fade` / `grow` / `orbit` with easing), rendered as SVG. **184 neon line icons** (Tabler, Lucide and Game Icons via Iconify) compiled into one sprite, 15 hand-drawn illustrations, 5 backdrops, particles, motion trails and camera moves.
- **The film:** **Web Audio** for every sound (projector, drone, error dings, glitch, glass, stamp; no audio files), **three.js** for the Act III shatter, canvas for the wanted poster, credits card and photo strip, **Motion** and **canvas-confetti** for Recall's feel, Cormorant Garamond, Chakra Petch and Press Start 2P for the type.
- **Director's Stage:** **MediaPipe Tasks Vision** (segmentation and face landmarks, models loaded from a CDN on that page only), one **WebGL2** shader for every layer, 9 colour grades, 5 procedural backgrounds, 10 photos from **Wikimedia Commons** (CC / public domain, credited on screen).
- **AI providers:** **OpenRouter** → **Google Gemini** → OpenRouter free models → an offline engine, with a dedicated fast chain for Recall (above). Every route has caching, rate limiting, schema validation, retries and a funny fallback.
- **Studio** (the original explainer-video creator) is hidden from navigation but still lives at `/studio`.

```
app/               the film (/), /recall, /director, /studio, and the API routes
                   /api/generate  description -> scene (Recall, Studio)
                   /api/direct    director line -> shot-settings patch
                   /api/verdict   case file -> charge sheet (Act III)
                   /api/roast     one director roast line
                   /api/edit      Studio voice edits
components/film/   the film shell: Film, Opening, Cards, Verdict, Credits, DirectorHost
components/        RecallGame, HowToPlay, SceneRenderer, director/DirectorStage, Studio…
lib/               scene schema, engine, scoring, generation, providers, offline engines, sounds
lib/director/      shot settings, WebGL renderer, tracking, overlays, grades, photo strip
lib/verdict/       charge schema, prompt, wanted poster, three.js shatter
lib/roast/         the director: roast schema, house roasts, voice, host queue
public/            neon icon sprite, background photos
scripts/           build-icons.mjs (regenerates the neon icon sprite)
GRAND_PLAN.md      the roadmap, phase by phase, with a progress log
```

---

## Run it locally

You need **Node.js 20+**, an **OpenRouter API key** (https://openrouter.ai/keys) and a free **Gemini API key** (https://aistudio.google.com/apikey) as the backup.

```bash
git clone https://github.com/adityabrabb/say-what-you-saw.git
cd say-what-you-saw
npm install
```

### Add your two API keys

Create a file called **`.env.local`** in the project root:

```bash
# Main AI provider
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Backup (free tier): used if OpenRouter fails, times out or runs out of credits
GEMINI_API_KEY=your-gemini-key-here
```

Optional overrides (the defaults are good):

```bash
# OPENROUTER_FAST_MODEL=google/gemini-2.5-flash-lite   # Recall's fast model
# GEMINI_FAST_MODEL=gemini-flash-lite-latest           # Recall's fast backup
# OPENROUTER_MODEL=google/gemini-2.5-flash             # Studio and other long generations
# GEMINI_MODEL=                                        # Studio's preferred Gemini model
```

`.env.local` is git-ignored, so your keys never get committed. There's a template in [`.env.example`](.env.example). Then start it:

```bash
npm run dev
```

Open http://localhost:3000 and click the black screen to roll the film.

> **Without any keys, everything still runs.** Recall, the director's roasts and the verdict fall back to the offline engines (Recall marks its scenes **OFFLINE BUILD**), so the whole film stays playable.

For a production check, run `npm run build` and then `npm start`.

**Deploying to Vercel:** the project is linked to this GitHub repo, so a push to `main` deploys it. Set `OPENROUTER_API_KEY` and `GEMINI_API_KEY` under *Project → Settings → Environment Variables*.

---

## Roadmap

The film is being built in phases, tracked in [`GRAND_PLAN.md`](GRAND_PLAN.md): **done** are the film shell, the verdict (Phase 1) and the director (Phase 2). **Next** are a three.js projector-beam opening and a fake mid-film ad break (Phase 3), an auto-edited trailer of your session (Phase 4), a shared "Most Wanted" wall (Phase 5), and a final polish pass (Phase 6).

---

## Built by voice with Wispr Flow

**This project was built by voice.** Every prompt was dictated into Claude Code using **Wispr Flow**, from the first line of the first screen to the last bug report. Claude Code wrote the code; I never typed any.

How it worked:

1. I hold the Wispr Flow hotkey and talk: "add a landing screen with two big arcade buttons", "a random guess got 40, make the scoring stricter", "the screen break is laggy, make it faster", "turn the whole site into a short film".
2. Wispr Flow turns that into clean text right in the Claude Code prompt. It handled long, rambling, multi-part instructions and my mid-sentence corrections, with no retyping.
3. Claude Code wrote the code, ran production builds, fixed errors, tested the pages in a headless browser (screenshots, frame rates, console errors), and committed, pushed and deployed each working step.

The only physical keys were the Wispr Flow hotkey and **Enter** to send a prompt. Everything else, every design change and every bug report, was spoken. The build was screen-recorded with Wispr Flow visible.

The game fits the tool: the better you can describe what's in front of you, the better you score. Say what you saw.
