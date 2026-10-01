"""Evaluate candidate 24 weights on held-out test rows after validation calibration."""

from __future__ import annotations

import hashlib
import json

import numpy as np
from sklearn.metrics import confusion_matrix

from batch24_pipeline import (
    AUTO_REPORT, CACHE, LABELS, METRICS, MODEL, OTHER, SUPPORTED,
    UNSUPPORTED, model_scores,
)


def main() -> None:
    manifest = json.loads((MODEL / "manifest.json").read_text(encoding="utf-8"))
    weights = MODEL / manifest["weightFile"]
    digest = hashlib.sha256(weights.read_bytes()).hexdigest()
    if digest != manifest["sha256"]:
        raise SystemExit("Candidate model checksum mismatch")
    calibration = json.loads(AUTO_REPORT.read_text(encoding="utf-8"))
    auto = calibration["selectedAutoSpawnRule"]
    reject = calibration["selectedUnknownRejectThreshold"]["scoreThreshold"]

    # Only the held-out phase opens test arrays. These results do not alter the
    # validation-selected thresholds or rule.
    with np.load(CACHE / "sampled-splits.npz") as cache:
        x, truth, source = cache["test_x"], cache["test_y"], cache["test_source"]
    scores = model_scores(x, weights, manifest)
    ranking = np.argsort(-scores, axis=1, kind="stable")
    # Mirror the browser UI: exclude Other, rank supported labels, then expose three.
    ui_ranking = np.argsort(-scores[:, :len(SUPPORTED)], axis=1, kind="stable")
    winner = ranking[:, 0]
    top_score = scores[np.arange(len(truth)), winner]
    margin = top_score - scores[np.arange(len(truth)), ranking[:, 1]]
    other_index = LABELS.index(OTHER)
    true_supported = truth != other_index
    allowed_auto_labels = manifest.get("autoSpawnLabels", auto.get("autoSpawnLabels", []))
    allowed_auto_indices = [LABELS.index(label) for label in allowed_auto_labels]
    auto_accepted = ((winner != other_index) & (top_score >= auto["scoreThreshold"])
                     & (margin >= auto["marginThreshold"]) & np.isin(winner, allowed_auto_indices))
    auto_count = int(np.sum(auto_accepted))
    auto_correct = int(np.sum(auto_accepted & (winner == truth)))
    supported_scores = np.max(scores[:, :len(SUPPORTED)], axis=1)
    rejected = (winner == other_index) | (supported_scores < reject)

    per_label = []
    for index, label in enumerate(LABELS):
        actual = truth == index
        auto_for_class = actual & auto_accepted
        accepted_count = int(np.sum(auto_for_class))
        per_label.append({
            "label": label,
            "samples": int(np.sum(actual)),
            "top1Accuracy": float(np.mean(winner[actual] == index)),
            "top3Recall": float(np.mean(np.any(ranking[actual, :3] == index, axis=1))),
            "autoSpawnCoverage": float(np.mean(auto_accepted[actual])) if index != other_index else None,
            "autoSpawnCorrectAmongClassAccepted": float(np.sum(auto_for_class & (winner == index)) / accepted_count) if accepted_count else None,
            "autoSpawnAccepted": accepted_count,
        })
    unknown_by_source = {}
    for name in UNSUPPORTED:
        actual = source == name
        unknown_by_source[name] = {
            "samples": int(np.sum(actual)),
            "rejectionRate": float(np.mean(rejected[actual])),
            "falseSupportedAcceptanceRate": float(np.mean(~rejected[actual])),
        }
    source_meta = json.loads((CACHE / "sampling-metadata.json").read_text(encoding="utf-8"))
    report = {
        "milestone": "active 24-class model integrated with catalog and browser runtime",
        "modelSha256": digest,
        "labelOrder": LABELS,
        "sourceCategories": {"supported": SUPPORTED, "otherTrainingExamples": UNSUPPORTED},
        "officialLabelVerification": {
            "allRequestedLabelsExist": True,
            "exactDatasetLabel": "house plant",
            "verifiedAgainst": "Google Creative Lab Quick, Draw! categories.txt",
            "categoryList": "https://github.com/googlecreativelab/quickdraw-dataset/blob/master/categories.txt",
            "dataset": "https://github.com/googlecreativelab/quickdraw-dataset",
            "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        },
        "sampling": {
            "seed": source_meta["seed"],
            "windowsPerCategory": source_meta["windowCount"],
            "rowsPerWindow": source_meta["rowsPerWindow"],
            "windowsBySource": source_meta["windowsBySource"],
            "bytesFetchedIncludingNpyHeaders": source_meta["bytesFetchedIncludingNpyHeaders"],
            "trainRows": manifest["trainingRows"],
            "validationRows": manifest["validationRows"],
            "testRows": manifest["testRows"],
            "splitPolicy": "Each source category is divided into ten strata; per-class deterministic seeded selection assigns disjoint windows to splits. Supported sources use 4/2/2 train/validation/test windows; Other sources use 2/3/3.",
        },
        "training": {
            "trainingSeconds": manifest["trainingSeconds"],
            "estimatorIterations": manifest["estimatorIterations"],
            "maxIterations": 20,
            "pythonVersion": manifest["pythonVersion"],
            "numpyVersion": manifest["numpyVersion"],
            "scikitLearnVersion": manifest["scikitLearnVersion"],
            "fittingRuns": 1,
        },
        "model": {
            "layerSizes": manifest["layerSizes"],
            "weightBytes": manifest["weightBytes"],
            "file": "public/models/drawing-recognizer-24-candidate/weights.f32",
            "runtimeFormat": manifest["format"],
            "confidence": manifest["confidence"],
        },
        "validationSelectedAutoSpawnRule": auto,
        "validationSelectedUnknownRejectThreshold": calibration["selectedUnknownRejectThreshold"],
        "heldOutTest": {
            "samples": int(len(truth)),
            "top1Accuracy": float(np.mean(winner == truth)),
            "top3Recall": float(np.mean(np.any(ranking[:, :3] == truth[:, None], axis=1))),
            "supportedSamples": int(np.sum(true_supported)),
            "supportedTop1Accuracy": float(np.mean(winner[true_supported] == truth[true_supported])),
            "supportedTop3Recall": float(np.mean(np.any(ranking[true_supported, :3] == truth[true_supported, None], axis=1))),
            "supportedUiFilteredTop1Recall": float(np.mean(ui_ranking[true_supported, 0] == truth[true_supported])),
            "supportedUiFilteredTop3Recall": float(np.mean(np.any(ui_ranking[true_supported, :3] == truth[true_supported, None], axis=1))),
            "supportedUiRanking": "filter Other, rank supported labels by descending score, then expose the first three; matches the browser suggestions",
            "unknownRows": int(np.sum(~true_supported)),
            "unknownRejection": float(np.mean(rejected[~true_supported])),
            "unknownRejectionBySource": unknown_by_source,
            "autoSpawn": {
                "validationSelectedScoreThreshold": auto["scoreThreshold"],
                "validationSelectedMarginThreshold": auto["marginThreshold"],
                "allowedAutoSpawnLabels": allowed_auto_labels,
                "accepted": auto_count,
                "correct": auto_correct,
                "precision": auto_correct / auto_count if auto_count else None,
                "supportedCoverage": float(np.sum(auto_accepted & true_supported) / np.sum(true_supported)),
                "note": "Evaluated once on test using validation-selected thresholds; test results did not tune the rule.",
            },
            "perClass": per_label,
            "confusionMatrix": confusion_matrix(truth, winner, labels=np.arange(len(LABELS))).tolist(),
            "confusionMatrixLabelOrder": LABELS,
        },
        "scoreCaveat": "Softmax scores are uncalibrated scores; validation precision and test precision are sampled-set measurements and not guarantees for freehand visitor sketches.",
    }
    METRICS.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "modelBytes": manifest["weightBytes"],
        "trainingSeconds": manifest["trainingSeconds"],
        "heldOutTest": report["heldOutTest"],
        "report": str(METRICS),
    }, indent=2))


if __name__ == "__main__":
    main()
