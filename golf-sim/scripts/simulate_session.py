#!/usr/bin/env python3
"""Drive a full range session against a running backend -- no golf required.

Fires all three sources per shot with realistic, deliberately out-of-order
latencies and verifies how the correlator paired them:

    telemetry     impact + ~0.05 s   over the GSPro socket
    impact clip   impact + ~1-2 s    ring-buffer snapshot, mux, upload
    body swing    impact + ~1-2 s    Kinovea Automation hook

Usage::

    uvicorn backend.main:app --port 8000                  # terminal 1
    python scripts/simulate_session.py --shots 3 --check   # terminal 2
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import CLUB_PROFILES, gspro_shot, make_clip  # noqa: E402
from mock_kinovea import export_clip, post_hook  # noqa: E402
from mock_lm import MockMonitor  # noqa: E402
from mock_phone import upload_clip  # noqa: E402


class SessionSimulator:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.rng = random.Random(args.seed)
        self.workdir = Path(tempfile.mkdtemp(prefix="golfsim-sim-"))
        self.impact_clip = make_clip(
            self.workdir / "impact_strike.mp4",
            seconds=1.5, container_fps=30, size="480x360", label="impact_strike",
        )
        self.monitor: MockMonitor | None = None
        self.expected = 0
        #: Shot ids this run created. The report judges only these: seeded
        #: fixtures carry the contract's 14:30 example timestamp, which is in
        #: the future for most of the day, so no time filter can exclude them.
        self.produced: set[str] = set()

    async def run(self) -> int:
        async with httpx.AsyncClient(base_url=self.args.base_url, timeout=60.0) as client:
            health = await self._preflight(client)
            if health is None:
                return 2

            for index in range(self.args.shots):
                await self._one_shot(client, index)
                if index + 1 < self.args.shots:
                    await asyncio.sleep(self.args.interval)

            settle = self.args.settle
            print(f"\nwaiting {settle}s for the pairing window to close...")
            await asyncio.sleep(settle)
            shots = (await client.get("/api/shots", params={"limit": 500})).json()
            return self._report([s for s in shots if s["shot_id"] in self.produced])

    async def _preflight(self, client: httpx.AsyncClient) -> dict | None:
        health = (await client.get("/api/health")).json()
        listeners = health["listeners"]
        print(f"backend up. session={health['session_id']}")
        print(
            f"pairing +/-{health['pairing']['window_ms']}ms, "
            f"late-attach {health['pairing']['late_attach_ms']}ms"
        )

        gspro = listeners["gspro_socket"]
        if not gspro["live"]:
            print(
                f"\nGSPro listener is not live on {gspro['host']}:{gspro['port']}"
                f" ({gspro['last_error']}).\n"
                "Telemetry cannot be simulated. Is GSPro holding port 921?"
            )
            if not self.args.allow_no_telemetry:
                return None
        else:
            self.monitor = MockMonitor(gspro["host"], gspro["port"])
            print(f"connected to the GSPro socket on {gspro['host']}:{gspro['port']}\n")
        return health

    async def _one_shot(self, client: httpx.AsyncClient, index: int) -> None:
        club = self.rng.choice(list(CLUB_PROFILES))
        impact_at = time.time()
        print(f"--- shot {index + 1}/{self.args.shots}  {club}")

        await asyncio.gather(
            self._send_telemetry(club, index, impact_at),
            self._send_impact(client, impact_at),
            self._send_body_swing(client, impact_at),
        )
        self.expected += 1

    async def _send_telemetry(self, club: str, index: int, impact_at: float) -> None:
        if self.monitor is None:
            return
        await asyncio.sleep(self.rng.uniform(0.02, 0.10))
        payload = gspro_shot(club, self.rng, shot_number=index + 1)
        reply = await asyncio.to_thread(self.monitor.send, payload)
        print(
            f"    telemetry   +{time.time() - impact_at:5.2f}s  "
            f"ball={payload['BallData']['Speed']:.1f}mph  ack={(reply or {}).get('Code')}"
        )

    async def _send_impact(self, client: httpx.AsyncClient, impact_at: float) -> None:
        await asyncio.sleep(self.rng.uniform(*self.args.impact_delay))
        # Deliberately skewed device clock: the backend must ignore it.
        hint = (datetime.now().astimezone() + timedelta(seconds=self.args.clock_skew))
        result = await asyncio.to_thread(
            upload_clip,
            self.args.base_url,
            self.impact_clip,
            trigger_ts=hint.isoformat(timespec="milliseconds"),
            capture_fps=240.0,
            container_fps=30.0,
            duration_ms=1500,
            width=480,
            height=360,
        )
        self.produced.add(result["shot_id"])
        print(f"    impact      +{time.time() - impact_at:5.2f}s  -> {result['shot_id']}")

    async def _send_body_swing(self, client: httpx.AsyncClient, impact_at: float) -> None:
        """Kinovea's Automation hooks, one per camera.

        Both fire within milliseconds of each other, which is exactly the case
        that needs distinct sources: without them the correlator reads the
        second clip as a second swing and doubles the shot.
        """
        cameras = [("body_swing", "face_on", 30.0)]
        if self.args.dtl:
            cameras.append(("body_swing_dtl", "dtl", 60.0))

        await asyncio.sleep(self.rng.uniform(*self.args.swing_delay))
        for source, camera, fps in cameras:
            clip = await asyncio.to_thread(
                export_clip,
                self.args.export_dir,
                write_seconds=self.args.swing_write_seconds,
                container_fps=int(fps),
            )
            result = await asyncio.to_thread(
                post_hook, self.args.base_url, clip,
                source=source, capture_fps=fps, container_fps=fps, camera=camera,
                duration_ms=4000, width=640, height=480,
            )
            self.produced.add(result["shot_id"])
            print(f"    {source:<11} +{time.time() - impact_at:5.2f}s  -> {result['shot_id']}")

    def _report(self, shots: list[dict]) -> int:
        expected_sources = {"body_swing", "body_swing_dtl", "impact_strike", "telemetry"}
        if self.monitor is None:
            expected_sources.discard("telemetry")
        if not self.args.dtl:
            expected_sources.discard("body_swing_dtl")

        print(f"\n{'=' * 80}\nPAIRING REPORT -- {len(shots)} shot package(s)\n{'=' * 80}")
        print(f"{'shot_id':<24} {'status':<9} {'club':<6} sources")
        print("-" * 80)

        good = 0
        for shot in shots:
            present = {k for k, v in shot["sources"].items() if v}
            # Subset, not equality: pose lands seconds after the shot closes,
            # so a package may honestly carry MORE than was simulated. Testing
            # for equality marked a complete shot as a failure purely because
            # its pose had finished in time.
            if expected_sources <= present:
                good += 1
            missing = expected_sources - present
            note = f"   MISSING: {', '.join(sorted(missing))}" if missing else ""
            print(
                f"{shot['shot_id']:<24} {shot['status']:<9} "
                f"{(shot['club_used'] or '-'):<6} {', '.join(sorted(present)) or '-'}{note}"
            )

        print("-" * 80)
        print(f"fully paired: {good}/{len(shots)}   simulated: {self.expected}")

        if not self.args.check:
            return 0
        problems = []
        if len(shots) != self.expected:
            problems.append(
                f"expected {self.expected} packages, found {len(shots)} "
                "(over- or under-splitting)"
            )
        if good != self.expected:
            problems.append(f"only {good} of {self.expected} packages have every source")
        if problems:
            print("\nFAIL:")
            for problem in problems:
                print(f"  - {problem}")
            return 1
        print("\nOK: every simulated shot produced exactly one fully paired package.")
        return 0

    def close(self) -> None:
        if self.monitor is not None:
            self.monitor.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--export-dir", type=Path, default=Path("data/kinovea_export"))
    parser.add_argument("--shots", type=int, default=3)
    parser.add_argument("--interval", type=float, default=10.0)
    parser.add_argument("--settle", type=float, default=6.0)
    parser.add_argument("--impact-delay", type=float, nargs=2, default=(1.0, 1.8),
                        metavar=("MIN", "MAX"))
    parser.add_argument("--swing-delay", type=float, nargs=2, default=(0.3, 0.8),
                        metavar=("MIN", "MAX"))
    parser.add_argument("--swing-write-seconds", type=float, default=0.6)
    parser.add_argument("--clock-skew", type=float, default=4.2)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--allow-no-telemetry", action="store_true",
                        help="run video-only when the GSPro socket is unavailable")
    parser.add_argument("--dtl", action="store_true",
                        help="also drive the second Kinovea camera (down-the-line)")
    parser.add_argument("--check", action="store_true",
                        help="exit non-zero unless every shot paired cleanly")
    args = parser.parse_args()

    simulator = SessionSimulator(args)
    try:
        raise SystemExit(asyncio.run(simulator.run()))
    except httpx.ConnectError:
        print(f"cannot reach the backend at {args.base_url} -- is uvicorn running?")
        raise SystemExit(2)
    finally:
        simulator.close()


if __name__ == "__main__":
    main()
