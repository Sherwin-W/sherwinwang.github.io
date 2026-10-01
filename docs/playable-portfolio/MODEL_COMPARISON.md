# Recognition model comparison

Six bounded validation experiments were completed from the same deterministic
train/validation partition (33,600 train rows; 21,600 validation rows; 24
supported labels plus eight `Other` drawing sources). Each support label has
600 validation examples and each negative source has 900. No visitor sketches
were uploaded. The held-out test set was not consulted for model selection;
the selected CNN received one final test evaluation afterward.

| Candidate | Input / training | Overall top-1 / top-3 | UI-filtered supported top-1 / top-3 | Other rejection | Validation auto precision / supported coverage |
| --- | --- | ---: | ---: | ---: | ---: |
| Existing 24 MLP | soft intensity; 20 iterations, 4.33s, hit cap without convergence | 63.23% / 81.77% | 60.92% / 80.06% | 73.00% | 95.39% / 16.68% |
| Converged 24 MLP | soft intensity; 39/120 iterations, 13.816s | 62.89% / 81.49% | 61.28% / 80.06% | 70.40% | 95.34% / 17.53% |
| Thresholded 24 MLP | binary `x >= .5`; 28/120, 8.979s | 61.29% / 80.74% | 58.61% / 78.37% | 73.24% | 95.19% / 12.17% |
| Contrast 24 MLP | `round(sqrt(x)*255)`; 43/120, 13.817s | 63.85% / 81.88% | 61.20% / 80.38% | 73.58% | 95.34% / 18.39% |
| Small CNN | 8/16-channel conv + dense64; 12 CPU epochs, 53.055s | 73.68% / 88.93% | 71.47% / 87.56% | 84.17% | 95.00% / 42.52% |

The six experiments include a sixth shared-label comparison, rather than
another retraining run: old 12- and 24-label models ranked the same 7,200
positive validation inputs only within their common twelve labels. The 12-way
model achieved 72.24%/89.71% top-1/top-3 versus 68.38%/88.19% for the
24-model restricted to those common labels. On the same 7,200 negative rows,
their `Other` winner rates were 73.53% and 73.00%. This restricted comparison
does not represent each model's full task because the 24 model has twelve
additional supported classes. Values and inputs are retained under local
`.cache/drawing-recognition/overnight/`.

The CNN was selected because it clearly improved 24-class validation ranking,
negative rejection, and accepted coverage at roughly the same validation
auto-spawn precision. Its network is small enough for the existing custom
browser runtime and its Python/JavaScript output parity was measured. It is
not converged by claim: validation was still improving at epoch twelve. Its
later held-out test report is `recognition-metrics-cnn-candidate.json`; test
metrics were not used for tuning. The earlier MLP weights remain preserved for
rollback.

## Training and evaluation protocol

Quick, Draw! 28×28 bitmaps were sampled by reproducible row windows with seed
20260930, keeping train, validation and test rows disjoint. Supported classes
contribute 1,200/600/600 rows each and eight `Other` sources contribute
600/900/900 each. The total split sizes are 33,600/21,600/21,600. Quick,
Draw! is distributed under CC BY 4.0. Python environment: Python 3.13.5,
NumPy 2.2.6, scikit-learn 1.8.0 and PyTorch 2.12.0+cpu. Per-run timeouts
were 120 seconds for baseline and comparison, and 900 seconds for each of
the four bounded training candidates; observed wall times are in
`.cache/drawing-recognition/overnight/plan-results.json` (local scratch
output). Fresh reproduction commands and the one-time held-out evaluation
boundary are in `RECOGNITION.md`.

All overall metrics rank all 25 outputs. The UI-filtered supported metrics
remove `Other` then rank only supported outputs, matching the browser's
suggestion behavior. Unknown rejection uses the separate `Other` winner rate.
Auto-spawn precision is correct accepted predictions divided by all accepted
predictions; coverage uses all supported examples as denominator. Score
thresholds and predicted-label eligibility are chosen on validation only.
Model scores are uncalibrated and should not be interpreted as correctness
probabilities.

## Browser measurements

The selected 212,452-byte model was loaded locally by Chromium/Playwright on a
390×844 viewport. A direct Worker measurement observed 0.3 ms construction,
26.4 ms from activation through the first result, 1.5 ms median warm
roundtrip, and 1.4 ms median warm inference. A separate real canvas flow
observed pointer-up to visible result/object of 1,659 ms (Sun) and 1,870 ms
(Chair); this includes the 1,500 ms debounce, real rasterization, Worker work,
and UI transition. In the latest serial Canvas run, Worker request-to-result
was 32.1 ms (Sun) and 22.8 ms (Chair); CNN inference was 7.1 ms and 4.4 ms.
These are local-server Chromium measurements, not network cold-start or
physical mobile measurements. Network timings and real-device frame behavior
were not measured.
Network timings and real-device frame behavior were not measured.
