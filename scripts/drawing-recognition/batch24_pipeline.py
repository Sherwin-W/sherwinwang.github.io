"""Shared constants and bounded Quick, Draw! bitmap sampling for candidate 24."""

from __future__ import annotations

import random
import struct
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "drawing-recognition" / "batch24"
MODEL = ROOT / "public" / "models" / "drawing-recognizer-24-candidate"
METRICS = ROOT / "docs" / "playable-portfolio" / "recognition-metrics-24-candidate.json"
AUTO_REPORT = ROOT / "docs" / "playable-portfolio" / "autospawn-validation-24-candidate.json"
BUCKET = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap"
SUPPORTED = [
    "cat", "dog", "rabbit", "bird", "fish", "butterfly", "tree", "flower",
    "mushroom", "cactus", "sun", "moon", "cow", "duck", "elephant", "frog",
    "leaf", "house plant", "apple", "banana", "pizza", "chair", "airplane", "bicycle",
]
# All labels are official Quick, Draw! categories and do not overlap the 24 supported labels.
UNSUPPORTED = ["car", "house", "clock", "cloud", "star", "mountain", "violin", "toothbrush"]
OTHER = "other"
LABELS = SUPPORTED + [OTHER]
PIXELS = 28 * 28
WINDOW_COUNT = 8
WINDOW_ROWS = 300
SEED = 20260930


def read_array_header(url: str) -> tuple[int, int, int]:
    request = urllib.request.Request(url, headers={"Range": "bytes=0-65535"})
    with urllib.request.urlopen(request, timeout=40) as response:
        prefix = response.read(65536)
        content_range = response.headers.get("Content-Range", "")
    if not content_range.startswith("bytes 0-"):
        raise RuntimeError(f"Server ignored byte-range request for {url}: {content_range}")
    total_bytes = int(content_range.rsplit("/", 1)[1])
    stream = memoryview(prefix)
    if bytes(stream[:6]) != b"\x93NUMPY":
        raise RuntimeError(f"Not a NumPy file: {url}")
    major = stream[6]
    if major == 1:
        header_length = struct.unpack("<H", stream[8:10])[0]
        offset = 10 + header_length
        header = bytes(stream[10:offset]).decode("latin1")
    elif major in (2, 3):
        header_length = struct.unpack("<I", stream[8:12])[0]
        offset = 12 + header_length
        header = bytes(stream[12:offset]).decode("latin1")
    else:
        raise RuntimeError(f"Unsupported NumPy format version {major}")
    if "'descr': '|u1'" not in header and '"descr": "|u1"' not in header:
        raise RuntimeError(f"Expected uint8 bitmap array, got {header!r}")
    return offset, (total_bytes - offset) // PIXELS, len(prefix)


def deterministic_windows(count: int, class_name: str) -> dict[str, list[tuple[int, int]]]:
    rng = random.Random(f"{SEED}:batch24:{class_name}")
    strata = list(range(WINDOW_COUNT))
    rng.shuffle(strata)
    allocations = ({"train": strata[:4], "validation": strata[4:6], "test": strata[6:]}
                   if class_name in SUPPORTED else
                   {"train": strata[:2], "validation": strata[2:5], "test": strata[5:]})
    result = {split: [] for split in ("train", "validation", "test")}
    for split, assigned in allocations.items():
        for stratum in assigned:
            lower = count * stratum // WINDOW_COUNT
            upper = count * (stratum + 1) // WINDOW_COUNT - WINDOW_ROWS
            start = rng.randint(lower, max(lower, upper))
            result[split].append((start, start + WINDOW_ROWS))
    return result


def fetch_one(args: tuple[str, str, int, int, int]) -> tuple[str, str, np.ndarray, int]:
    name, split, start, end, data_offset = args
    url = f"{BUCKET}/{urllib.parse.quote(name)}.npy"
    first, last = data_offset + start * PIXELS, data_offset + end * PIXELS - 1
    request = urllib.request.Request(url, headers={"Range": f"bytes={first}-{last}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
        content_range = response.headers.get("Content-Range", "")
    if len(payload) != (end - start) * PIXELS or not content_range.startswith(f"bytes {first}-{last}/"):
        raise RuntimeError(f"Invalid byte range for {name}: {content_range}; {len(payload)} bytes")
    return name, split, np.frombuffer(payload, dtype=np.uint8).reshape(end - start, PIXELS).copy(), len(payload)


def sample_and_cache() -> dict[str, dict[str, np.ndarray]]:
    CACHE.mkdir(parents=True, exist_ok=True)
    jobs, source_counts, bytes_read = [], {}, 0
    for name in SUPPORTED + UNSUPPORTED:
        offset, count, header_bytes = read_array_header(f"{BUCKET}/{urllib.parse.quote(name)}.npy")
        bytes_read += header_bytes
        windows = deterministic_windows(count, name)
        source_counts[name] = {split: sum(end - start for start, end in ranges) for split, ranges in windows.items()}
        for split, ranges in windows.items():
            jobs.extend((name, split, start, end, offset) for start, end in ranges)

    rows = {split: {"x": [], "y": [], "source": []} for split in ("train", "validation", "test")}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for name, split, images, payload_bytes in pool.map(fetch_one, jobs):
            bytes_read += payload_bytes
            bucket = OTHER if name in UNSUPPORTED else name
            rows[split]["x"].append(images.astype(np.float32) / 255.0)
            rows[split]["y"].extend([LABELS.index(bucket)] * len(images))
            rows[split]["source"].extend([name] * len(images))

    arrays = {}
    for split, values in rows.items():
        arrays[split] = {
            "x": np.concatenate(values["x"]).astype(np.float32),
            "y": np.asarray(values["y"], dtype=np.int64),
            "source": np.asarray(values["source"], dtype="U24"),
        }
        permutation = np.random.default_rng(SEED + len(split) + 24).permutation(len(arrays[split]["y"]))
        arrays[split] = {key: value[permutation] for key, value in arrays[split].items()}
    np.savez_compressed(CACHE / "sampled-splits.npz", **{
        f"{split}_{key}": value for split, values in arrays.items() for key, value in values.items()
    })
    (CACHE / "sampling-metadata.json").write_text(__import__("json").dumps({
        "seed": SEED,
        "windowCount": WINDOW_COUNT,
        "rowsPerWindow": WINDOW_ROWS,
        "windowsBySource": source_counts,
        "bytesFetchedIncludingNpyHeaders": bytes_read,
        "officialBucket": BUCKET,
    }, indent=2) + "\n", encoding="utf-8")
    return arrays


def load_cached() -> dict[str, dict[str, np.ndarray]]:
    path = CACHE / "sampled-splits.npz"
    if not path.exists():
        raise SystemExit(f"Missing candidate split cache {path}; run prepare_overnight_data.py to fetch the deterministic data sample.")
    with np.load(path) as saved:
        return {split: {key: saved[f"{split}_{key}"] for key in ("x", "y", "source")}
                for split in ("train", "validation", "test")}


def model_scores(inputs: np.ndarray, weights_path: Path, manifest: dict) -> np.ndarray:
    packed = np.fromfile(weights_path, dtype="<f4")
    offset = 0
    values = np.asarray(inputs, dtype=np.float32)
    sizes = manifest["layerSizes"]
    for layer, (input_size, output_size) in enumerate(zip(sizes, sizes[1:])):
        count = input_size * output_size
        matrix = packed[offset:offset + count].reshape(input_size, output_size)
        offset += count
        bias = packed[offset:offset + output_size]
        offset += output_size
        values = values @ matrix + bias
        if layer < len(sizes) - 2:
            values = np.maximum(values, 0)
    if offset != len(packed):
        raise ValueError("Unexpected number of model weights")
    logits = values.astype(np.float64)
    exp = np.exp(logits - np.max(logits, axis=1, keepdims=True))
    return exp / exp.sum(axis=1, keepdims=True)
