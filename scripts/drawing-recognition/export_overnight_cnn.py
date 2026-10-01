"""Validation-only selection and browser-format export of overnight tiny CNN."""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from batch24_pipeline import CACHE, LABELS, OTHER, SUPPORTED, load_cached

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".cache" / "drawing-recognition" / "overnight" / "cnn-browser-candidate"


class SmallCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(nn.Conv2d(1, 8, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                                      nn.Conv2d(8, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2))
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(16 * 7 * 7, 64), nn.ReLU(), nn.Linear(64, len(LABELS)))

    def forward(self, x):
        return self.head(self.features(x))


def main() -> None:
    arrays = load_cached()
    checkpoint = ROOT / ".cache" / "drawing-recognition" / "overnight" / "small-cnn.pt"
    training_report = json.loads((ROOT / ".cache" / "drawing-recognition" / "overnight" / "cnn.json").read_text())
    model = SmallCNN()
    model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
    model.eval()
    x, truth, source = arrays["validation"]["x"], arrays["validation"]["y"], arrays["validation"]["source"]
    with torch.no_grad():
        logits = torch.cat([model(torch.from_numpy(x[i:i + 512].reshape(-1, 1, 28, 28)))
                            for i in range(0, len(x), 512)])
        probabilities = torch.softmax(logits, dim=1).numpy()
    other = LABELS.index(OTHER)
    supported_truth = truth != other
    predicted = probabilities.argmax(axis=1)
    sorted_indices = np.argsort(-probabilities, axis=1, kind="stable")
    top_score = probabilities[np.arange(len(truth)), predicted]
    margin = top_score - probabilities[np.arange(len(truth)), sorted_indices[:, 1]]

    candidates = []
    for score_cut in np.round(np.arange(.3, 1.001, .01), 2):
        for margin_cut in np.round(np.arange(0, .701, .01), 2):
            raw = (predicted != other) & (top_score >= score_cut) & (margin >= margin_cut)
            accepted_predictions = predicted[raw]
            counts = np.bincount(accepted_predictions, minlength=len(LABELS))
            correct_by_label = np.bincount(accepted_predictions[accepted_predictions == truth[raw]],
                                            minlength=len(LABELS))
            enabled = [label for index, label in enumerate(SUPPORTED)
                       if counts[index] >= 20 and correct_by_label[index] / counts[index] >= .90]
            accepted = raw & np.isin(predicted, [SUPPORTED.index(label) for label in enabled])
            count = int(accepted.sum())
            if not count:
                continue
            correct = int(np.sum(accepted & (predicted == truth)))
            precision = correct / count
            coverage = float(np.sum(accepted & supported_truth) / supported_truth.sum())
            if precision >= .95:
                candidates.append((coverage, precision, float(score_cut), float(margin_cut),
                                   count, correct, enabled))
    if not candidates:
        raise SystemExit("No joint threshold and per-label gate reached 95% validation precision")
    coverage, precision, score_threshold, margin_threshold, accepted_count, correct_count, allowed = max(
        candidates, key=lambda value: (value[0], value[1], value[2], value[3]))
    accepted = ((predicted != other) & (top_score >= score_threshold) & (margin >= margin_threshold)
                & np.isin(predicted, [SUPPORTED.index(label) for label in allowed]))

    supported_scores = probabilities[:, :len(SUPPORTED)].max(axis=1)
    reject_candidates = []
    for threshold in np.round(np.arange(.05, .951, .01), 2):
        accept_supported = (predicted != other) & (supported_scores >= threshold)
        sensitivity = float(np.mean(accept_supported[supported_truth]))
        specificity = float(np.mean(~accept_supported[~supported_truth]))
        reject_candidates.append((.5 * (sensitivity + specificity), float(threshold), sensitivity, specificity))
    best = max(row[0] for row in reject_candidates)
    _, reject_threshold, supported_acceptance, other_rejection = max(
        (row for row in reject_candidates if row[0] >= best - .005), key=lambda row: row[1])

    per_class = {}
    for index, label in enumerate(SUPPORTED):
        actual = truth == index
        ui_scores = probabilities[:, :len(SUPPORTED)]
        ui_rank = np.argsort(-ui_scores[actual], axis=1, kind="stable")
        count = int(actual.sum())
        predicted_accepted = accepted & (predicted == index)
        correct_accepted = predicted_accepted & (truth == index)
        per_class[label] = {
            "samples": count,
            "uiFilteredTop1": float(np.mean(ui_rank[:, 0] == index)),
            "uiFilteredTop3": float(np.mean(np.any(ui_rank[:, :3] == index, axis=1))),
            "autoSpawnCorrectForClass": int(correct_accepted.sum()),
            "autoSpawnCoverage": float(correct_accepted.sum() / count),
            "predictedAccepted": int(predicted_accepted.sum()),
            "precisionAmongPredictedAccepts": (float(correct_accepted.sum() / predicted_accepted.sum())
                                               if predicted_accepted.sum() else None),
            "enabledForAutoSpawn": label in allowed,
        }

    state = model.state_dict()
    packed = bytearray()
    binary_parts = {}
    def add(name: str, tensor: torch.Tensor, shape: list[int]) -> None:
        values = tensor.detach().cpu().numpy().astype("<f4", copy=False).reshape(-1)
        binary_parts[name] = {"offsetFloats": len(packed) // 4, "lengthFloats": len(values), "shape": shape}
        packed.extend(values.tobytes())
    add("conv1Weights", state["features.0.weight"], list(state["features.0.weight"].shape))
    add("conv1Bias", state["features.0.bias"], list(state["features.0.bias"].shape))
    add("conv2Weights", state["features.3.weight"], list(state["features.3.weight"].shape))
    add("conv2Bias", state["features.3.bias"], list(state["features.3.bias"].shape))
    # Browser dense math uses input-major/output-minor weights.
    add("dense1Weights", state["head.1.weight"].T.contiguous(), [784, 64])
    add("dense1Bias", state["head.1.bias"], [64])
    add("dense2Weights", state["head.3.weight"].T.contiguous(), [64, 25])
    add("dense2Bias", state["head.3.bias"], [25])
    OUT.mkdir(parents=True, exist_ok=True)
    weights_path = OUT / "weights.f32"
    weights_path.write_bytes(packed)
    digest = hashlib.sha256(packed).hexdigest()
    manifest = {
        "labels": LABELS, "supportedLabels": SUPPORTED, "otherLabel": OTHER,
        "inputSize": 784, "weightFile": "weights.f32", "weightBytes": len(packed), "sha256": digest,
        "architecture": "28x28 -> conv(1,8,3,same)/ReLU/maxpool2 -> conv(8,16,3,same)/ReLU/maxpool2 -> dense(784,64)/ReLU -> dense(64,25)/softmax",
        "packing": binary_parts, "dataset": "Google Quick, Draw! bitmap subset, CC BY 4.0",
        "autoSpawnScoreThreshold": score_threshold,
        "autoSpawnMarginThreshold": margin_threshold,
        "autoSpawnLabels": allowed,
        "unsupportedScoreThreshold": reject_threshold,
        "thresholdMethod": "Joint score/margin rule and predicted-label allowlist selected using validation only; >=95% aggregate precision, with >=90% precision and >=20 predicted accepts per enabled label.",
        "preprocessing": "Official centered 28x28 bitmap normalized to [0,1]; no augmentation or visitor upload.",
        "training": {"trainingRows": int(len(arrays['train']['y'])), "validationRows": int(len(truth)),
                     "epochs": 12, "trainingSeconds": training_report["trainingSeconds"], "pytorch": torch.__version__,
                     "seed": 20260930, "cpuThreads": 4},
        "validation": {"overallTop1": float(np.mean(predicted == truth)),
                       "overallTop3": float(np.mean(np.any(sorted_indices[:, :3] == truth[:, None], axis=1))),
                       "supportedRows": int(supported_truth.sum()), "uiFilteredTop1": float(np.mean(
                           np.argmax(probabilities[:, :len(SUPPORTED)], axis=1)[supported_truth] == truth[supported_truth])),
                       "uiFilteredTop3": float(np.mean(np.any(np.argsort(-probabilities[:, :len(SUPPORTED)], axis=1,
                           kind='stable')[supported_truth, :3] == truth[supported_truth, None], axis=1))),
                       "unknownRows": int((~supported_truth).sum()), "otherWinnerRejection": float(np.mean(predicted[~supported_truth] == other)),
                       "unknownRejectThreshold": reject_threshold, "validationSupportedAcceptance": supported_acceptance,
                       "validationOtherRejection": other_rejection,
                       "autoSpawnRule": {"scoreThreshold": score_threshold, "marginThreshold": margin_threshold,
                                         "allowedLabels": allowed, "accepted": accepted_count,
                                         "correct": correct_count, "precision": precision, "supportedCoverage": coverage},
                       "perClass": per_class,
                       "confidenceCaveat": "Softmax scores are uncalibrated. Validation precision/coverage are sampled-set measurements, not guarantees for visitor strokes."},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    fixture_indices = []
    for label in ("cat", "tree", "sun", "dog", "other"):
        ix = next(i for i, name in enumerate(arrays["validation"]["source"]) if
                  name == label if label != "other") if label != "other" else next(
                      i for i, name in enumerate(arrays["validation"]["source"]) if name in
                      ("car", "house", "clock", "cloud", "star", "mountain", "violin", "toothbrush"))
        fixture_indices.append(ix)
    blank_input = np.zeros((1, 1, 28, 28), dtype=np.float32)
    with torch.no_grad():
        blank_scores = torch.softmax(model(torch.from_numpy(blank_input)), dim=1).numpy()[0]
    fixture_inputs = [x[i].tolist() for i in fixture_indices] + [blank_input.reshape(-1).tolist()]
    fixture_scores = probabilities[fixture_indices].tolist() + [blank_scores.tolist()]
    fixtures = {"modelSha256": digest, "tolerance": 1e-5, "inputs": fixture_inputs,
                "expectedScores": fixture_scores, "fixtureLabels": ["cat", "tree", "sun", "dog", "other", "blank"]}
    (OUT / "parity-fixtures.json").write_text(json.dumps(fixtures) + "\n", encoding="utf-8")
    print(json.dumps({"modelBytes": len(packed), "sha256": digest, "validation": manifest["validation"],
                      "manifest": str(OUT / 'manifest.json'), "fixtures": str(OUT / 'parity-fixtures.json')}, indent=2))


if __name__ == "__main__":
    main()
