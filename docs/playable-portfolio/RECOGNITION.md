# Drawing recognition

## Active browser model

The active recognizer is a small 24-label CNN plus `other`, stored at
`public/models/drawing-recognizer-cnn/`. It has 53,113 float32 parameters,
212,452 bytes of weights and SHA-256
`6d8541e7267799d43dea6f092a2506c9b70babd30e42ecd1e75693b828703426`. It runs
locally in a lazy, dependency-free Web Worker; drawings are not uploaded.
Python and JavaScript scores for every output match within absolute tolerance
`1e-5` (measured maximum difference `2.3841858e-7`). Fixed input fixtures and
Python reference scores are in `scripts/drawing-recognition/fixtures/model-parity-cnn.json`.

The exact supported training labels are Cat, Dog, Rabbit, Bird, Fish,
Butterfly, Tree, Flower, Mushroom, Cactus, Sun, Moon, Cow, Duck, Elephant,
Frog, Leaf, House plant (shown as Potted plant), Apple, Banana, Pizza, Chair,
Airplane and Bicycle. `Other` examples are car, house, clock, cloud, star,
mountain, violin and toothbrush. Quick, Draw! exact labels are sourced from
Google Creative Lab under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The expanded negative set excludes Apple and Airplane, now supported labels.
Scripts for reproducible preparation/training and the bounded overnight
experiments are under `scripts/drawing-recognition/`; generated datasets and
experiment scratch output stay local under `.cache/`.

From a fresh checkout with Python, NumPy, scikit-learn and CPU PyTorch
installed, `python scripts/drawing-recognition/prepare_overnight_data.py`
fetches the deterministic split cache into ignored `.cache/`. Then
`python scripts/drawing-recognition/run_overnight_plan.py` runs the six
predeclared validation experiments with individual timeouts. The CNN weights
are exported and validation gate selected by
`python scripts/drawing-recognition/export_overnight_cnn.py`; it writes a
candidate model and parity fixture under `.cache/`, keeping the active public
weights untouched. Only after choosing on validation, run
`python scripts/drawing-recognition/evaluate_overnight_cnn_test.py` once for
held-out evaluation. This final step overwrites the checked-in test report,
so do not run it as a tuning loop. The canonical committed weights were
promoted from that candidate and their hash is recorded above.

The CNN was trained for 12 CPU epochs in 53.055 seconds. Validation accuracy
was still improving at the epoch limit, so it is not described as converged.
No visitor data or paid service is involved. The previous 24-label MLP remains
at `public/models/drawing-recognizer-24-candidate/` and the 12-label model is
preserved separately.

## Model comparison and selection

Six bounded experiments were scheduled and recorded in
`MODEL_COMPARISON.md`: active MLP baseline, converged soft-intensity MLP,
thresholded MLP, sqrt-intensity MLP, small CNN, and an identical-validation
comparison of the old 12- and 24-label models over their shared classes. The
CNN had the strongest validation ranking and rejection measurements among the
tested 24-class candidates; its later single held-out test pass was not used
for tuning. Comparison denominators and each input representation are stated
in that report.

On 21,600 held-out Quick, Draw! examples (600 per supported label and 900 per
each of eight negative categories), the CNN's overall 25-output top-1/top-3
were **73.86% / 88.95%**. On the 14,400 supported rows, filtering `Other` and
ranking the remaining labels exactly as the UI does gives **71.99% / 87.96%**.
Unknown rejection is separate: `Other` won on **85.17% of 7,200** examples
from the eight named negative categories. The test data was not used to select
the thresholds.

| Supported label | UI-ranked top-1 | UI-ranked top-3 |
| --- | ---: | ---: |
| Cat | 58.8% | 80.5% |
| Dog | 35.0% | 77.5% |
| Rabbit | 57.8% | 81.7% |
| Bird | 43.5% | 82.3% |
| Fish | 85.0% | 92.0% |
| Butterfly | 87.2% | 93.0% |
| Tree | 74.0% | 92.8% |
| Flower | 80.2% | 91.0% |
| Mushroom | 87.3% | 95.7% |
| Cactus | 76.3% | 92.7% |
| Sun | 86.3% | 91.8% |
| Moon | 75.5% | 88.8% |
| Cow | 70.8% | 88.2% |
| Duck | 54.5% | 76.8% |
| Elephant | 58.3% | 83.5% |
| Frog | 35.8% | 69.0% |
| Leaf | 71.5% | 85.7% |
| Potted plant | 82.7% | 91.3% |
| Apple | 92.0% | 95.2% |
| Banana | 74.5% | 92.0% |
| Pizza | 84.5% | 93.3% |
| Chair | 88.2% | 93.8% |
| Airplane | 75.0% | 86.5% |
| Bicycle | 93.0% | 95.8% |

Dog, Frog, and Duck remain weak classes; their suggestions may be inaccurate.
Common held-out confusions include Dog→Cow (105/600), Duck→Bird (84/600),
Frog→Other (174/600), Bird→Duck (106/600), and Cow→Dog (55/600). Full
per-source rejection and the complete confusion matrix are in
`recognition-metrics-cnn-candidate.json`.

## Automatic creation and unknown handling

Thresholds were selected on the 21,600-row validation split only: winning
score >=0.75 and margin over runner-up >=0.66, plus a per-predicted-label gate
requiring at least 20 accepted validation examples and >=90% precision. The
enabled labels are Cat, Rabbit, Fish, Butterfly, Tree, Flower, Mushroom,
Cactus, Sun, Duck, Leaf, Potted plant, Apple, Banana, Pizza, Chair, Airplane
and Bicycle. Dog, Bird, Moon, Cow, Elephant and Frog remain suggestions and
picker-only. Validation auto-spawn precision/coverage were **95.04%**
(5,710/6,008) / **41.25%** of supported examples. With that rule unchanged,
the held-out test was **95.35%** precision (5,674/5,951) / **40.88%**
supported coverage. These are sampled-dataset measurements, not calibrated
confidence or a guarantee for visitor drawings.

The separate validation-selected unknown rejection threshold is 0.23. On test,
rejection varied by source: car 80.9%, house 89.3%, clock 91.2%, cloud 84.9%,
star 79.7%, mountain 90.9%, violin 79.0%, toothbrush 85.4%. This threshold is
not the same as auto-spawn acceptance. Blank raster handling is explicit;
uncertain/unsupported sketches retain their ink and offer three suggestions
plus the accessible picker.

## Browser preprocessing integration set

Twelve independently authored polylines, one for each of the twelve expanded
labels, were run through the actual browser rasterizer, selected Worker and
UI supported-label filtering in Chromium at 390×844 using the local Vite
server. Correct UI top-1 was **7/12**, top-3 **10/12**. Five objects
auto-created: **4 correct / 5 accepted (80%)**, with **4/12 correct auto
coverage**. The wrong one transformed the Bicycle fixture into Butterfly,
even though Bicycle was suggestion rank three. The five accepted labels were
Potted plant, Banana, Pizza, Chair and Bicycle; only four transformations
were correct. Cow, Elephant, Apple and Airplane were outside the UI top three.
This tiny implementer-authored integration set is not a human-drawing
benchmark and was not used for training or threshold tuning. Blank raster,
scribble and unsupported house controls are separately recorded in
`cnn-browser-fixture-results.json` and `browser-fixture-results-cnn.json`.

The browser integration discrepancy is material: sampled Quick, Draw!
performance is substantially better than the 12 authored strokes, and one
confident accepted prediction was visibly wrong. Human-drawn evaluation and
possibly revised auto-creation behavior remain needed before treating the
system as dependable outside the sampled domain.
