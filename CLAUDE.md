# Project: Say What You Saw

Hacker House Goa 2026 / Wispr Flow shortlisting task. Hard deadline Oct 11 12:00 AM IST. TARGET SUBMISSION: Fri Oct 10, 12:00 PM IST.

## The rule
The owner (Adi) builds this ENTIRELY BY VOICE using Wispr Flow. He dictates prompts to you; you write all the code. Never ask him to type code. Keep replies short so he can respond by voice. Don't ask for exact syntax or filenames; infer them. Screen is being recorded: prefer visible, incremental progress over big silent changes.

## What we're building
A web app where you dictate an explanation and it becomes an animated explainer video, then you edit it by voice.
Example: "The earth goes around the sun, the moon goes around the earth, that's why we get eclipses" -> animated scenes with shapes, labels, arrows and motion, plus a voiceover.
Voice edits: "make the moon smaller", "slow down scene 2", "add a label saying umbra".

The app input is a plain text box. Wispr Flow dictates into it. Do NOT build our own mic/speech input. Wispr is the voice layer.

## Two modes (same engine)
- **Studio** (creator): describe anything, it builds the animated SVG scene; edit by voice.
- **Recall** (game, the hero of the demo):
  1. A target scene flashes for N seconds (Easy 5s, Medium 3s, Hard 2s). Targets come from a curated pool of hand-made scenes first, AI-generated later.
  2. Player gets 30s (visible countdown) to describe it from memory, dictated via Wispr into the text box. Auto-submit at 0.
  3. Description -> scene JSON via the same generator.
  4. Score by comparing the two scene JSONs object by object: object type/count, colour, relative position, size, motion. Use deterministic matching (e.g. greedy/Hungarian on type+colour+position), not an LLM, so scores are consistent. Show breakdown per category.
  5. Reveal: player's scene overlaid / side by side with the original, misses highlighted. Funny one-line verdict.
  6. Rounds, total score, difficulty select, local high score. Shareable result card if time.

Recall is why judges will love it: voice is the actual skill being tested, not just a controller.

## Why it should stand out
Other entries are mostly voice-controlled games, voice-to-UI tools and AI dashboards. Nobody is doing voice-to-animation. Edits must change the existing scene data, not regenerate everything.

## Prototype scope (cut hard, prototype is fine)
- Stack: Next.js + TypeScript, SVG renderer, deploy to Vercel. Keep it simple.
- Primitives only: circle, rect, text, arrow, image. Actions: move, fade, grow, orbit.
- Scene format: JSON, list of scenes, each with objects and a timeline of animations.
- LLM call turns a script into scenes in that JSON format (validate output against a schema, auto-repair or retry on bad JSON).
- Layout rules so it never looks random: auto-spacing, keep everything on screen, consistent palette and fonts.
- Voice edits: LLM receives current scene JSON + instruction, returns a small patch (not a full rewrite). Apply patch, replay.
- Text-to-speech voiceover per scene, animation timed to it.
- Playback controls: play, pause, scene scrubber.
- Stretch only if time: export video.

## Build order
1. Scene JSON schema + SVG renderer playing a hardcoded example.
2. Script -> scenes generation.
3. Recall mode: target pool (10+ hand-made scenes), flash, 30s timer, scoring, reveal screen.
4. Voice edit patches + undo in Studio.
5. Polish: game feel (sounds, countdown, score animation), landing screen with the two modes.
6. Voiceover sync in Studio (cut first if behind).
7. README, repo public, deploy live URL.

Priority if time runs short: Recall > Studio generation > voice edits > voiceover.

## Submission checklist
- GitHub repo with README explaining it was built by voice
- Screen recording of the actual build process (keep Wispr visible, show "keys typed" honestly: Enter/hotkey are physical unless using a mouse binding)
- Live demo URL
- Wispr account created via ref.wisprflow.ai/hhg
- Submit by Fri Oct 10, 12:00 PM IST

## Fallbacks
- If TTS or sync breaks, ship captions instead of voiceover.
- If LLM scenes look bad, hand-write 3 great demo scenes and keep live generation as the bonus.
