# Drawing recognition milestone

The canvas now has a real, local classifier. The training source is the official [Quick, Draw! dataset](https://github.com/googlecreativelab/quickdraw-dataset), which provides 345 classes and grants the data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). All twelve catalog labels are present. The bitmap `.npy` files are centered 28×28 grayscale images; the trainer samples byte ranges from the official public bucket instead of downloading each 96–122 MB class file in full.

## Chosen implementation

`scripts/drawing-recognition/train.py` trains a scikit-learn one-hidden-layer MLP on a fixed, balanced subset of all twelve supported classes and an aggregated `other` output. Eight out-of-scope classes provide the negative examples: airplane, car, house, clock, cloud, star, mountain, and apple. The final model has 784 input values, 96 ReLU units, and 13 softmax outputs. It exports little-endian float32 arrays consumed by a small, dependency-free JavaScript inference function in a Web Worker. There is no remote inference service and visitor sketches never leave the page; only the static manifest and weights are fetched from the same origin after recognition is first requested.

The public model payload is **306,484 bytes** (`weights.f32`, about 299 KiB), plus a 1,221-byte manifest. It is checksum-verified before inference. The model uses the official black-background, white-ink 28×28 bitmap convention. Browser strokes are independently normalized to that input size. Typing does not construct the worker or request model files.

The reproducible local command is `python scripts/drawing-recognition/train.py`. It requires Python 3.10+, NumPy, and scikit-learn; the current run used Python 3.13.5, NumPy 2.2.6, and scikit-learn 1.8.0 on CPU. Add `--refresh-data` to repeat the deterministic byte-range sampling from Google Cloud Storage. The sampler reads 10 non-overlapping windows per category, distributed across the file: target classes use 6 train / 2 validation / 2 test windows; out-of-scope classes use 4 / 3 / 3. Each window is 300 rows. The seed is 20260930. Raw dataset examples stay in the ignored `.cache/drawing-recognition/` folder and are not committed.

## Alternatives checked

- [QuickDraw 345 TFLite](https://huggingface.co/zarqankhn/quickdraw-345-tflite) is available with an Apache-2.0 model license and all twelve labels. Its model card reports 76.19% top-1 and 89.51% top-3 over 345 classes, but labels the evaluation self-reported and gives no per-class results. It is 8.44 MB float16 or 4.34 MB int8, expects 28×28 grayscale with a white background and black strokes, and would add a TFLite interpreter. Its model card documents Flutter use; browser use would require a separate TFLite runtime integration.
- [AutoClient's ONNX models](https://github.com/nsdevaraj/autoClient) demonstrate browser-side ONNX inference, but the repository has no verified license. Its QuickDraw classifier candidate covers eight portfolio labels (bird, cat, dog, fish, flower, moon, sun, tree) and omits rabbit, butterfly, mushroom, and cactus. We did not reuse its weights or code.
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) is a viable WASM browser runtime, but this task's one-hidden-layer model can run directly in a small worker, so adding a general inference runtime was unnecessary.

## Results and interpretation

The holdout contains 600 examples for each supported class and 900 for each of the eight source categories aggregated as `other` (14,400 total). Row windows are disjoint between train, validation, and test. The held-out top-1 accuracy is **76.31%** and top-3 accuracy is **91.63%**. Per-class scores and the full confusion matrix are in [`recognition-metrics.json`](recognition-metrics.json).

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

The most visible supported-class confusions include cat→dog (77/600), dog→cat (47/600) and dog→bird (47/600), tree→flower (54/600) and tree→mushroom (39/600), and flower→tree (32/600). The eight source categories used as `other` are rejected at these held-out rates: airplane 76.6%, car 90.2%, house 89.7%, clock 92.9%, cloud 88.1%, star 73.7%, mountain 91.7%, and apple 94.0%. A closed set cannot reject every unknown drawing; these rates do not generalize to all unsupported ideas.

A score threshold of **0.28** was selected on the separate validation windows by maximizing balanced accuracy for supported-versus-`other` rejection, allowing thresholds within 0.5 percentage points of the maximum and choosing the more conservative cutoff. On test data this accepts 86.4% of supported drawings and rejects 87.9% of the aggregated out-of-scope set. Softmax scores remain **uncalibrated** and are labeled “model score” in the interface, never probability or confidence.

Playwright independently drew examples through pointer events in Chromium at 390×844. A multi-stroke sun ranked Sun first at 93% model score and the visitor-selected suggestion spawned in place. A hand-drawn house took the unsupported path. A deliberate scribble was also marked possibly unsupported; its closest guesses were rabbit (21%), bird (13%), and cat (9%). An empty drawing shows a separate blank-input state. These few constructed examples are integration checks, not a broad human-drawing benchmark.

The latest cold browser request initialized the worker, fetched both local model files, and returned a result in **22.5 ms** in the local Chromium run; the reported worker inference was **0.9 ms**. A subsequent inference took **0.2 ms**. These are one desktop-run observation, not mobile performance guarantees. The model scores are approximate, the train/test subsets are drawn from the same source population, and stronger per-class validation with a broader independently drawn set remains needed. No suggestion auto-spawns: the visitor chooses a ranked result or opens the existing twelve-object manual picker.
