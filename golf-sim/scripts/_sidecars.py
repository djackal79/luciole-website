"""Synthetic pose and pressure sidecars for the v1.1 fixtures.

These exist so the biomechanics and pressure-mat panels can be built against
the real data *shape* long before a pose pipeline runs or the plates are
soldered. The numbers are plausible, not real: the golfer is a parametric
articulated model, not a capture.

Both sidecars timestamp relative to their own capture start and carry their own
``impact_ms``, so the frontend maps to the master timeline the same way for
both: ``t_from_impact = t_ms - impact_ms``.
"""

from __future__ import annotations

import math
from typing import Any

SIDECAR_SCHEMA_VERSION = "1.1"

#: MediaPipe Pose landmark order. The pipeline emits these indices, so the
#: fixtures must use the same order or the frontend will wire up a skeleton
#: that works on mocks and breaks on real data.
MEDIAPIPE_LANDMARKS = [
    "nose",
    "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear",
    "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_pinky", "right_pinky",
    "left_index", "right_index",
    "left_thumb", "right_thumb",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
    "left_heel", "right_heel",
    "left_foot_index", "right_foot_index",
]


def _smoothstep(a: float, b: float, f: float) -> float:
    f = min(max(f, 0.0), 1.0)
    return a + (b - a) * f * f * (3.0 - 2.0 * f)


def _interp(t_ms: float, keys: list[tuple[float, float]]) -> float:
    """Smoothstep between keyframes, clamped at both ends."""
    if t_ms <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t_ms <= t1:
            span = t1 - t0
            return _smoothstep(v0, v1, 0.0 if span <= 0 else (t_ms - t0) / span)
    return keys[-1][1]


def _swing_state(t_ms: float, impact_ms: float, duration_ms: float) -> dict[str, float]:
    """Where the golfer is at ``t_ms``, from named keyframes.

    Keyframed rather than computed from a single phase scalar, because a
    scalar cannot distinguish address from impact -- both are "square" -- and
    a swing that starts at the top of the backswing looks obviously wrong.

    ``turn`` is trunk rotation: 0 square, -1 at the top, +1 at the finish.
    ``trail_pct`` is the weight on the trail foot.
    """
    top_ms = max(impact_ms * 0.45, impact_ms - 900.0)
    takeaway_ms = top_ms * 0.35
    finish_ms = min(duration_ms, impact_ms + 600.0)

    turn = _interp(t_ms, [
        (0.0, 0.0),            # address, square
        (takeaway_ms, -0.15),  # takeaway
        (top_ms, -1.0),        # top of the backswing
        (impact_ms, 0.0),      # square again through impact
        (finish_ms, 1.0),      # finish
    ])
    trail_pct = _interp(t_ms, [
        (0.0, 52.0),           # address, near enough balanced
        (top_ms, 75.0),        # loaded into the trail foot
        (impact_ms, 45.0),     # already transferring at impact
        (finish_ms, 22.0),     # finished on the lead side
    ])
    return {"turn": turn, "trail_pct": trail_pct}


def _pose_frame(turn: float, hand_swing: float) -> list[list[float]]:
    """One frame of normalised image coordinates, [x, y, visibility].

    A crude articulated model: the trunk rotates with the swing, the arms
    trail it, and the head stays put. Enough to animate believably and to
    exercise a skeleton renderer.
    """
    lean = 0.04 * turn

    cx, shoulder_y, hip_y = 0.5, 0.36, 0.56
    shoulder_half = 0.085 * (1.0 - 0.35 * abs(turn))
    hip_half = 0.065 * (1.0 - 0.20 * abs(turn))

    # Hands swing through a wide arc around the trunk.
    hand_angle = math.pi * (0.5 + 0.85 * hand_swing)
    hand_x = cx + 0.20 * math.cos(hand_angle) - lean
    hand_y = 0.52 - 0.26 * math.sin(hand_angle)

    def point(x: float, y: float, vis: float = 0.95) -> list[float]:
        return [round(min(max(x, 0.0), 1.0), 4), round(min(max(y, 0.0), 1.0), 4), vis]

    head_x = cx - lean * 0.5
    left_shoulder = (cx - shoulder_half - lean, shoulder_y)
    right_shoulder = (cx + shoulder_half - lean, shoulder_y)
    left_hip = (cx - hip_half, hip_y)
    right_hip = (cx + hip_half, hip_y)

    # Elbows sit between shoulder and hands.
    def between(a: tuple[float, float], b: tuple[float, float], f: float):
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)

    left_elbow = between(left_shoulder, (hand_x, hand_y), 0.5)
    right_elbow = between(right_shoulder, (hand_x, hand_y), 0.5)

    frame: dict[str, list[float]] = {
        "nose": point(head_x, 0.20),
        "left_eye_inner": point(head_x - 0.012, 0.185),
        "left_eye": point(head_x - 0.020, 0.185),
        "left_eye_outer": point(head_x - 0.028, 0.185),
        "right_eye_inner": point(head_x + 0.012, 0.185),
        "right_eye": point(head_x + 0.020, 0.185),
        "right_eye_outer": point(head_x + 0.028, 0.185),
        "left_ear": point(head_x - 0.038, 0.195),
        "right_ear": point(head_x + 0.038, 0.195),
        "mouth_left": point(head_x - 0.015, 0.222),
        "mouth_right": point(head_x + 0.015, 0.222),
        "left_shoulder": point(*left_shoulder),
        "right_shoulder": point(*right_shoulder),
        "left_elbow": point(*left_elbow, 0.88),
        "right_elbow": point(*right_elbow, 0.88),
        "left_wrist": point(hand_x - 0.012, hand_y, 0.90),
        "right_wrist": point(hand_x + 0.012, hand_y, 0.90),
        "left_pinky": point(hand_x - 0.020, hand_y + 0.012, 0.70),
        "right_pinky": point(hand_x + 0.020, hand_y + 0.012, 0.70),
        "left_index": point(hand_x - 0.016, hand_y + 0.018, 0.70),
        "right_index": point(hand_x + 0.016, hand_y + 0.018, 0.70),
        "left_thumb": point(hand_x - 0.008, hand_y + 0.014, 0.65),
        "right_thumb": point(hand_x + 0.008, hand_y + 0.014, 0.65),
        "left_hip": point(*left_hip),
        "right_hip": point(*right_hip),
        "left_knee": point(cx - 0.060, 0.74, 0.92),
        "right_knee": point(cx + 0.060, 0.74, 0.92),
        "left_ankle": point(cx - 0.070, 0.90, 0.90),
        "right_ankle": point(cx + 0.070, 0.90, 0.90),
        "left_heel": point(cx - 0.076, 0.925, 0.80),
        "right_heel": point(cx + 0.076, 0.925, 0.80),
        "left_foot_index": point(cx - 0.050, 0.945, 0.80),
        "right_foot_index": point(cx + 0.050, 0.945, 0.80),
    }
    return [frame[name] for name in MEDIAPIPE_LANDMARKS]


def build_pose_track(
    *,
    camera: str = "face_on",
    fps: float = 30.0,
    duration_ms: int = 4000,
    impact_ms: int = 2450,
    width: int = 1280,
    height: int = 720,
) -> dict[str, Any]:
    """One camera's landmark track."""
    step_ms = 1000.0 / fps
    frames = []
    t = 0.0
    while t <= duration_ms:
        state = _swing_state(t, impact_ms, duration_ms)
        frames.append(
            {
                "t_ms": int(round(t)),
                # Hands trail the trunk slightly, which is what gives the arc
                # its lag rather than the arms moving with the shoulders.
                "points": _pose_frame(state["turn"], state["turn"] * 0.92),
            }
        )
        t += step_ms

    return {
        "camera": camera,
        "fps": fps,
        "width": width,
        "height": height,
        "impact_ms": impact_ms,
        "frame_count": len(frames),
        "frames": frames,
    }


def build_pose(
    *,
    cameras: dict[str, str] | None = None,
    impact_ms: int = 2450,
    duration_ms: int = 4000,
) -> dict[str, Any]:
    """A 2D pose file, as monocular MediaPipe produces it.

    Keyed by media source rather than carrying one camera, because two Kinovea
    cameras run and the player draws a skeleton over each view. It is also
    where a triangulated ``world`` track will sit once the cameras are
    calibrated.
    """
    cameras = cameras or {"body_swing": "face_on"}
    rates = {"body_swing": 30.0, "body_swing_dtl": 60.0}

    return {
        "schema_version": SIDECAR_SCHEMA_VERSION,
        "model": "mediapipe_pose_lite",
        # 2D: normalised image coordinates in [0,1], origin top-left, plus a
        # visibility score. 3D would be metres in a world frame.
        "dimensions": "2d",
        "coordinate_space": "normalised_image",
        "point_format": ["x", "y", "visibility"],
        "landmarks": MEDIAPIPE_LANDMARKS,
        "tracks": {
            source: build_pose_track(
                camera=camera,
                fps=rates.get(source, 30.0),
                duration_ms=duration_ms,
                impact_ms=impact_ms,
            )
            for source, camera in cameras.items()
        },
    }


def build_pressure(
    *,
    sample_rate_hz: float = 100.0,
    duration_ms: int = 4000,
    impact_ms: int = 2450,
    peak_grf_n: float = 750.0,
) -> dict[str, Any]:
    """A dual-plate capture: weight shifting trail to lead through impact."""
    step_ms = 1000.0 / sample_rate_hz
    samples = []
    t = 0.0
    while t <= duration_ms:
        state = _swing_state(t, impact_ms, duration_ms)
        trail_pct = state["trail_pct"]
        lead_pct = 100.0 - trail_pct

        # Vertical force peaks just before impact as the ground is pushed.
        # Coefficients sum to 1.0 so the peak equals peak_grf_n rather than
        # overshooting it.
        from_impact = (t - impact_ms) / 1000.0
        grf = peak_grf_n * (0.78 + 0.22 * math.exp(-((from_impact + 0.12) ** 2) / 0.05))

        # Centre of pressure tracks the transfer, in mm from mat centre.
        cop_x = -60.0 + 118.0 * (lead_pct / 100.0)
        cop_y = 6.0 * state["turn"]

        samples.append(
            {
                "t_ms": int(round(t)),
                "trail_pct": round(trail_pct, 2),
                "lead_pct": round(lead_pct, 2),
                "grf_n": round(grf, 1),
                "cop": {"x_mm": round(cop_x, 2), "y_mm": round(cop_y, 2)},
            }
        )
        t += step_ms

    at_impact = min(samples, key=lambda s: abs(s["t_ms"] - impact_ms))
    xs = [s["cop"]["x_mm"] for s in samples]

    return {
        "schema_version": SIDECAR_SCHEMA_VERSION,
        # Self-built plates, so the device string is ours, not a vendor's.
        "device": "custom_dual_plate",
        "sample_rate_hz": sample_rate_hz,
        "units": {"force": "N", "position": "mm", "time": "ms"},
        "impact_ms": impact_ms,
        "sample_count": len(samples),
        "samples": samples,
        "summary": {
            "peak_grf_n": round(max(s["grf_n"] for s in samples), 1),
            "trail_pct_at_impact": at_impact["trail_pct"],
            "lead_pct_at_impact": at_impact["lead_pct"],
            "cop_excursion_mm": round(max(xs) - min(xs), 1),
        },
    }
