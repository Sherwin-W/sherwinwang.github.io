"""Sample deterministic batch-24 data (if absent) and perform one bounded fit."""

from __future__ import annotations

import hashlib
import json
import platform
import time

import numpy as np
import sklearn
from sklearn.neural_network import MLPClassifier

from batch24_pipeline import (
    CACHE, LABELS, MODEL, OTHER, PIXELS, SEED, SUPPORTED, UNSUPPORTED,
    load_cached, sample_and_cache,
)


def main() -> None:
    if not (CACHE / "sampled-splits.npz").exists():
        arrays = sample_and_cache()
    else:
        print(f"Reusing candidate cache: {CACHE / 'sampled-splits.npz'}", flush=True)
        arrays = load_cached()

    started = time.perf_counter()
    model = MLPClassifier(
        hidden_layer_sizes=(96,), activation="relu", solver="adam", alpha=1e-4,
        batch_size=256, learning_rate_init=1e-3, max_iter=20,
        early_stopping=True, validation_fraction=0.1, n_iter_no_change=3,
        random_state=SEED, verbose=True,
    )
    model.fit(arrays["train"]["x"], arrays["train"]["y"])
    training_seconds = time.perf_counter() - started

    flat = []
    for weights, bias in zip(model.coefs_, model.intercepts_):
        flat.extend(weights.astype("<f4", copy=False).reshape(-1, order="C"))
        flat.extend(bias.astype("<f4", copy=False))
    model_bytes = np.asarray(flat, dtype="<f4").tobytes()
    MODEL.mkdir(parents=True, exist_ok=True)
    weights_path = MODEL / "weights.f32"
    weights_path.write_bytes(model_bytes)
    digest = hashlib.sha256(model_bytes).hexdigest()
    manifest = {
        "labels": LABELS,
        "supportedLabels": SUPPORTED,
        "otherLabel": OTHER,
        "inputSize": PIXELS,
        "layerSizes": [PIXELS, *[int(size) for size in model.hidden_layer_sizes], len(LABELS)],
        "weightFile": weights_path.name,
        "weightBytes": len(model_bytes),
        "sha256": digest,
        "format": "input-major/output-minor float32 dense weights followed by float32 biases; ReLU hidden layer; softmax output",
        "dataset": "Google Quick, Draw! bitmap subset, CC BY 4.0",
        "preprocessing": "Official centered 28x28 numpy_bitmap raster, uint8 divided by 255; black background and white strokes.",
        "confidence": "softmax score; uncalibrated",
        "unsupportedOtherTrainingExamples": UNSUPPORTED,
        "seed": SEED,
        "trainingRows": int(len(arrays["train"]["y"])),
        "validationRows": int(len(arrays["validation"]["y"])),
        "testRows": int(len(arrays["test"]["y"])),
        "trainingSeconds": round(training_seconds, 2),
        "pythonVersion": platform.python_version(),
        "numpyVersion": np.__version__,
        "scikitLearnVersion": sklearn.__version__,
        "estimatorIterations": int(model.n_iter_),
        "estimatorConvergedWithinBound": bool(model.n_iter_ < 20),
        "samplingMetadata": ".cache/drawing-recognition/batch24/sampling-metadata.json",
        "runtimeCompatibleWith": "evaluate_model.py browser runtime: 28x28 float32 input, packed float32 layer weights, ReLU and softmax",
    }
    (MODEL / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "modelSha256": digest,
        "modelBytes": len(model_bytes),
        "rows": {split: len(values["y"]) for split, values in arrays.items()},
        "trainingSeconds": manifest["trainingSeconds"],
        "iterations": model.n_iter_,
        "validationScore": float(model.score(arrays["validation"]["x"], arrays["validation"]["y"])),
        "testScoreNotUsedForSelection": "not computed in training run",
        "model": str(weights_path),
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
