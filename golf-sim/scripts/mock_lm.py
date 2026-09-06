#!/usr/bin/env python3
"""Pretend to be the Square Golf launch monitor bridge.

    python scripts/mock_lm.py --club 7i --count 3
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import CLUB_PROFILES, synthetic_shot  # noqa: E402


def post_shot(
    base_url: str,
    club: str,
    rng: random.Random,
    *,
    timestamp: float | None = None,
    session_id: str = "mock-session",
    token: str | None = None,
) -> dict:
    payload = synthetic_shot(club, rng)
    payload["timestamp"] = timestamp if timestamp is not None else time.time()
    payload["session_id"] = session_id
    headers = {"X-Golfsim-Token": token} if token else {}
    response = httpx.post(
        f"{base_url}/api/v1/telemetry", json=payload, headers=headers, timeout=10.0
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--club", default="7i", choices=sorted(CLUB_PROFILES))
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--interval", type=float, default=8.0)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--token", default=None)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    for index in range(args.count):
        result = post_shot(args.base_url, args.club, rng, token=args.token)
        metrics = result["normalized_metrics"]
        print(
            f"shot {index + 1}/{args.count}  ball={metrics['ball_speed_mph']:.1f}mph "
            f"launch={metrics['launch_angle_deg']:.1f}deg "
            f"spin={metrics['back_spin_rpm']:.0f}rpm "
            f"smash={metrics.get('smash_factor', 0):.2f} -> {result['correlation']}"
        )
        if index + 1 < args.count:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
