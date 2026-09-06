#!/usr/bin/env python3
"""Download the MediaPipe pose model.

Not committed to the repo: it is a 5.8 MB binary that Google publishes and
versions itself, so vendoring it would mean carrying a blob nobody reviews.

    python scripts/fetch_pose_model.py            # lite, the default
    python scripts/fetch_pose_model.py --variant full
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

BASE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker"

#: lite is enough for swing geometry and roughly 3x faster than heavy on CPU.
VARIANTS = {
    "lite": f"{BASE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "full": f"{BASE}/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "heavy": f"{BASE}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", default="lite", choices=sorted(VARIANTS))
    parser.add_argument("--dest", type=Path, default=Path("models"))
    args = parser.parse_args()

    url = VARIANTS[args.variant]
    args.dest.mkdir(parents=True, exist_ok=True)
    target = args.dest / Path(url).name

    if target.is_file():
        print(f"already present: {target} ({target.stat().st_size / 1e6:.1f} MB)")
        return

    print(f"downloading {args.variant} -> {target}")
    try:
        urllib.request.urlretrieve(url, target)
    except Exception as exc:
        print(f"download failed: {exc}")
        sys.exit(1)
    print(f"done: {target} ({target.stat().st_size / 1e6:.1f} MB)")
    print("\nSet GOLFSIM_POSE_MODEL_PATH if you put it somewhere else.")


if __name__ == "__main__":
    main()
