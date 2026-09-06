#!/usr/bin/env python3
"""Pretend to be the launch monitor: a GSPro Open Connect v1 client.

The monitor is the *client* in this protocol -- it connects to port 921 and
pushes shot JSON, and the backend (impersonating GSPro) acknowledges. This
script exercises that real socket path, not a convenience HTTP shim.

    python scripts/mock_lm.py --club 7I --count 3
"""

from __future__ import annotations

import argparse
import json
import random
import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import CLUB_PROFILES, gspro_heartbeat, gspro_shot  # noqa: E402


class MockMonitor:
    """Minimal GSPro Connect client."""

    def __init__(self, host: str, port: int, timeout: float = 5.0) -> None:
        self.sock = socket.create_connection((host, port), timeout=timeout)
        self._buffer = ""

    def send(self, payload: dict) -> dict | None:
        self.sock.sendall((json.dumps(payload) + "\r\n").encode("utf-8"))
        return self.recv()

    def recv(self) -> dict | None:
        decoder = json.JSONDecoder()
        deadline = time.time() + 5.0
        while time.time() < deadline:
            try:
                self._buffer += self.sock.recv(65536).decode("utf-8", errors="replace")
            except socket.timeout:
                return None
            stripped = self._buffer.lstrip()
            if not stripped:
                continue
            try:
                message, end = decoder.raw_decode(stripped)
            except json.JSONDecodeError:
                continue
            self._buffer = stripped[end:]
            return message
        return None

    def close(self) -> None:
        self.sock.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=921)
    parser.add_argument("--club", default="7I", choices=sorted(CLUB_PROFILES))
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--interval", type=float, default=8.0)
    parser.add_argument("--no-club-data", action="store_true",
                        help="send ContainsClubData false (smash_factor becomes null)")
    parser.add_argument("--heartbeat", action="store_true",
                        help="send a heartbeat first; it must not create a shot")
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    monitor = MockMonitor(args.host, args.port)
    print(f"connected to {args.host}:{args.port}")

    try:
        if args.heartbeat:
            print(f"  heartbeat -> {monitor.send(gspro_heartbeat())}")

        for index in range(args.count):
            payload = gspro_shot(
                args.club,
                rng,
                shot_number=index + 1,
                contains_club_data=not args.no_club_data,
            )
            reply = monitor.send(payload)
            ball = payload["BallData"]
            print(
                f"shot {index + 1}/{args.count}  ball={ball['Speed']:.1f}mph "
                f"vla={ball['VLA']:.1f} spin={ball['BackSpin']:.0f}  <- {reply}"
            )
            if index + 1 < args.count:
                time.sleep(args.interval)
    finally:
        monitor.close()


if __name__ == "__main__":
    main()
