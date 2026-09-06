"""Swing metrics derived from 2D landmark tracks.

What is honestly recoverable from monocular pose, and what is not:

* **Swing plane** and **spine angle** come from the down-the-line view. They
  are angles in the image plane, and DTL is the view where the swing plane and
  forward bend actually lie in that plane.
* **Shoulder turn, pelvis rotation and X-factor** need depth. A single camera
  cannot recover them, and a plausible-looking guess is worse than an
  em-dash — they stay null until the cameras are calibrated and triangulated.
* **Hand speed** needs a real-world scale. Normalised image coordinates have
  none, so it stays null too.

Face-on shows lateral tilt and sway rather than plane or forward bend, so it
contributes no summary metric yet.
"""

from __future__ import annotations

import logging
import math
from typing import Any

from .landmarks import INDEX

log = logging.getLogger(__name__)

#: Below this, the model lost the golfer often enough that the geometry is
#: not worth reporting.
MIN_DETECTION_RATE = 0.6

#: Landmarks below this visibility are treated as absent.
MIN_VISIBILITY = 0.5

#: Frames averaged at the start of the clip to establish the address posture.
ADDRESS_FRAMES = 8


def summarise(tracks: dict[str, Any]) -> dict[str, float | None]:
    """Build the ``pose.summary`` block from whatever tracks exist."""
    summary: dict[str, float | None] = {
        "swing_plane_deg": None,
        "spine_angle_deg": None,
        "shoulder_turn_deg": None,   # needs two calibrated views
        "pelvis_rotation_deg": None, # needs two calibrated views
        "x_factor_deg": None,        # shoulder_turn - pelvis_rotation
        "hand_speed_mph": None,      # needs a real-world scale
    }

    dtl = tracks.get("body_swing_dtl")
    if dtl is None:
        log.info("no down-the-line track; swing plane and spine angle unavailable")
        return summary
    if dtl.detection_rate < MIN_DETECTION_RATE:
        log.warning(
            "down-the-line detection rate %.0f%% below %.0f%%; skipping metrics",
            dtl.detection_rate * 100, MIN_DETECTION_RATE * 100,
        )
        return summary

    aspect = _aspect(dtl)
    summary["swing_plane_deg"] = _swing_plane(dtl, aspect)
    summary["spine_angle_deg"] = _spine_angle(dtl, aspect)
    return summary


def _aspect(track: Any) -> float:
    """Pixels-per-normalised-unit ratio, x over y.

    Normalised coordinates run 0-1 on both axes, but the frame is not square.
    Measuring an angle without this correction on 1280x720 skews it by the
    16:9 ratio -- a 62 degree swing plane would read as 47.
    """
    if not track.width or not track.height:
        return 1.0
    return track.width / track.height


def _point(frame: dict[str, Any], name: str) -> tuple[float, float] | None:
    point = frame["points"][INDEX[name]]
    if point[2] < MIN_VISIBILITY:
        return None
    return point[0], point[1]


def _midpoint(frame: dict[str, Any], left: str, right: str) -> tuple[float, float] | None:
    a, b = _point(frame, left), _point(frame, right)
    if a is None or b is None:
        return None
    return (a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0


def _swing_plane(track: Any, aspect: float) -> float | None:
    """Angle of the downswing hand path from horizontal, in degrees.

    Fitted from the top of the backswing to impact, because that is the
    segment a swing plane describes -- including the takeaway would flatten it
    with a path the club never returns on.
    """
    hands = [
        (frame["t_ms"], _midpoint(frame, "left_wrist", "right_wrist"))
        for frame in track.frames
    ]
    hands = [(t, p) for t, p in hands if p is not None]
    if len(hands) < 6:
        return None

    impact_ms = track.impact_ms if track.impact_ms is not None else hands[-1][0]
    before = [(t, p) for t, p in hands if t <= impact_ms]
    if len(before) < 6:
        return None

    # Image y increases downward, so the top of the backswing is the minimum.
    top_index = min(range(len(before)), key=lambda i: before[i][1][1])
    downswing = before[top_index:]
    if len(downswing) < 3:
        return None

    points = [(p[0] * aspect, p[1]) for _, p in downswing]
    direction = _principal_direction(points)
    if direction is None:
        return None

    dx, dy = direction
    # Magnitudes: the plane's inclination is direction-agnostic.
    return round(math.degrees(math.atan2(abs(dy), abs(dx))), 1)


def _spine_angle(track: Any, aspect: float) -> float | None:
    """Forward tilt of the trunk at address, in degrees from vertical."""
    angles = []
    for frame in track.frames[:ADDRESS_FRAMES]:
        shoulders = _midpoint(frame, "left_shoulder", "right_shoulder")
        hips = _midpoint(frame, "left_hip", "right_hip")
        if shoulders is None or hips is None:
            continue
        dx = (shoulders[0] - hips[0]) * aspect
        dy = shoulders[1] - hips[1]  # negative: shoulders sit above hips
        if dx == 0 and dy == 0:
            continue
        angles.append(math.degrees(math.atan2(abs(dx), abs(dy))))

    if not angles:
        return None
    return round(sum(angles) / len(angles), 1)


def _principal_direction(
    points: list[tuple[float, float]]
) -> tuple[float, float] | None:
    """Dominant direction of a point cloud, by covariance eigenvector.

    Total least squares rather than fitting y on x: a steep swing plane
    approaches vertical, where ordinary regression diverges.
    """
    count = len(points)
    if count < 2:
        return None

    mean_x = sum(x for x, _ in points) / count
    mean_y = sum(y for _, y in points) / count

    sxx = sum((x - mean_x) ** 2 for x, _ in points) / count
    syy = sum((y - mean_y) ** 2 for _, y in points) / count
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in points) / count

    if sxx == 0 and syy == 0:
        return None

    # Larger eigenvalue of the 2x2 covariance matrix.
    trace, det = sxx + syy, sxx * syy - sxy * sxy
    disc = max(trace * trace / 4.0 - det, 0.0)
    eigenvalue = trace / 2.0 + math.sqrt(disc)

    if abs(sxy) > 1e-12:
        vx, vy = eigenvalue - syy, sxy
    else:
        vx, vy = (1.0, 0.0) if sxx >= syy else (0.0, 1.0)

    norm = math.hypot(vx, vy)
    return (vx / norm, vy / norm) if norm else None
