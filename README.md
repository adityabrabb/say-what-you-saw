# Say What You Saw

**Speak it. See it. Score it.**

Live: **https://say-what-you-saw.vercel.app**

Say What You Saw turns what you *say* into animated scenes. Describe something out loud and it becomes moving shapes, labels and arrows. Or flip it around: a scene flashes on screen, it disappears, and you have to describe what you saw from memory. The closer your words rebuild the original, the higher you score.

Your voice isn't a remote control here. It's the skill being tested.

Built for the Hacker House Goa 2026 × Wispr Flow challenge, and built **entirely by voice** (see [How it was built](#how-it-was-built-by-voice)).

---

## The two modes

### Recall (the game)

1. Pick a difficulty: **Easy** shows the target for 5 seconds, **Medium** for 3, **Hard** for 2. Pick 3 or 5 rounds.
2. A neon 3‑2‑1‑LOOK countdown, then the target scene flashes and vanishes.
3. You get **30 seconds** to describe it. Dictate with Wispr Flow straight into the box. At zero it auto-submits.
4. Your description is turned into a scene with the same generator Studio uses.
5. **Reveal:** your scene sits next to the original. Objects you missed get pulsing red rings, and things you invented get yellow ones. The score counts up, each category bar fills, and you get a one-line verdict ("Photographic memory. Are you a camera?" … "The scene is filing a missing persons report.").
6. A running total across rounds, plus a best score per difficulty and round count saved in your browser.

Targets get harder as the difficulty goes up:

- **Easy:** 11 simple shape scenes (a traffic light, a snowman, three stars and an arrow, a sliding square…).
- **Medium:** 8 illustrated scenes with backdrops and motion (a dog chasing a football in the park, a rocket leaving Earth, fish swimming under a sailboat…).
- **Hard:** 8 busy scenes with 6–9 objects, weather, camera moves and staggered entrances (a ship in a thunderstorm, rush hour in the rain, a neon arcade, a birthday party…), all in a 2-second flash.

### Studio (the creator)

- Type or dictate any explanation ("The earth goes around the sun, the moon goes around the earth…") and press **Generate**. You get a short animated explainer of 1–4 scenes with play/pause, a timeline scrubber and scene chips.
- **Edit by voice:** "make the moon smaller", "slow down the earth", "add a label saying umbra". An edit **patches** the existing scene instead of regenerating it. Each edit lands in a history list showing exactly what changed (`moon r: 5 → 3`), and **Undo** restores the previous version.

---

## How the scoring works (no AI)

The generator is an LLM, but the **judge is not**. Scoring is plain deterministic code ([`lib/score.ts`](lib/score.ts)), so the same two scenes always get the same score.

**1. Match objects.** Every target object is paired with at most one of your objects, greedily, in this priority order:
- same **type** first (circle ↔ circle),
- then closest **colour** (colours are bucketed by hue: red, orange, yellow, green, blue, purple, pink, brown, white, grey, black),
- then nearest **position**.

A different shape can only stand in for the original if the colour is exactly right. A pink star will never pass for a red circle.

**2. Weight each match by confidence.** Right shape and right colour gets full weight. Right shape in the wrong colour gets about a quarter. Partial credit everywhere else is scaled by this weight, so a lucky guess can't collect points across the board.

**3. Score five categories, 20 points each (total 100):**

| Category | What it checks |
|---|---|
| **Objects & count** | Matched objects vs. everything in both scenes (an F1 score). Misses *and* made-up extras cost points. |
| **Colour** | Exact colour family = full credit, neighbouring shade (red/orange, blue/purple) = partial. |
| **Position** | Mostly *relative* layout: is A still above / left of B? Plus a little for absolute placement. |
| **Size** | Ratio of sizes. Within 15% is full marks. |
| **Motion** | Same kind of motion (move / fade / grow / orbit) and the same direction. A still scene only earns these points for objects you actually remembered. |

Objects you didn't mention count as zero in every category, so "a red circle" on a two-object scene can't score more than about half.

---

## What scenes can do

Scenes are JSON, and both the hand-made targets and the AI-generated ones use the same features:

- **Shapes and icons:** circles, rectangles, stars, text and arrows, plus **184 illustrated Fluent Emoji icons** (animals, vehicles, food, weather, planets, buildings, objects…).
- **Backdrops:** deep space with twinkling stars, a daytime sky with drifting clouds, a sunset ocean with rolling waves, a night city with lit windows, and a neon synthwave grid.
- **Weather particles:** sparkle, rain, snow.
- **Motion:** move, fade, grow and orbit with easing (`back`, `bounce`, `elastic`…), motion trails on anything that moves, staggered pop-in entrances, and a slow camera zoom and pan with parallax.
- **Look:** gradient-shaded shapes, soft glows and contact shadows.

**Performance:** every glow and shadow is a gradient, not a blur filter. Backdrops, particles and twinkles are animated by CSS alone. The stage is split into three GPU layers (backdrop, objects, weather), so a moving object never forces the backdrop to redraw, and the camera is a pure CSS transform. Heavy scenes hold 120–145 fps in Chrome.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **SVG renderer** with a small animation engine: scenes are JSON (objects + a timeline of `move` / `fade` / `grow` / `orbit`)
- **OpenRouter** for the LLM (defaults to `google/gemini-2.5-flash`)
- **Zod** to validate every model response. Bad JSON is sent back to the model with the exact error and retried, up to 3 attempts.
- Voice edits as **JSON patches** (`updateObject`, `addObject`, `updateAnimation`, …), applied to a copy and re-validated before they're accepted
- **three.js** for the low-poly neon moon on the landing screen (loaded lazily, paused off-screen)
- **Motion** for the countdown and score animations, **canvas-confetti** for celebrations
- **Web Audio API** for every sound effect. All synthesised in the browser, no audio files.
- **Fluent Emoji** icons (MIT, Microsoft) via Iconify, extracted to static SVGs by `scripts/build-icons.mjs`
- Deployed on **Vercel**

```
app/            pages (landing, /recall, /studio) and API routes (/api/generate, /api/edit)
components/     SceneRenderer, Player, RecallGame, Studio, NeonMoon, Starfield, …
lib/            scene schema, animation engine, scoring, patching, generation, sounds, fx
```

---

## Run it locally

You need **Node.js 20+** and an **OpenRouter API key** (get one at https://openrouter.ai/keys).

```bash
git clone https://github.com/adityabrabb/say-what-you-saw.git
cd say-what-you-saw
npm install
```

### Add your OpenRouter API key

Create a file called **`.env.local`** in the project root:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: use a different OpenRouter model
# OPENROUTER_MODEL=google/gemini-2.5-flash
```

`.env.local` is git-ignored, so your key never gets committed. There's a template in [`.env.example`](.env.example).

Then start it:

```bash
npm run dev
```

Open http://localhost:3000.

> Without a key, the landing page and the built-in solar-system demo still work, but generating scenes, scoring Recall rounds and voice edits will show "Missing OPENROUTER_API_KEY".

**Deploying to Vercel:** add the same `OPENROUTER_API_KEY` under *Project → Settings → Environment Variables*, then redeploy.

---

## How it was built (by voice)

Every line of this project was written by Claude Code from prompts I **spoke** using **Wispr Flow**. I didn't type any code.

The workflow:

1. I hold the Wispr Flow hotkey and talk: "add a landing screen with two big arcade buttons", "the scoring is too generous, a random guess got 40, make it stricter", "the screen break is laggy, make it faster".
2. Wispr Flow turns that into clean text right in the Claude Code prompt. It handled long, rambly, multi-part instructions, and it picked up every prompt without me retyping anything.
3. Claude Code wrote the code, ran a production build, fixed errors, tested pages in a headless browser, and committed and pushed each working step.

Honest note on "keys typed": the only physical keys were **Enter** to send a prompt and the Wispr Flow **hotkey**. Everything else, including every prompt, every bug report and every design change, was dictated. The full build was screen-recorded with Wispr Flow visible.

Wispr Flow's small floating bar stays out of the way while you work, and it's fast and accurate enough that talking to your editor feels faster than typing to it. Fittingly, the app it built is a game about how well you can **say what you saw**.
