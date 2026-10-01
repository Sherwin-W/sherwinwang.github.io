"""Check candidate packed weights against the actual browser JS inference code."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np

from batch24_pipeline import MODEL, model_scores


ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    manifest_path = MODEL / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    # Fixed recognizable geometric fixture, independent from validation/test.
    yy, xx = np.mgrid[:28, :28]
    image = (((xx - 13.5) ** 2 + (yy - 13.5) ** 2 >= 7**2) &
             ((xx - 13.5) ** 2 + (yy - 13.5) ** 2 <= 9**2)).astype(np.float32)
    expected = model_scores(image.reshape(1, -1), MODEL / manifest["weightFile"], manifest)[0]
    payload = json.dumps({"manifest": str(manifest_path), "input": image.reshape(-1).tolist()})
    js = r"""
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { pathToFileURL } = await import('node:url');
      const arg = JSON.parse(process.argv[1]);
      const manifest = JSON.parse(await fs.readFile(arg.manifest, 'utf8'));
      const bytes = await fs.readFile(path.join(path.dirname(arg.manifest), manifest.weightFile));
      const weights = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      const math = await import(pathToFileURL(path.resolve('src/playable/recognitionMath.js')));
      const layers = math.unpackLayers(weights, manifest.layerSizes);
      const scores = math.predictScores(Float32Array.from(arg.input), layers);
      process.stdout.write(JSON.stringify(Array.from(scores)));
    """
    result = subprocess.run(["node", "--input-type=module", "-e", js, payload], cwd=ROOT, check=True, capture_output=True, text=True)
    actual = np.asarray(json.loads(result.stdout), dtype=np.float64)
    maximum_error = float(np.max(np.abs(actual - expected)))
    if maximum_error > 1e-5:
        raise SystemExit(f"Browser JS candidate inference differs from Python by {maximum_error:.8g}")
    metrics_path = ROOT / "docs" / "playable-portfolio" / "recognition-metrics-24-candidate.json"
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    metrics["browserRuntimeCompatibility"] = {
        "tested": True,
        "module": "src/playable/recognitionMath.js: unpackLayers + predictScores",
        "fixture": "centered 28x28 circle (synthetic; no cached split rows used)",
        "outputCount": len(actual),
        "maximumAbsoluteScoreError": maximum_error,
        "tolerance": 1e-5,
        "integrationNote": "The active Worker loads the 24-class model and the catalog maps all 24 labels, including house plant to Potted plant. Full end-to-end Chromium preprocessing results for twelve independent new-category drawings are in browser-fixture-results-24.json.",
    }
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics["browserRuntimeCompatibility"], indent=2))


if __name__ == "__main__":
    main()
