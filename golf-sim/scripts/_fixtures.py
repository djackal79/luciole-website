"""Shared helpers for the mock scripts: synthetic clips and GSPro payloads."""

from __future__ import annotations

import random
import shutil
import struct
import subprocess
from pathlib import Path
from typing import Any

#: Ball/club numbers a decent amateur would post, before jitter.
CLUB_PROFILES: dict[str, dict[str, float]] = {
    "DR": {
        "ball_speed": 152.0, "club_speed": 103.0, "vla": 13.4, "back_spin": 2650,
        "path": 1.2, "face": 1.8, "aoa": 2.1, "loft": 13.9,
    },
    "5I": {
        "ball_speed": 128.0, "club_speed": 88.0, "vla": 15.1, "back_spin": 5200,
        "path": -0.8, "face": -0.2, "aoa": -2.6, "loft": 20.4,
    },
    "7I": {
        "ball_speed": 118.0, "club_speed": 84.0, "vla": 17.6, "back_spin": 6600,
        "path": -1.4, "face": -0.9, "aoa": -3.8, "loft": 24.6,
    },
    "PW": {
        "ball_speed": 96.0, "club_speed": 74.0, "vla": 24.8, "back_spin": 9100,
        "path": -2.1, "face": -1.6, "aoa": -4.9, "loft": 43.2,
    },
}


def gspro_shot(
    club: str,
    rng: random.Random,
    *,
    shot_number: int = 1,
    contains_club_data: bool = True,
    device_id: str = "GolfSimMock",
) -> dict[str, Any]:
    """A GSPro Open Connect v1 shot frame, exactly as a monitor would send it."""
    profile = CLUB_PROFILES[club]

    def jitter(value: float, pct: float) -> float:
        return round(value * rng.uniform(1 - pct, 1 + pct), 2)

    back_spin = jitter(profile["back_spin"], 0.08)
    side_spin = round(rng.uniform(-900, 900), 1)
    total_spin = round((back_spin**2 + side_spin**2) ** 0.5, 1)
    spin_axis = round(rng.uniform(-14, 14), 1)
    face = round(profile["face"] + rng.uniform(-1.5, 1.5), 2)
    path = round(profile["path"] + rng.uniform(-1.5, 1.5), 2)

    payload: dict[str, Any] = {
        "DeviceID": device_id,
        "Units": "Yards",
        "ShotNumber": shot_number,
        "APIversion": "1",
        "BallData": {
            "Speed": jitter(profile["ball_speed"], 0.04),
            "SpinAxis": spin_axis,
            "TotalSpin": total_spin,
            "BackSpin": back_spin,
            "SideSpin": side_spin,
            "HLA": round(face * 0.75 + path * 0.25, 2),
            "VLA": jitter(profile["vla"], 0.06),
        },
        "ShotDataOptions": {
            "ContainsBallData": True,
            "ContainsClubData": contains_club_data,
            "LaunchMonitorIsReady": True,
            "LaunchMonitorBallDetected": True,
            "IsHeartBeat": False,
        },
    }
    if contains_club_data:
        payload["ClubData"] = {
            "Speed": jitter(profile["club_speed"], 0.03),
            "AngleOfAttack": round(profile["aoa"] + rng.uniform(-0.8, 0.8), 2),
            "FaceToTarget": face,
            "Lie": 0.0,
            "Loft": profile["loft"],
            "Path": path,
            "SpeedAtImpact": jitter(profile["club_speed"], 0.03),
            "VerticalFaceImpact": 0.0,
            "HorizontalFaceImpact": 0.0,
            "ClosureRate": round(rng.uniform(-40, 40), 1),
        }
    return payload


def gspro_heartbeat(device_id: str = "GolfSimMock") -> dict[str, Any]:
    """Monitors send these between shots; they must not create a shot."""
    return {
        "DeviceID": device_id,
        "Units": "Yards",
        "ShotNumber": 0,
        "APIversion": "1",
        "ShotDataOptions": {
            "ContainsBallData": False,
            "ContainsClubData": False,
            "LaunchMonitorIsReady": True,
            "LaunchMonitorBallDetected": False,
            "IsHeartBeat": True,
        },
    }


def _stub_mp4(size_bytes: int) -> bytes:
    """A valid ftyp/mdat skeleton with no real video payload.

    Enough for ingest, probing and range serving; not playable. Used when
    ffmpeg is unavailable.
    """
    ftyp = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41"
    payload_size = max(size_bytes - len(ftyp) - 8, 8)
    return ftyp + struct.pack(">I", payload_size + 8) + b"mdat" + b"\x00" * payload_size


def make_clip(
    destination: Path,
    *,
    seconds: float = 2.0,
    container_fps: int = 30,
    size: str = "640x480",
    label: str = "clip",
    target_bytes: int = 128 * 1024,
) -> Path:
    """Write a test clip, using ffmpeg for a real one when it is installed.

    ``container_fps`` is the *container* rate, matching how the phone writes
    240 fps footage into a 30 fps container.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    if shutil.which("ffmpeg"):
        command = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi",
            # testsrc burns in a frame counter, which is what you want when
            # eyeballing the Build 2 frame alignment.
            "-i", f"testsrc=size={size}:rate={container_fps}:duration={seconds}",
            "-pix_fmt", "yuv420p",
            "-metadata", f"title={label}",
            str(destination),
        ]
        if subprocess.run(command, capture_output=True, check=False).returncode == 0:
            if destination.exists():
                return destination
    destination.write_bytes(_stub_mp4(target_bytes))
    return destination
