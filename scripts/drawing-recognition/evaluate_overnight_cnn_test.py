"""Single post-selection held-out test report for the chosen CNN candidate."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import confusion_matrix

from batch24_pipeline import CACHE, LABELS, OTHER, SUPPORTED, UNSUPPORTED, load_cached
from export_overnight_cnn import OUT, SmallCNN

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "docs" / "playable-portfolio" / "recognition-metrics-cnn-candidate.json"


def main() -> None:
    # This is the only new-model test evaluation. No test statistic is used to
    # change weights, preprocessing, or the validation-selected rule.
    with np.load(CACHE / "sampled-splits.npz") as saved:
        x, truth, source = saved["test_x"], saved["test_y"], saved["test_source"]
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    model = SmallCNN()
    model.load_state_dict(torch.load(ROOT / ".cache" / "drawing-recognition" / "overnight" / "small-cnn.pt",
                                    map_location="cpu", weights_only=True))
    model.eval()
    with torch.no_grad():
        logits = torch.cat([model(torch.from_numpy(x[i:i + 512].reshape(-1, 1, 28, 28)))
                            for i in range(0, len(x), 512)])
        probabilities = torch.softmax(logits, dim=1).numpy()
    other = LABELS.index(OTHER)
    supported = truth != other
    winner = np.argmax(probabilities, axis=1)
    rank = np.argsort(-probabilities, axis=1, kind="stable")
    ui_scores = probabilities[:, :len(SUPPORTED)]
    ui_rank = np.argsort(-ui_scores, axis=1, kind="stable")
    rule = manifest["validation"]["autoSpawnRule"]
    accepted = ((winner != other)
                & (probabilities[np.arange(len(truth)), winner] >= rule["scoreThreshold"])
                & ((probabilities[np.arange(len(truth)), winner]
                    - probabilities[np.arange(len(truth)), rank[:, 1]]) >= rule["marginThreshold"])
                & np.isin(winner, [LABELS.index(label) for label in rule["allowedLabels"]]))
    accepted_count = int(accepted.sum())
    correct_count = int(np.sum(accepted & (winner == truth)))
    rejected = (winner == other) | (ui_scores.max(axis=1) < manifest["unsupportedScoreThreshold"])
    unknown_by_source = {}
    for name in UNSUPPORTED:
        mask = source == name
        unknown_by_source[name] = {"samples": int(mask.sum()), "rejectionRate": float(np.mean(rejected[mask]))}
    per_class = []
    for index, label in enumerate(LABELS):
        mask = truth == index
        count = int(mask.sum())
        predicted_accepted = accepted & (winner == index)
        valid_supported = label != OTHER
        per_class.append({
            "label": label, "samples": count,
            "overallOutputTop1": float(np.mean(winner[mask] == index)),
            "overallOutputTop3": float(np.mean(np.any(rank[mask, :3] == index, axis=1))),
            "uiFilteredTop1": float(np.mean(ui_rank[mask, 0] == index)) if valid_supported else None,
            "uiFilteredTop3": float(np.mean(np.any(ui_rank[mask, :3] == index, axis=1))) if valid_supported else None,
            "autoSpawnAcceptedPredictions": int(predicted_accepted.sum()),
            "autoSpawnPrecisionForPredictedLabel": float(np.sum(predicted_accepted & (truth == index)) / predicted_accepted.sum()) if predicted_accepted.any() else None,
        })
    report = {
        "model": "24-label small CNN, 8-16 channels with dense64; trained with PyTorch CPU, candidate weights retained separately from prior MLP.",
        "modelSha256": manifest["sha256"], "modelBytes": manifest["weightBytes"],
        "sourceCategories": {"supported": SUPPORTED, "otherTrainingExamples": UNSUPPORTED},
        "validationSelectedRule": rule,
        "validationSelectedRejectThreshold": manifest["unsupportedScoreThreshold"],
        "heldOutTest": {
            "rows": int(len(truth)), "overallTop1": float(np.mean(winner == truth)),
            "overallTop3": float(np.mean(np.any(rank[:, :3] == truth[:, None], axis=1))),
            "supportedRows": int(supported.sum()),
            "supportedUiFilteredTop1": float(np.mean(ui_rank[supported, 0] == truth[supported])),
            "supportedUiFilteredTop3": float(np.mean(np.any(ui_rank[supported, :3] == truth[supported, None], axis=1))),
            "unknownRows": int((~supported).sum()), "unknownRejection": float(np.mean(rejected[~supported])),
            "unknownRejectionBySource": unknown_by_source,
            "autoSpawn": {"accepted": accepted_count, "correct": correct_count,
                          "precision": correct_count / accepted_count,
                          "supportedCoverage": float(np.sum(accepted & supported) / supported.sum()),
                          "note": "Rule and per-label allowlist were selected on validation; this held-out report was run once and not used for tuning."},
            "perClass": per_class,
            "confusionMatrix": confusion_matrix(truth, winner, labels=np.arange(len(LABELS))).tolist(),
            "confusionMatrixLabelOrder": LABELS,
        },
        "scoreCaveat": "Softmax scores are uncalibrated. Test performance on sampled Quick, Draw! bitmaps is not a guarantee for visitor sketches.",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"modelBytes": report["modelBytes"], "test": report["heldOutTest"],
                      "report": str(REPORT)}, indent=2))


if __name__ == "__main__":
    main()
