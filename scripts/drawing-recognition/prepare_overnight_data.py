"""Fetch the deterministic 24-class train/validation/test sample cache.

The downloaded Quick, Draw! bitmap rows stay under ignored `.cache/` and are
not copied into the repository or used as visitor drawing data.
"""

from __future__ import annotations

import json

from batch24_pipeline import CACHE, sample_and_cache


def main() -> None:
    path = CACHE / "sampled-splits.npz"
    if path.exists():
        print(f"Sample cache already exists: {path}")
        return
    arrays = sample_and_cache()
    summary = {
        "cache": str(path),
        "splitRows": {split: int(len(values["y"])) for split, values in arrays.items()},
        "metadata": str(CACHE / "sampling-metadata.json"),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
