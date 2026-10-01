"""Select a conservative auto-spawn rule from validation rows only.

Uses the committed browser weights and cached validation split. It never reads
train or test arrays and never fits or modifies a model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "drawing-recognition" / "sampled-splits.npz"
MODEL = ROOT / "public" / "models" / "drawing-recognizer"
DEFAULT_REPORT = ROOT / "docs" / "playable-portfolio" / "autospawn-validation.json"
PRECISION_TARGET = 0.95


def scores_for(inputs: np.ndarray, weights_path: Path, manifest: dict) -> np.ndarray:
    packed = np.fromfile(weights_path, dtype="<f4")
    offset = 0
    values = np.asarray(inputs, dtype=np.float32)
    sizes = manifest["layerSizes"]
    for index, (input_size, output_size) in enumerate(zip(sizes, sizes[1:])):
        count = input_size * output_size
        matrix = packed[offset : offset + count].reshape(input_size, output_size)
        offset += count
        bias = packed[offset : offset + output_size]
        offset += output_size
        values = values @ matrix + bias
        if index < len(sizes) - 2:
            values = np.maximum(values, 0)
    if offset != len(packed):
        raise ValueError("Unexpected extra values in model weights")
    logits = values.astype(np.float64)
    exponentials = np.exp(logits - np.max(logits, axis=1, keepdims=True))
    return exponentials / np.sum(exponentials, axis=1, keepdims=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    if not CACHE.exists():
        raise SystemExit(
            f"Missing validation cache: {CACHE}. Create/reuse the deterministic "
            "split with `python scripts/drawing-recognition/train.py --data-only`; "
            "this command itself never downloads data, trains, or reads test rows."
        )

    manifest = json.loads((MODEL / "manifest.json").read_text(encoding="utf-8"))
    weights_path = MODEL / manifest["weightFile"]
    weights_hash = hashlib.sha256(weights_path.read_bytes()).hexdigest()
    if weights_hash != manifest["sha256"]:
        raise SystemExit("Committed model weights do not match manifest checksum")

    # Explicitly request validation keys only. Do not open train or test arrays.
    with np.load(CACHE) as saved:
        inputs = saved["validation_x"]
        truth = saved["validation_y"]
        source = saved["validation_source"]

    labels = manifest["labels"]
    supported = manifest["supportedLabels"]
    supported_count = len(supported)
    other_index = labels.index(manifest["otherLabel"])
    probabilities = scores_for(inputs, weights_path, manifest)
    ranking = np.argsort(-probabilities, axis=1, kind="stable")
    winner = ranking[:, 0]
    top_score = probabilities[np.arange(len(truth)), winner]
    margin = top_score - probabilities[np.arange(len(truth)), ranking[:, 1]]
    true_supported = truth < supported_count

    # Grid search jointly considers supported top score and margin over the
    # runner-up across all 13 outputs. Maximize supported coverage subject to
    # validation auto-spawn precision >= 95%; tie-break toward the stricter rule.
    candidates = []
    for score_threshold in np.round(np.arange(0.30, 1.001, 0.01), 2):
        for margin_threshold in np.round(np.arange(0.00, 0.501, 0.01), 2):
            accepted = (
                (winner != other_index)
                & (top_score >= score_threshold)
                & (margin >= margin_threshold)
            )
            count = int(accepted.sum())
            correct = int(np.sum(accepted & (winner == truth)))
            precision = correct / count if count else 1.0
            coverage = float(np.sum(accepted & true_supported) / np.sum(true_supported))
            candidates.append({
                "scoreThreshold": float(score_threshold),
                "marginThreshold": float(margin_threshold),
                "accepted": count,
                "correct": correct,
                "precision": precision,
                "supportedCoverage": coverage,
            })

    eligible = [item for item in candidates if item["accepted"] and item["precision"] >= PRECISION_TARGET]
    if not eligible:
        raise SystemExit("No validation rule met the requested 95% precision target")
    selected = max(
        eligible,
        key=lambda item: (item["supportedCoverage"], item["precision"], item["scoreThreshold"], item["marginThreshold"]),
    )

    # A few fixed, interpretable choices expose the precision/coverage tradeoff.
    tradeoffs = []
    for score_threshold, margin_threshold in ((0.50, 0.10), (0.60, 0.15), (0.70, 0.20), (0.80, 0.25)):
        tradeoffs.append(next(item for item in candidates if
                              item["scoreThreshold"] == score_threshold and
                              item["marginThreshold"] == margin_threshold))

    class_counts = {}
    class_quality = {}
    for index, label in enumerate(supported):
        actual = truth == index
        accepted = actual & (winner != other_index) & (top_score >= selected["scoreThreshold"]) & (margin >= selected["marginThreshold"])
        class_counts[label] = int(np.sum(actual))
        class_quality[label] = {
            "autoSpawnCoverage": float(np.sum(accepted) / np.sum(actual)),
            "autoSpawnCorrectAmongClass": float(np.sum(accepted & (winner == index)) / np.sum(accepted)) if np.any(accepted) else None,
            "accepted": int(np.sum(accepted)),
        }

    report = {
        "method": "Validation-only search using committed weights; no fitting or test-label access.",
        "modelSha256": weights_hash,
        "split": {
            "name": "validation",
            "totalRows": int(len(truth)),
            "supportedRows": int(np.sum(true_supported)),
            "otherRows": int(np.sum(~true_supported)),
            "supportedRowsByClass": class_counts,
            "otherRowsBySource": {name: int(np.sum(source == name)) for name in sorted(set(source.tolist())) if name not in supported},
        },
        "selection": {
            "objective": f"Maximize supported auto-spawn coverage subject to validation precision >= {PRECISION_TARGET:.0%}",
            "rule": "Accept only when the 13-output winner is a supported label, its score meets scoreThreshold, and its lead over the runner-up meets marginThreshold.",
            **selected,
            "precisionDenominator": "all auto-spawned validation rows, including unsupported/Other rows falsely accepted as supported",
            "coverageDenominator": "all validation rows whose true label is one of the 12 supported classes",
            "perSupportedClass": class_quality,
        },
        "tradeoffs": tradeoffs,
        "scoreCaveat": "The model outputs are uncalibrated softmax scores, not probabilities of correctness. Precision and coverage are empirical validation measurements for this sampled Quick, Draw! split and are not guarantees for visitor sketches.",
        "weakRisks": [
            "Other aggregates only airplane, car, house, clock, cloud, star, mountain, and apple; other unsupported visitor drawings may be confidently misclassified.",
            "Validation windows are sampled from the same source categories as training and are not an independent population of people or freehand browser sketches.",
            "Per-class auto-spawn acceptance counts are limited; classes with low accepted counts have noisy precision estimates.",
        ],
        "testUsage": "No test arrays or labels were loaded or used for threshold selection or this report.",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rule": report["selection"], "tradeoffs": tradeoffs, "report": str(args.report)}, indent=2))


if __name__ == "__main__":
    main()
