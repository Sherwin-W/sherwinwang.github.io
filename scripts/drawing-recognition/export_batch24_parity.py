"""Export fixed Python score fixtures for the candidate batch-24 model."""

import hashlib
import json
from pathlib import Path

import numpy as np

from batch24_pipeline import MODEL, model_scores

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "scripts" / "drawing-recognition" / "fixtures" / "model-parity-24.json"


def main() -> None:
    manifest = json.loads((MODEL / "manifest.json").read_text(encoding="utf-8"))
    weights = MODEL / manifest["weightFile"]
    digest = hashlib.sha256(weights.read_bytes()).hexdigest()
    if digest != manifest["sha256"]:
        raise SystemExit("Candidate weights do not match the manifest checksum")
    side = 28
    yy, xx = np.mgrid[:side, :side]
    circle = (((xx - 13.5) ** 2 + (yy - 13.5) ** 2 >= 7**2) &
              ((xx - 13.5) ** 2 + (yy - 13.5) ** 2 <= 9**2)).astype(np.float32)
    diagonal = ((xx == yy) | (xx + yy == side - 1)).astype(np.float32)
    rng = np.random.default_rng(61973)
    inputs = [
        ("blank", np.zeros((side, side), dtype=np.float32)),
        ("centered-circle", circle),
        ("crossed-diagonals", diagonal),
        ("seeded-binary-pattern", rng.integers(0, 2, size=(side, side), dtype=np.uint8).astype(np.float32)),
    ]
    scores = model_scores(np.stack([pixels.ravel() for _, pixels in inputs]), weights, manifest)
    report = {
        "modelSha256": digest,
        "tolerance": 0.00001,
        "method": "Python NumPy float32 dense layers and float64 softmax over the candidate float32 weights",
        "fixtures": [
            {"name": name, "input": pixels.ravel().astype(int).tolist(), "expectedScores": result.tolist()}
            for (name, pixels), result in zip(inputs, scores)
        ],
    }
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(inputs)} fixtures, {len(manifest['labels'])} scores each; model {digest}")


if __name__ == "__main__":
    main()
