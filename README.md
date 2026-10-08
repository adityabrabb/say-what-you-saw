# Say What You Saw

**Speak it. See it. Score it.**

Live: **https://say-what-you-saw.vercel.app**

Say What You Saw turns what you *say* into animated scenes. Describe something out loud and it becomes a moving, neon-lit animation. Or flip it around: a scene flashes on screen, vanishes, and you have to describe what you saw from memory. The closer your words rebuild the original, the higher you score.

Your voice isn't a remote control here. It's the skill being tested.

Built for the Hacker House Goa 2026 × Wispr Flow challenge, and built **entirely by voice** (see [How it was built](#how-it-was-built-by-voice)).

---

## The two modes

### Recall (the game)

1. A **How to Play** tutorial with live mini-demos opens on your first visit.
2. Pick a difficulty and 3 or 5 rounds:
   - **Easy:** the target shows for 5 seconds. 11 simple scenes (a traffic light in the city, a cat and a dog under the sun, the Moon orbiting Earth…).
   - **Medium:** 3 seconds. 8 illustrated scenes with backdrops and motion (a dog chasing a football in the park, a rocket leaving Earth…).
   - **Hard:** 2 seconds. 8 busy scenes with 6–9 objects, weather, camera moves and staggered entrances (a ship in a thunderstorm, rush hour in the rain, a birthday party…).
3. A neon 3‑2‑1‑LOOK countdown, then the target flashes and disappears.
4. You get **30 seconds** to describe it. Dictate with Wispr Flow straight into the box. It auto-submits at zero (or press Ctrl+Enter).
5. Your words are rebuilt into a scene by the same generator Studio uses.
6. **Reveal:** your scene sits next to the original. Things you missed get pulsing red rings and are named ("Missed: robot, dice, coin"), and things you invented get yellow rings. The score counts up and settles, each category bar fills, and you get a one-line verdict ("Photographic memory. Are you a camera?" … "The scene is filing a missing persons report.").
7. Running total, win jingle or loss buzzer, screen flashes and shakes, confetti on high scores, and a best score saved per difficulty and round count.

### Studio (the creator)

- Type or dictate any explanation ("Bees collect nectar and bring it back to the hive…") and press **Generate**. You get a 1–3 scene animated explainer designed like a motion graphic: a fitting backdrop, 6–12 layered objects, labels and arrows that explain, most things animated, and a slow camera move.
- **Showcase bar:** three hand-made explainers drawn with detailed illustrations: a **solar eclipse**, the **water cycle** and a **rocket launch**.
- **Edit by voice:** "make the moon smaller", "slow down the earth", "add a label saying umbra". Edits **patch** the existing scene instead of regenerating it. Each edit lands in a history list showing exactly what changed (`moon w: 62 → 93`), and **Undo** restores the previous version.
- Playback controls: play/pause, a timeline scrubber and scene chips.

---

## How the scoring works (deterministic, no AI)

The generator is an LLM, but the **judge is not**. Scoring is plain code ([`lib/score.ts`](lib/score.ts)), so the same two scenes always get the same score.

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

Things you didn't mention count as zero everywhere, so naming half the scene can't score more than about half.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, deployed on **Vercel**
- **Scene engine:** scenes are JSON (objects plus a timeline of `move` / `fade` / `grow` / `orbit` with easing), rendered as SVG
- **Visuals:**
  - **184 neon line icons** from Tabler, Lucide and Game Icons (via Iconify), compiled into one SVG sprite and drawn as glowing neon tubes
  - **15 hand-drawn illustrations** (sun, Earth, moon, planet, shadow cone, clouds, rain cloud, mountain, sea, rocket, flame, smoke, launch pad, drop, vapour)
  - **5 backdrops:** space, sky, ocean, night city, neon grid
  - **Particles:** rain, snow, sparkle
  - Motion trails, staggered entrances, camera zoom and pan, gradient shading, glows and shadows
- **Performance:** every glow and shadow is a gradient (no blur filters), backdrops and particles are animated by CSS alone, and the stage is split into three GPU layers, so a moving object never repaints the backdrop. Heavy scenes hold 100–145 fps.
- **AI:** **OpenRouter** (default `google/gemini-2.5-flash`) with **Zod** validation. Bad JSON is sent back with the exact error and retried. Unknown icon names snap to the closest listed icon. Voice edits are small JSON patches, re-validated before they're applied.
- **Fallback chain:** OpenRouter → **Google Gemini** (free tier) → OpenRouter free models → an **offline keyword engine** that builds scenes and applies common edits with no AI at all, shown as **OFFLINE BUILD**
- **Game feel:** **Web Audio API** chiptune sounds (all synthesised, no audio files), **Motion** for counters, **canvas-confetti**, **three.js** for the low-poly neon moon on the landing screen
- **Arcade theme:** Press Start 2P and Chakra Petch fonts, warp star field, synthwave grid, CRT scan lines and power-on/off transitions

```
app/            pages (landing, /recall, /studio) and API routes (/api/generate, /api/edit)
components/     SceneRenderer, SceneBackground, Art, Player, RecallGame, HowToPlay, Studio, NeonMoon…
lib/            scene schema, engine, scoring, patching, generation, providers, offline engine, icons, sounds
scripts/        build-icons.mjs (regenerates the neon icon sprite)
```

---

## Run it locally

You need **Node.js 20+**, an **OpenRouter API key** (https://openrouter.ai/keys) and, optionally, a free **Gemini API key** (https://aistudio.google.com/apikey) as a backup.

```bash
git clone https://github.com/adityabrabb/say-what-you-saw.git
cd say-what-you-saw
npm install
```

### Add your API keys

Create a file called **`.env.local`** in the project root:

```bash
# Required: main AI provider
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Recommended: free backup if OpenRouter fails or runs out of credits
GEMINI_API_KEY=your-gemini-key-here

# Optional: a different OpenRouter model
# OPENROUTER_MODEL=google/gemini-2.5-flash
```

`.env.local` is git-ignored, so your keys never get committed. There's a template in [`.env.example`](.env.example).

Then start it:

```bash
npm run dev
```

Open http://localhost:3000.

> Without any keys, everything still runs. Generation and voice edits fall back to the offline engine (marked **OFFLINE BUILD**), so Recall stays playable.

**Deploying to Vercel:** add `OPENROUTER_API_KEY` and `GEMINI_API_KEY` under *Project → Settings → Environment Variables*, then redeploy.

---

## How it was built (by voice)

Every line of this project was written by Claude Code from prompts I **spoke** using **Wispr Flow**. I didn't type any code.

The workflow:

1. I hold the Wispr Flow hotkey and talk: "add a landing screen with two big arcade buttons", "a random guess got 40, make the scoring stricter", "the screen break is laggy, make it faster", "replace the emoji with neon outline icons".
2. Wispr Flow turns that into clean text right in the Claude Code prompt. It handled long, rambly, multi-part instructions and picked up every prompt, with no retyping.
3. Claude Code wrote the code, ran production builds, fixed errors, tested pages in a headless browser (screenshots, frame rates, console errors), and committed, pushed and deployed each working step.

Honest note on "keys typed": the only physical keys were **Enter** to send a prompt and the Wispr Flow **hotkey**. Everything else, including every prompt, bug report and design change, was dictated. The full build was screen-recorded with Wispr Flow visible.

Wispr Flow's small floating bar stays out of the way while you work, and it's fast and accurate enough that talking to your editor feels quicker than typing to it. Fittingly, the app it built is a game about how well you can **say what you saw**.
