"""Calibration and triangulation, validated against synthetic geometry.

Known 3D points are projected through two virtual cameras 90 degrees apart,
then triangulated back. If the recovered points are not the originals, the
maths is wrong -- and this can be checked without a single real photograph.
"""

from __future__ import annotations

import json
import math

import numpy as np
import pytest

import cv2

from backend.pose.calibration import (
    BOARD_TO_WORLD,
    Board,
    Calibration,
    CameraCalibration,
    camera_position,
    place_camera,
    solve_pose,
)
from backend.pose.landmarks import INDEX, MEDIAPIPE_LANDMARKS
from backend.pose.triangulate import (
    MAX_REPROJECTION_PX,
    summarise_3d,
    triangulate_tracks,
)

WIDTH, HEIGHT = 1280, 720
FOCAL = 900.0


def synthetic_camera(position, target=(0.0, 0.0, 1.0), size=(WIDTH, HEIGHT)):
    """A camera at ``position`` looking at ``target``. World Z is up."""
    width, height = size
    position = np.array(position, dtype=float)
    forward = np.array(target, dtype=float) - position
    forward /= np.linalg.norm(forward)

    world_up = np.array([0.0, 0.0, 1.0])
    right = np.cross(forward, world_up)
    right /= np.linalg.norm(right)
    down = np.cross(forward, right)

    rotation = np.vstack([right, down, forward])          # world -> camera
    translation = -rotation @ position

    return CameraCalibration(
        image_size=(width, height),
        matrix=[[FOCAL, 0.0, width / 2], [0.0, FOCAL, height / 2], [0.0, 0.0, 1.0]],
        distortion=[0.0, 0.0, 0.0, 0.0, 0.0],
        rms_px=0.2,
        rotation=rotation.tolist(),
        translation=translation.tolist(),
        pose_rms_px=0.3,
    )


#: Face-on and down-the-line, the real rig, 90 degrees apart.
FACE_ON = synthetic_camera((0.0, -3.5, 1.4))
DTL = synthetic_camera((3.5, 0.0, 1.4))


def project(camera: CameraCalibration, world, noise_px=0.0, rng=None):
    """World point to normalised image coordinates."""
    point = np.array([world[0], world[1], world[2], 1.0])
    pixel = camera.projection() @ point
    x, y = pixel[0] / pixel[2], pixel[1] / pixel[2]
    if noise_px and rng is not None:
        x += rng.normal(0, noise_px)
        y += rng.normal(0, noise_px)
    width, height = camera.image_size
    return [x / width, y / height, 0.95]


def make_track(camera, skeletons, fps, impact_ms, noise_px=0.0, seed=1, size=(WIDTH, HEIGHT)):
    """A pose track for one camera from a sequence of 3D skeletons."""
    rng = np.random.default_rng(seed)
    step = 1000.0 / fps
    frames = []
    for i, skeleton in enumerate(skeletons):
        frames.append(
            {
                "t_ms": i * step,
                "points": [project(camera, p, noise_px, rng) for p in skeleton],
            }
        )
    return {
        "camera": "synthetic", "fps": fps, "width": size[0], "height": size[1],
        "impact_ms": impact_ms, "frame_count": len(frames), "frames": frames,
    }


def flat_skeleton(**overrides):
    """33 landmarks, all at a default position unless named."""
    points = [[0.0, 0.0, 1.0] for _ in MEDIAPIPE_LANDMARKS]
    for name, position in overrides.items():
        points[INDEX[name]] = list(position)
    return points


def rig():
    return Calibration(cameras={"body_swing": FACE_ON, "body_swing_dtl": DTL})


# ---- the round trip -------------------------------------------------------


def test_a_known_point_is_recovered_to_the_millimetre():
    truth = [0.12, -0.05, 1.35]
    skeleton = flat_skeleton(nose=truth)
    tracks = {
        "body_swing": make_track(FACE_ON, [skeleton], 30, 0),
        "body_swing_dtl": make_track(DTL, [skeleton], 60, 0),
    }
    frames = triangulate_tracks(tracks, rig())
    recovered = frames[0].points[INDEX["nose"]]
    assert recovered is not None
    assert np.allclose(recovered[:3], truth, atol=0.001)
    assert recovered[3] < 0.5   # reprojection error, pixels


def test_accuracy_degrades_gracefully_with_detection_noise():
    """MediaPipe does not put landmarks on exact pixels. A couple of pixels of
    jitter should cost millimetres, not metres."""
    truth = [0.2, 0.1, 1.2]
    skeleton = flat_skeleton(nose=truth)
    tracks = {
        "body_swing": make_track(FACE_ON, [skeleton], 30, 0, noise_px=2.0, seed=7),
        "body_swing_dtl": make_track(DTL, [skeleton], 60, 0, noise_px=2.0, seed=8),
    }
    recovered = triangulate_tracks(tracks, rig())[0].points[INDEX["nose"]]
    assert recovered is not None
    error_mm = np.linalg.norm(np.array(recovered[:3]) - truth) * 1000
    assert error_mm < 40, f"{error_mm:.1f} mm from 2 px of jitter"


def test_two_cameras_ninety_degrees_apart_actually_work():
    """The arrangement OpenCV's stereoCalibrate cannot handle, which is why
    each camera is placed independently against a shared board instead."""
    points = {
        "left_shoulder": [-0.2, 0.0, 1.45], "right_shoulder": [0.2, 0.0, 1.45],
        "left_hip": [-0.15, 0.0, 1.0], "right_hip": [0.15, 0.0, 1.0],
        "left_wrist": [0.3, -0.25, 1.1],
    }
    skeleton = flat_skeleton(**points)
    tracks = {
        "body_swing": make_track(FACE_ON, [skeleton], 30, 0),
        "body_swing_dtl": make_track(DTL, [skeleton], 60, 0),
    }
    frame = triangulate_tracks(tracks, rig())[0]
    for name, truth in points.items():
        recovered = frame.points[INDEX[name]]
        assert recovered is not None, name
        assert np.allclose(recovered[:3], truth, atol=0.002), name


# ---- refusing to guess ----------------------------------------------------


def test_a_landmark_seen_by_only_one_camera_is_not_invented():
    skeleton = flat_skeleton(nose=[0.1, 0.0, 1.3])
    tracks = {
        "body_swing": make_track(FACE_ON, [skeleton], 30, 0),
        "body_swing_dtl": make_track(DTL, [skeleton], 60, 0),
    }
    tracks["body_swing_dtl"]["frames"][0]["points"][INDEX["nose"]][2] = 0.1  # occluded
    assert triangulate_tracks(tracks, rig())[0].points[INDEX["nose"]] is None


def test_views_that_disagree_are_rejected():
    """If the two cameras place a landmark somewhere incompatible, there is no
    3D point that satisfies both -- better to return nothing."""
    skeleton = flat_skeleton(nose=[0.1, 0.0, 1.3])
    tracks = {
        "body_swing": make_track(FACE_ON, [skeleton], 30, 0),
        "body_swing_dtl": make_track(DTL, [skeleton], 60, 0),
    }
    tracks["body_swing_dtl"]["frames"][0]["points"][INDEX["nose"]][1] += 0.35
    recovered = triangulate_tracks(tracks, rig())[0].points[INDEX["nose"]]
    assert recovered is None or recovered[3] <= MAX_REPROJECTION_PX


def test_one_calibrated_camera_is_not_enough():
    skeleton = flat_skeleton(nose=[0.0, 0.0, 1.3])
    tracks = {"body_swing": make_track(FACE_ON, [skeleton], 30, 0)}
    assert triangulate_tracks(tracks, rig()) is None


def test_uncalibrated_cameras_produce_nothing():
    skeleton = flat_skeleton(nose=[0.0, 0.0, 1.3])
    tracks = {
        "body_swing": make_track(FACE_ON, [skeleton], 30, 0),
        "body_swing_dtl": make_track(DTL, [skeleton], 60, 0),
    }
    bare = Calibration(cameras={
        "body_swing": CameraCalibration((WIDTH, HEIGHT), FACE_ON.matrix, FACE_ON.distortion, 0.2),
    })
    assert bare.ready is False
    assert triangulate_tracks(tracks, bare) is None


# ---- unsynchronised cameras ----------------------------------------------


def test_cameras_at_different_rates_are_aligned_on_impact():
    """30 and 60 fps, started independently. Triangulating frames that are not
    the same instant would produce confident nonsense."""
    moving = [flat_skeleton(nose=[0.0, 0.0, 1.0 + 0.4 * (i / 60.0)]) for i in range(60)]

    fast = make_track(DTL, moving, 60, impact_ms=500)
    slow_skeletons = moving[::2]
    slow = make_track(FACE_ON, slow_skeletons, 30, impact_ms=500)

    frames = triangulate_tracks(
        {"body_swing": slow, "body_swing_dtl": fast}, rig()
    )
    # Driven by the 60 fps camera, so one frame per fast sample.
    assert len(frames) == 60
    # Timestamps are relative to impact, so they straddle zero.
    assert frames[0].t_ms == pytest.approx(-500.0, abs=1.0)
    assert any(abs(f.t_ms) < 20 for f in frames)

    mid = frames[30]
    expected = 1.0 + 0.4 * (30 / 60.0)
    recovered = mid.points[INDEX["nose"]]
    assert recovered is not None
    assert recovered[2] == pytest.approx(expected, abs=0.01)


# ---- the metrics 2D could not give ---------------------------------------


def test_shoulder_turn_recovers_a_known_rotation():
    """The whole point of calibrating: a single camera cannot measure this."""
    skeletons = []
    for degrees in range(0, 91, 5):
        angle = math.radians(degrees)
        half = 0.2
        skeletons.append(
            flat_skeleton(
                left_shoulder=[-half * math.cos(angle), -half * math.sin(angle), 1.45],
                right_shoulder=[half * math.cos(angle), half * math.sin(angle), 1.45],
                left_hip=[-0.15, 0.0, 1.0],
                right_hip=[0.15, 0.0, 1.0],
            )
        )
    # Both cameras watch the same swing over the same 300 ms, so the 30 fps
    # one takes every other pose. Handing both the full list would march the
    # 60 fps camera through the backswing at twice the speed.
    tracks = {
        "body_swing": make_track(FACE_ON, skeletons[::2], 30, 0),
        "body_swing_dtl": make_track(DTL, skeletons, 60, 0),
    }
    summary = summarise_3d(triangulate_tracks(tracks, rig()))
    assert summary["shoulder_turn_deg"] == pytest.approx(90, abs=3)
    assert summary["pelvis_rotation_deg"] == pytest.approx(0, abs=3)
    assert summary["x_factor_deg"] == pytest.approx(90, abs=4)


def test_x_factor_is_the_difference_between_the_two():
    skeletons = []
    for degrees in range(0, 91, 5):
        shoulder = math.radians(degrees)
        pelvis = math.radians(degrees * 0.45)     # hips turn less than shoulders
        skeletons.append(
            flat_skeleton(
                left_shoulder=[-0.2 * math.cos(shoulder), -0.2 * math.sin(shoulder), 1.45],
                right_shoulder=[0.2 * math.cos(shoulder), 0.2 * math.sin(shoulder), 1.45],
                left_hip=[-0.15 * math.cos(pelvis), -0.15 * math.sin(pelvis), 1.0],
                right_hip=[0.15 * math.cos(pelvis), 0.15 * math.sin(pelvis), 1.0],
            )
        )
    tracks = {
        "body_swing": make_track(FACE_ON, skeletons[::2], 30, 0),
        "body_swing_dtl": make_track(DTL, skeletons, 60, 0),
    }
    summary = summarise_3d(triangulate_tracks(tracks, rig()))
    assert summary["shoulder_turn_deg"] == pytest.approx(90, abs=3)
    assert summary["pelvis_rotation_deg"] == pytest.approx(40.5, abs=4)
    assert summary["x_factor_deg"] == pytest.approx(49.5, abs=5)


def turning_skeletons(hip_ratio=0.0):
    """A backswing: shoulders sweep 0 to 90 degrees, hips follow at a ratio."""
    out = []
    for degrees in range(0, 91, 5):
        shoulder = math.radians(degrees)
        pelvis = math.radians(degrees * hip_ratio)
        out.append(
            flat_skeleton(
                left_shoulder=[-0.2 * math.cos(shoulder), -0.2 * math.sin(shoulder), 1.45],
                right_shoulder=[0.2 * math.cos(shoulder), 0.2 * math.sin(shoulder), 1.45],
                left_hip=[-0.15 * math.cos(pelvis), -0.15 * math.sin(pelvis), 1.0],
                right_hip=[0.15 * math.cos(pelvis), 0.15 * math.sin(pelvis), 1.0],
            )
        )
    return out


# ---- the failure reprojection error cannot see ---------------------------


def test_tracks_without_impact_are_refused_rather_than_guessed():
    """Two clips, two independent recorders, no shared clock. Aligning one
    camera's impact against the other's first frame reprojects cleanly and
    reads tens of degrees wrong, so there is nothing to fall back on."""
    skeletons = turning_skeletons()
    tracks = {
        "body_swing": make_track(FACE_ON, skeletons[::2], 30, 0),
        "body_swing_dtl": make_track(DTL, skeletons, 60, 0),
    }
    tracks["body_swing"]["impact_ms"] = None
    assert triangulate_tracks(tracks, rig()) is None


def test_a_time_skew_is_caught_by_anatomy_not_by_reprojection():
    """The down-the-line clip's impact frame is 200 ms out. Face-on fixes X,
    down-the-line fixes Y, so every point reprojects to well under a pixel --
    but the shoulders stretch past any human width as the body turns."""
    skeletons = turning_skeletons()
    tracks = {
        "body_swing": make_track(FACE_ON, skeletons[::2], 30, 0),
        "body_swing_dtl": make_track(DTL, skeletons, 60, 200),
    }
    frames = triangulate_tracks(tracks, rig())
    worst = max(p[3] for f in frames for p in f.points if p is not None)
    assert worst < 1.0, f"{worst:.2f} px -- reprojection was supposed to be blind here"

    assert summarise_3d(frames)["shoulder_turn_deg"] is None


def test_a_mistyped_board_square_size_is_caught():
    """Calibrating a 25 mm board as 50 mm scales the entire reconstruction by
    two. Every angle stays correct, so nothing geometric objects -- but the
    golfer comes out 80 cm across the shoulders."""
    double = Calibration(cameras={
        "body_swing": synthetic_camera((0.0, -7.0, 2.8)),
        "body_swing_dtl": synthetic_camera((7.0, 0.0, 2.8)),
    })
    skeletons = [
        flat_skeleton(**{name: [c * 2 for c in point] for name, point in {
            "left_shoulder": [-0.2 * math.cos(a), -0.2 * math.sin(a), 1.45],
            "right_shoulder": [0.2 * math.cos(a), 0.2 * math.sin(a), 1.45],
            "left_hip": [-0.15, 0.0, 1.0], "right_hip": [0.15, 0.0, 1.0],
        }.items()})
        for a in (math.radians(d) for d in range(0, 91, 5))
    ]
    tracks = {
        "body_swing": make_track(double.cameras["body_swing"], skeletons[::2], 30, 0),
        "body_swing_dtl": make_track(double.cameras["body_swing_dtl"], skeletons, 60, 0),
    }
    assert summarise_3d(triangulate_tracks(tracks, double)) == {
        "shoulder_turn_deg": None, "pelvis_rotation_deg": None, "x_factor_deg": None
    }


def test_detection_jitter_does_not_trip_the_plausibility_check():
    """The guard has to survive real MediaPipe noise, or it costs every shot."""
    skeletons = turning_skeletons(hip_ratio=0.45)
    tracks = {
        "body_swing": make_track(FACE_ON, skeletons[::2], 30, 0, noise_px=4.0, seed=11),
        "body_swing_dtl": make_track(DTL, skeletons, 60, 0, noise_px=4.0, seed=12),
    }
    summary = summarise_3d(triangulate_tracks(tracks, rig()))
    assert summary["shoulder_turn_deg"] == pytest.approx(90, abs=6)


def test_no_frames_means_no_metrics():
    assert summarise_3d([]) == {
        "shoulder_turn_deg": None, "pelvis_rotation_deg": None, "x_factor_deg": None
    }


# ---- persistence ----------------------------------------------------------


def test_calibration_round_trips_through_disk(tmp_path):
    path = tmp_path / "calibration.json"
    rig().save(path)
    loaded = Calibration.load(path)
    assert loaded.ready
    assert loaded.triangulable == ["body_swing", "body_swing_dtl"]
    assert np.allclose(loaded.cameras["body_swing"].projection(), FACE_ON.projection())


def test_missing_calibration_is_not_an_error(tmp_path):
    assert Calibration.load(tmp_path / "absent.json") is None


def test_unplaced_cameras_are_not_triangulable(tmp_path):
    partial = Calibration(cameras={
        "body_swing": FACE_ON,
        "body_swing_dtl": CameraCalibration((WIDTH, HEIGHT), DTL.matrix, DTL.distortion, 0.2),
    })
    assert partial.triangulable == ["body_swing"]
    assert partial.ready is False


# ---- the board and the pose solve ----------------------------------------


def test_board_geometry_is_in_metres():
    board = Board(squares_x=10, squares_y=7, square_mm=150.0, marker_mm=110.0)
    assert board.size_mm == (1500.0, 1050.0)
    corners = board.cv().getChessboardCorners()
    assert corners.shape == (54, 3)               # 10x7 squares -> 9x6 corners
    assert np.allclose(corners[:, 2], 0.0)        # flat board
    assert corners[1][0] - corners[0][0] == pytest.approx(0.150)


def test_a_marker_bigger_than_its_square_is_refused():
    with pytest.raises(ValueError, match="smaller than the square"):
        Board(square_mm=100.0, marker_mm=100.0)


def test_the_board_detects_in_its_own_printed_image():
    """Closes the loop between what the script prints and what it looks for."""
    board = Board()
    printed = cv2.cvtColor(board.generate_image(px_per_mm=2.0), cv2.COLOR_GRAY2BGR)
    matched = board.detect(printed)
    assert matched is not None
    object_points, image_points = matched
    assert len(object_points) == 54
    assert len(image_points) == 54


def _board_seen_from(board, position, target, up=(0.0, 0.0, 1.0), noise_px=0.0, seed=1):
    """Where each board corner lands in an image, for a camera at ``position``.

    ``position`` and ``target`` are in the Z-up world frame the solver reports
    in; the corners themselves are in the board's own frame, so the camera is
    converted across before projecting. Getting this backwards is what the
    printed-page test exists to catch.
    """
    rng = np.random.default_rng(seed)
    to_world = np.array(BOARD_TO_WORLD, dtype=np.float64)
    position = to_world @ np.array(position, dtype=float)
    target = to_world @ np.array(target, dtype=float)

    forward = target - position
    forward /= np.linalg.norm(forward)
    right = np.cross(forward, to_world @ np.array(up, dtype=float))
    right /= np.linalg.norm(right)
    rotation = np.vstack([right, np.cross(forward, right), forward])
    translation = (-rotation @ position).reshape(3, 1)

    corners = board.cv().getChessboardCorners().reshape(-1, 1, 3).astype(np.float64)
    matrix = np.array([[FOCAL, 0, WIDTH / 2], [0, FOCAL, HEIGHT / 2], [0, 0, 1.0]])
    pixels, _ = cv2.projectPoints(
        corners, cv2.Rodrigues(rotation)[0], translation, matrix, np.zeros(5)
    )
    if noise_px:
        pixels = pixels + rng.normal(0, noise_px, pixels.shape)
    return corners, pixels, matrix


def _fresh_camera(matrix):
    return CameraCalibration((WIDTH, HEIGHT), matrix.tolist(), [0.0] * 5, 0.2)


@pytest.mark.parametrize(
    "position,up",
    [
        ((0.0, -3.5, 1.4), (0.0, 0.0, 1.0)),      # face-on
        ((3.5, 0.0, 1.4), (0.0, 0.0, 1.0)),       # down-the-line
        ((0.75, 0.525, 2.5), (0.0, 1.0, 0.0)),    # square to the board: IPPE
    ],                                            # degenerates here, SQPNP does not
)
def test_the_pose_solve_recovers_where_the_camera_really_was(position, up):
    board = Board()
    centre = (board.size_mm[0] / 2000, board.size_mm[1] / 2000, 0.0)
    corners, pixels, matrix = _board_seen_from(board, position, centre, up)
    solved = solve_pose(_fresh_camera(matrix), corners, pixels)
    assert camera_position(solved) == pytest.approx(np.array(position), abs=0.001)
    assert solved.pose_rms_px < 0.01


def test_the_camera_is_never_placed_under_the_floor():
    """The board lies printed-side-up on the floor, so a pose putting the
    camera beneath it is not a worse fit but an impossible one. IPPE's two tilt
    solutions can come out close on a near-degenerate view, and this is what
    stops the impossible one winning on a hair of reprojection error."""
    board = Board()
    centre = (board.size_mm[0] / 2000, board.size_mm[1] / 2000, 0.0)
    for position in ((0.0, -3.5, 1.4), (3.5, 0.0, 1.4), (-2.0, -2.0, 2.2)):
        corners, pixels, matrix = _board_seen_from(board, position, centre)
        assert camera_position(solve_pose(_fresh_camera(matrix), corners, pixels))[2] > 0


def test_place_camera_reads_an_image_end_to_end():
    """detect + solve together, on an image that is genuinely a photograph of
    the board: its own printed page, viewed square on. A camera looking at a
    flat print head-on must come out on the board's axis, at the distance the
    focal length implies -- and above it, never behind."""
    board = Board()
    px_per_mm = 2.0
    printed = cv2.cvtColor(board.generate_image(px_per_mm), cv2.COLOR_GRAY2BGR)
    height, width = printed.shape[:2]
    focal = 3000.0
    camera = CameraCalibration(
        (width, height),
        [[focal, 0, width / 2], [0, focal, height / 2], [0, 0, 1.0]],
        [0.0] * 5,
        0.2,
    )

    placed = place_camera(camera, printed, board)
    where = camera_position(placed)

    # Scale: the print is px_per_mm * 1000 pixels per metre, so a camera of
    # this focal length sits focal / (px per metre) away.
    assert where[2] == pytest.approx(focal / (px_per_mm * 1000), abs=0.02)
    # Square on: centred over the middle of the board. World Y is the board's
    # Y negated, so the centre is at minus half the board's height.
    assert where[0] == pytest.approx(board.size_mm[0] / 2000, abs=0.02)
    assert where[1] == pytest.approx(-board.size_mm[1] / 2000, abs=0.02)
    assert placed.pose_rms_px < 1.0


def test_a_partly_hidden_board_still_places_the_camera():
    """The golfer's mat, a bag, a foot -- something covers a corner of the
    board. The markers that remain identify themselves, so the origin is still
    known and the pose still solves. A plain chessboard needs the whole grid."""
    board = Board()
    printed = cv2.cvtColor(board.generate_image(2.0), cv2.COLOR_GRAY2BGR)
    printed[: printed.shape[0] // 3, : printed.shape[1] // 3] = 128

    matched = board.detect(printed)
    assert matched is not None
    assert 6 <= len(matched[0]) < 54, "expected a partial detection"

    camera = CameraCalibration(
        (printed.shape[1], printed.shape[0]),
        [[3000.0, 0, printed.shape[1] / 2], [0, 3000.0, printed.shape[0] / 2], [0, 0, 1.0]],
        [0.0] * 5,
        0.2,
    )
    assert camera_position(place_camera(camera, printed, board))[2] > 0


def test_detection_noise_costs_millimetres_not_metres():
    board = Board()
    centre = (board.size_mm[0] / 2000, board.size_mm[1] / 2000, 0.0)
    corners, pixels, matrix = _board_seen_from(
        board, (0.0, -3.5, 1.4), centre, noise_px=1.0, seed=4
    )
    solved = solve_pose(_fresh_camera(matrix), corners, pixels)
    error_mm = np.linalg.norm(camera_position(solved) - np.array([0.0, -3.5, 1.4])) * 1000
    assert error_mm < 25, f"{error_mm:.1f} mm from 1 px of corner noise"


def test_an_older_calibration_file_is_retired_rather_than_misread(tmp_path):
    """Schema 1.x placed cameras against a plain chessboard, so its poses may
    be mirrored. Better to ask for a recalibration than to load them."""
    path = tmp_path / "calibration.json"
    path.write_text(json.dumps({
        "schema_version": "1.0",
        "board": {"cols": 9, "rows": 6, "square_mm": 25.0},
        "cameras": {},
    }))
    assert Calibration.load(path) is None


# ---- end to end through the pose pipeline --------------------------------


class TriangulableExtractor:
    """Returns the synthetic backswing as each camera would have seen it.

    Stands in for MediaPipe so the wiring can be tested without inference:
    what matters here is that impact_ms survives the trip from ingest to the
    triangulator, and that a calibrated rig turns into a world track.
    """

    def __init__(self, skeletons):
        self.skeletons = skeletons

    def available(self):
        return None

    def extract(self, video, *, camera, impact_ms=None, max_fps=30.0):
        from backend.pose.extractor import PoseTrack

        dtl = camera == "dtl"
        rig_camera, fps = (DTL, 60.0) if dtl else (FACE_ON, 30.0)
        poses = self.skeletons if dtl else self.skeletons[::2]
        step = 1000.0 / fps
        frames = [
            {"t_ms": i * step, "points": [project(rig_camera, p) for p in pose]}
            for i, pose in enumerate(poses)
        ]
        return PoseTrack(camera, fps, WIDTH, HEIGHT, impact_ms, frames)


async def _swing_through(correlator, settings, tmp_path, impact_ms):
    from backend.correlator import MediaArrival
    from backend.models import SourceName

    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"\x00" * 2048)
    package = None
    for source, camera in (
        (SourceName.BODY_SWING, "face_on"),
        (SourceName.BODY_SWING_DTL, "dtl"),
    ):
        package = await correlator.submit_media(
            MediaArrival(
                source=source, file=clip, camera=camera, capture_fps=30.0,
                container_fps=30.0, impact_ms=impact_ms, copy=True,
            )
        )
    return package


async def _run_pose(correlator, settings, tmp_path, impact_ms=0):
    import asyncio

    from backend.pose.pipeline import PosePipeline

    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = TriangulableExtractor(turning_skeletons(hip_ratio=0.45))
    correlator.pose_pipeline = pipeline
    await pipeline.start()
    package = await _swing_through(correlator, settings, tmp_path, impact_ms)
    await correlator.close_all()
    await asyncio.wait_for(pipeline._queue.join(), timeout=20)
    await pipeline.stop()

    directory = settings.shots_dir / f"shot_{package.shot_id}"
    return (
        json.loads((directory / "metadata.json").read_text()),
        json.loads((directory / "pose.json").read_text()),
    )


@pytest.mark.asyncio
async def test_a_calibrated_rig_produces_3d_metrics_end_to_end(
    correlator, settings, tmp_path
):
    rig().save(settings.pose_calibration_path)
    metadata, sidecar = await _run_pose(correlator, settings, tmp_path)

    assert metadata["pose"]["status"] == "ready"
    assert metadata["pose"]["dimensions"] == "3d"
    summary = metadata["pose"]["summary"]
    assert summary["shoulder_turn_deg"] == pytest.approx(90, abs=3)
    assert summary["pelvis_rotation_deg"] == pytest.approx(40.5, abs=4)
    assert summary["x_factor_deg"] == pytest.approx(49.5, abs=5)

    # The 2D tracks are untouched -- a viewer overlaying a skeleton on the
    # video still needs image coordinates.
    assert sidecar["tracks"]["body_swing"]["frames"][0]["points"][0][0] < 1.0
    world = sidecar["world"]
    assert world["coordinate_space"] == "world_metres"
    assert world["frame_count"] == len(world["frames"])
    shoulder = world["frames"][0]["points"][INDEX["left_shoulder"]]
    assert shoulder[:3] == pytest.approx([-0.2, 0.0, 1.45], abs=0.01)


@pytest.mark.asyncio
async def test_without_calibration_the_shot_still_gets_its_2d_pose(
    correlator, settings, tmp_path
):
    """3D is additive. An uncalibrated rig must cost nothing that worked before."""
    assert not settings.pose_calibration_path.exists()
    metadata, sidecar = await _run_pose(correlator, settings, tmp_path)

    assert metadata["pose"]["status"] == "ready"
    assert metadata["pose"]["dimensions"] == "2d"
    assert metadata["pose"]["summary"]["shoulder_turn_deg"] is None
    assert "world" not in sidecar
    assert set(sidecar["tracks"]) == {"body_swing", "body_swing_dtl"}


@pytest.mark.asyncio
async def test_a_broken_calibration_file_does_not_cost_the_pose(
    correlator, settings, tmp_path
):
    settings.pose_calibration_path.parent.mkdir(parents=True, exist_ok=True)
    settings.pose_calibration_path.write_text("{ this is not json")
    metadata, _ = await _run_pose(correlator, settings, tmp_path)

    assert metadata["pose"]["status"] == "ready"
    assert metadata["pose"]["dimensions"] == "2d"


@pytest.mark.asyncio
async def test_clips_without_an_impact_frame_stay_2d(correlator, settings, tmp_path):
    """The Kinovea hooks ship with IMPACT_MS blank. Two clips from two
    independently started recorders then share no clock, and lining one's
    impact up against the other's first frame reprojects cleanly while reading
    tens of degrees wrong -- so a calibrated rig still declines to go 3D."""
    rig().save(settings.pose_calibration_path)
    metadata, sidecar = await _run_pose(correlator, settings, tmp_path, impact_ms=None)

    assert metadata["pose"]["status"] == "ready"
    assert metadata["pose"]["dimensions"] == "2d"
    assert metadata["pose"]["summary"]["shoulder_turn_deg"] is None
    assert "world" not in sidecar
