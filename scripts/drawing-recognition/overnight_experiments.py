"""Bounded validation-only model comparisons for the overnight run.

Each invocation runs exactly one planned experiment. The parent process must
enforce its per-experiment timeout. Test arrays are never opened here.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from batch24_pipeline import CACHE, LABELS, OTHER, SUPPORTED, load_cached, model_scores

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".cache" / "drawing-recognition" / "overnight"
CURRENT = ROOT / "public" / "models" / "drawing-recognizer-24-candidate"


def metrics(probabilities: np.ndarray, truth: np.ndarray) -> dict:
    other = LABELS.index(OTHER)
    supported = truth != other
    ui = probabilities[:, :len(SUPPORTED)]
    ui_rank = np.argsort(-ui, axis=1, kind="stable")
    winner = np.argmax(probabilities, axis=1)
    rank = np.argsort(-probabilities, axis=1, kind="stable")
    scores = probabilities[np.arange(len(truth)), winner]
    margins = scores - probabilities[np.arange(len(truth)), rank[:, 1]]
    # Choose a joint score/margin operating point on validation rows only,
    # maximizing supported coverage while requiring at least 95% precision.
    candidates = []
    for score_cut in np.arange(.3, 1.001, .01):
        for margin_cut in np.arange(0, .701, .01):
            accepted = (winner != other) & (scores >= score_cut) & (margins >= margin_cut)
            n = int(accepted.sum())
            if n == 0:
                continue
            correct = int(np.sum(accepted & (winner == truth)))
            precision = correct / n
            if precision >= .95:
                candidates.append((float(np.sum(accepted & supported) / supported.sum()), precision,
                                   float(score_cut), float(margin_cut), n, correct))
    operating = max(candidates, default=None)
    return {
        "rows": int(len(truth)),
        "overallTop1": float(np.mean(winner == truth)),
        "overallTop3": float(np.mean(np.any(rank[:, :3] == truth[:, None], axis=1))),
        "supportedRows": int(supported.sum()),
        "supportedUiTop1": float(np.mean(ui_rank[supported, 0] == truth[supported])),
        "supportedUiTop3": float(np.mean(np.any(ui_rank[supported, :3] == truth[supported, None], axis=1))),
        "otherRejectionWinner": float(np.mean(winner[~supported] == other)),
        "autoRuleSelectedOnValidation": (None if operating is None else {
            "scoreThreshold": operating[2], "marginThreshold": operating[3],
            "accepted": operating[4], "correct": operating[5],
            "precision": operating[1], "supportedCoverage": operating[0],
        }),
    }


def run_mlp(max_iter: int, preprocess: str) -> dict:
    from sklearn.neural_network import MLPClassifier
    import sklearn

    arrays = load_cached()
    x_train, x_val = arrays["train"]["x"], arrays["validation"]["x"]
    if preprocess == "soft":
        # Current official bitmap normalization.
        transform = lambda x: x
    elif preprocess == "threshold":
        # Explicitly test whether hard binary inputs suit the existing rasterizer.
        transform = lambda x: (x >= .5).astype(np.float32)
    elif preprocess == "contrast":
        # Preserve antialiasing but lift low-coverage pixels to reduce stroke-weight mismatch.
        transform = lambda x: np.sqrt(x, dtype=np.float32)
    else:
        raise ValueError(preprocess)
    start = time.perf_counter()
    model = MLPClassifier(hidden_layer_sizes=(96,), activation="relu", solver="adam",
                          alpha=1e-4, batch_size=256, learning_rate_init=1e-3,
                          max_iter=max_iter, early_stopping=True, validation_fraction=.1,
                          n_iter_no_change=10, tol=1e-4, random_state=20260930, verbose=False)
    model.fit(transform(x_train), arrays["train"]["y"])
    elapsed = time.perf_counter() - start
    probs = model.predict_proba(transform(x_val))
    OUT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT / f"mlp-{preprocess}.npz", coefs=np.array(model.coefs_, dtype=object),
                        intercepts=np.array(model.intercepts_, dtype=object))
    return {"experiment": f"mlp-{preprocess}", "preprocessing": preprocess,
            "inputTransform": "identity" if preprocess == "soft" else "round(sqrt(x)*255)" if preprocess == "contrast" else "x>=0.5",
            "layerSizes": [784, 96, 25], "weightBytesFloat32": int(sum(w.size+b.size for w,b in zip(model.coefs_, model.intercepts_))*4),
            "iterations": int(model.n_iter_), "maxIterations": max_iter,
            "convergedBeforeCap": bool(model.n_iter_ < max_iter), "trainingSeconds": round(elapsed, 3),
            "scikitLearn": sklearn.__version__, "validation": metrics(probs, arrays["validation"]["y"])}


def run_cnn(epochs: int) -> dict:
    import torch
    from torch import nn
    from torch.utils.data import DataLoader, TensorDataset

    torch.manual_seed(20260930)
    torch.set_num_threads(min(4, torch.get_num_threads()))
    arrays = load_cached()
    x_train = torch.from_numpy(arrays["train"]["x"].reshape(-1, 1, 28, 28))
    y_train = torch.from_numpy(arrays["train"]["y"].astype(np.int64))
    x_val = torch.from_numpy(arrays["validation"]["x"].reshape(-1, 1, 28, 28))
    class SmallCNN(nn.Module):
        def __init__(self):
            super().__init__()
            self.features = nn.Sequential(nn.Conv2d(1, 8, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                                          nn.Conv2d(8, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2))
            self.head = nn.Sequential(nn.Flatten(), nn.Linear(16*7*7, 64), nn.ReLU(), nn.Linear(64, len(LABELS)))
        def forward(self, x):
            return self.head(self.features(x))
    model = SmallCNN()
    optimizer = torch.optim.Adam(model.parameters(), lr=.001)
    loader = DataLoader(TensorDataset(x_train, y_train), batch_size=256, shuffle=True)
    started = time.perf_counter()
    loss_fn = nn.CrossEntropyLoss()
    history = []
    for epoch in range(epochs):
        model.train()
        total = 0.0
        for xb, yb in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(xb), yb)
            loss.backward()
            optimizer.step()
            total += loss.item() * len(yb)
        model.eval()
        with torch.no_grad():
            val_logits = torch.cat([model(x_val[i:i+512]) for i in range(0, len(x_val), 512)])
            val_probs = torch.softmax(val_logits, dim=1).cpu().numpy()
        history.append({"epoch": epoch+1, "trainLoss": total / len(x_train),
                        "validation": metrics(val_probs, arrays["validation"]["y"])})
    elapsed = time.perf_counter() - started
    OUT.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), OUT / "small-cnn.pt")
    param_count = sum(p.numel() for p in model.parameters())
    return {"experiment": "small-cnn", "architecture": "1x28x28 -> conv8/pool -> conv16/pool -> dense64 -> 25",
            "epochs": epochs, "parameterCount": param_count, "weightBytesFloat32": param_count*4,
            "pytorch": torch.__version__, "trainingSeconds": round(elapsed, 3),
            "epochHistory": history, "validation": history[-1]["validation"]}


def compare_existing() -> dict:
    """Compare both committed checkpoints on identical validation drawings."""
    arrays = load_cached()
    x, truth, source = arrays["validation"]["x"], arrays["validation"]["y"], arrays["validation"]["source"]
    current_manifest = json.loads((CURRENT / "manifest.json").read_text())
    current_scores = model_scores(x, CURRENT / current_manifest["weightFile"], current_manifest)
    old_dir = ROOT / "public" / "models" / "drawing-recognizer"
    old_manifest = json.loads((old_dir / "manifest.json").read_text())
    old_scores = model_scores(x, old_dir / old_manifest["weightFile"], old_manifest)
    old_supported = old_manifest["supportedLabels"]
    overlap = [name for name in old_supported if name in SUPPORTED]
    common_truth = np.isin(truth, [LABELS.index(name) for name in overlap])

    old_name_index = {name: i for i, name in enumerate(old_manifest["labels"])}
    # `old_scores` indexes old model label order, unlike the current 25-label array.
    old_indices = [old_name_index[name] for name in overlap]
    candidate_indices = [LABELS.index(name) for name in overlap]
    truth_names = np.asarray([LABELS[int(y)] for y in truth])
    old_rank = np.argsort(-old_scores[:, old_indices], axis=1, kind="stable")
    old_truth_local = np.asarray([old_indices.index(old_name_index[n]) if n in old_name_index and old_name_index[n] in old_indices else -1 for n in truth_names])
    current_rank = np.argsort(-current_scores[:, candidate_indices], axis=1, kind="stable")
    truth_local = np.asarray([overlap.index(n) if n in overlap else -1 for n in truth_names])

    negatives = np.isin(source, ["car", "house", "clock", "cloud", "star", "mountain", "violin", "toothbrush"])
    old_other = old_manifest["labels"].index(old_manifest["otherLabel"])
    current_other = LABELS.index(OTHER)
    return {
        "experiment": "committed-12-vs-24-common-label-validation",
        "sameValidationRows": len(truth), "sharedSupportedLabels": overlap,
        "sharedLabelPositiveRows": int(common_truth.sum()),
        "twelveOutputUiRankedWithinSharedLabels": {
            "top1": float(np.mean(old_rank[common_truth, 0] == old_truth_local[common_truth])),
            "top3": float(np.mean(np.any(old_rank[common_truth, :3] == old_truth_local[common_truth, None], axis=1))),
        },
        "twentyFourOutputUiRankedWithinSharedLabels": {
            "top1": float(np.mean(current_rank[common_truth, 0] == truth_local[common_truth])),
            "top3": float(np.mean(np.any(current_rank[common_truth, :3] == truth_local[common_truth, None], axis=1))),
        },
        "eightSharedNegativeSources": {"rows": int(negatives.sum()),
            "twelveOtherWinner": float(np.mean(np.argmax(old_scores[negatives], axis=1) == old_other)),
            "twentyFourOtherWinner": float(np.mean(np.argmax(current_scores[negatives], axis=1) == current_other)),
            "sources": sorted(np.unique(source[negatives]).tolist())},
        "disclaimer": "Identical validation bitmap inputs; shared-label ranking is restricted to common 12 labels. This is not a full 12-versus-24 task comparison because the 24 model has twelve additional active classes.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("experiment", choices=["baseline", "mlp-soft", "mlp-threshold", "mlp-contrast", "cnn", "compare-existing"])
    parser.add_argument("--max-iter", type=int, default=120)
    parser.add_argument("--epochs", type=int, default=10)
    args = parser.parse_args()
    arrays = load_cached()
    if args.experiment == "baseline":
        manifest = json.loads((CURRENT / "manifest.json").read_text())
        probs = model_scores(arrays["validation"]["x"], CURRENT / manifest["weightFile"], manifest)
        report = {"experiment": "active-24-baseline", "modelBytes": manifest["weightBytes"],
                  "validation": metrics(probs, arrays["validation"]["y"])}
    elif args.experiment.startswith("mlp-"):
        report = run_mlp(args.max_iter, args.experiment.removeprefix("mlp-"))
    elif args.experiment == "cnn":
        report = run_cnn(args.epochs)
    else:
        report = compare_existing()
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{args.experiment}.json"
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(path), **report}, indent=2), flush=True)


if __name__ == "__main__":
    main()
