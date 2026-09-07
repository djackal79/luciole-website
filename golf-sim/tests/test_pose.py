"""Pose extraction: geometry, pipeline lifecycle, and failure handling."""

from __future__ import annotations

import asyncio
import json
import math
import time
from pathlib import Path

import pytest

# See test_calibration: the pose extras are optional, so their tests skip
# rather than break collection for anyone who has not installed them.
pytest.importorskip("numpy", reason="pose extras not installed")

from backend.models import DataStatus, SourceName
from backend.pose import metrics
from backend.pose.extractor import ExtractionError, PoseExtractor, PoseTrack
from backend.pose.landmarks import INDEX, MEDIAPIPE_LANDMARKS
from backend.pose.pipeline import PosePipeline, _pose_inputs, _write_sidecar

WIDTH, HEIGHT = 1280, 720
MODEL = Path("models/pose_landmarker_lite.task")


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------


def _frame(t_ms, hand_px, shoulder_px=None, hip_px=None, visibility=0.95):
    points = [[0.5, 0.5, visibility] for _ in MEDIAPIPE_LANDMARKS]
    for name in ("left_wrist", "right_wrist"):
        points[INDEX[name]] = [hand_px[0] / WIDTH, hand_px[1] / HEIGHT, visibility]
    if shoulder_px and hip_px:
        for name in ("left_shoulder", "right_shoulder"):
            points[INDEX[name]] = [shoulder_px[0] / WIDTH, shoulder_px[1] / HEIGHT, visibility]
        for name in ("left_hip", "right_hip"):
            points[INDEX[name]] = [hip_px[0] / WIDTH, hip_px[1] / HEIGHT, visibility]
    return {"t_ms": t_ms, "points": points}


def _dtl_track(frames, **kwargs):
    return PoseTrack(
        camera="dtl", fps=30, width=WIDTH, height=HEIGHT,
        impact_ms=kwargs.pop("impact_ms", frames[-1]["t_ms"]), frames=frames, **kwargs
    )


def _hand_path(angle_deg, count=20):
    slope = math.tan(math.radians(angle_deg))
    return [_frame(i * 33, (400 + i * 12, 200 + i * 12 * slope)) for i in range(count)]


@pytest.mark.parametrize("angle", [45.0, 55.0, 62.0, 70.0])
def test_swing_plane_recovers_a_known_angle(angle):
    track = _dtl_track(_hand_path(angle))
    assert metrics._swing_plane(track, metrics._aspect(track)) == pytest.approx(angle, abs=0.5)


def test_swing_plane_corrects_for_aspect_ratio():
    """Normalised coordinates run 0-1 on both axes but the frame is 16:9.
    Without the correction a 62 degree plane reads as 73 -- wrong, and
    plausible enough that nobody would notice."""
    track = _dtl_track(_hand_path(62.0))
    corrected = metrics._swing_plane(track, metrics._aspect(track))
    uncorrected = metrics._swing_plane(track, 1.0)
    assert corrected == pytest.approx(62.0, abs=0.5)
    assert uncorrected > 70.0


@pytest.mark.parametrize("angle", [25.0, 31.0, 38.0])
def test_spine_angle_recovers_a_known_forward_tilt(angle):
    dx = 100 * math.tan(math.radians(angle))
    frames = [
        _frame(i * 33, (500, 500), shoulder_px=(640 + dx, 300), hip_px=(640, 400))
        for i in range(10)
    ]
    track = _dtl_track(frames)
    assert metrics._spine_angle(track, metrics._aspect(track)) == pytest.approx(angle, abs=0.5)


def test_swing_plane_uses_only_the_downswing():
    """Including the takeaway would flatten the plane with a path the club
    never returns on."""
    backswing = [_frame(i * 33, (700 - i * 14, 400 - i * 4)) for i in range(12)]
    downswing = [
        _frame((12 + i) * 33, (530 + i * 12, 352 + i * 12 * math.tan(math.radians(62.0))))
        for i in range(12)
    ]
    track = _dtl_track(backswing + downswing, impact_ms=23 * 33)
    assert metrics._swing_plane(track, metrics._aspect(track)) == pytest.approx(62.0, abs=2.0)


def test_metrics_need_the_down_the_line_view():
    """Face-on shows lateral tilt and sway, not plane or forward bend."""
    face_on = PoseTrack(
        camera="face_on", fps=30, width=WIDTH, height=HEIGHT,
        impact_ms=600, frames=_hand_path(62.0),
    )
    assert metrics.summarise({"body_swing": face_on})["swing_plane_deg"] is None


def test_a_poorly_detected_clip_reports_nothing_rather_than_guessing():
    track = _dtl_track(_hand_path(62.0, count=6), missed_frames=40)
    assert track.detection_rate < metrics.MIN_DETECTION_RATE
    assert metrics.summarise({"body_swing_dtl": track})["swing_plane_deg"] is None


def test_depth_dependent_metrics_stay_null_in_2d():
    """A single camera cannot recover these, and a plausible guess is worse
    than an em-dash."""
    summary = metrics.summarise({"body_swing_dtl": _dtl_track(_hand_path(62.0))})
    assert summary["swing_plane_deg"] is not None
    for field in ("shoulder_turn_deg", "pelvis_rotation_deg", "x_factor_deg", "hand_speed_mph"):
        assert summary[field] is None


def test_invisible_landmarks_are_treated_as_absent():
    track = _dtl_track(_hand_path(62.0), )
    for frame in track.frames:
        for name in ("left_wrist", "right_wrist"):
            frame["points"][INDEX[name]][2] = 0.1
    assert metrics._swing_plane(track, metrics._aspect(track)) is None


# ---------------------------------------------------------------------------
# Sidecar
# ---------------------------------------------------------------------------


def test_sidecar_is_keyed_by_camera(tmp_path):
    tracks = {
        "body_swing": PoseTrack("face_on", 30, WIDTH, HEIGHT, 2450, _hand_path(50.0)),
        "body_swing_dtl": PoseTrack("dtl", 60, WIDTH, HEIGHT, 2450, _hand_path(62.0)),
    }
    _write_sidecar(tmp_path, tracks)
    written = json.loads((tmp_path / "pose.json").read_text())

    assert set(written["tracks"]) == {"body_swing", "body_swing_dtl"}
    assert written["landmarks"] == MEDIAPIPE_LANDMARKS
    assert written["point_format"] == ["x", "y", "visibility"]
    assert written["tracks"]["body_swing_dtl"]["camera"] == "dtl"
    assert written["tracks"]["body_swing_dtl"]["impact_ms"] == 2450
    assert len(written["tracks"]["body_swing"]["frames"][0]["points"]) == 33
    assert not list(tmp_path.glob(".*tmp"))  # atomic write left nothing behind


def test_pose_inputs_prefers_face_on_then_dtl(tmp_path):
    (tmp_path / "body_swing.mp4").write_bytes(b"x")
    (tmp_path / "body_swing_dtl.mp4").write_bytes(b"x")
    metadata = {
        "media": {
            "body_swing_dtl": {"path": "body_swing_dtl.mp4", "camera": "dtl"},
            "body_swing": {"path": "body_swing.mp4", "camera": "face_on"},
            "impact_strike": {"path": "impact_strike.mp4", "camera": "impact"},
        }
    }
    found = _pose_inputs(metadata, tmp_path)
    assert [name for name, _, _ in found] == ["body_swing", "body_swing_dtl"]


def test_pose_inputs_skips_a_clip_that_is_not_on_disk(tmp_path):
    metadata = {"media": {"body_swing": {"path": "gone.mp4", "camera": "face_on"}}}
    assert _pose_inputs(metadata, tmp_path) == []


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class StubExtractor:
    """Deterministic stand-in, so pipeline tests do not run inference."""

    def __init__(self, *, fails=None, empty=False):
        self.fails = fails
        self.empty = empty
        self.calls: list[str] = []

    def available(self):
        return None

    def extract(self, video, *, camera, impact_ms=None, max_fps=30.0):
        self.calls.append(camera)
        if self.fails:
            raise self.fails
        frames = [] if self.empty else _hand_path(62.0)
        return PoseTrack(camera, 30.0, WIDTH, HEIGHT, impact_ms, frames)


async def _shot_with_clips(correlator, settings, tmp_path, *, dtl=False):
    from backend.correlator import MediaArrival

    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"\x00" * 2048)
    sources = [SourceName.BODY_SWING] + ([SourceName.BODY_SWING_DTL] if dtl else [])
    package = None
    for source in sources:
        package = await correlator.submit_media(
            MediaArrival(
                source=source, file=clip, camera="dtl" if "dtl" in source.value else "face_on",
                capture_fps=30.0, container_fps=30.0, copy=True,
            )
        )
    return package


async def _drain(pipeline):
    await asyncio.wait_for(pipeline._queue.join(), timeout=20)


@pytest.mark.asyncio
async def test_pipeline_writes_pose_and_marks_the_source_present(
    correlator, settings, tmp_path
):
    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor()
    correlator.pose_pipeline = pipeline
    await pipeline.start()

    package = await _shot_with_clips(correlator, settings, tmp_path, dtl=True)
    await correlator.close_all()
    await _drain(pipeline)
    await pipeline.stop()

    metadata = json.loads(
        (settings.shots_dir / f"shot_{package.shot_id}" / "metadata.json").read_text()
    )
    assert metadata["pose"]["status"] == "ready"
    assert metadata["sources"]["pose"] is True
    assert set(metadata["pose"]["cameras"]) == {"body_swing", "body_swing_dtl"}
    assert metadata["pose"]["summary"]["swing_plane_deg"] == pytest.approx(62.0, abs=0.5)
    assert metadata["pose"]["summary"]["shoulder_turn_deg"] is None

    sidecar = settings.shots_dir / f"shot_{package.shot_id}" / "pose.json"
    assert set(json.loads(sidecar.read_text())["tracks"]) == {"body_swing", "body_swing_dtl"}


@pytest.mark.asyncio
async def test_a_native_failure_never_leaves_a_shot_pending(
    correlator, settings, tmp_path
):
    """The estimator is a native library and can fail with OSError rather than
    ExtractionError. Letting that escape would leave the UI showing
    'computing' forever."""
    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor(fails=OSError("libGLESv2.so.2: not found"))
    correlator.pose_pipeline = pipeline
    await pipeline.start()

    package = await _shot_with_clips(correlator, settings, tmp_path)
    await correlator.close_all()
    await _drain(pipeline)
    await pipeline.stop()

    metadata = json.loads(
        (settings.shots_dir / f"shot_{package.shot_id}" / "metadata.json").read_text()
    )
    assert metadata["pose"]["status"] == "failed"
    assert "libGLESv2" in metadata["pose"]["error"]
    assert metadata["sources"]["pose"] is False


@pytest.mark.asyncio
async def test_no_golfer_detected_is_a_failure_not_an_empty_skeleton(
    correlator, settings, tmp_path
):
    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor(empty=True)
    correlator.pose_pipeline = pipeline
    await pipeline.start()

    package = await _shot_with_clips(correlator, settings, tmp_path)
    await correlator.close_all()
    await _drain(pipeline)
    await pipeline.stop()

    metadata = json.loads(
        (settings.shots_dir / f"shot_{package.shot_id}" / "metadata.json").read_text()
    )
    assert metadata["pose"]["status"] == "failed"
    assert "no golfer detected" in metadata["pose"]["error"]
    assert not (settings.shots_dir / f"shot_{package.shot_id}" / "pose.json").exists()


@pytest.mark.asyncio
async def test_a_shot_with_no_body_swing_clip_is_never_queued(
    correlator, settings, tmp_path
):
    from backend.correlator import MediaArrival

    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor()
    correlator.pose_pipeline = pipeline
    await pipeline.start()

    clip = tmp_path / "impact.mp4"
    clip.write_bytes(b"\x00" * 512)
    await correlator.submit_media(
        MediaArrival(source=SourceName.IMPACT_STRIKE, file=clip, camera="impact", copy=True)
    )
    await correlator.close_all()
    await _drain(pipeline)
    await pipeline.stop()

    assert pipeline.extractor.calls == []


@pytest.mark.asyncio
async def test_the_queue_sheds_load_rather_than_backing_up(settings, correlator):
    """Better to lose pose on one shot than to stall a range session."""
    settings.pose_queue_size = 2
    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor()
    await pipeline.start()
    try:
        accepted = [pipeline.enqueue(f"shot-{i}") for i in range(6)]
        assert accepted[0] is True
        assert False in accepted  # some shed
    finally:
        await pipeline.stop()


def test_a_missing_model_reports_how_to_fix_it(tmp_path):
    reason = PoseExtractor(tmp_path / "absent.task").available()
    assert "fetch_pose_model" in reason


# ---------------------------------------------------------------------------
# Real MediaPipe
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    not MODEL.is_file() or PoseExtractor(MODEL).available() is not None,
    reason="pose model or its native dependencies unavailable here",
)
def test_real_mediapipe_runs_over_a_real_video(tmp_path):
    """Exercises decode plus inference, not a stub. Detection quality on real
    golf footage can only be judged on real golf footage."""
    import cv2
    import numpy as np

    video = tmp_path / "clip.mp4"
    writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"mp4v"), 30, (640, 360))
    for i in range(30):
        frame = np.full((360, 640, 3), 40, np.uint8)
        phase = i / 30
        cv2.circle(frame, (320, 80), 22, (200, 180, 160), -1)
        cv2.line(frame, (320, 102), (320, 210), (90, 110, 160), 18)
        cv2.line(frame, (320, 120),
                 (int(320 + 70 * np.cos(phase * 3)), int(150 + 70 * np.sin(phase * 3))),
                 (90, 110, 160), 10)
        cv2.line(frame, (320, 210), (290, 320), (60, 60, 90), 12)
        cv2.line(frame, (320, 210), (350, 320), (60, 60, 90), 12)
        writer.write(frame)
    writer.release()

    started = time.time()
    track = PoseExtractor(MODEL).extract(video, camera="dtl", impact_ms=500, max_fps=30)
    assert time.time() - started < 60
    assert len(track.frames) + track.missed_frames == 30
    assert 0.0 <= track.detection_rate <= 1.0
    for frame in track.frames:
        assert len(frame["points"]) == 33
        assert all(0.0 <= axis <= 1.0 for axis in frame["points"][0][:2])


# ---------------------------------------------------------------------------
# Crash recovery
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_shot_left_computing_by_a_crash_is_picked_up(
    correlator, settings, tmp_path
):
    """Kill the backend mid-extraction and the queue dies with it. The clips
    are still on disk, so the work is simply redone on the next start."""
    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor()
    correlator.pose_pipeline = pipeline
    await pipeline.start()

    package = await _shot_with_clips(correlator, settings, tmp_path)
    await correlator.close_all()
    await _drain(pipeline)

    # Rewind to what a crash mid-extraction leaves behind.
    directory = settings.shots_dir / f"shot_{package.shot_id}"
    metadata = json.loads((directory / "metadata.json").read_text())
    metadata["pose"] = {"status": "pending", "cameras": ["body_swing"]}
    metadata["sources"]["pose"] = False
    (directory / "metadata.json").write_text(json.dumps(metadata))

    assert await pipeline.reconcile_pending() == 1
    await _drain(pipeline)
    await pipeline.stop()

    recovered = json.loads((directory / "metadata.json").read_text())
    assert recovered["pose"]["status"] == "ready"
    assert recovered["sources"]["pose"] is True


@pytest.mark.asyncio
async def test_a_stranded_shot_is_never_left_computing_forever(
    correlator, settings, tmp_path
):
    """When the estimator cannot run there is nothing to redo, and a shot that
    reads "computing" for ever is the one state the UI cannot make sense of."""
    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor()
    correlator.pose_pipeline = pipeline
    await pipeline.start()
    package = await _shot_with_clips(correlator, settings, tmp_path)
    await correlator.close_all()
    await _drain(pipeline)
    await pipeline.stop()          # worker gone: enqueue can no longer accept

    directory = settings.shots_dir / f"shot_{package.shot_id}"
    metadata = json.loads((directory / "metadata.json").read_text())
    metadata["pose"] = {"status": "pending", "cameras": []}
    (directory / "metadata.json").write_text(json.dumps(metadata))

    assert await pipeline.reconcile_pending() == 0
    after = json.loads((directory / "metadata.json").read_text())
    assert after["pose"]["status"] == "failed"
    assert "interrupted by a restart" in after["pose"]["error"]


@pytest.mark.asyncio
async def test_a_clean_start_has_nothing_to_recover(correlator, settings, tmp_path):
    pipeline = PosePipeline(settings, correlator)
    pipeline.extractor = StubExtractor()
    correlator.pose_pipeline = pipeline
    await pipeline.start()
    await _shot_with_clips(correlator, settings, tmp_path)
    await correlator.close_all()
    await _drain(pipeline)

    assert await pipeline.reconcile_pending() == 0
    await pipeline.stop()
