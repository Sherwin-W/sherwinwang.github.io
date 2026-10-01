# Validation

## Completed interaction and batch-24 model

- Preserved interaction checkpoint: `924aba8` on `feature/playable-portfolio`.
  Batch-24 model/art/catalog integration follows it; Claude's untracked review
  file is not part of these changes.
- `npm run test`: 17 Node tests pass, including parity against Python expected
  scores for all 25 batch-24 outputs over four fixed inputs. Absolute tolerance
  is `1e-5`; the earlier 13-output model parity check also remains.
- `npm run test:browser`: 11 Chromium Playwright tests pass. They cover the
  24-item accessible picker, no click-to-create, drag/trash/delete, portfolio
  access, touch drawing, brush hotspot/glow, reduced motion, multi-stroke
  1,500 ms debounce, a slow held pointer, accepted Sun transformation, Undo and
  Retry, uncertain/unsupported picker flow, scheduled/in-flight cancellation,
  unmount, load failure, and twelve new actual-browser rasterizer/model
  fixtures.
- The 24-label model was trained once: 33,600 train / 21,600 validation /
  21,600 test rows; one CPU fit, 20 iterations, 4.33 seconds. The fit reached
  its iteration cap without convergence and was not retrained. Deterministic range sampling fetched 62,308,352 bytes including NumPy headers. Exact
  prompts were verified against Quick, Draw!'s official category list;
  Quick, Draw! is CC BY 4.0. The `Other` set excludes newly supported Apple and
  Airplane and now uses car, house, clock, cloud, star, mountain, violin, and
  toothbrush. Python/JavaScript inference parity maximum absolute error was
  `3.42e-8` in the worker's initial candidate check; committed-fixture tests
  independently check all 25 scores within `1e-5`.
- Model weights: 311,140 bytes; 784 ? 96 ReLU ? 25 softmax outputs. Browser
  inference is local in a lazy Web Worker; visitor strokes are not uploaded.

## Held-out recognition quality

The 21,600-row test split was not used to select thresholds. Overall 25-output
top-1/top-3 are **62.93% / 81.95%**. The 14,400 supported drawings' raw
25-output top-1/top-3 are **58.25% / 78.40%**. With `Other` removed and supported
labels sorted exactly as the UI does, supported top-1/top-3 are **60.96% /
80.26%**. Unknown rejection is reported separately: **73.42%** across 7,200
examples from eight named negative categories.

Validation first selected score >= **0.94** and runner-up margin >= **0.70** from validation rows. A second validation-only gate enables predicted labels only when there are at least 20 accepted examples and per-label precision is at least 90%. Dog, Rabbit, Bird, Cow, Duck, Elephant, Frog, and Sun fail that gate and remain suggestion/picker-only. The final rule achieved **96.15% validation precision / 15.57% supported coverage** (2,172 correct of 2,259 accepted). Applied unchanged to held-out test it achieved **95.72% precision / 15.35% coverage** (2,146 correct of 2,242 accepted). These are sampled Quick, Draw! measurements, not calibrated confidence or a freehand guarantee. Weak classes include Dog (25.8% top-1; 64.7% top-3), Bird (33.8%; 72.2%), Elephant (30.5%; 58.7%), and Frog (19.5%; 51.2%). Apple, Chair, and Bicycle are stronger (87.2%, 83.0%, and 79.8% top-1). Full per-class, source-specific unknown rejection, and confusion results are in `recognition-metrics-24-candidate.json`; validation gate results are in `autospawn-validation-24-candidate.json`.

## Independent browser preprocessing and timing

Twelve separately authored synthetic strokes for Cow, Duck, Elephant, Frog,
Leaf, Potted plant, Apple, Banana, Pizza, Chair, Airplane, and Bicycle were
run through pointer events, the real browser rasterizer, the Worker, and the
model at Chromium 390?844. The UI-filtered ranking placed the expected class
first in **5/12** and in its three suggestions in **8/12**; one sketch (Chair)
auto-created. Cow, Elephant, Banana, and Bicycle did not appear in
the UI top three. These are small integration fixtures by the implementer,
not held-out model data or human-subject evaluation; they were not used for
training or threshold selection. Exact per-sketch rankings and timings are in
`browser-fixture-results-24.json` and their authored paths in
`tests/fixtures/batch24-drawings.json`. A zero-pixel vector sent through the
actual Worker returned its explicit blank state. A single-point tap had enough
ink mass to reach an unsupported result; a multi-line scribble reached the
uncertain state, and an unsupported house reached the unsupported state. These
control outcomes are recorded separately in the same browser results file.

For the first batch-24 browser fixture, pointer-up to visible suggestions was
**1,887.4 ms** (including the 1,500 ms debounce, local model loading, inference,
and UI). Its worker postMessage-to-result was **24.6 ms** and inference **1.3
ms**; warm worker roundtrip median over the remaining eleven fixtures was
**2.2 ms**, with median inference **0.3 ms**. A manually accepted Sun suggestion appeared at **1,670.5 ms** after pointer-up. A validation-accepted Chair auto-created at **1,876.7 ms** on first local model use; worker request-to-result was **26.1 ms** and inference **1.3 ms**. The model payload was 311,140 bytes. These are local Chromium/Playwright measurements
at a 390?844 viewport, not physical-device or network benchmarks.

Screenshots updated: `screenshots/desktop.png` (1440?900, Select default),
`screenshots/mobile.png` (390?844, picker scrolls above the dock and the dock
remains visible), `screenshots/recognition-auto-mobile.png` (390?844, accepted Chair auto-transformation and Undo), and `screenshots/catalog-24-review.png` (all 24
original illustrations rendered together for a style/recognizability check). Model download is lazy; simple canvas interaction
and picker use do not request weights.

Missing project architecture diagrams and verified project links remain
tracked in `CONTENT_GAPS.md`; no project architecture or URLs were invented.
