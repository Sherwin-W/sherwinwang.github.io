# Drawing recognition milestone

The canvas now has a real, local classifier. The training source is the official [Quick, Draw! dataset](https://github.com/googlecreativelab/quickdraw-dataset), which provides 345 classes and grants the data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). All twelve catalog labels are present. The bitmap `.npy` files are centered 28×28 grayscale images; the trainer samples byte ranges from the official public bucket instead of downloading each 96–122 MB class file in full.

## Chosen implementation

`scripts/drawing-recognition/train.py` trains a scikit-learn one-hidden-layer MLP on a fixed, balanced subset of all twelve supported classes and an aggregated `other` output. Eight out-of-scope classes provide the negative examples: airplane, car, house, clock, cloud, star, mountain, and apple. The final model has 784 input values, 96 ReLU units, and 13 softmax outputs. It exports little-endian float32 arrays consumed by a small, dependency-free JavaScript inference function in a Web Worker. There is no remote inference service and visitor sketches never leave the page; only the static manifest and weights are fetched from the same origin after recognition is first requested.

The public model payload is **306,484 bytes** (`weights.f32`, about 299 KiB), plus a manifest. It is checksum-verified before inference. The model uses the official black-background, white-ink 28×28 bitmap convention. Browser strokes are independently normalized to that input size. Recognition remains lazy: Select, Brush, and the object picker do not load the worker. After pointer-up, the canvas waits 1,500 ms before requesting inference.

The reproducible local command is `python scripts/drawing-recognition/train.py`. It requires Python 3.10+, NumPy, and scikit-learn; the current run used Python 3.13.5, NumPy 2.2.6, and scikit-learn 1.8.0 on CPU. Add `--refresh-data` to repeat the deterministic byte-range sampling from Google Cloud Storage. The sampler reads 10 non-overlapping windows per category, distributed across the file: target classes use 6 train / 2 validation / 2 test windows; out-of-scope classes use 4 / 3 / 3. Each window is 300 rows. The seed is 20260930. Raw dataset examples stay in the ignored `.cache/drawing-recognition/` folder and are not committed.

## Alternatives checked

- [QuickDraw 345 TFLite](https://huggingface.co/zarqankhn/quickdraw-345-tflite) is available with an Apache-2.0 model license and all twelve labels. Its model card reports 76.19% top-1 and 89.51% top-3 over 345 classes, but labels the evaluation self-reported and gives no per-class results. It is 8.44 MB float16 or 4.34 MB int8, expects 28×28 grayscale with a white background and black strokes, and would add a TFLite interpreter. Its model card documents Flutter use; browser use would require a separate TFLite runtime integration.
- [AutoClient's ONNX models](https://github.com/nsdevaraj/autoClient) demonstrate browser-side ONNX inference, but the repository has no verified license. Its QuickDraw classifier candidate covers eight portfolio labels (bird, cat, dog, fish, flower, moon, sun, tree) and omits rabbit, butterfly, mushroom, and cactus. We did not reuse its weights or code.
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) is a viable WASM browser runtime, but this task's one-hidden-layer model can run directly in a small worker, so adding a general inference runtime was unnecessary.

## Results and interpretation

The holdout contains 600 examples for each supported class and 900 for each of the eight source categories aggregated as `other` (14,400 total). Row windows are disjoint between train, validation, and test. Reported metrics are calculated from the committed weights without refitting. Overall top-1/top-3 across all 13 labels are **76.31% / 91.63%**. On the 7,200 supported drawings alone, raw 13-label top-1/top-3 are **65.51% / 86.85%**. The UI removes `other` before sorting the 12 supported suggestions; applying that same filter and ranking gives supported top-1/top-3 recall of **71.56% / 89.22%**. Unknown rejection is a separate measurement: **87.86%** over 7,200 examples across the eight named negative categories at threshold 0.28. Exact formulas, per-class scores, category rejection, and the full confusion matrix are in [`recognition-metrics.json`](recognition-metrics.json).

| Supported label | Held-out top-1 | Held-out top-3 |
| --- | ---: | ---: |
| Cat | 55.0% | 82.0% |
| Dog | 49.3% | 85.3% |
| Rabbit | 62.8% | 86.3% |
| Bird | 52.0% | 78.8% |
| Fish | 69.2% | 88.2% |
| Butterfly | 73.8% | 88.7% |
| Tree | 73.7% | 91.8% |
| Flower | 73.5% | 87.5% |
| Mushroom | 76.5% | 93.0% |
| Cactus | 61.7% | 85.8% |
| Sun | 73.2% | 91.5% |
| Moon | 65.5% | 83.2% |

The most visible supported-class confusions include cat→dog (77/600), dog→cat (47/600) and dog→bird (47/600), tree→flower (54/600) and tree→mushroom (39/600), and flower→tree (32/600). Under the app's unsupported-state rule (top label is `other` or maximum supported score is below 0.28), the eight source categories used as `other` are rejected at these held-out rates: airplane 77.4%, car 90.6%, house 90.0%, clock 93.4%, cloud 88.3%, star 76.7%, mountain 92.1%, and apple 94.3%. This rejection decision is separate from supported-label top-1/top-3 accuracy. A closed set cannot reject every unknown drawing; these rates do not generalize to all unsupported ideas.

A separate unsupported threshold of **0.28** was selected on validation for supported-vs-`other` rejection. Automatic creation uses an additional score-and-margin gate selected only on validation: the top of all 13 outputs must be a supported label, score >= **0.91**, and lead over the runner-up >= **0.50**. The selection objective was maximum supported coverage subject to at least 95% precision on all auto-created validation rows. The resulting validation precision is **95.41%**, with **26.88% supported-class coverage**. Precision denominator includes incorrectly accepted `other` examples; coverage denominator is true supported drawings. Weak classes include dog (5.0% coverage; 60.0% precision among accepted dog drawings) and bird (8.67% coverage; 86.54% precision). Full per-class acceptance and tradeoffs are in [`autospawn-validation.json`](autospawn-validation.json). The accepted rule is empirical and validation-specific: softmax scores remain **uncalibrated** and are not probabilities of correctness.

Playwright independently drew examples through pointer events in Chromium at 390×844. A multi-stroke sun ranked Sun first at 93% model score and the visitor-selected suggestion spawned in place. A hand-drawn house took the unsupported path. A deliberate scribble was also marked possibly unsupported; its closest guesses were rabbit (21%), bird (13%), and cat (9%). An empty drawing shows a separate blank-input state. These few constructed examples are integration checks, not a broad human-drawing benchmark.

The fixed, independently authored stroke fixtures in [`hand-authored-drawings.json`](../../tests/fixtures/hand-authored-drawings.json) exercise all twelve categories through the app's actual SVG-coordinate rasterizer, React flow, worker, and committed model. At 390×844, 11 of 12 ranked the expected class first and 11 of 12 included it in the UI-filtered three suggestions. Tree was ranked Sun/Cactus/Cat and was flagged as possibly unsupported. Cat ranked first but was also flagged possibly unsupported. The complete results and per-fixture activation-to-visible timings are in [`browser-fixture-results.json`](browser-fixture-results.json). These are hand-authored synthetic polylines by the feature implementer; they are not independent human subjects and were not used to train or tune the model. They are only a small preprocessing/integration check.

The 1,500 ms pause is tested across multi-stroke drawings and slow pointer holds. A sufficiently strong Sun auto-transforms after the pause; the house stays as ink with three suggestions and the manual picker. Undo transformation removes the spawned object and restores all strokes. New strokes, Clear, Undo stroke, Select/Brush changes, portfolio sheets, and unmount invalidate pending timers/results. Browser checks also cover touch pointer events at 390×844 and reduced motion.

Python/JavaScript parity uses four exported fixed inputs (blank, centered circle, diagonal cross, and a seeded binary pattern) with Python expected values generated from the exact committed weight hash. `npm run test` runs all 13 output scores per fixture through JavaScript and requires absolute error at most **1e-5**. Recreate the score fixture with `python scripts/drawing-recognition/evaluate_model.py --export-parity-fixtures`; no model fitting is involved. For held-out metric recalculation, `python scripts/drawing-recognition/train.py --data-only` prepares/reuses the deterministic split without fitting, then `python scripts/drawing-recognition/evaluate_model.py` scores it with committed weights and no threshold retuning.

The worker's `data-worker-roundtrip-ms` starts immediately before `postMessage`, after browser-stroke rasterization and Worker construction, and ends when the worker result arrives; it is not end-user latency. Auto-spawn metrics include this request path and the UI keeps ink until insertion succeeds. A transformation can be undone; uncertainty leaves the sketch available with three ranked suggestions and the manual picker. The model scores are approximate, the train/test subsets are drawn from the same source population, and human freehand recognition needs broader independent evaluation.
