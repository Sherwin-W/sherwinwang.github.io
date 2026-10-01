# Validation

## Checks run

- `npm run test`: **20 passed**. Covers catalog contracts, Select/Brush state,
  manual placement dispersion, pointer and movement helpers, and fixed actual
  CNN Python/JavaScript parity for all outputs (absolute tolerance `1e-5`,
  measured maximum absolute error `2.3841858e-7`).
- `npm run lint`: passed with no findings after minimal cleanup of the
  repository's existing React-component lint errors.
- `npm run test:browser`: **15 passed** on the final full run (1.3 minutes).
  The first run had 14 passed and one stale assertion that required Sun in a
  suggestion panel; the validation gate now correctly auto-creates Sun. The
  assertion was updated to verify the transformation, then the entire suite
  passed.
- Browser tests verified the accessible 24-object picker, Select-first/no
  click-to-create, dragging/deletion/portfolio access, mobile touch input,
  picker layout above the dock, glow/cursor/reduced motion, 1,500 ms
  multi-stroke quiet period, uninterrupted pointer hold, accepted Sun and
  Chair transformations, Undo, stale-result cancellation, unmount, model-load
  failure, uncertain/unsupported flow, transformed-ink/new-stroke race, and
  all twelve selected-model preprocessing fixtures.
- The full browser run exposed and then clarified a stale assertion only; no
  application behavior failure reproduced. First pass ended 14/15, the
  focused cancellation rerun passed 1/1, and the corrected full suite passed
  15/15.
- `npm run build`: passed. Vite emitted a 308.08 kB JS chunk (100.54 kB gzip),
  an 18.36 kB CSS chunk (4.60 kB gzip), and the 4.46 kB worker. The model
  remains a separate lazy asset.
- Independent source/visual review found no concrete regression in model
  contract, cancellation, or mobile panel placement; it confirmed the 4/5
  browser-fixture accepted prediction count matches the recorded results.

## Recognition evidence

Six bounded candidate experiments and their validation-only selection are
reported in `MODEL_COMPARISON.md`. The active 24-label CNN held-out report is
`recognition-metrics-cnn-candidate.json`; its test split ran once after model
selection. The held-out denominator is 21,600 total rows: 14,400 supported
(600 per label) and 7,200 negative (900 each from eight named categories).
Overall 25-output top-1/top-3: **73.86% / 88.95%**. Supported-only ranking
after removing `Other`, matching the exact UI: **71.99% / 87.96%**. Unknown
rejection is separately **85.17% of 7,200** negative rows. The
validation-selected auto rule, unchanged on test, yielded **95.35% precision**
(5,674/5,951 accepted) and **40.88% supported coverage**. The score/margin
rule is not a calibrated confidence estimate.

Twelve independently authored browser polylines ran through Chromium's real
pointer path, production rasterizer, lazy Worker and UI supported-label
ranking at 390×844. UI top-1/top-3 were **7/12 and 10/12**. Five suggestions
auto-created objects: four correct, one wrong (the Bicycle stroke became
Butterfly even though Bicycle ranked third). Correct automatic coverage was
4/12. This hand-authored integration set is not a human-drawing benchmark and
was not used to train or tune thresholds. A blank raster returned explicit
blank; scribble stayed uncertain; unsupported house was rejected. A single
point had enough nonblank mass to be treated as a sketch and was wrongly
auto-created as Banana, so tiny taps remain a documented failure case rather
than a successful blank test.

## Browser timings and conditions

Local Vite server, Chromium Playwright, emulated 390×844 viewport. No physical
device or network cold-load measurement was made.

- Model file: **212,452 bytes**.
- Direct Worker run: construction **0.3 ms**; activation through first result
  **26.4 ms**; warm median request/response **1.5 ms**; warm median model
  inference **1.4 ms**. The full UI path adds rasterization and rendering.
- Real canvas Sun/Chair checks measured pointer-up through visible outcome at
  **1,659 ms** (Sun) and **1,870 ms** (Chair), including the required 1,500 ms
  quiet period. Their Worker request-to-result times were **32.1 ms** and
  **22.8 ms**; CNN inference was **7.1 ms** and **4.4 ms**. This boundary
  differs from direct Worker warm measurements and is recorded separately.
- Direct browser-rasterizer fixture run: Worker construction **0.3 ms**,
  activation through first result **26.4 ms**, warm roundtrip median **1.5 ms**,
  warm inference median **1.4 ms**.

## Screenshots and remaining gaps

Updated screenshots: `screenshots/desktop.png` (1440×900, Select default),
`screenshots/mobile-select.png` (390×844, first-load Select with one starter
cat and generous empty canvas), `screenshots/mobile.png` (390×844, picker and
controls),
`screenshots/recognition-auto-mobile.png` (Chair transformation and Undo),
`screenshots/recognition-uncertain-mobile.png`,
`screenshots/recognition-picker-mobile.png`, and
`screenshots/catalog-60-art-review.png` (24 active and 36 roadmap-only
illustrations). Screenshots document local Chromium rendering, not device
coverage.

Human-drawn evaluation, network load, physical mobile, and performance under
30 simultaneous objects are unmeasured. Dog/Frog/Duck remain weak. The
authored integration set reveals an accepted wrong object; assess whether
default auto-creation should stay enabled before public release. Missing
project diagrams and verified project links remain listed in
`CONTENT_GAPS.md`; no unverified architecture or URLs were added.
