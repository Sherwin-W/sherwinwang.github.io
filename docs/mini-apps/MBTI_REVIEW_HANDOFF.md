# Codex review handoff: MBTI-inspired test (free, scenario-based)

Branch `feature/mini-apps`, uncommitted working tree. Nothing has been committed, pushed or deployed. Review the working tree, including untracked files. Do not modify files, commit or install dependencies.

## Scope

The owner's "MBTI Test — Revised Scope: Free, Scenario-Based Personality Assessment" brief replaces the earlier AI and TTS plan. Spec: `docs/mini-apps/MBTI.md`. Blackjack is out of scope and must be unchanged. The only server change is Spotify `durationMs` (`server/lib/spotify.ts` and its test); all MBTI server code and `@anthropic-ai/sdk` were removed.

## Please verify in particular

1. **No paid services or secrets:**
   - No network calls from `/mbti/`, except what the browser's own speech recognition does.
   - No API keys.
   - No leftover MBTI server routes or dependencies.
2. **Late transcripts:**
   - `useSpeech` generation guard.
   - `ResponseInput` keyed per question and per scene part, so unmount cancels recognition.
   - Can any final result still reach the next question or scene, including during the ring delay or after Leave?
3. **Scoring:**
   - The negation window and the "but" reset.
   - The third-person filter: does it wrongly skip "My friend and I love parties"?
   - Hedge and general weights, the per-response cap, confidence thresholds, and the stage-disagreement note.
   - Are any rubric patterns in `stage2/scenes.ts` too broad, or do they score belief or agreement (especially `different-beliefs`)?
4. **Session reducer:** any phase or action combination that loses answers or reaches results with too little evidence (`canSeeResults`, `finishStage1` with a pending follow-up).
5. **Voice:**
   - `useVoice` token handling when `say` is called rapidly (replay spam, mute toggles mid-line, unmount).
   - The fallback path when `Audio.play()` rejects versus `onerror` firing later.
   - The `speaking` state never sticking at true.
6. **Accessibility:**
   - Focus moves on question change, transition and results.
   - Captions in a polite live region.
   - The recording indicator, `aria-pressed` on toggles, and 44px targets.
   - Reduced motion (`.mb--still` and the media query).
   - The `mb-type` heading's `aria-label`.
7. **Content honesty:**
   - No claim of recorded or licensed audio.
   - No precise percentages.
   - The disclaimer appears on the intro, results and share card.
   - The share card contains no quotes.

## Checks run (all passing)

`npm run lint`, `npm run typecheck`, `npm test` (22 files, 311 Vitest tests, plus the node playable tests), `npm run build`, `npm run test:browser` (85 tests). `docs/playable-portfolio` was restored after the browser run.

## Addendum: real voices and a smaller thumbnail (2026-11-03)

Brief: "MBTI Test — Minimalist Portfolio Thumbnail & Real Human Voices". Speech synthesis is removed. Characters use CC0 human recordings (see `MBTI_VOICES.md`), the scenes were adapted to those recordings, and a seventh scene (Rosa, "Checking in") was added. The tile is now a small thinking character sized like the Blackjack art.

New or changed: `src/mbti/stage2/{voice.ts, voiceLines.ts, voiceCatalog.ts, scenes.ts}`, `ui/SceneCall.tsx`, `ui/VoiceCredits.tsx`, `ui/ResponseInput.tsx` (`characterSpeaking`), `ui/Stage1.tsx` (no narration), `pixel/scenes.ts` (`porch`), `public/voices/*.m4a` (22 files, about 0.4 MB), `scripts/voices/process.py`, `src/components/bento/visuals/{MbtiPreview.jsx, visuals.css}`, `src/data/projects.js`, plus tests.

Please verify in particular:
1. `useVoice` token handling across play, stop, replay and unmount; the `NotAllowedError` path (blocked) versus other rejections (failed); and that `speaking` can never stay true.
2. The microphone and playback interaction: no path where a character clip plays while recognition is listening.
3. Subtitle accuracy: the catalog transcripts match `scenes.ts` (a test checks this), and the Common Voice sentences are the validated prompts.
4. The licensing statements in `MBTI_VOICES.md` and in the credits panel.
5. Rubric changes for the adapted scenes, especially that `destiny` never scores belief or agreement.
6. The tile: no layout shift, and the finite animation (an infinite one previously blocked tests that wait for `document.getAnimations()`).

Checks: lint, typecheck, `npm test` (327 Vitest and 20 node tests), build, and `test:browser` (95) all pass.
