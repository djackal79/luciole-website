"""Shared helpers for the mock scripts: fake clips and plausible telemetry."""

from __future__ import annotations

import random
import shutil
import struct
import subprocess
from pathlib import Path

#: Ball/club numbers a decent amateur would post, before jitter is applied.
CLUB_PROFILES: dict[str, dict[str, float]] = {
    "Driver": {
        "ball_speed": 152.0, "club_speed": 103.0, "launch_angle": 13.4,
        "back_spin": 2650, "club_path": 1.2, "face_angle": 1.8,
        "attack_angle": 2.1, "carry": 248.0,
    },
    "5i": {
        "ball_speed": 128.0, "club_speed": 88.0, "launch_angle": 15.1,
        "back_spin": 5200, "club_path": -0.8, "face_angle": -0.2,
        "attack_angle": -2.6, "carry": 187.0,
    },
    "7i": {
        "ball_speed": 118.0, "club_speed": 84.0, "launch_angle": 17.6,
        "back_spin": 6600, "club_path": -1.4, "face_angle": -0.9,
        "attack_angle": -3.8, "carry": 162.0,
    },
    "PW": {
        "ball_speed": 96.0, "club_speed": 74.0, "launch_angle": 24.8,
        "back_spin": 9100, "club_path": -2.1, "face_angle": -1.6,
        "attack_angle": -4.9, "carry": 128.0,
    },
}


def synthetic_shot(club: str, rng: random.Random) -> dict[str, float | str]:
    """One shot's telemetry, in the mixed key casing the Square app emits."""
    profile = CLUB_PROFILES[club]

    def jitter(value: float, pct: float) -> float:
        return round(value * rng.uniform(1 - pct, 1 + pct), 2)

    ball_speed = jitter(profile["ball_speed"], 0.04)
    club_speed = jitter(profile["club_speed"], 0.03)
    face_angle = round(profile["face_angle"] + rng.uniform(-1.5, 1.5), 2)
    club_path = round(profile["club_path"] + rng.uniform(-1.5, 1.5), 2)
    return {
        "club": club,
        # Deliberately inconsistent casing -- the backend normalises it.
        "BallSpeed": ball_speed,
        "clubHeadSpeed": club_speed,
        "launchAngle": jitter(profile["launch_angle"], 0.06),
        "Backspin": int(jitter(profile["back_spin"], 0.08)),
        "sideSpin": int(rng.uniform(-900, 900)),
        "clubPath": club_path,
        "faceAngle": face_angle,
        "attackAngle": round(profile["attack_angle"] + rng.uniform(-0.8, 0.8), 2),
        "azimuth": round(face_angle * 0.75 + club_path * 0.25, 2),
        "carryDistance": jitter(profile["carry"], 0.05),
        "totalDistance": jitter(profile["carry"] * 1.06, 0.05),
        "apex": round(rng.uniform(60, 110), 1),
    }


def _stub_mp4(size_bytes: int) -> bytes:
    """A file with a valid ftyp/mdat skeleton but no real video payload.

    Enough for ingest, hashing and byte-range serving; not playable. Used when
    ffmpeg is unavailable.
    """
    ftyp = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41"
    payload_size = max(size_bytes - len(ftyp) - 8, 8)
    mdat = struct.pack(">I", payload_size + 8) + b"mdat" + b"\x00" * payload_size
    return ftyp + mdat


def make_clip(
    destination: Path,
    *,
    seconds: float = 2.0,
    fps: int = 240,
    size: str = "640x480",
    label: str = "clip",
    target_bytes: int = 256 * 1024,
) -> Path:
    """Write a test clip, using ffmpeg for a real one when it is installed."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if shutil.which("ffmpeg"):
        command = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi",
            # testsrc already burns in a frame counter, which is exactly what
            # you want when eyeballing Build 2's frame alignment.
            "-i", f"testsrc=size={size}:rate={fps}:duration={seconds}",
            "-pix_fmt", "yuv420p",
            "-metadata", f"title={label}",
            str(destination),
        ]
        result = subprocess.run(command, capture_output=True, check=False)
        if result.returncode == 0 and destination.exists():
            return destination
    destination.write_bytes(_stub_mp4(target_bytes))
    return destination
