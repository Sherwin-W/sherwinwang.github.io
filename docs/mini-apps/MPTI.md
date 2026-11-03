# MPTI: how it works

Route: `/mpti/` (second Vite entry, `mpti/index.html`, opened in a new tab from the home grid). Code: `src/mpti/`.

## Assessment process (deterministic, on-device)

1. `scenarios.ts`: 12 original everyday scenarios, 3 per dimension (E/I, S/N, T/F, J/P), each with one follow-up.
2. `lexicon.ts`: hand-written cue phrases per pole with weights (2 = fairly direct, 1 = hint).
3. `scoring.ts`: a cue counts only if it appears in a sentence of the person's answer and is not directly preceded by a negation. Each (pole, sentence) counts once. Lean = (a - b) / (a + b) toward the first pole. Confidence: `unclear` (no evidence or tie), `low`, `medium` (margin >= 2, at least 2 supporting sentences, |lean| >= 0.3), `high` (margin >= 4, support from 2+ scenarios, |lean| >= 0.5). Undetermined dimensions show as `X` instead of a guess.
4. `engine.ts`: the first four questions cover each dimension once; after that the next scenario comes from the dimension with the least confidence/evidence. A vague answer (under 4 words, or no cue for its own dimension) gets exactly one follow-up. The session ends at 6 questions, or earlier (after at least 3) when all four dimensions reach medium confidence. Every question can be skipped.
5. Results quote the person's own sentences and name the cue that matched. The person can overrule any dimension. Same answers always give the same result.

There is no LLM and no server call. This keeps the process explainable and testable, and means nothing leaves the browser from this app. A model-backed version (JSON-schema-constrained scoring through the `server/` project) is a possible later step; it would need an API key and a privacy review.

## Voice and privacy

- Voice uses the browser's Web Speech API. The app never records, stores or uploads audio. In Chrome and Edge the browser may send audio to its vendor's speech service; the welcome screen says so. Typing avoids it.
- A transcript lands in an editable text box before it is analyzed.
- Answers live in React state only: no localStorage, no network. "Delete this session" and "Start over" clear them.
- The shareable card is drawn locally on a canvas and contains only the type, leanings and confidence, never quotes.
- Scoring uses words only, never tone, pace or volume.

## Known limits

- Keyword cues are crude: sarcasm, indirect phrasing and non-English answers are mostly missed (speech recognition language follows the browser locale, but the lexicon is English).
- Short answers produce low confidence by design.
- Voice input does not work in Firefox or browsers without the Web Speech API; the typed path is complete on its own.
- Not an official MBTI instrument; no official items are used.
