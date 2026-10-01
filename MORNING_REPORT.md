# Playable portfolio overnight handoff

## Working features

The portfolio now starts in Select mode with a single draggable, deletable
starter cat and substantial empty canvas. Visitors create through Brush or an
accessible thumbnail picker. Brush strokes use restrained glowing ink; the
clean stroke data goes to a lazy local Web Worker after a 1,500 ms pause.
Validation-gated predictions transform ink into the object with Undo; uncertain
or unsupported sketches stay visible with ranked suggestions and manual
selection. Clearing, editing, changing mode, opening a sheet, and unmounting
invalidate pending recognition. Mobile picker/panel placement, touch drawing,
reduced motion, and a stale transition race are covered by browser tests.

The 24-object catalog and recognizer remain fully wired. Another 36 original
illustrations are included as roadmap-only art and are clearly marked as not
recognized. Several review-noted active illustrations were improved. Minimal
lint fixes were made to legacy components. Exact review triage is in
`docs/playable-portfolio/STATUS.md`.

## Recognition measurements

Six bounded candidate experiments were run; full comparison and denominator
definitions are in `docs/playable-portfolio/MODEL_COMPARISON.md`. The chosen
8/16-channel CNN has 53,113 parameters and 212,452 bytes of weights. It
replaced the 311,140-byte MLP in the active Worker; the MLP remains preserved
for rollback. The CNN reached epoch 12 while validation was still improving,
so it is not described as converged.

On the held-out set, the CNN achieved 73.86%/88.95% overall 25-output top-1/top-3.
On supported rows, removing `Other` and ranking exactly as the UI does gives
71.99%/87.96%. These denominators are 21,600 overall and 14,400 supported
(600 per label). Unknown rejection is separate: `Other` won on 85.17% of 7,200
negative examples from eight sources. The validation-selected 0.75 top-score,
0.66 margin, per-label allowlist rule had held-out auto-spawn precision 95.35%
(5,674/5,951 accepted) and supported coverage 40.88%. Softmax outputs are
uncalibrated scores, not confidence probabilities. Dog, Frog and Duck remain
weak; all 24 per-class results and confusion data are documented.

The independently authored browser integration set measured 7/12 UI top-1,
10/12 top-3, and five accepted automatic objects, four correct and one
incorrect (Bicycle became Butterfly). Correct auto coverage is 4/12. A
synthetic single-point stroke auto-created Banana. This is a small integration
set, not a human-drawing benchmark; human evaluation remains necessary before
claiming the sampled-set results predict visitor experience.

## Checks and commits

- `npm run test`: 20/20 passed; Python/JS model parity maximum absolute error
  was `2.3841858e-7` against tolerance `1e-5`.
- `npm run lint`: passed.
- `npm run build`: passed; main JS 308.08 kB (100.54 kB gzip), CSS 18.36 kB
  (4.60 kB gzip), Worker 4.46 kB. Model weights are a separate lazy asset.
- `npm run test:browser`: 15/15 Chromium tests passed in 1.3 minutes.
- Independent read-only source review found no concrete model-contract,
  cancellation, or mobile placement regression. A focused browser assertion
  confirms the starter cat can be dragged/deleted and is not recreated after
  a same-tab reload.
- The active branch preserves `924aba8` (drawing interaction), `87f0c86`
  (batch 24), `51f33c7` (per-label validation gate), and `dd22ef4` (overnight
  authorization). The overnight implementation and this handoff are recorded
  together in the final local checkpoint on `feature/playable-portfolio`.

## Screenshots and local preview

Screenshots: `docs/playable-portfolio/screenshots/desktop.png`,
`mobile-select.png`, `mobile.png`, `recognition-auto-mobile.png`,
`recognition-uncertain-mobile.png`, `recognition-picker-mobile.png`, and
`catalog-60-art-review.png`. The desktop/mobile screenshots were captured in
local Chromium; mobile uses a 390×844 viewport, not a physical device.

From the repository root, run `npm run dev` and open the local Vite URL it
prints (normally `http://localhost:5173/`). Recognition loads weights only
after drawing pauses; local-server Worker and canvas timings are recorded in
`docs/playable-portfolio/MODEL_COMPARISON.md` and `VALIDATION.md`. Network cold
load, physical mobile, and 30-object stress performance were not measured.

## Remaining gaps and owner decisions

- Human-drawn evaluation is still needed. The small authored integration set
  exposed an accepted wrong object and a single-point false positive. Decide
  whether automatic creation should remain enabled before public release.
- Do not expand the active recognition model beyond 24 until existing-class
  quality and auto-creation reliability are shown to hold. The 36 new objects
  are asset-only roadmap entries.
- Project architecture diagrams, verified project/demo links, and detailed
  technology evidence remain missing; no architecture or URLs were invented.
- The previous LinkedIn candidate is `https://linkedin.com/in/sherwin`, found
  as plain text in the prior About page, but repository evidence does not
  establish that it belongs to Sherwin. Confirm before publishing. The exact
  question remains in `docs/playable-portfolio/CONTENT_GAPS.md`.
- `docs/playable-portfolio/CLAUDE_REVIEW_RESULT.md` and completed Claude
  review files were left untouched and excluded from the implementation
  commit. No push, deployment, or merge to main occurred.
