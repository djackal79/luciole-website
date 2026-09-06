#!/usr/bin/env python3
"""Pretend to be the Samsung impact camera.

Models the real device faithfully enough to be useful:

* keeps a control WebSocket open and runs NTP-style clock sync over it,
* simulates a wall clock that is skewed from the PC's (``--clock-skew``),
* holds a notional ring buffer, so a trigger "captures the past",
* uploads the snapshot over HTTP after a realistic mux + transfer delay.

    python scripts/mock_phone.py                       # wait for triggers
    python scripts/mock_phone.py --self-trigger 3      # fire 3 shots itself
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
import websockets

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import make_clip  # noqa: E402


class MockPhone:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.rng = random.Random(args.seed)
        self.offset_ms: float | None = None
        self._workdir = Path(tempfile.mkdtemp(prefix="mock-phone-"))
        self._clip = make_clip(
            self._workdir / "impact.mp4",
            seconds=args.clip_seconds,
            fps=args.fps,
            size="480x360",
            label="impact",
        )

    # The phone's own wall clock, deliberately wrong.
    def now(self) -> float:
        return time.time() + self.args.clock_skew

    @property
    def ws_url(self) -> str:
        base = self.args.base_url.replace("http://", "ws://").replace("https://", "wss://")
        return f"{base}/ws/control?device_id={self.args.device_id}"

    async def run(self) -> None:
        async with websockets.connect(self.ws_url) as socket:
            welcome = await socket.recv()
            print(f"connected: {welcome}")
            await socket.send(_json(
                {"type": "hello", "device_id": self.args.device_id,
                 "capabilities": {"fps": self.args.fps, "ring_buffer_s": self.args.ring_buffer}}
            ))
            await self._sync_clock(socket)

            if self.args.self_trigger:
                await self._self_trigger_loop(socket)
            else:
                print("waiting for capture triggers (Ctrl-C to stop)...")
                await self._listen(socket)

    async def _sync_clock(self, socket) -> None:
        """NTP-style probes until the offset estimate settles."""
        for _ in range(self.args.sync_probes):
            t1 = self.now()
            await socket.send(_json({"type": "ping", "t1": t1}))
            pong = _loads(await socket.recv())
            t4 = self.now()
            await socket.send(_json({
                "type": "sync_ack", "t1": t1, "t2": pong["t2"], "t3": pong["t3"], "t4": t4,
            }))
            clock = _loads(await socket.recv())
            self.offset_ms = clock["offset_ms"]
            await asyncio.sleep(0.05)
        print(
            f"clock synced: offset={self.offset_ms:.1f}ms "
            f"rtt={clock['rtt_ms']:.1f}ms (true skew {self.args.clock_skew * 1000:.0f}ms)"
        )

    async def _listen(self, socket) -> None:
        async for raw in socket:
            message = _loads(raw)
            if message.get("type") == "capture_trigger":
                asyncio.create_task(self._snapshot_and_upload(message["trigger_id"], "trigger"))

    async def _self_trigger_loop(self, socket) -> None:
        listener = asyncio.create_task(self._listen(socket))
        try:
            for index in range(self.args.self_trigger):
                await self._snapshot_and_upload(f"self-{index}", "audio")
                if index + 1 < self.args.self_trigger:
                    await asyncio.sleep(self.args.interval)
        finally:
            listener.cancel()

    async def _snapshot_and_upload(self, trigger_id: str, trigger_source: str) -> None:
        """Snapshot the ring buffer, then mux + upload.

        The impact instant is *now*; the ring buffer means capture latency is
        zero and only the upload is slow, which is the whole point of the
        design. ``captured_at`` is sent in the phone's skewed clock.
        """
        impact_at = self.now()
        mux_delay = self.rng.uniform(*self.args.mux_delay)
        await asyncio.sleep(mux_delay)

        data = {
            "captured_at": f"{impact_at:.6f}",
            "device_id": self.args.device_id,
            "trigger_source": trigger_source,
            "pre_roll_s": str(self.args.pre_roll),
            "fps": str(self.args.fps),
        }
        headers = {"X-Golfsim-Token": self.args.token} if self.args.token else {}
        async with httpx.AsyncClient(timeout=60.0) as client:
            with self._clip.open("rb") as handle:
                response = await client.post(
                    f"{self.args.base_url}/api/v1/media/impact",
                    data=data,
                    files={"file": ("impact.mp4", handle, "video/mp4")},
                    headers=headers,
                )
        response.raise_for_status()
        body = response.json()
        print(
            f"[{trigger_id}] uploaded {body['bytes_received']} bytes after "
            f"{mux_delay:.2f}s  device_ts={impact_at:.3f} -> host_ts={body['timestamp']:.3f} "
            f"(corrected {body['clock_offset_ms']:.1f}ms)"
        )


def _json(payload: dict) -> str:
    import json

    return json.dumps(payload)


def _loads(raw: str) -> dict:
    import json

    return json.loads(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--device-id", default="galaxy-impact")
    parser.add_argument("--fps", type=int, default=240)
    parser.add_argument("--clip-seconds", type=float, default=1.5)
    parser.add_argument("--pre-roll", type=float, default=0.75,
                        help="seconds of the clip that precede impact")
    parser.add_argument("--ring-buffer", type=float, default=4.0)
    parser.add_argument("--clock-skew", type=float, default=4.2,
                        help="seconds the phone clock is ahead of the PC")
    parser.add_argument("--sync-probes", type=int, default=8)
    parser.add_argument("--mux-delay", type=float, nargs=2, default=(0.8, 2.2),
                        metavar=("MIN", "MAX"))
    parser.add_argument("--self-trigger", type=int, default=0,
                        help="fire N shots on its own instead of waiting")
    parser.add_argument("--interval", type=float, default=8.0)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--token", default=None)
    args = parser.parse_args()

    try:
        asyncio.run(MockPhone(args).run())
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
