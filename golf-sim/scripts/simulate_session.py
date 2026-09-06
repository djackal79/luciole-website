#!/usr/bin/env python3
"""Drive a full range session against a running backend -- no golf required.

For each simulated shot it fires all three sources with realistic, *deliberately
out-of-order* latencies, then reports how the correlator paired them:

    telemetry     impact + ~0.05 s   (fast path, becomes the anchor)
    impact clip   impact + ~1-2 s    (ring-buffer snapshot, mux, upload)
    swing clip    impact + ~2 s      (Kinovea post-roll, encode, flush)

Usage::

    uvicorn backend.main:app --port 8000        # terminal 1
    python scripts/simulate_session.py --shots 5 --check
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
import tempfile
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import CLUB_PROFILES, make_clip, synthetic_shot  # noqa: E402
from mock_kinovea import export_clip  # noqa: E402


class SessionSimulator:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.rng = random.Random(args.seed)
        self.headers = {"X-Golfsim-Token": args.token} if args.token else {}
        self.workdir = Path(tempfile.mkdtemp(prefix="golfsim-sim-"))
        self.impact_clip = make_clip(
            self.workdir / "impact.mp4", seconds=1.5, fps=240, size="480x360", label="impact"
        )
        self.expected: list[dict] = []

    async def run(self) -> int:
        async with httpx.AsyncClient(base_url=self.args.base_url, timeout=60.0) as client:
            await self._preflight(client)
            for index in range(self.args.shots):
                await self._one_shot(client, index)
                if index + 1 < self.args.shots:
                    await asyncio.sleep(self.args.interval)

            print(f"\nwaiting {self.args.settle}s for shots to settle...")
            await asyncio.sleep(self.args.settle)
            shots = (await client.get("/api/v1/shots", params={"limit": 200})).json()
            return self._report(shots)

    async def _preflight(self, client: httpx.AsyncClient) -> None:
        health = await client.get("/health")
        health.raise_for_status()
        status = (await client.get("/api/v1/status")).json()
        print(f"backend up. watching {status['watching']}")
        print(
            f"pairing window +/-{status['pair_window_seconds']}s, "
            f"settle {status['settle_seconds']}s, "
            f"expecting {', '.join(status['expected_sources'])}\n"
        )
        if Path(status["watching"]).resolve() != self.args.export_dir.resolve():
            print(
                f"  note: backend watches {status['watching']} but this script writes to "
                f"{self.args.export_dir}. Pass --export-dir to match.\n"
            )

    async def _one_shot(self, client: httpx.AsyncClient, index: int) -> None:
        club = self.rng.choice(list(CLUB_PROFILES))
        impact_at = time.time()
        print(f"--- shot {index + 1}/{self.args.shots}  {club}  impact={impact_at:.3f}")

        # Launched concurrently and completing out of order, exactly as the
        # real sources do.
        await asyncio.gather(
            self._send_telemetry(client, club, impact_at),
            self._send_impact_clip(client, impact_at),
            self._write_swing_clip(impact_at),
        )
        self.expected.append({"club": club, "impact_at": impact_at})

    async def _send_telemetry(
        self, client: httpx.AsyncClient, club: str, impact_at: float
    ) -> None:
        await asyncio.sleep(self.rng.uniform(0.02, 0.12))
        payload = synthetic_shot(club, self.rng)
        payload["timestamp"] = impact_at
        payload["session_id"] = self.args.session_id
        response = await client.post("/api/v1/telemetry", json=payload, headers=self.headers)
        response.raise_for_status()
        print(f"    telemetry  +{time.time() - impact_at:5.2f}s  -> {response.json()['correlation']}")

    async def _send_impact_clip(self, client: httpx.AsyncClient, impact_at: float) -> None:
        await asyncio.sleep(self.rng.uniform(*self.args.impact_delay))
        with self.impact_clip.open("rb") as handle:
            response = await client.post(
                "/api/v1/media/impact",
                data={
                    "captured_at": f"{impact_at:.6f}",
                    "device_id": "galaxy-impact",
                    "trigger_source": "audio",
                    "pre_roll_s": "0.75",
                    "fps": "240",
                },
                files={"file": ("impact.mp4", handle, "video/mp4")},
                headers=self.headers,
            )
        response.raise_for_status()
        print(f"    impact     +{time.time() - impact_at:5.2f}s  {response.json()['bytes_received']} bytes")

    async def _write_swing_clip(self, impact_at: float) -> None:
        """Kinovea keeps recording after impact, then encodes and flushes."""
        await asyncio.sleep(self.rng.uniform(*self.args.swing_delay))
        await asyncio.to_thread(
            export_clip, self.args.export_dir, write_seconds=self.args.swing_write_seconds
        )
        print(f"    swing      +{time.time() - impact_at:5.2f}s  written to export dir")

    def _report(self, shots: dict) -> int:
        print(f"\n{'=' * 78}\nPAIRING REPORT -- {shots['count']} shot package(s)\n{'=' * 78}")
        header = f"{'shot_id':<28} {'status':<9} {'club':<7} sources (offset from anchor)"
        print(header)
        print("-" * 78)

        complete = 0
        for summary in shots["shots"]:
            if summary["status"] == "complete":
                complete += 1
            sources = ", ".join(summary["present_sources"]) or "-"
            missing = (
                f"  MISSING: {', '.join(summary['missing_sources'])}"
                if summary["missing_sources"]
                else ""
            )
            print(
                f"{summary['shot_id']:<28} {summary['status']:<9} "
                f"{(summary['club'] or '-'):<7} {sources}{missing}"
            )

        print("-" * 78)
        print(f"complete: {complete}/{shots['count']}   simulated: {len(self.expected)}")

        if not self.args.check:
            return 0
        problems = []
        if shots["count"] != len(self.expected):
            problems.append(
                f"expected {len(self.expected)} packages, found {shots['count']} "
                "(over- or under-splitting)"
            )
        if complete != len(self.expected):
            problems.append(f"only {complete} of {len(self.expected)} packages are complete")
        if problems:
            print("\nFAIL:")
            for problem in problems:
                print(f"  - {problem}")
            return 1
        print("\nOK: every simulated shot produced exactly one complete package.")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--export-dir", type=Path, default=Path("data/kinovea_export"),
                        help="must match the backend's GOLFSIM_KINOVEA_EXPORT_DIR")
    parser.add_argument("--shots", type=int, default=3)
    parser.add_argument("--interval", type=float, default=10.0,
                        help="seconds between simulated swings")
    parser.add_argument("--settle", type=float, default=6.0,
                        help="seconds to wait before reporting")
    parser.add_argument("--impact-delay", type=float, nargs=2, default=(1.0, 2.0),
                        metavar=("MIN", "MAX"))
    parser.add_argument("--swing-delay", type=float, nargs=2, default=(0.4, 1.0),
                        metavar=("MIN", "MAX"))
    parser.add_argument("--swing-write-seconds", type=float, default=1.0)
    parser.add_argument("--session-id", default="mock-session")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--token", default=None)
    parser.add_argument("--check", action="store_true",
                        help="exit non-zero unless every shot paired cleanly")
    args = parser.parse_args()

    try:
        raise SystemExit(asyncio.run(SessionSimulator(args).run()))
    except httpx.ConnectError:
        print(f"cannot reach the backend at {args.base_url} -- is uvicorn running?")
        raise SystemExit(2)


if __name__ == "__main__":
    main()
