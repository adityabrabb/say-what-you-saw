# Say What You Saw

**A short film you star in, directed by your voice.**

**Play it: https://say-what-you-saw.vercel.app**

> ## 🎙️ Built entirely by voice with Wispr Flow
>
> **I never typed a line of this project.** Every prompt, every design change and every bug report was **dictated with [Wispr Flow](https://wisprflow.ai)** straight into Claude Code, and Claude Code wrote all the code. The only physical keys I touched were the Wispr Flow hotkey and Enter. The whole build was screen-recorded with Wispr Flow visible.
>
> The game fits the tool: the better you can describe what's in front of you, the better you score. **Say what you saw.** See [Built by voice](#built-by-voice-with-wispr-flow) for how it went, phase by phase.

Made for the Hacker House Goa 2026 × Wispr Flow challenge.

---

## The concept

Say What You Saw is a film that plays in your browser, and you're the lead. A washed-up film director (the site itself) narrates, interrupts and roasts you the whole way through.

1. **You are the witness.** A scene flashes for a few seconds. You describe it from memory by dictating, and a deterministic judge scores how much you remembered.
2. **You direct yourself.** Your webcam is cut out of your room and relit live. You say where you are and how it should look, and the shot changes.
3. **You were never the witness.** In the last act the film freezes, the fourth wall breaks, and you get a **wanted poster** with your own words as evidence. You were the suspect all along.

Then credits, a downloadable photo strip, and a 25-second **trailer** auto-edited from your session.

The look is film noir: an evidence file, near-black charcoal, aged paper, typewriter type and one blood-red accent. The tone is funny and roasty, and the roasts only ever target **what you said**, never your face, body, age or identity.

## A 60-second walkthrough

| Time | What you'll see |
|---|---|
| **0:00** | Pure black. Click and a projector clicks on, the film flickers, a 5-to-1 leader counts down, and a beam of dust assembles **"Say What You Saw"** out of particles. Say or type **"roll camera"**. |
| **0:10** | "Who's starring tonight?" You give your name; it goes on a card and later on your poster and credits. |
| **0:15** | **Act I · The Witness.** A target scene flashes for 2 to 5 seconds. You get 30 seconds to describe it. The director reviews the footage, your scene is rebuilt from your words, and the two are laid side by side with the misses and inventions circled in red. The director roasts you, quoting what you said. |
| **0:30** | (First visit only) a fake **Act 2.5: NOT FOUND (404)**, a "budget cuts" apology and a 10-second **Memory+** ad you can only skip on the second click. |
| **0:35** | **Act II · The Director's Stage.** Your camera is cut out and relit. Say "Put me on a rooftop at night with neon rain" and the shot eases there over a second. Say "freeze" to take a shot. |
| **0:50** | After the fourth shot the frame freezes. The tab becomes **"Suspect Detected"**, fake error windows pile up, there's a second of glitch, the twist is typed out and the frame **shatters into 80 shards that reassemble into your wanted poster**. A GUILTY stamp slams down. |
| **1:00** | Rolling **credits** with your scores, your best line, your alias and crime, the photo strip, and a button to **watch your trailer**. |

### Scene select

A **Select scene** button in the corner jumps to any scene: the opening, cast, every act, the break and ad, the verdict, the credits and the trailer. Progress is saved, so a **refresh resumes the same scene**, while a new visit starts at the opening (your name is kept). A corner **mute** silences all sound.

---

## The acts

### Opening and cast

The page starts black because browsers only allow sound after a gesture. After your click, a projector clicks on, a motor whirs and a quiet drone hums, all synthesised with Web Audio (there are no audio files). The title is built from about 4,000 particles in a three.js projector beam, which loads lazily and falls back to a plain CSS title card without WebGL, with reduced motion or if it is slow.

**"Roll camera"** accepts loose matches ("role camera", "action", "start") because Wispr Flow dictates into the box, and there's a button for people who don't use it.

### Act I · The Witness (Recall, `/recall`)

1. A **briefing** with live mini-demos opens on your first visit.
2. Pick a difficulty and 3 or 5 rounds. They're case-file folder tabs: **Rookie** (target shows for 5 seconds), **Detective** (3 seconds) and **Chief** (2 seconds). Each has its own hand-made pool of scenes.
3. A countdown, then the target flashes on a CCTV frame and disappears.
4. You have **30 seconds** to dictate a witness statement. It auto-submits at zero.
5. Your words are rebuilt into a scene by a fast model in about two seconds (see [The generator](#the-generator)).
6. The reveal shows your scene next to the original as two taped evidence photos. Things you **missed** are circled in red and named, things you **invented** in amber. The score counts up, and you get a one-line verdict.

Recall is **never altered by the film**. Its gameplay, timings, pools and scoring are identical standalone or inside the film; the film only listens through report-only hooks.

#### How the scoring works (deterministic, no AI)

The generator is a language model, but **the judge is not**. Scoring is plain code ([`lib/score.ts`](lib/score.ts)), so the same two scenes always get the same score.

**1. Match objects.** Every target object is paired with at most one of your objects, greedily, in this priority order:
- the same **kind** first (circle with circle; icons and illustrations match by **name**, so "dog" matches "dog"),
- then the closest **colour** (bucketed by hue: red, orange, yellow, green, blue, purple, pink, brown, white, grey, black) or, for pictures, the same name (a related one like tree and pine tree earns partial credit),
- then the nearest **position**.

A different kind of thing only stands in for the original if the colour or name is exactly right, so a pink star never passes for a red circle.

**2. Weight each match by confidence.** The right thing in the right colour gets full weight. The right shape in the wrong colour gets about a quarter. All other credit is scaled by this weight, so a random guess can't collect points everywhere.

**3. Score five categories, 20 points each (total 100):**

| Category | What it checks |
|---|---|
| **Objects & count** | Matched objects vs. everything in both scenes (an F1 score). Misses *and* made-up extras cost points. |
| **Colour** | The same colour family (or the same icon) is full credit, a neighbouring shade or related icon is partial. |
| **Position** | Mostly *relative* layout: is A still above or left of B? Plus a little for absolute placement. |
| **Size** | Ratio of sizes. Within 15% is full marks. |
| **Motion** | The same kind of motion (move, fade, grow, orbit) in the same direction. A still scene only earns these points for things you actually remembered. |

Things you didn't mention count as zero everywhere, so naming half the scene can't score more than about half. Your total over all rounds is your **Witness score**, and it travels into the verdict and the credits.

### Act II · The Director's Stage (`/director`)

1. **"The camera is now on you."** Allow your camera (1280×720, mirrored, fullscreen) or use the built-in demo silhouette.
2. The shot opens **clean**: just you, no filters.
3. Dictate a direction into the film slate: "Put me on a Tokyo rooftop at night with neon rain", "golden hour, warm light from the left", "black and white noir, hard light from above", "make the moon orbit my head", "write ADI under my chin in gold".
4. Every line shows as a director's note with a **TAKE** counter.
5. **"Freeze"**, **"click"** or **"take the shot"** captures a frame with a flash and shutter sound. **"Cut"**, **"go back"** or **"undo"** reverts to the previous setup.
6. In the film, your **fourth shot** (or **That's a wrap**) starts Act III. On the standalone page it builds a **35mm photo strip** (sprocket holes, frame numbers, orange date stamp) to download as a PNG.

#### How the cut-out works (segmentation)

**MediaPipe** selfie segmentation produces a person mask at 256×144 and face landmarks locate the head top, forehead, eyes, nose, mouth, chin and cheeks. Everything is composited in **one WebGL2 pass**, back to front:

1. the background (a real photo, a generated scene, or your own room, blurred)
2. you, cut out with a bicubic, feathered mask that sits just inside the body so no halo leaks
3. a key light shaped around your face from its landmarks, plus a rim light on the mask edge
4. the colour grade (9 looks plus exposure, contrast, saturation, temperature, tint, fade, vignette)
5. overlays that stick to your face (and pass behind your head when they orbit)
6. film grain (only on request) and light leaks

**Adaptive quality:** the render loop watches its own frame time. If it can't hold **30 fps** for three seconds, the shader switches to a lite path (single-tap blur, plain mask edge, no grain, leaks, teeth or edge wrap) and stays there for the shot. Tracking resolution adapts the same way.

#### How a dictated direction becomes a shot (shot patches)

The whole look is one small settings object with clamped ranges (background, grade, light, grain, leaks, overlays). **The model never returns a whole shot, only a *patch*:** a partial change such as `{ "light": { "angle": 180, "color": "#ffb060" } }`. The route `/api/direct`:

1. validates the patch with Zod (one retry with the validation error fed back, then a repair step that keeps whatever is valid),
2. swaps generated backdrops for real photographs when it can and snaps invented icon names to real ones,
3. falls back to an **offline keyword director** if no model answers,
4. is cached for 10 minutes and rate limited to 12 lines a minute per IP.

The client eases every patch in over one second, so the picture never freezes while a model thinks. A synthwave frame is drawn over the live view only; captured shots stay clean.

#### Background photos

Director mode has 25 photo backgrounds, 15 of them moody, dark, cinematic ones, each tagged with mood and time of day so the model can pick the right one ("Put me on top of a rooftop at night."). Every photo's title, photographer, licence and URL is in [`public/backgrounds/credits.md`](public/backgrounds/credits.md).

### Act III · The Verdict

1. **The frame freezes.** The tab title becomes **"Suspect Detected"** and the icon a blinking red siren (both restored afterwards).
2. **The fourth wall breaks.** Fake system error windows ("Memory.exe has stopped responding", "Witness credibility: not found") stack up while a fake cursor clicks them. They are styled props; the site never opens a real browser dialog.
3. **A glitch**: about a second of static, an RGB split and warping under a detuned tone. It is the only film grain anywhere.
4. **The twist is typed out:** *Plot twist: you were never the witness. You are the suspect.*
5. **The shatter.** The frozen frame breaks into 80 three.js shards that drift in slow motion, fly back together as the back of a poster and spin around to reveal its front.
6. **The wanted poster**, drawn on a canvas on your device: aged paper, your sepia still (or, with no camera, a police sketch the fake cursor drags in, captioned "Suspect refuses to be photographed. Suspicious."), your name, an **alias**, the **crime**, **Exhibits A, B and C quoting your own worst statements** (tagged with what you missed and invented in Act I), a tiny reward and a **GUILTY** stamp.
7. Buttons: **Download poster** (PNG), **Appeal** (restart Act I) and **Roll credits**.

The charge sheet comes from `/api/verdict`, which receives **text only**. Each exhibit must quote something you really said and no two can be the same line; if the model is down, a funny local charge is built from your own words.

### The credits and the trailer

Credits roll your name, scores, best line, every direction as a numbered scene, the photo strip, your alias and crime, the crew and the photo credits. You can download the strip, share or download a credits card (a 4:5 image with your title, scores and poster), play again, or **watch your trailer**.

**The trailer** is 25 seconds, auto-edited from your session on a 1280×720 canvas in a 2.39:1 letterbox:

- an opening line on black, a flash of a Recall target and your own dictated sentences as typed quotes,
- the score slamming in, your four takes with Ken Burns moves, the director's lines cut on the beat,
- the wanted poster with its GUILTY stamp, a beat of true silence, and **"Starring <you>. Directed by voice. Coming soon to a browser near you."**

Four title lines are written by the model (`/api/trailer`, text only, with funny house fallbacks), and a score of risers, braams and a sub drop is generated live with Web Audio. **MediaRecorder** captures the canvas and audio into a downloadable file (see [limitations](#known-limitations)).

### The director

Every line of commentary comes from one character, an arrogant, washed-up film director. After each Recall answer and each direction he fires one short line that **quotes you**, shown as a typewriter subtitle ("THE DIRECTOR"). `/api/roast` requires the line to quote a real word you said and rejects anything about looks, body, age or identity; if the model fails, over 80 built-in roasts take over. He interrupts between Recall rounds ("Interruption. Round 2. Try not to embarrass yourself."), and stays quiet during the opening, Act III and Recall's countdown, flash and describe phases. Right-click opens a film-style action menu, and anyone who opens dev tools finds a detective's note in the console.

---

## The generator

Recall waits on one model call, the one that turns your description into a scene, so it's built to be quick and to always answer:

1. **A short prompt.** Recall only needs shapes, 184 neon icons, colours, positions, sizes and a few motions.
2. **The fastest model.** OpenRouter's `google/gemini-2.5-flash-lite` first (about a second), with a 10-second timeout.
3. **Gemini next.** If that misses or returns something invalid, Google Gemini (`gemini-flash-lite-latest`) gets 6 seconds.
4. **A local keyword builder last.** If both miss, an offline engine builds the scene from keywords in your sentence (marked **OFFLINE BUILD**). A hard 18-second deadline backs all of it up.

A healthy round goes from "Submit" to a score in about two seconds, and an identical description is answered from a 10-minute cache.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, deployed on **Vercel**. **Zod 4** validates every model reply.
- **Scene engine:** scenes are JSON (objects plus a timeline of move, fade, grow and orbit with easing) rendered as SVG, with 184 neon line icons (Tabler, Lucide, Game Icons), 15 hand-drawn illustrations, backdrops, particles and camera moves.
- **The film:** **Web Audio** for every sound (no audio files), **three.js** (loaded lazily) for the opening beam and the Act III shatter, canvas for the poster, credits card, photo strip and trailer, **Motion** for transitions, Cormorant Garamond, Courier Prime and Special Elite for type.
- **Director's Stage:** **MediaPipe Tasks Vision** (segmentation and face landmarks, loaded from a CDN on that page only) and one **WebGL2** shader for every layer.
- **AI providers:** **OpenRouter** → **Google Gemini** → OpenRouter free models → an offline engine, plus the fast chain for Recall. Every route has caching, rate limiting, schema validation, retries and a funny fallback.
- **Studio** (the original explainer-video creator) is hidden from navigation but still lives at `/studio`.

```
app/               the film (/), /recall, /director, /studio, and the API routes
                   /api/generate  description -> scene (Recall, Studio)
                   /api/direct    director line -> shot-settings patch
                   /api/verdict   case file -> charge sheet (Act III)
                   /api/roast     one director roast line
                   /api/trailer   four trailer title lines
components/film/   the film shell: Film, Opening, Cards, Break, Verdict, Credits, Trailer, DirectorHost
components/        RecallGame, HowToPlay, SceneRenderer, director/DirectorStage, Studio…
lib/               scene schema, engine, scoring, generation, providers, offline engines, sounds
lib/director/      shot settings, WebGL renderer, tracking, overlays, grades, photo strip
lib/verdict/       charge schema, prompt, wanted poster, three.js shatter
lib/trailer/       canvas renderer, Web Audio score, recorder, narration
lib/roast/         the director: roast schema, house roasts, host queue
public/            neon icon sprite, background photos, credits.md
scripts/           build-icons.mjs (icon sprite), smoke.mjs (whole-film test)
GRAND_PLAN.md      the roadmap, phase by phase, with a progress log
```

---

## Run it locally

You need **Node.js 20.9+**, an **OpenRouter API key** (https://openrouter.ai/keys) and a free **Gemini API key** (https://aistudio.google.com/apikey) as the backup.

```bash
git clone https://github.com/adityabrabb/say-what-you-saw.git
cd say-what-you-saw
npm install
```

Create **`.env.local`** in the project root:

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

`.env.local` is git-ignored; a template is in [`.env.example`](.env.example). Then:

```bash
npm run dev
```

Open http://localhost:3000 and click the black screen to roll the film.

> **Without any keys, everything still runs.** Recall, the director's roasts, shot patches, the verdict and the trailer lines fall back to offline engines (Recall marks its scenes **OFFLINE BUILD**), so the whole film stays playable.

For a production check run `npm run build && npm start`. To play the whole film with real clicks, run the production server on port 3100 and then `npm run smoke` (needs Chrome).

**Deploying:** the project is linked to this GitHub repo, so a push to `main` deploys to Vercel. Set `OPENROUTER_API_KEY` and `GEMINI_API_KEY` under *Project → Settings → Environment Variables*.

---

## Known limitations

- **Trailer download needs a Chromium browser.** Recording uses `MediaRecorder` on a canvas stream, tested in Chrome and Edge. Where it isn't supported (older Safari, some mobile browsers) the trailer still plays but is watch-only with no download button.
- **Director needs WebGL2 and a CDN.** MediaPipe's models load from a CDN, so Act II needs a network and a browser with WebGL2. Without a camera or tracking you get the demo silhouette.
- **The cut-out depends on your camera and light.** Segmentation runs at 256×144 and is upsampled, so fine hair detail is soft. On slow GPUs the shader drops to a simpler look below 30 fps.
- **Models can be slow or unavailable.** OpenRouter credits on the live site are low, so Gemini usually answers. Rate limits and caches are in memory per server instance. Everything has an offline fallback, which is less clever.
- **Hard difficulty is hard.** Two seconds, six to nine objects.
- **Act III reflects real content.** If you directed a very dark backdrop, the frozen frame and the shards are dark.
- **The Most Wanted wall from the plan was skipped**: it needs a database, which this project deliberately doesn't have.
- English only, and best on a laptop; phones work but Act II is heavy.

## Credits

- Background photos: every title, photographer, licence and source URL is in [`public/backgrounds/credits.md`](public/backgrounds/credits.md).
- Icons: Tabler, Lucide and Game Icons via Iconify. Fonts: Cormorant Garamond, Courier Prime, Special Elite (Google Fonts).
- Live site: **https://say-what-you-saw.vercel.app**

---

## Built by voice with Wispr Flow

**This project was built by voice.** Every prompt was dictated into Claude Code with **Wispr Flow**, from the first line of the first screen to the last bug report. Claude Code wrote the code; I never typed any.

How it worked:

1. I hold the Wispr Flow hotkey and talk: "add a landing screen with two big arcade buttons", "a random guess got 40, make the scoring stricter", "the screen break is laggy, make it faster", "turn the whole site into a short film".
2. Wispr Flow turns that into clean text right in the Claude Code prompt. It handled long, rambling, multi-part instructions and my mid-sentence corrections with no retyping. Messy dictation ("blood" for blur, "3GS" for three.js) was understood by intent.
3. Claude Code wrote the code, ran production builds, fixed errors, tested the pages in a headless browser (screenshots, frame rates, console errors) and committed, pushed and deployed each working step.

**How it was built, in phases** (the full log is in [`GRAND_PLAN.md`](GRAND_PLAN.md)):

- **Foundations:** Recall, the memory game, with deterministic scoring and a fast scene generator. Then Studio, then Director mode (webcam cut-out, relighting, voice-directed shot patches, photo strip).
- **The film shell:** the opening, cast and act cards, credits, Select scene, progress saving.
- **Phase 1, The Verdict:** the plot twist, the fake errors, the shatter and the wanted poster.
- **Phase 2, The Director:** one roasting character across the whole film, with interruptions.
- **Noir restyle:** the whole film moved from arcade neon to an evidence file.
- **Phase 3, The Spectacle:** the three.js projector-beam opening, the fake Act 2.5 and the ad break.
- **Phase 4, The Trailer:** a 25-second auto-edited trailer with a generated score and a downloadable recording.
- **Phase 5, The Most Wanted wall:** skipped on purpose (no database).
- **Phase 6, Polish and ship:** performance (lazy three.js, a shader that drops to a lite path below 30 fps), share metadata and an Open Graph still of the title card, a smoke test of the whole film, and a production check of both API keys and the rate limit.

The only physical keys were the Wispr Flow hotkey and **Enter** to send a prompt. Say what you saw.
