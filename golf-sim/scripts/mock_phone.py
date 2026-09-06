#!/usr/bin/env python3
"""Pretend to be the Samsung impact camera.

Models the device faithfully enough to be useful: a deliberately skewed wall
clock, a ring buffer (so a trigger captures the past and capture latency is
zero), and a realistic mux + upload delay before the clip reaches the PC.

The skewed ``trigger_ts`` is sent on purpose -- the backend must treat it as an
ordering hint and stamp the shot on receipt instead.

    python scripts/mock_phone.py --count 3
"""

from __future__ import annotations

import argparse
import random
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import make_clip  # noqa: E402


def upload_clip(
    base_url: str,
    clip: Path,
    *,
    trigger_ts: str,
    capture_fps: float,
    container_fps: float,
    duration_ms: int | None = None,
    width: int | None = None,
    height: int | None = None,
    token: str | None = None,
) -> dict:
    headers = {"X-Golfsim-Token": token} if token else {}
    with clip.open("rb") as handle:
        response = httpx.post(
            f"{base_url}/api/ingest/impact",
            data={
                "trigger_ts": trigger_ts,
                "capture_fps": capture_fps,
                "container_fps": container_fps,
                "camera": "impact",
                # A real phone knows these exactly; supplying them beats
                # probing, and works without ffmpeg on the host.
                **({"duration_ms": duration_ms} if duration_ms else {}),
                **({"width": width} if width else {}),
                **({"height": height} if height else {}),
            },
            files={"file": ("impact_strike.mp4", handle, "video/mp4")},
            headers=headers,
            timeout=60.0,
        )
    response.raise_for_status()
    return response.json()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--interval", type=float, default=8.0)
    parser.add_argument("--capture-fps", type=float, default=240.0)
    parser.add_argument("--container-fps", type=float, default=30.0)
    parser.add_argument("--clip-seconds", type=float, default=1.5)
    parser.add_argument("--clock-skew", type=float, default=4.2,
                        help="seconds the phone clock is ahead of the PC")
    parser.add_argument("--mux-delay", type=float, nargs=2, default=(0.8, 1.8),
                        metavar=("MIN", "MAX"))
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--token", default=None)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    workdir = Path(tempfile.mkdtemp(prefix="mock-phone-"))
    clip = make_clip(
        workdir / "impact_strike.mp4",
        seconds=args.clip_seconds,
        container_fps=int(args.container_fps),
        size="480x360",
        label="impact_strike",
    )

    for index in range(args.count):
        # The ring buffer means the frames already exist; only the mux and
        # upload cost time.
        impact_at = datetime.now().astimezone() + timedelta(seconds=args.clock_skew)
        delay = rng.uniform(*args.mux_delay)
        time.sleep(delay)

        result = upload_clip(
            args.base_url,
            clip,
            trigger_ts=impact_at.isoformat(timespec="milliseconds"),
            capture_fps=args.capture_fps,
            container_fps=args.container_fps,
            duration_ms=int(args.clip_seconds * 1000),
            width=480,
            height=360,
            token=args.token,
        )
        print(
            f"shot {index + 1}/{args.count}  uploaded after {delay:.2f}s "
            f"(phone clock {args.clock_skew:+.1f}s off) -> shot {result['shot_id']} "
            f"({result['status']})"
        )
        if index + 1 < args.count:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
