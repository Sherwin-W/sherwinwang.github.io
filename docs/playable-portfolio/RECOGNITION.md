# Drawing recognition

## Active 24-label browser model

The active browser recognizer is the 24-object batch model at
`public/models/drawing-recognizer-24-candidate/`. It extends the verified
12-class checkpoint with Cow, Duck, Elephant, Frog, Leaf, Potted plant (`house
plant` is the exact training prompt), Apple, Banana, Pizza, Chair, Airplane,
and Bicycle. The Quick, Draw! source provides the exact labels under CC BY 4.0.
The model runs locally in a lazy, dependency-free Web Worker; no visitor drawing
is uploaded.

Training and evaluation are reproducible with `batch24_pipeline.py`,
`batch24_train.py`, `batch24_calibrate_autospawn.py`, `batch24_evaluate.py`,
and `export_batch24_parity.py`. Reproduce the existing data/model run and its
validation/test reporting with:

```powershell
python scripts/drawing-recognition/batch24_train.py
python scripts/drawing-recognition/batch24_calibrate_autospawn.py
python scripts/drawing-recognition/batch24_evaluate.py
python scripts/drawing-recognition/export_batch24_parity.py
```

The deterministic sampler uses non-overlapping train,
validation, and test windows, seed 20260930, 300 rows per window. It sampled
1,200 train, 600 validation, and 600 test examples per supported label; eight
Other categories each contributed 600/900/900 rows. Total split sizes were
33,600 / 21,600 / 21,600. Training ran once on CPU for 4.33 seconds with a
20-iteration maximum; the fit reached that bound without convergence and was
not repeatedly retrained. Range requests fetched 62,308,352 bytes including
headers. The 784 ? 96 ? 25 model weighs 311,140 bytes.

The expanded `Other` labels are car, house, clock, cloud, star, mountain,
violin, and toothbrush. Apple and Airplane were removed from the negative set
before training them as supported classes. The reject threshold is 0.21,
selected on validation for balanced supported-vs-Other behavior.

## Results and limitations

On the untouched test split, overall 25-output top-1/top-3 are 62.93%/81.95%.
Supported-only raw 25-output top-1/top-3 are 58.25%/78.40%. The browser filters
`Other` before ranking suggestions; using that exact supported-only ranking,
top-1/top-3 are 60.96%/80.26%. Unknown rejection is separate at 73.42% across
the eight named negative categories.

Automatic creation requires a supported 25-output winner, score >= 0.94, margin over the runner-up >= 0.70, and membership in a label allowlist selected from validation only. A label must have at least 20 accepted validation predictions and >=90% precision for that predicted label. Dog, Rabbit, Bird, Cow, Duck, Elephant, Frog, and Sun fail this per-label gate and remain in ranked suggestions and the manual picker. The final rule had 96.15% validation precision (2,172/2,259) and 15.57% supported coverage; on held-out test it had 95.72% precision (2,146/2,242) and 15.35% coverage. Model outputs remain uncalibrated scores, not probabilities of correctness. Model quality varies sharply: Dog, Bird, Elephant, Frog, and Duck have low top-1/top-3 performance. Largest held-out confusions include Frog?Other
(130/600), Dog?Cow (114/600), Duck?Bird (102/600), Elephant?Other (97/600),
Bird?Duck (93/600), and Cow?Dog (71/600). Full class values and confusion
matrix are in `recognition-metrics-24-candidate.json`; the validation rule selection is in
`autospawn-validation-24-candidate.json`.

Held-out per-class raw 25-output top-1/top-3 percentages (the Other output participates in this table):

| Label | Top-1 | Top-3 | Label | Top-1 | Top-3 |
| --- | ---: | ---: | --- | ---: | ---: |
| Cat | 42.8 | 66.2 | Cow | 58.3 | 79.0 |
| Dog | 25.8 | 64.7 | Duck | 48.3 | 76.3 |
| Rabbit | 45.2 | 72.7 | Elephant | 30.5 | 58.7 |
| Bird | 33.8 | 72.2 | Frog | 19.5 | 51.2 |
| Fish | 72.0 | 85.8 | Leaf | 56.8 | 75.2 |
| Butterfly | 71.8 | 85.0 | Potted plant | 71.0 | 86.3 |
| Tree | 63.2 | 85.8 | Apple | 87.2 | 93.3 |
| Flower | 59.8 | 80.0 | Banana | 70.0 | 87.5 |
| Mushroom | 76.2 | 89.2 | Pizza | 62.5 | 79.0 |
| Cactus | 54.0 | 73.3 | Chair | 83.0 | 89.5 |
| Sun | 73.3 | 84.7 | Airplane | 58.5 | 76.3 |
| Moon | 54.5 | 81.0 | Bicycle | 79.8 | 88.8 |

All 24 labels are wired in the active manifest, catalog picker, original
vector artwork, and browser ranking. Weak model classes remain available by
picker and suggestions, but their observed evidence is clear in the table and
JSON rather than described as uniformly reliable.

## Browser integration examples

A separate set of twelve authored polylines for the new categories ran through
the browser pointer path, production rasterizer, Worker, and active model at
390?844. UI-filtered top-1/top-3 were 5/12 and 8/12; one object auto-created.
Cow, Elephant, Banana, and Bicycle missed the top three. This small
integration set is synthetic, authored by the implementer, and not a human
benchmark or training/threshold data. Per-drawing rankings and timings are in
`browser-fixture-results-24.json`; geometry is in
`tests/fixtures/batch24-drawings.json`. The actual Worker returns its explicit
blank state for a zero-pixel raster. A pointer tap contains enough ink to be
treated as a sketch, so the single-point example was rejected as unsupported;
a multi-line scribble was uncertain and an unsupported house was rejected.
These controls are recorded separately and do not count toward class accuracy.

The training and validation artifacts record the per-label gate. The active manifest enforces it before auto-creation. Four fixed binary arrays are exported by
`export_batch24_parity.py`; `npm run test` runs each through the actual
JavaScript math against the Python reference scores for all 25 outputs at
absolute tolerance 1e-5. The candidate parity fixture is bound to the weight
SHA-256. The earlier 13-output model remains available and its independent
parity test is retained.

Browser interaction tests cover debounce, long pointer holds, cancellation,
manual selection, suggestions, and Undo transformation. Local timing boundaries
and the measured cold/warm paths are in `VALIDATION.md`. The 24-class model
improves catalog coverage but lowers overall recognition and unknown rejection
compared with the earlier 12-class model. No classes beyond this batch are
integrated; review these weak categories before planning the remaining 36.
