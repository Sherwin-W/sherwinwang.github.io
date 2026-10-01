"""Train/export a compact Quick, Draw! classifier with an unsupported class.

The downloader uses byte-range requests against Google's official NumPy bitmap
files. It deliberately reads only deterministic windows, never whole classes.
Requirements: Python 3.10+, numpy, scikit-learn. No GPU or paid service.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import struct
import time
import urllib.parse
import urllib.request
import platform
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import sklearn
from sklearn.metrics import confusion_matrix
from sklearn.neural_network import MLPClassifier


ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "drawing-recognition"
OUTPUT = ROOT / "public" / "models" / "drawing-recognizer"
REPORT = ROOT / "docs" / "playable-portfolio" / "recognition-metrics.json"
BUCKET = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap"
SUPPORTED = [
    "cat", "dog", "rabbit", "bird", "fish", "butterfly", "tree", "flower",
    "mushroom", "cactus", "sun", "moon",
]
# These provide representative out-of-scope examples for the reject class.
# This is not an exhaustive model of every possible unsupported drawing.
UNSUPPORTED = ["airplane", "car", "house", "clock", "cloud", "star", "mountain", "apple"]
OTHER = "other"
LABELS = SUPPORTED + [OTHER]
PIXELS = 28 * 28
WINDOW_COUNT = 10
WINDOW_ROWS = 300
SEED = 20260930


def read_array_header(url: str) -> tuple[int, int, str]:
    request = urllib.request.Request(url, headers={"Range": "bytes=0-65535"})
    with urllib.request.urlopen(request, timeout=40) as response:
        prefix = response.read(65536)
        content_range = response.headers.get("Content-Range", "")
    if not content_range.startswith("bytes 0-"):
        raise RuntimeError(f"Server ignored byte-range request for {url}: {content_range}")
    total_bytes = int(content_range.rsplit("/", 1)[1])
    stream = memoryview(prefix)
    if bytes(stream[:6]) != b"\x93NUMPY":
        raise RuntimeError(f"Not a NumPy file: {url}")
    major = stream[6]
    if major == 1:
        header_length = struct.unpack("<H", stream[8:10])[0]
        header_end = 10 + header_length
        header = bytes(stream[10:header_end]).decode("latin1")
        data_offset = header_end
    elif major in (2, 3):
        header_length = struct.unpack("<I", stream[8:12])[0]
        header_end = 12 + header_length
        header = bytes(stream[12:header_end]).decode("latin1")
        data_offset = header_end
    else:
        raise RuntimeError(f"Unsupported NumPy format version {major}")
    if "'descr': '|u1'" not in header and '"descr": "|u1"' not in header:
        raise RuntimeError(f"Expected uint8 bitmaps, got header {header!r}")
    # Quick Draw bitmaps are C-order rows of 784 uint8 pixels.
    count = (total_bytes - data_offset) // PIXELS
    if count < WINDOW_COUNT * WINDOW_ROWS:
        raise RuntimeError(f"Unexpectedly short bitmap file: {count} rows")
    return data_offset, count, header


def deterministic_windows(count: int, class_name: str) -> dict[str, list[tuple[int, int]]]:
    rng = random.Random(f"{SEED}:{class_name}")
    bins = list(range(WINDOW_COUNT))
    rng.shuffle(bins)
    if class_name in SUPPORTED:
        split_bins = {"train": bins[:6], "validation": bins[6:8], "test": bins[8:]}
    else:
        split_bins = {"train": bins[:4], "validation": bins[4:7], "test": bins[7:]}
    windows = {}
    for split, assigned in split_bins.items():
        windows[split] = []
        for index in assigned:
            lower = (count * index) // WINDOW_COUNT
            upper = (count * (index + 1)) // WINDOW_COUNT - WINDOW_ROWS
            start = rng.randint(lower, max(lower, upper))
            windows[split].append((start, start + WINDOW_ROWS))
    return windows


def fetch_window(args: tuple[str, str, int, int, int]) -> tuple[str, str, int, np.ndarray]:
    class_name, split, start, end, data_offset = args
    url = f"{BUCKET}/{urllib.parse.quote(class_name)}.npy"
    first = data_offset + start * PIXELS
    last = data_offset + end * PIXELS - 1
    request = urllib.request.Request(url, headers={"Range": f"bytes={first}-{last}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        content = response.read()
        content_range = response.headers.get("Content-Range", "")
    expected = (end - start) * PIXELS
    if len(content) != expected or not content_range.startswith(f"bytes {first}-{last}/"):
        raise RuntimeError(f"Short/invalid range for {class_name}: {content_range}, {len(content)} bytes")
    images = np.frombuffer(content, dtype=np.uint8).reshape(end - start, PIXELS).copy()
    return class_name, split, start, images


def load_splits():
    CACHE.mkdir(parents=True, exist_ok=True)
    work = []
    per_class_windows = {}
    for class_name in SUPPORTED + UNSUPPORTED:
        url = f"{BUCKET}/{urllib.parse.quote(class_name)}.npy"
        offset, count, header = read_array_header(url)
        per_class_windows[class_name] = deterministic_windows(count, class_name)
        for split, ranges in per_class_windows[class_name].items():
            for start, end in ranges:
                work.append((class_name, split, start, end, offset))
        print(f"{class_name}: {count:,} rows; range-sampling {sum(len(v) for v in per_class_windows[class_name].values())} windows", flush=True)

    result = {split: {"x": [], "y": [], "source": []} for split in ("train", "validation", "test")}
    with ThreadPoolExecutor(max_workers=8) as executor:
        for class_name, split, start, images in executor.map(fetch_window, work):
            bucket = OTHER if class_name in UNSUPPORTED else class_name
            # Official .npy uses black background / white anti-aliased strokes.
            result[split]["x"].append(images.astype(np.float32) / 255.0)
            result[split]["y"].extend([LABELS.index(bucket)] * len(images))
            result[split]["source"].extend([class_name] * len(images))

    arrays = {}
    for split, values in result.items():
        arrays[split] = {
            "x": np.concatenate(values["x"]),
            "y": np.asarray(values["y"], dtype=np.int64),
            "source": np.asarray(values["source"], dtype="U24"),
        }
        permutation = np.random.default_rng(SEED + len(split)).permutation(len(arrays[split]["y"]))
        arrays[split] = {key: value[permutation] for key, value in arrays[split].items()}
    np.savez_compressed(CACHE / "sampled-splits.npz", **{
        f"{split}_{key}": value
        for split, values in arrays.items() for key, value in values.items()
    })
    return arrays


def metric_report(model, arrays: dict[str, dict[str, np.ndarray]], training_seconds: float):
    test = arrays["test"]
    probabilities = model.predict_proba(test["x"])
    predicted = np.argmax(probabilities, axis=1)
    top3 = np.argsort(-probabilities, axis=1)[:, :3]
    matrix = confusion_matrix(test["y"], predicted, labels=np.arange(len(LABELS)))

    validation = arrays["validation"]
    validation_scores = model.predict_proba(validation["x"])
    validation_winner = np.argmax(validation_scores, axis=1)
    validation_supported_score = np.max(validation_scores[:, :len(SUPPORTED)], axis=1)
    validation_supported = validation["y"] != LABELS.index(OTHER)
    threshold_rows = []
    for threshold in np.arange(0.05, 0.951, 0.01):
        accepted = (validation_winner != LABELS.index(OTHER)) & (validation_supported_score >= threshold)
        sensitivity = float(np.mean(accepted[validation_supported]))
        specificity = float(np.mean(~accepted[~validation_supported]))
        threshold_rows.append((0.5 * (sensitivity + specificity), float(threshold), sensitivity, specificity))
    # On near-ties, favor the larger cutoff to reduce false acceptance of unknown sketches.
    best_balanced_accuracy = max(row[0] for row in threshold_rows)
    eligible = [row for row in threshold_rows if row[0] >= best_balanced_accuracy - 0.005]
    _, reject_threshold, target_coverage, other_rejection = max(eligible, key=lambda row: row[1])

    # Select auto-spawn thresholds on validation only: maximize supported
    # coverage while requiring at least 95% precision across every accepted row.
    validation_ranking = np.argsort(-validation_scores, axis=1, kind="stable")
    validation_top = validation_ranking[:, 0]
    validation_y = validation["y"]
    validation_top_score = validation_scores[np.arange(len(validation_y)), validation_top]
    validation_margin = validation_top_score - validation_scores[np.arange(len(validation_y)), validation_ranking[:, 1]]
    auto_candidates = []
    for score_threshold in np.round(np.arange(0.30, 1.001, 0.01), 2):
        for margin_threshold in np.round(np.arange(0.00, 0.501, 0.01), 2):
            accepted = (validation_top != LABELS.index(OTHER)) & (validation_top_score >= score_threshold) & (validation_margin >= margin_threshold)
            count = int(accepted.sum())
            correct = int(np.sum(accepted & (validation_top == validation_y)))
            precision = correct / count if count else 1.0
            coverage = float(np.mean(accepted[validation_supported]))
            if count and precision >= 0.95:
                auto_candidates.append((coverage, precision, float(score_threshold), float(margin_threshold), count, correct))
    if not auto_candidates:
        raise RuntimeError("No validation auto-spawn rule met the 95% precision target")
    auto_coverage, auto_precision, auto_score_threshold, auto_margin_threshold, auto_count, auto_correct = max(auto_candidates)

    test_supported = test["y"] != LABELS.index(OTHER)
    supported_score = np.max(probabilities[:, :len(SUPPORTED)], axis=1)
    accepted_test = (predicted != LABELS.index(OTHER)) & (supported_score >= reject_threshold)
    per_label = []
    for index, label in enumerate(LABELS):
        actual = test["y"] == index
        per_label.append({
            "label": label,
            "samples": int(actual.sum()),
            "top1Accuracy": float(np.mean(predicted[actual] == index)),
            "top3Accuracy": float(np.mean(np.any(top3[actual] == index, axis=1))),
        })

    source_results = []
    for source in UNSUPPORTED:
        actual = test["source"] == source
        if not np.any(actual):
            continue
        accepted_as_other = predicted[actual] == LABELS.index(OTHER)
        supported_predictions = predicted[actual][~accepted_as_other]
        most_confused = LABELS[int(np.bincount(supported_predictions, minlength=len(LABELS)).argmax())] if len(supported_predictions) else None
        source_results.append({
            "sourceCategory": source,
            "samples": int(actual.sum()),
            "rejectedAsOther": float(np.mean(accepted_as_other)),
            "mostCommonFalseSupportedGuess": most_confused,
        })

    return {
        "seed": SEED,
        "pythonVersion": platform.python_version(),
        "numpyVersion": np.__version__,
        "scikitLearnVersion": sklearn.__version__,
        "splitPolicy": {
            "rowWindowsPerSourceCategory": WINDOW_COUNT,
            "rowsPerWindow": WINDOW_ROWS,
            "supportedCategoryWindows": {"train": 6, "validation": 2, "test": 2},
            "unsupportedCategoryWindows": {"train": 4, "validation": 3, "test": 3},
            "randomizedStrata": "one deterministic random window from each of ten equal row-index strata; split strata are shuffled per class and disjoint",
        },
        "trainRows": int(len(arrays["train"]["y"])),
        "validationRows": int(len(arrays["validation"]["y"])),
        "testRows": int(len(test["y"])),
        "trainingSeconds": round(training_seconds, 2),
        "hiddenLayerSizes": [96],
        "labelOrder": LABELS,
        "top1Accuracy": float(np.mean(predicted == test["y"])),
        "top3Accuracy": float(np.mean(np.any(top3 == test["y"][:, None], axis=1))),
        "unsupportedScoreThreshold": round(reject_threshold, 3),
        "heldOutAcceptedSupportedCoverage": float(np.mean(accepted_test[test_supported])),
        "heldOutUnsupportedRejection": float(np.mean(~accepted_test[~test_supported])),
        "validationThresholdTargetCoverage": target_coverage,
        "validationThresholdOtherRejection": other_rejection,
        "autoSpawnRule": {
            "scoreThreshold": auto_score_threshold,
            "marginThreshold": auto_margin_threshold,
            "validationAccepted": auto_count,
            "validationCorrect": auto_correct,
            "validationPrecision": auto_precision,
            "validationSupportedCoverage": auto_coverage,
            "selectedOn": "validation only; maximize supported coverage subject to >=95% precision",
        },
        "perLabel": per_label,
        "unsupportedHeldOut": source_results,
        "confusionMatrix": matrix.tolist(),
        "confidenceCalibration": "Uncalibrated softmax scores; not probabilities of correctness.",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh-data", action="store_true", help="Download deterministic sample windows again")
    parser.add_argument("--data-only", action="store_true", help="Create/reuse the deterministic data cache without fitting a model")
    args = parser.parse_args()
    split_path = CACHE / "sampled-splits.npz"
    if split_path.exists() and not args.refresh_data:
        with np.load(split_path) as saved:
            arrays = {
                split: {key: saved[f"{split}_{key}"] for key in ("x", "y", "source")}
                for split in ("train", "validation", "test")
            }
        print(f"Using cached selected sample windows: {split_path}", flush=True)
    else:
        arrays = load_splits()

    if args.data_only:
        print(json.dumps({"cachedRows": {split: len(values["y"]) for split, values in arrays.items()}, "modelTrained": False}, indent=2))
        return

    started = time.perf_counter()
    model = MLPClassifier(
        hidden_layer_sizes=(96,), activation="relu", solver="adam", alpha=1e-4,
        batch_size=256, learning_rate_init=1e-3, max_iter=24,
        early_stopping=True, validation_fraction=0.1, n_iter_no_change=4,
        random_state=SEED, verbose=True,
    )
    model.fit(arrays["train"]["x"], arrays["train"]["y"])
    training_seconds = time.perf_counter() - started
    report = metric_report(model, arrays, training_seconds)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    flat = []
    for weights, bias in zip(model.coefs_, model.intercepts_):
        flat.extend(weights.astype("<f4", copy=False).reshape(-1, order="C"))
        flat.extend(bias.astype("<f4", copy=False))
    model_bytes = np.asarray(flat, dtype="<f4").tobytes()
    weights_path = OUTPUT / "weights.f32"
    weights_path.write_bytes(model_bytes)
    report["modelBytes"] = len(model_bytes)
    report["modelSha256"] = hashlib.sha256(model_bytes).hexdigest()
    report["inputShape"] = [28, 28]
    report["inputConvention"] = "float32 grayscale, black=0, white ink=1; row-major"
    report["layerSizes"] = [PIXELS, *[int(x) for x in model.hidden_layer_sizes], len(LABELS)]
    report["weightPacking"] = "For each dense layer: row-major input×output float32 weights, then float32 biases; ReLU hidden, softmax output."
    report["sourceCategories"] = {"supported": SUPPORTED, "unsupportedOtherTrainingExamples": UNSUPPORTED}
    (OUTPUT / "manifest.json").write_text(json.dumps({
        "labels": LABELS,
        "supportedLabels": SUPPORTED,
        "otherLabel": OTHER,
        "inputSize": PIXELS,
        "layerSizes": report["layerSizes"],
        "weightFile": "weights.f32",
        "weightBytes": len(model_bytes),
        "sha256": report["modelSha256"],
        "format": "input-major/output-minor float32 layer weights followed by float32 biases; ReLU hidden layer; softmax output",
        "dataset": "Google Quick, Draw! bitmap subset, CC BY 4.0",
        "preprocessing": "Official centered 28x28 numpy_bitmap raster, uint8 divided by 255; black background and white strokes.",
        "confidence": "softmax score; uncalibrated",
        "unsupportedScoreThreshold": report["unsupportedScoreThreshold"],
        "autoSpawnScoreThreshold": report["autoSpawnRule"]["scoreThreshold"],
        "autoSpawnMarginThreshold": report["autoSpawnRule"]["marginThreshold"],
        "autoSpawnRule": "Supported top label must meet validation-selected score and lead-margin thresholds; raw scores are uncalibrated.",
        "thresholdMethod": "Select the score threshold maximizing balanced accuracy on the separate validation windows for supported vs aggregated Other; tie favors higher rejection.",
    }, indent=2) + "\n", encoding="utf-8")
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "rows": {split: len(values["y"]) for split, values in arrays.items()},
        "modelBytes": len(model_bytes),
        "metrics": report,
        "modelFile": str(weights_path),
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
