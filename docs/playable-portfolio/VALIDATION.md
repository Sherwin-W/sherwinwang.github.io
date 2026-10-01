# Validation

## Completed interaction and batch-24 model

- Preserved interaction checkpoint: `924aba8` on `feature/playable-portfolio`.
  Batch-24 model/art/catalog integration follows it; Claude's untracked review
  file is not part of these changes.
- `npm run test`: 17 Node tests pass, including parity against Python expected
  scores for all 25 batch-24 outputs over four fixed inputs. Absolute tolerance
  is `1e-5`; the earlier 13-output model parity check also remains.
- `npm run test:browser`: 10 Chromium Playwright tests pass. They cover the
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

Validation selected auto-spawn when the overall winner is supported, its score
is at least **0.94**, and its margin is at least **0.70**. Validation results:
**95.39% precision**, **16.68% supported coverage** (2,320 correct of 2,432
accepted). Applying the fixed rule once to held-out test yielded **95.26%
precision**, **16.56% coverage** (2,311 correct of 2,426 accepted). This is
empirical for sampled Quick, Draw! windows, not calibrated confidence or a
freehand guarantee. Weak categories include Dog (25.8% top-1; 64.7% top-3;
0.7% auto coverage and 0% precision among four test auto-acceptances), Bird
(33.8% top-1; 72.2% top-3; 0.7% coverage), Elephant (30.5% top-1; 58.7%
top-3; 1.2% coverage and 14.3% accepted-class precision), and Frog (19.5%
top-1; 51.2% top-3; 1.5% coverage). Duck's auto coverage is 1.8% with 81.8%
precision among accepted Duck examples. Apple, Chair, and Bicycle are stronger
(top-1 87.2%, 83.0%, and 79.8%). The full per-class table, source-specific
unknown rejection, and confusion matrix are in
`recognition-metrics-24-candidate.json`; validation acceptance results are in
`autospawn-validation-24-candidate.json`.

## Independent browser preprocessing and timing

Twelve separately authored synthetic strokes for Cow, Duck, Elephant, Frog,
Leaf, Potted plant, Apple, Banana, Pizza, Chair, Airplane, and Bicycle were
run through pointer events, the real browser rasterizer, the Worker, and the
model at Chromium 390?844. The UI-filtered ranking placed the expected class
first in **5/12** and in its three suggestions in **7/12**; one sketch (Chair)
auto-created. Cow, Elephant, Banana, Airplane, and Bicycle did not appear in
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
**1,864.1 ms** (including the 1,500 ms debounce, local model loading, inference,
and UI). Its worker postMessage-to-result was **17.6 ms** and inference **1.1
ms**; warm worker roundtrip median over the remaining eleven fixtures was
**1.4 ms**, with median inference **0.1 ms**. A separately checked accepted
Sun appeared **1,655.2 ms** after pointer-up; its 311,140-byte model was already
requested through local Vite. These are local Chromium/Playwright measurements
at a 390?844 viewport, not physical-device or network benchmarks.

Screenshots updated: `screenshots/desktop.png` (1440?900, Select default),
`screenshots/mobile.png` (390?844, picker scrolls above the dock and the dock
remains visible), `screenshots/recognition-auto-mobile.png` (390?844, Sun
transformation and Undo), and `screenshots/catalog-24-review.png` (all 24
original illustrations rendered together for a style/recognizability check). Model download is lazy; simple canvas interaction
and picker use do not request weights.

Missing project architecture diagrams and verified project links remain
tracked in `CONTENT_GAPS.md`; no project architecture or URLs were invented.
