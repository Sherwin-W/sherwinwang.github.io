"""Run at most six predeclared experiments, with a hard timeout per fit."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = Path(__file__).with_name("overnight_experiments.py")
OUT = ROOT / ".cache" / "drawing-recognition" / "overnight"
PLAN = [
    ("baseline", 120),
    ("mlp-soft", 900),
    ("mlp-threshold", 900),
    ("mlp-contrast", 900),
    ("cnn", 900),
    ("compare-existing", 120),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    for name, timeout_seconds in PLAN:
        log = OUT / f"{name}.log"
        started = time.perf_counter()
        command = [sys.executable, str(SCRIPT), name]
        if name.startswith("mlp-"):
            command.extend(["--max-iter", "120"])
        if name == "cnn":
            command.extend(["--epochs", "12"])
        try:
            with log.open("w", encoding="utf-8") as output:
                completed = subprocess.run(command, cwd=ROOT, stdout=output,
                                           stderr=subprocess.STDOUT, timeout=timeout_seconds,
                                           check=False)
            item = {"experiment": name, "timeoutSeconds": timeout_seconds,
                    "wallSeconds": round(time.perf_counter()-started, 3),
                    "returnCode": completed.returncode, "log": str(log.relative_to(ROOT))}
        except subprocess.TimeoutExpired:
            item = {"experiment": name, "timeoutSeconds": timeout_seconds,
                    "wallSeconds": round(time.perf_counter()-started, 3),
                    "timedOut": True, "log": str(log.relative_to(ROOT))}
        results.append(item)
        print(item, flush=True)
        if item.get("returnCode", 0) != 0 or item.get("timedOut"):
            print("Stopping planned experiments after failed/timed-out run.", flush=True)
            break
    (OUT / "plan-results.json").write_text(__import__("json").dumps(results, indent=2)+"\n")


if __name__ == "__main__":
    main()
