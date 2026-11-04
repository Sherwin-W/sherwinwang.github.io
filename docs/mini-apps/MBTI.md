# MBTI-Inspired Personality Test (`/mbti/`)

A free, entirely client-side, voice-first personality test. It is not a chatbot: every line a character says is predefined, and the reading comes from deterministic, inspectable rules. `/mpti/` (the old address) redirects here and keeps the query and hash.

## Name and disclaimer

"MBTI" and "Myers-Briggs Type Indicator" are trademarks of The Myers-Briggs Company. The app is called **MBTI-Inspired Personality Test** (`APP_NAME`, `src/mbti/brand.ts`), and the intro, results and share card all carry: "An independent, MBTI-inspired personality exploration. Not affiliated with or endorsed by The Myers-Briggs Company. Not a validated psychological assessment."

## Flow

1. **Intro:** time, privacy, microphone notes, and a choice between "Answer out loud" (disabled when the browser has no speech recognition) and "Type instead".
2. **Stage 1:** 5–7 open questions from a pool of 12 (`scenarios.ts`), shown as text. The next question targets the least certain dimension (`engine.ts`). A predefined follow-up is asked at most once, only if an answer is under 4 words or says nothing about that question's dimension. Questions can be skipped, and "Finish questions" appears after 5 questions or 3 answered ones. 
3. **Transition:** "Stage 2 / Social scenes".
4. **Stage 2:** seven retro video calls, playable in any order (`stage2/scenes.ts`). Each call rings, connects, and then the character speaks their recorded line, with subtitles. The dialogue was adapted to the recordings the site owner chose; each scene's scoring purpose is unchanged. Replay, voice on/off and Leave are always available. The person answers by voice or text. A predefined clarifying line plays at most once (`needsClarification`), followed by a sign-off where one was recorded (Sam only); lines without a recording are shown as text. At least 4 answered scenes unlock the reading.

| Scene | Character | Setting | Line (recorded) | Explores |
|---|---|---|---|---|
| Party tonight | Lena, 24 | kitchen at night | "What are you doing tonight?" | E/I, J/P |
| The interview | Dr. Okoye, 55 | office | "Have you ever had any experience?" | S/N, T/F, J/P |
| The big decision | Jordan, 18 | diner | "What shall I do?" | T/F, S/N |
| A leap | Walter, 68 | living room | "Did you really think it through?" | S/N, J/P |
| A different view | Maya, 34 | park | "Everyone, when they are young, knows what their destiny is." | T/F, S/N |
| Getting everyone together | Sam, 41 | apartment | "Can we plan on doing it on Tuesday?" | J/P, E/I, T/F |
| Checking in | Rosa, 58 | porch | "Are you well?" | E/I, T/F |

In "A different view", Maya shares a view on destiny. The rubric scores only *how* the person responds: reasons vs. feelings, concrete vs. abstract. It never scores whether they agree, and it never scores belief or identity words. A unit test enforces this.

5. **Results:** a type with letter-by-letter reveal (X = no lean). For each dimension: a meter, a plain verdict ("Leaning Feeling · Moderate evidence"), up to three quotes from the person's own words, each labelled with its stage or scene and what it was read as (always including the best quote from each stage that has one), one quote pointing the other way, notes (thin evidence, both ways, stages disagreeing), and "Your call" buttons to adjust a letter. Also shown: close alternatives, how the reading works, a downloadable share card (type and leanings only, no quotes), and "Start over (deletes this session)".

## Scoring architecture (`analysis.ts`, `lexicon.ts`, `scoring.ts`)

- **Sentences:** each response is split into sentences. Every piece of evidence is one quoted sentence plus the label of the pattern it matched.
- **Patterns:** a general lexicon applies everywhere, and each scene adds a rubric that is read in the context of its line. Example: in Lena's scene, "stay in" means a preference for a quiet night. When a rubric cue and a general cue match the same pole in one sentence, the rubric cue wins.
- **Negation:** a cue is ignored if a negator (not, never, don't, wouldn't, …) appears within 20 characters before it in the same clause. "But" resets the clause ("Not at first, but I always make a plan" still counts).
- **Other people:** sentences about someone else ("My friend loves parties") are skipped.
- **Uncertainty:** hedged sentences ("maybe", "it depends", "I guess") count ×0.5. General statements ("usually", "I'm the kind of person") count ×1.5.
- **Stages:** Stage 2 answers count ×0.8, because a reaction to one situation is weaker than a stated habit.
- **Accumulation:** each response contributes at most 3 points to a pole, so one long answer never decides a letter. Lean = (a−b)/(a+b). No preference if |a−b| < 0.25.
- **Confidence:**
  - *Consistent:* margin ≥ 4, ≥ 3 supporting responses, |lean| ≥ 0.5, and the stages agree.
  - *Moderate:* margin ≥ 2, ≥ 2 responses, |lean| ≥ 0.3.
  - *Tentative:* any other lean.
  - *Not enough evidence:* no lean at all.

  These are labels, not percentages.
- **Not scored:** answer length, speaking pace, voice, accent, and which character asked. Average answer length is shown separately and marked as not used.
- **Limits:** keyword and phrase rules, with no semantic understanding. Sarcasm, unusual phrasing and non-English answers are read poorly. That is why every result shows its evidence and can be adjusted.

## Voices and licences

Every recorded character line is a real person's recording: CC0 clips from Mozilla Common Voice 17.0 and CC BY 4.0 clips from LibriTTS-R (credited in the app). Nothing is synthesised: the browser's speech synthesis is no longer used anywhere. The full catalog, sources, selection method, processing and gaps are in `MBTI_VOICES.md`. Playback (`stage2/voice.ts`) works like this:

- The greeting and question play in order once the call connects, after the person has clicked to open the scene. The subtitles show each recording's exact transcript, with the current line highlighted.
- Replay restarts the lines. Voice on/off keeps the subtitles. If the browser blocks autoplay, a "Play voice" button appears. A missing or failed clip is shown as text with a note.
- Pressing Speak stops the character. Replaying while listening stops the microphone, so the character is never transcribed. Leaving a call, changing scenes, or hiding or leaving the page stops the audio.
- "Voices and credits" (intro and results) lists every clip with a play button, its transcript, speaker, original file and licence.

UI sounds (ring, connect, hang up) are tiny Web Audio square-wave blips generated in code. The chrome font is VT323 (`@fontsource/vt323`, SIL OFL 1.1). All pixel art is original and drawn in code (`pixel/`).

## Privacy and microphone

- Everything stays in React state in the tab. Nothing is sent to this site's server, and nothing goes to localStorage or sessionStorage (checked in the browser test). Reset or closing the tab deletes it.
- Speech uses the browser's Web Speech API. Chrome and Edge may process audio with their own online service; the intro says so. The app never records or stores audio.
- A visible recording indicator shows while listening. Each listening session has a generation number, so results arriving after cancel, restart or moving on are dropped and can never leak into the next question. Leaving a question unmounts the answer box, which cancels recognition.
- A denied permission, no speech, or an unsupported browser shows a plain message, and typing always works.

## Files

`src/mbti/`: `Mbti.tsx` (root: menu bar, phase routing), `session.ts` (pure reducer), `engine.ts`, `analysis.ts`, `lexicon.ts`, `scoring.ts`, `scenarios.ts`, `useSpeech.ts`, `resultCard.ts`, `brand.ts`, `stage2/` (scenes, voice, voiceLines), `pixel/` (grid, Sprite, portraits, scenes), `ui/` (Window, Intro, Stage1, Transition, SceneSelect, SceneCall, SceneView, Portrait, ResponseInput, Results), `mbti.css`. Tile: `src/components/bento/visuals/MbtiPreview.jsx`. Entries: `mbti/index.html`, `mpti/index.html` (redirect).

## Tests

- Unit: `analysis.test.ts`, `session.test.ts`, `engine.test.ts`, `stage2/scenes.test.ts`, `stage2/voice.test.tsx` (voice choice, failed-recording fallback, muted, stop/replay), `useSpeech.test.tsx` (late results dropped, mic denial).
- App flow: `Mbti.test.tsx` (both stages typed, subtitles and replay, voices off, mic denial, late transcript cleanup, adjust, reset).
- Browser: `tests/mbti.spec.js` (full run with no storage and no network, scene controls, no speech synthesis, mic denial, transcript cleanup, layouts at 390×844, 844×390 and 1366×900, `/mpti/` redirect), plus the tile in `tests/glass-bento.spec.js`.
