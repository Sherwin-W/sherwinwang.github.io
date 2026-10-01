"""Select reject and auto-spawn thresholds from candidate validation rows only."""

from __future__ import annotations

import hashlib
import json

import numpy as np

from batch24_pipeline import AUTO_REPORT, CACHE, LABELS, MODEL, OTHER, SUPPORTED, model_scores

PRECISION_TARGET = 0.95


def main() -> None:
    manifest = json.loads((MODEL / "manifest.json").read_text(encoding="utf-8"))
    weights = MODEL / manifest["weightFile"]
    digest = hashlib.sha256(weights.read_bytes()).hexdigest()
    if digest != manifest["sha256"]:
        raise SystemExit("Candidate weights do not match the manifest checksum")
    # Access validation arrays only. The test arrays are never opened here.
    with np.load(CACHE / "sampled-splits.npz") as cache:
        x, truth, source = cache["validation_x"], cache["validation_y"], cache["validation_source"]
    probabilities = model_scores(x, weights, manifest)
    ranking = np.argsort(-probabilities, axis=1, kind="stable")
    winner = ranking[:, 0]
    top = probabilities[np.arange(len(truth)), winner]
    margin = top - probabilities[np.arange(len(truth)), ranking[:, 1]]
    other_index = LABELS.index(OTHER)
    supported_truth = truth != other_index

    auto_candidates = []
    for score_cut in np.round(np.arange(0.30, 1.001, 0.01), 2):
        for margin_cut in np.round(np.arange(0.00, 0.701, 0.01), 2):
            accepted = (winner != other_index) & (top >= score_cut) & (margin >= margin_cut)
            count = int(accepted.sum())
            correct = int(np.sum(accepted & (winner == truth)))
            precision = correct / count if count else 1.0
            coverage = float(np.sum(accepted & supported_truth) / np.sum(supported_truth))
            if count and precision >= PRECISION_TARGET:
                auto_candidates.append({
                    "scoreThreshold": float(score_cut),
                    "marginThreshold": float(margin_cut),
                    "accepted": count,
                    "correct": correct,
                    "precision": precision,
                    "supportedCoverage": coverage,
                })
    if not auto_candidates:
        raise SystemExit("No rule reached the 95% validation precision target; no auto-spawn rule selected")
    selected = max(auto_candidates, key=lambda v: (v["supportedCoverage"], v["precision"], v["scoreThreshold"], v["marginThreshold"]))

    supported_score = np.max(probabilities[:, :len(SUPPORTED)], axis=1)
    reject_candidates = []
    for threshold in np.round(np.arange(0.05, 0.951, 0.01), 2):
        accepted = (winner != other_index) & (supported_score >= threshold)
        sensitivity = float(np.mean(accepted[supported_truth]))
        specificity = float(np.mean(~accepted[~supported_truth]))
        reject_candidates.append((0.5 * (sensitivity + specificity), float(threshold), sensitivity, specificity))
    best = max(item[0] for item in reject_candidates)
    # Conservative tie handling as in the current model report.
    balanced_ties = [item for item in reject_candidates if item[0] >= best - 0.005]
    _, reject_threshold, supported_acceptance, other_rejection = max(balanced_ties, key=lambda item: item[1])

    accepted_before_class_gate = (winner != other_index) & (top >= selected["scoreThreshold"]) & (margin >= selected["marginThreshold"])
    auto_spawn_labels = []
    predicted_class_results = {}
    for index, label in enumerate(SUPPORTED):
        predicted = accepted_before_class_gate & (winner == index)
        count = int(np.sum(predicted))
        correct = int(np.sum(predicted & (truth == index)))
        precision = correct / count if count else None
        predicted_class_results[label] = {
            "acceptedPredictions": count,
            "correctPredictions": correct,
            "precisionAmongPredictions": precision,
            "autoSpawnEnabled": bool(count >= 20 and precision is not None and precision >= 0.90),
        }
        if count >= 20 and precision is not None and precision >= 0.90:
            auto_spawn_labels.append(label)

    auto_label_indices = [SUPPORTED.index(label) for label in auto_spawn_labels]
    accepted = accepted_before_class_gate & np.isin(winner, auto_label_indices)
    accepted_count = int(np.sum(accepted))
    correct_count = int(np.sum(accepted & (winner == truth)))
    final_precision = correct_count / accepted_count if accepted_count else None
    final_coverage = float(np.sum(accepted & supported_truth) / np.sum(supported_truth))

    class_results = {}
    for index, label in enumerate(SUPPORTED):
        actual = truth == index
        class_accepted = actual & accepted
        n = int(np.sum(class_accepted))
        class_results[label] = {
            "samples": int(np.sum(actual)),
            "accepted": n,
            "coverage": float(n / np.sum(actual)),
            "precisionAmongAcceptedForClass": float(np.sum(class_accepted & (winner == index)) / n) if n else None,
        }
    report = {
        "method": "Thresholds selected on validation rows only using candidate committed weights; no test rows or labels loaded.",
        "modelSha256": digest,
        "validationRows": int(len(truth)),
        "validationSupportedRows": int(np.sum(supported_truth)),
        "validationOtherRows": int(np.sum(~supported_truth)),
        "selectedAutoSpawnRule": {
            "criterion": f"select score/margin at precision >= {PRECISION_TARGET:.0%}, then require each auto-created label to have >=90% validation precision over >=20 accepted predictions",
            "decision": "25-output winner is supported, top score >= scoreThreshold, margin over runner-up >= marginThreshold, and winner is in autoSpawnLabels",
            **selected,
            "acceptedBeforePerLabelGate": selected["accepted"],
            "correctBeforePerLabelGate": selected["correct"],
            "autoSpawnLabels": auto_spawn_labels,
            "perPredictedLabelValidation": predicted_class_results,
            "accepted": accepted_count,
            "correct": correct_count,
            "precision": final_precision,
            "supportedCoverage": final_coverage,
            "perClass": class_results,
        },
        "selectedUnknownRejectThreshold": {
            "scoreThreshold": reject_threshold,
            "validationSupportedAcceptance": supported_acceptance,
            "validationOtherRejection": other_rejection,
            "decision": "winner is other OR maximum supported-label score is below threshold",
            "selection": "balanced accuracy on validation supported-versus-Other, within 0.5 points of maximum; highest threshold wins ties",
        },
        "uncalibratedScoreCaveat": "Softmax outputs are uncalibrated model scores, not probabilities of correctness. Validation precision and coverage describe this sampled Quick, Draw! split and may not transfer to visitor sketches.",
        "validationOtherSourceCounts": {str(name): int(np.sum(source == name)) for name in np.unique(source) if name not in SUPPORTED},
    }
    manifest["unsupportedScoreThreshold"] = float(reject_threshold)
    manifest["autoSpawnScoreThreshold"] = selected["scoreThreshold"]
    manifest["autoSpawnMarginThreshold"] = selected["marginThreshold"]
    manifest["autoSpawnLabels"] = auto_spawn_labels
    manifest["thresholdMethod"] = (
        "Validation-only: rejection threshold uses balanced supported-vs-Other accuracy; "
        "auto-spawn rule maximizes supported coverage subject to at least 95% precision. "
        "Scores remain uncalibrated."
    )
    (MODEL / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    AUTO_REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
