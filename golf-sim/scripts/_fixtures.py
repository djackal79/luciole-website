"""Shared helpers for the mock scripts: synthetic clips and GSPro payloads."""

from __future__ import annotations

import math
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


#: Joints of a crude golfer, in the frame's own normalised coordinates.
#: A neck and arms held clear of the torso are not decoration -- without them
#: the silhouette is one blob and MediaPipe does not fire on it at all.
_FIGURE = {
    "head": (0.500, 0.248), "neck": (0.500, 0.314),
    "l_sh": (0.459, 0.339), "r_sh": (0.541, 0.339),
    "l_el": (0.433, 0.442), "r_el": (0.567, 0.442),
    "l_wr": (0.444, 0.510), "r_wr": (0.556, 0.510),
    "l_hip": (0.470, 0.500), "r_hip": (0.530, 0.500),
    "l_kn": (0.467, 0.655), "r_kn": (0.533, 0.655),
    "l_an": (0.465, 0.812), "r_an": (0.535, 0.812),
}
_BONES = [("neck","l_sh"),("neck","r_sh"),("l_sh","r_sh"),("l_sh","l_el"),
          ("l_el","l_wr"),("r_sh","r_el"),("r_el","r_wr"),("l_sh","l_hip"),
          ("r_sh","r_hip"),("l_hip","r_hip"),("l_hip","l_kn"),("l_kn","l_an"),
          ("r_hip","r_kn"),("r_kn","r_an")]

#: Fractions of frame height. Tuned against the detector, not eyeballed --
#: a thinner figure is not detected at all.
_LIMB = 0.031
_HEAD = 0.036


def _write_golfer_clip(destination, seconds, container_fps, size) -> bool:
    """A figure MediaPipe will actually detect, swinging.

    ffmpeg's testsrc is decodable but contains no person, so a mock session
    could never exercise the pose pipeline -- extraction would run, find
    nobody, and report failure. That left pose and 3D as the only part of the
    chain untestable without going to the bay. Drawn with OpenCV, which the
    pose extras already install, so this needs nothing extra.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return False

    width, height = (int(v) for v in size.split("x"))
    writer = cv2.VideoWriter(
        str(destination), cv2.VideoWriter_fourcc(*"mp4v"), container_fps, (width, height)
    )
    if not writer.isOpened():
        return False

    total = max(1, int(round(seconds * container_fps)))
    for index in range(total):
        # Shoulders and arms swing through a turn; hips and legs stay put.
        phase = math.sin(2 * math.pi * index / total)
        frame = np.full((height, width, 3), 205, np.uint8)
        pixels = {}
        for name, (x, y) in _FIGURE.items():
            if name in ("l_sh", "r_sh", "l_el", "r_el", "l_wr", "r_wr", "neck", "head"):
                # Enough motion that interpolation and frame alignment are
                # exercised, little enough that the figure stays detectable --
                # a big swing deforms it until MediaPipe loses it entirely.
                x += 0.022 * phase * (1.0 if name.startswith("r") else -1.0)
                if name in ("l_wr", "r_wr", "l_el", "r_el"):
                    y -= 0.045 * abs(phase)
            pixels[name] = (int(x * width), int(y * height))
        for a, b in _BONES:
            cv2.line(frame, pixels[a], pixels[b], (45, 45, 45),
                     max(6, round(height * _LIMB)), cv2.LINE_AA)
        cv2.circle(frame, pixels["head"], max(8, round(height * _HEAD)),
                   (45, 45, 45), -1, cv2.LINE_AA)
        writer.write(frame)
    writer.release()
    return destination.exists() and destination.stat().st_size > 1024


def make_clip(
    destination: Path,
    *,
    seconds: float = 2.0,
    container_fps: int = 30,
    size: str = "640x480",
    label: str = "clip",
    target_bytes: int = 128 * 1024,
    golfer: bool = False,
) -> Path:
    """Write a test clip, using ffmpeg for a real one when it is installed.

    ``container_fps`` is the *container* rate, matching how the phone writes
    240 fps footage into a 30 fps container.

    ``golfer`` draws a detectable figure instead of a test pattern, so a mock
    session exercises pose extraction rather than stopping at "no golfer
    detected". Use it for the body-swing cameras.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    if golfer and _write_golfer_clip(destination, seconds, container_fps, size):
        return destination
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
