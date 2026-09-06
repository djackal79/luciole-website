"""Camera calibration for triangulated 3D pose.

Two cameras roughly 90 degrees apart cannot be calibrated with OpenCV's
``stereoCalibrate``: it assumes a narrow baseline where both views see the same
flat board clearly, and at right angles one view is always near edge-on. It
converges to nonsense.

So each camera is solved **independently against a shared world frame**
instead. Put the board flat on the floor where both cameras can see it, take
one frame from each, and ``solvePnP`` gives each camera's pose relative to the
board. The board is the world, both poses share it, and triangulation follows
without either camera needing a clear view of anything the other sees.

Board flat on the floor also makes the world frame gravity-aligned, which is
what makes spine angle and pelvis rotation mean anything. The stored frame has
its origin at the board's first inner corner with Z up; see ``BOARD_TO_WORLD``
for why that is not simply the board's own frame.

The board is a **ChArUco** board -- a chessboard with a coded ArUco marker in
every white square -- rather than a plain chessboard, and that is not
decoration. ``findChessboardCorners`` returns corners in the order it walked
the *image*, and gives no guarantee about which physical corner it started
from: the result is unique only up to the pattern's own symmetry. One view can
come back numbered from one end of the board and another view from the other,
which is the same board described in two world frames 180 degrees apart.

For a single camera that would not matter. Here it is fatal: the two cameras
sit 90 degrees apart and photograph the same floor board from very different
angles, so they are exactly the case most likely to disagree -- and each one
still fits its own view perfectly, so reprojection error reports nothing while
triangulation between the two frames returns confident nonsense.

ArUco markers carry their own identity, so the origin is absolute and every
view agrees on it by construction. Two smaller benefits come along: a partly
occluded or partly out-of-frame board still calibrates from the markers it
does show, and the detector is far less fussy about lighting.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

CALIBRATION_SCHEMA_VERSION = "2.0"

#: Fewer matched corners than this and the pose is not worth solving.
MIN_CORNERS = 6

#: Board frame -> world frame, as a rotation about the board's X axis.
#:
#: OpenCV object frames follow the image convention -- X right, Y *down* -- so
#: the board's +Z points into the printed page, and a camera photographing the
#: print sits at negative board Z. Verified rather than assumed: a camera 1.5 m
#: square-on to the board solves to board Z = -1.5 m. With the board
#: printed-side-up on the floor that puts board +Z into the ground, which would
#: make "up" negative for every metric built on this frame. So each pose is
#: rotated by this before it is stored, and world Z is up from there on.
BOARD_TO_WORLD = ((1.0, 0.0, 0.0), (0.0, -1.0, 0.0), (0.0, 0.0, -1.0))


@dataclass
class Board:
    """A printed ChArUco board.

    ``squares_x``/``squares_y`` count SQUARES, not inner corners -- a 10x7
    board has 9x6 inner corners. Markers sit in the white squares and must be
    smaller than them; 0.75x the square is the usual ratio.

    Defaults describe a board that works at golf-bay distances: 150 mm squares
    over 10x7 is 1.5 x 1.05 m, which is a big print, but a board flat on the
    floor seen from a camera at chest height several metres away is
    foreshortened hard, and a small one simply will not be found.
    """

    squares_x: int = 10
    squares_y: int = 7
    square_mm: float = 150.0
    marker_mm: float = 110.0
    dictionary: str = "DICT_4X4_50"

    def __post_init__(self) -> None:
        if self.marker_mm >= self.square_mm:
            raise ValueError(
                f"marker ({self.marker_mm} mm) must be smaller than the square "
                f"({self.square_mm} mm) -- it has to fit inside one"
            )

    @property
    def size_mm(self) -> tuple[float, float]:
        return (self.squares_x * self.square_mm, self.squares_y * self.square_mm)

    def cv(self):
        """The OpenCV board object."""
        import cv2

        dictionary = getattr(cv2.aruco, self.dictionary, None)
        if dictionary is None:
            raise ValueError(f"unknown ArUco dictionary {self.dictionary!r}")
        return cv2.aruco.CharucoBoard(
            (self.squares_x, self.squares_y),
            self.square_mm / 1000.0,
            self.marker_mm / 1000.0,
            cv2.aruco.getPredefinedDictionary(dictionary),
        )

    def detect(self, image):
        """Matched (object_points, image_points), or None if not found.

        Object points are in board metres with Z=0, and which corner is the
        origin is fixed by the markers rather than by the viewing angle.
        Partial views are fine -- only the corners actually seen come back.
        """
        import cv2

        detector = cv2.aruco.CharucoDetector(self.cv())
        corners, ids, _, _ = detector.detectBoard(image)
        if ids is None or len(ids) < MIN_CORNERS:
            return None
        object_points, image_points = self.cv().matchImagePoints(corners, ids)
        if object_points is None or len(object_points) < MIN_CORNERS:
            return None
        return object_points.reshape(-1, 1, 3), image_points.reshape(-1, 1, 2)

    def generate_image(self, px_per_mm: float = 4.0):
        """A printable image of this exact board."""
        width, height = self.size_mm
        return self.cv().generateImage(
            (int(round(width * px_per_mm)), int(round(height * px_per_mm)))
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "squares_x": self.squares_x,
            "squares_y": self.squares_y,
            "square_mm": self.square_mm,
            "marker_mm": self.marker_mm,
            "dictionary": self.dictionary,
        }


@dataclass
class CameraCalibration:
    """One camera: how it distorts, and where it sits in the world."""

    image_size: tuple[int, int]
    matrix: list[list[float]]
    distortion: list[float]
    #: RMS reprojection error of the intrinsic fit, in pixels. Above about 1.0
    #: means the captures were poor -- too few angles, or a blurry board.
    rms_px: float
    #: World -> camera. Absent until the camera has been placed.
    rotation: list[list[float]] | None = None
    translation: list[float] | None = None
    pose_rms_px: float | None = None

    @property
    def placed(self) -> bool:
        return self.rotation is not None and self.translation is not None

    def projection(self):
        """The 3x4 matrix that maps a world point to this camera's image."""
        import numpy as np

        if not self.placed:
            raise ValueError("camera has no world pose; run the placement step")
        rotation = np.array(self.rotation, dtype=np.float64)
        translation = np.array(self.translation, dtype=np.float64).reshape(3, 1)
        return np.array(self.matrix, dtype=np.float64) @ np.hstack([rotation, translation])

    def as_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "image_size": list(self.image_size),
            "matrix": self.matrix,
            "distortion": self.distortion,
            "rms_px": round(self.rms_px, 4),
        }
        if self.placed:
            data["rotation"] = self.rotation
            data["translation"] = self.translation
            data["pose_rms_px"] = (
                None if self.pose_rms_px is None else round(self.pose_rms_px, 4)
            )
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CameraCalibration":
        return cls(
            image_size=tuple(data["image_size"]),  # type: ignore[arg-type]
            matrix=data["matrix"],
            distortion=data["distortion"],
            rms_px=data["rms_px"],
            rotation=data.get("rotation"),
            translation=data.get("translation"),
            pose_rms_px=data.get("pose_rms_px"),
        )


@dataclass
class Calibration:
    """The whole rig: a board, and a camera per media source."""

    board: Board = field(default_factory=Board)
    cameras: dict[str, CameraCalibration] = field(default_factory=dict)
    created_at: str | None = None

    @property
    def triangulable(self) -> list[str]:
        """Sources with a world pose, so at least two means 3D is possible."""
        return sorted(name for name, cam in self.cameras.items() if cam.placed)

    @property
    def ready(self) -> bool:
        return len(self.triangulable) >= 2

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": CALIBRATION_SCHEMA_VERSION,
            "created_at": self.created_at,
            "board": self.board.as_dict(),
            "cameras": {name: cam.as_dict() for name, cam in self.cameras.items()},
        }

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(self.as_dict(), indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)

    @classmethod
    def load(cls, path: Path) -> "Calibration | None":
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("unreadable calibration at %s: %s", path, exc)
            return None
        try:
            board = Board(**data.get("board", {}))
        except TypeError:
            # A pre-ChArUco file (schema 1.x described a plain chessboard by
            # cols/rows). Its camera poses were solved against a board with no
            # reliable origin, so they cannot be carried forward.
            log.warning(
                "%s was written by an older calibration format; recalibrate "
                "with scripts/calibrate_cameras.py", path,
            )
            return None
        return cls(
            board=board,
            cameras={
                name: CameraCalibration.from_dict(entry)
                for name, entry in (data.get("cameras") or {}).items()
            },
            created_at=data.get("created_at"),
        )


# ---------------------------------------------------------------------------
# Solving
# ---------------------------------------------------------------------------


def calibrate_intrinsics(images, board: Board) -> CameraCalibration:
    """Lens parameters, from several views of the board at varied angles.

    Varied angles is the part people get wrong: a dozen shots of the board
    parallel to the sensor cannot separate focal length from distance, and the
    fit will be confidently wrong.
    """
    import cv2
    import numpy as np

    object_points, image_points = [], []
    size: tuple[int, int] | None = None

    for image in images:
        matched = board.detect(image)
        if matched is None:
            continue
        height, width = image.shape[:2]
        size = (width, height)
        object_points.append(matched[0])
        image_points.append(matched[1])

    if len(object_points) < 5 or size is None:
        raise ValueError(
            f"need at least 5 usable board views, found {len(object_points)}"
        )

    rms, matrix, distortion, _, _ = cv2.calibrateCamera(
        object_points, image_points, size, None, None
    )
    log.info("intrinsics from %d views, RMS %.3f px", len(object_points), rms)
    return CameraCalibration(
        image_size=size,
        matrix=np.asarray(matrix).tolist(),
        distortion=np.asarray(distortion).ravel().tolist(),
        rms_px=float(rms),
    )


def place_camera(camera: CameraCalibration, image, board: Board) -> CameraCalibration:
    """Solve where this camera sits, from one view of the board in the world.

    Every camera placed against the *same* physical board position ends up in
    the same world frame, which is what makes triangulation possible without
    the two views having to see each other's scene.
    """
    matched = board.detect(image)
    if matched is None:
        raise ValueError(
            f"board not found, or fewer than {MIN_CORNERS} corners matched"
        )
    return solve_pose(camera, *matched)


def solve_pose(camera: CameraCalibration, object_points, image_points) -> CameraCalibration:
    """The pose solve, given matched board corners.

    Split out from ``place_camera`` so it can be exercised on exact projected
    points, with no dependence on how detectable a rendered board happens to be.

    The markers fix which corner is the board's origin, so the only ambiguity
    left is the ordinary planar tilt pair, which IPPE returns explicitly and
    reprojection error usually separates. Where it does not -- the two can come
    out close on a near-degenerate view -- physics does: the board lies
    printed-side-up on the floor, so a solution placing the camera underneath
    it is not a worse fit, it is an impossible one, and is dropped rather than
    allowed to win on a hair of reprojection error.

    The pose is stored in the Z-up world frame, not the board's own frame; see
    ``BOARD_TO_WORLD``.
    """
    import cv2
    import numpy as np

    matrix = np.array(camera.matrix, dtype=np.float64)
    distortion = np.array(camera.distortion, dtype=np.float64)
    to_world = np.array(BOARD_TO_WORLD, dtype=np.float64)

    # IPPE is the right solver for a planar target and returns the tilt pair
    # explicitly. It degenerates when the board is dead square to the sensor,
    # though, so SQPNP is asked as well and the candidates pooled -- otherwise
    # a camera looking straight down at the board has no valid answer at all.
    candidates = []
    for flag in (cv2.SOLVEPNP_IPPE, cv2.SOLVEPNP_SQPNP):
        try:
            count, rvecs, tvecs, errors = cv2.solvePnPGeneric(
                object_points, image_points, matrix, distortion, flags=flag
            )
        except cv2.error:
            continue
        for index in range(count):
            rotation = np.asarray(cv2.Rodrigues(rvecs[index])[0]) @ to_world
            centre = (-rotation.T @ np.asarray(tvecs[index])).ravel()
            candidates.append(
                (float(np.ravel(errors[index])[0]), centre, rotation, tvecs[index])
            )

    if not candidates:
        raise ValueError("could not solve the camera pose")

    # World Z is up out of the floor, so a real camera has a positive height.
    above = [c for c in candidates if c[1][2] > 0]
    if not above:
        raise ValueError(
            "every pose solution puts the camera below the floor. The board "
            "must be printed-side-up and flat, and fully inside the frame."
        )

    error, centre, rotation, tvec = min(above, key=lambda c: c[0])
    camera.rotation = np.asarray(rotation).tolist()
    camera.translation = np.asarray(tvec).ravel().tolist()
    camera.pose_rms_px = error
    log.info(
        "camera placed %.2f m from the board origin, %.2f m up, "
        "from %d corners, pose RMS %.3f px",
        float(np.linalg.norm(centre)), float(centre[2]), len(object_points), error,
    )
    return camera


def camera_position(camera: CameraCalibration):
    """Where this camera sits in world metres, Z up. The number to tape-measure."""
    import numpy as np

    if not camera.placed:
        return None
    rotation = np.array(camera.rotation, dtype=np.float64)
    translation = np.array(camera.translation, dtype=np.float64).reshape(3, 1)
    return (-rotation.T @ translation).ravel()
