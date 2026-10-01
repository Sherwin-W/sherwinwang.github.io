"""Evaluate committed QuickDraw weights without fitting or changing them."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "drawing-recognition" / "sampled-splits.npz"
MODEL = ROOT / "public" / "models" / "drawing-recognizer"
REPORT = ROOT / "docs" / "playable-portfolio" / "recognition-metrics.json"
PARITY = ROOT / "scripts" / "drawing-recognition" / "fixtures" / "model-parity.json"


def model_scores(inputs: np.ndarray, weights_path: Path, manifest: dict) -> np.ndarray:
    packed = np.fromfile(weights_path, dtype="<f4")
    offset = 0
    values = np.asarray(inputs, dtype=np.float32)
    sizes = manifest["layerSizes"]
    for index, (input_size, output_size) in enumerate(zip(sizes, sizes[1:])):
        weight_count = input_size * output_size
        matrix = packed[offset : offset + weight_count].reshape(input_size, output_size)
        offset += weight_count
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


def export_parity_fixtures(manifest: dict) -> None:
    side = 28
    yy, xx = np.mgrid[:side, :side]
    circle = (((xx - 13.5) ** 2 + (yy - 13.5) ** 2 >= 7**2) &
              ((xx - 13.5) ** 2 + (yy - 13.5) ** 2 <= 9**2)).astype(np.float32)
    diagonal = (((xx == yy) | (xx + yy == side - 1))).astype(np.float32)
    rng = np.random.default_rng(61973)
    inputs = [
        ("blank", np.zeros((side, side), dtype=np.float32)),
        ("centered-circle", circle),
        ("crossed-diagonals", diagonal),
        ("seeded-binary-pattern", rng.integers(0, 2, size=(side, side), dtype=np.uint8).astype(np.float32)),
    ]
    expected = model_scores(np.stack([image.reshape(-1) for _, image in inputs]), MODEL / "weights.f32", manifest)
    data = {
        "modelSha256": manifest["sha256"],
        "tolerance": 0.00001,
        "method": "Python NumPy float32 dense layers and float64 softmax over the committed float32 weights",
        "fixtures": [
            {"name": name, "input": image.reshape(-1).astype(int).tolist(), "expectedScores": scores.tolist()}
            for (name, image), scores in zip(inputs, expected)
        ],
    }
    PARITY.parent.mkdir(parents=True, exist_ok=True)
    PARITY.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--export-parity-fixtures", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((MODEL / "manifest.json").read_text(encoding="utf-8"))
    weights_path = MODEL / manifest["weightFile"]
    actual_hash = hashlib.sha256(weights_path.read_bytes()).hexdigest()
    if actual_hash != manifest["sha256"]:
        raise SystemExit("Committed weights do not match the manifest checksum")
    if args.export_parity_fixtures:
        export_parity_fixtures(manifest)
        print(f"Wrote Python reference fixtures for model {actual_hash}")

    if not CACHE.exists():
        if args.export_parity_fixtures:
            return
        raise SystemExit("Missing cached held-out split; run the documented deterministic data sampler first (this script never trains).")
    with np.load(CACHE) as saved:
        inputs = saved["test_x"]
        truth = saved["test_y"]
        source = saved["test_source"]
    scores = model_scores(inputs, weights_path, manifest)
    labels = manifest["labels"]
    supported_count = len(manifest["supportedLabels"])
    other_index = labels.index(manifest["otherLabel"])
    supported_truth = truth < supported_count
    all_ranking = np.argsort(-scores, axis=1, kind="stable")
    supported_ranking = np.argsort(-scores[:, :supported_count], axis=1, kind="stable")
    accepted_as_other = (all_ranking[:, 0] == other_index) | (
        np.max(scores[:, :supported_count], axis=1) < manifest["unsupportedScoreThreshold"]
    )
    overall = {
        "samples": int(len(truth)),
        "top1Accuracy": float(np.mean(all_ranking[:, 0] == truth)),
        "top3Recall": float(np.mean(np.any(all_ranking[:, :3] == truth[:, None], axis=1))),
        "ranking": "all 13 model outputs, including other",
    }
    supported = {
        "samples": int(np.sum(supported_truth)),
        "top1Accuracy": float(np.mean(all_ranking[supported_truth, 0] == truth[supported_truth])),
        "top3Recall": float(np.mean(np.any(all_ranking[supported_truth, :3] == truth[supported_truth, None], axis=1))),
        "ranking": "raw model ranking, all 13 outputs, including other",
    }
    ui = {
        "samples": int(np.sum(supported_truth)),
        "top1Recall": float(np.mean(supported_ranking[supported_truth, 0] == truth[supported_truth])),
        "top3Recall": float(np.mean(np.any(supported_ranking[supported_truth, :3] == truth[supported_truth, None], axis=1))),
        "ranking": "same as UI: filter other, rank 12 supported labels by descending model score, show first three",
    }
    unknown = ~supported_truth
    source_metrics = {}
    for name in np.unique(source[unknown]):
        mask = unknown & (source == name)
        source_metrics[str(name)] = {
            "samples": int(np.sum(mask)),
            "rejectionRate": float(np.mean(accepted_as_other[mask])),
        }
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    report["evaluationFromCommittedWeights"] = {
        "modelSha256": actual_hash,
        "overall": overall,
        "supportedOnly": supported,
        "supportedUiFilteredRanking": ui,
        "unknownRejection": {
            "samples": int(np.sum(unknown)),
            "rejectionRate": float(np.mean(accepted_as_other[unknown])),
            "bySourceCategory": source_metrics,
            "threshold": manifest["unsupportedScoreThreshold"],
            "decision": "top prediction is other OR maximum supported score is below threshold",
        },
        "note": "Computed from the already held-out cached split and committed weights; no model fitting or threshold retuning was performed.",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["evaluationFromCommittedWeights"], indent=2))


if __name__ == "__main__":
    main()
