"""Turn two 2D landmark tracks into 3D world points.

Two problems have to be solved before triangulation is even meaningful:

1. **The cameras are not synchronised.** They run at different rates (30 and
   60 fps here), started independently. Each track carries its own
   ``impact_ms``, so both are re-expressed relative to the strike and the
   slower track is interpolated onto the faster one's instants. Triangulating
   frames that are not the same moment produces confident nonsense.

2. **Landmarks go missing.** MediaPipe drops points behind the body or through
   motion blur. A point is only triangulated when both views actually saw it.

Every 3D point carries its reprojection error, so a bad solve is visible
rather than silently wrong.

One caveat worth stating plainly, because it cost a debugging session: with
the cameras 90 degrees apart, **reprojection error is blind to bad time
alignment**. Face-on fixes X and Z, down-the-line fixes Y, so almost any
(X, Y) pair satisfies both rays -- feeding the two views different instants
of the swing reprojects at well under a pixel while producing a body angle
tens of degrees wrong. Measured here: a 50 ms skew turned a real 90 degree
shoulder turn into 61 degrees at 0.4 px of reprojection error.

So alignment is enforced rather than checked. Both tracks must carry a real
``impact_ms``; triangulation refuses to run otherwise, instead of quietly
lining impact up against the start of the other clip.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from .calibration import Calibration
from .landmarks import INDEX, MEDIAPIPE_LANDMARKS

log = logging.getLogger(__name__)

#: Below this visibility a landmark is treated as unseen.
MIN_VISIBILITY = 0.5

#: Reprojection error above this means the two views disagree about where the
#: point is; the 3D estimate is not trustworthy and is dropped.
MAX_REPROJECTION_PX = 25.0

#: How far a track may be interpolated across a gap before the result is
#: guesswork rather than interpolation.
MAX_INTERP_GAP_MS = 60.0


@dataclass
class Frame3D:
    t_ms: float
    #: [x, y, z, error_px] per landmark; None where it could not be solved.
    points: list[list[float] | None]

    @property
    def solved(self) -> int:
        return sum(1 for point in self.points if point is not None)


def _relative(track: dict[str, Any]) -> list[tuple[float, list]]:
    """Frames re-expressed as milliseconds from impact.

    The caller guarantees ``impact_ms`` is present -- defaulting it to zero
    here would align one camera's impact against the other's first frame.
    """
    offset = float(track["impact_ms"])
    return [(frame["t_ms"] - offset, frame["points"]) for frame in track["frames"]]


def _interpolate(
    frames: list[tuple[float, list]], t_ms: float, landmark: int
) -> list[float] | None:
    """One landmark at an arbitrary instant, linearly between neighbours."""
    if not frames:
        return None

    before = after = None
    for time, points in frames:
        if time <= t_ms:
            before = (time, points)
        else:
            after = (time, points)
            break

    def usable(entry) -> bool:
        return entry is not None and entry[1][landmark][2] >= MIN_VISIBILITY

    if before is not None and abs(before[0] - t_ms) < 1e-6:
        return before[1][landmark] if usable(before) else None
    if not usable(before) or not usable(after):
        return None
    if after[0] - before[0] > MAX_INTERP_GAP_MS:
        # Too wide a gap to interpolate honestly -- at 60 fps this is four
        # missing frames, over which a clubhead moves a long way.
        return None

    span = after[0] - before[0]
    fraction = 0.0 if span <= 0 else (t_ms - before[0]) / span
    start, end = before[1][landmark], after[1][landmark]
    return [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
        min(start[2], end[2]),
    ]


def triangulate_tracks(
    tracks: dict[str, dict[str, Any]], calibration: Calibration
) -> list[Frame3D] | None:
    """3D world points per instant, driven by the higher-rate camera.

    Returns ``None`` when fewer than two calibrated cameras have tracks.
    """
    import cv2
    import numpy as np

    usable = [
        name
        for name in calibration.triangulable
        if name in tracks and tracks[name].get("frames")
    ]
    if len(usable) < 2:
        log.info("triangulation needs two calibrated tracks, have %d", len(usable))
        return None

    unaligned = [name for name in usable[:2] if tracks[name].get("impact_ms") is None]
    if unaligned:
        # Without impact on both clips there is no shared clock: the two
        # cameras started recording independently. See the module docstring --
        # a guess here reprojects cleanly and reads tens of degrees wrong.
        log.warning(
            "no impact_ms on %s; refusing to triangulate against an unknown "
            "time offset. Set IMPACT_MS in the Kinovea hook for each camera "
            "(the capture trigger's pre-roll) to enable 3D.",
            ", ".join(unaligned),
        )
        return None

    # Drive off whichever camera sampled fastest; the other is interpolated.
    primary, secondary = sorted(
        usable[:2], key=lambda n: -float(tracks[n].get("fps") or 0)
    )
    log.info("triangulating %s (primary) against %s", primary, secondary)

    cam_a = calibration.cameras[primary]
    cam_b = calibration.cameras[secondary]
    proj_a, proj_b = cam_a.projection(), cam_b.projection()
    width_a, height_a = cam_a.image_size
    width_b, height_b = cam_b.image_size

    frames_a = _relative(tracks[primary])
    frames_b = _relative(tracks[secondary])

    output: list[Frame3D] = []
    for t_ms, points_a in frames_a:
        solved: list[list[float] | None] = []
        for index in range(len(MEDIAPIPE_LANDMARKS)):
            point_a = points_a[index]
            if point_a[2] < MIN_VISIBILITY:
                solved.append(None)
                continue
            point_b = _interpolate(frames_b, t_ms, index)
            if point_b is None:
                solved.append(None)
                continue

            # Normalised coordinates back to pixels, which is what the camera
            # matrices are expressed in.
            pixel_a = np.array([[point_a[0] * width_a], [point_a[1] * height_a]])
            pixel_b = np.array([[point_b[0] * width_b], [point_b[1] * height_b]])

            homogeneous = cv2.triangulatePoints(proj_a, proj_b, pixel_a, pixel_b)
            if abs(homogeneous[3, 0]) < 1e-9:
                solved.append(None)
                continue
            world = (homogeneous[:3, 0] / homogeneous[3, 0]).astype(float)

            error = _reprojection_error(world, proj_a, pixel_a, proj_b, pixel_b)
            if error > MAX_REPROJECTION_PX:
                solved.append(None)
                continue
            solved.append([round(float(v), 5) for v in world] + [round(error, 2)])

        output.append(Frame3D(t_ms=t_ms, points=solved))

    detected = sum(frame.solved for frame in output)
    log.info(
        "triangulated %d frames, %d landmark solutions (%.0f%% of possible)",
        len(output), detected,
        100.0 * detected / max(1, len(output) * len(MEDIAPIPE_LANDMARKS)),
    )
    return output


def _reprojection_error(world, proj_a, pixel_a, proj_b, pixel_b) -> float:
    """Mean pixel disagreement between the two views. The honesty check."""
    import numpy as np

    point = np.array([world[0], world[1], world[2], 1.0])
    errors = []
    for projection, observed in ((proj_a, pixel_a), (proj_b, pixel_b)):
        projected = projection @ point
        if abs(projected[2]) < 1e-9:
            return float("inf")
        errors.append(
            float(
                np.hypot(
                    projected[0] / projected[2] - observed[0, 0],
                    projected[1] / projected[2] - observed[1, 0],
                )
            )
        )
    return sum(errors) / len(errors)


# ---------------------------------------------------------------------------
# The metrics 2D could not give
# ---------------------------------------------------------------------------


#: Triangulated shoulder and hip widths outside these bands are not an unusual
#: golfer -- they mean the reconstruction itself is wrong. The two ways that
#: happens in practice are a mistyped board square size (which scales the whole
#: world uniformly) and time-misaligned tracks (which stretch a segment as it
#: rotates). Both are invisible to reprojection error; a tape measure is not.
#: Bands are deliberately wide: they are here to catch a broken rig, not to
#: judge anyone's build.
PLAUSIBLE_WIDTH_M = {
    ("left_shoulder", "right_shoulder"): (0.28, 0.52),
    ("left_hip", "right_hip"): (0.18, 0.42),
}


def _implausible(frames: list[Frame3D]) -> str | None:
    """Why these 3D points cannot be a human, or None if they can be.

    Uses the median length across the swing: landmark jitter is zero-mean and
    barely moves it (under 2% at 8 px of noise, measured), while a scale error
    or a time skew biases every frame the same way.
    """
    import numpy as np

    for (left, right), (low, high) in PLAUSIBLE_WIDTH_M.items():
        lengths = [
            float(np.linalg.norm(segment))
            for frame in frames
            if (segment := _segment(frame, left, right)) is not None
        ]
        if len(lengths) < 3:
            continue
        median = float(np.median(lengths))
        if not low <= median <= high:
            return (
                f"{left.split('_')[1]} width triangulates to {median * 100:.0f} cm "
                f"(expected {low * 100:.0f}-{high * 100:.0f}); check the board "
                f"square size in the calibration and that both clips carry the "
                f"right impact frame"
            )
    return None


def _segment(frame: Frame3D, left: str, right: str):
    import numpy as np

    a = frame.points[INDEX[left]]
    b = frame.points[INDEX[right]]
    if a is None or b is None:
        return None
    return np.array(b[:3]) - np.array(a[:3])


def _rotation_deg(vector, reference) -> float | None:
    """Angle of a segment about the vertical, signed, in the ground plane."""
    import numpy as np

    flat = np.array([vector[0], vector[1], 0.0])
    base = np.array([reference[0], reference[1], 0.0])
    if np.linalg.norm(flat) < 1e-6 or np.linalg.norm(base) < 1e-6:
        return None
    flat /= np.linalg.norm(flat)
    base /= np.linalg.norm(base)
    angle = np.degrees(np.arctan2(np.cross(base, flat)[2], float(np.dot(base, flat))))
    return float(angle)


def summarise_3d(frames: list[Frame3D], impact_index: int | None = None) -> dict[str, float | None]:
    """Shoulder turn, pelvis rotation and X-factor at the top of the backswing.

    These are the three a single camera cannot recover, which is the whole
    reason for calibrating. Measured against each segment's own address
    orientation, so the golfer does not have to be square to the world frame.
    """
    summary: dict[str, float | None] = {
        "shoulder_turn_deg": None,
        "pelvis_rotation_deg": None,
        "x_factor_deg": None,
    }
    if not frames:
        return summary

    address = next(
        (
            f for f in frames
            if _segment(f, "left_shoulder", "right_shoulder") is not None
            and _segment(f, "left_hip", "right_hip") is not None
        ),
        None,
    )
    if address is None:
        return summary

    if (reason := _implausible(frames)) is not None:
        # The 3D track still gets written -- the skeleton is worth looking at
        # even when it is wrong, and seeing it wrong is how the rig gets fixed.
        # Only the derived angles are withheld, because a number is believed.
        log.warning("3D metrics withheld: %s", reason)
        return summary

    shoulder_ref = _segment(address, "left_shoulder", "right_shoulder")
    hip_ref = _segment(address, "left_hip", "right_hip")

    best_shoulder = best_pelvis = 0.0
    best_x = 0.0
    for frame in frames:
        shoulders = _segment(frame, "left_shoulder", "right_shoulder")
        hips = _segment(frame, "left_hip", "right_hip")
        if shoulders is None or hips is None:
            continue
        turn = _rotation_deg(shoulders, shoulder_ref)
        pelvis = _rotation_deg(hips, hip_ref)
        if turn is None or pelvis is None:
            continue
        # Peak backswing rotation, whichever direction the golfer turns.
        if abs(turn) > abs(best_shoulder):
            best_shoulder, best_pelvis = turn, pelvis
            best_x = turn - pelvis

    if best_shoulder == 0.0:
        return summary
    summary["shoulder_turn_deg"] = round(abs(best_shoulder), 1)
    summary["pelvis_rotation_deg"] = round(abs(best_pelvis), 1)
    summary["x_factor_deg"] = round(abs(best_x), 1)
    return summary
