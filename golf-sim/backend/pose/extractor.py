"""Run MediaPipe Pose over a video clip.

Deliberately narrow: video in, landmark track out. No file writing, no
metadata, no knowledge of shots -- so it can be tested on any clip and swapped
for a different estimator without touching the pipeline.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .landmarks import MEDIAPIPE_LANDMARKS

log = logging.getLogger(__name__)

#: Sentinel: the availability probe has not run yet.
_UNPROBED = object()


class ExtractionError(RuntimeError):
    """Raised when a clip cannot be processed at all."""


@dataclass
class PoseTrack:
    """One camera's landmarks, in the sidecar's on-disk shape."""

    camera: str
    fps: float
    width: int
    height: int
    impact_ms: int | None
    frames: list[dict[str, Any]] = field(default_factory=list)
    #: Frames where the model found nobody. A few is normal (motion blur at
    #: impact); mostly-missing means the camera framing is wrong.
    missed_frames: int = 0

    @property
    def detection_rate(self) -> float:
        total = len(self.frames) + self.missed_frames
        return 0.0 if total == 0 else len(self.frames) / total

    def as_dict(self) -> dict[str, Any]:
        return {
            "camera": self.camera,
            "fps": round(self.fps, 3),
            "width": self.width,
            "height": self.height,
            "impact_ms": self.impact_ms,
            "frame_count": len(self.frames),
            "detection_rate": round(self.detection_rate, 3),
            "frames": self.frames,
        }


class PoseExtractor:
    """Wraps the MediaPipe Tasks PoseLandmarker.

    The model file is not shipped with the repo -- fetch it once with
    ``scripts/fetch_pose_model.py``.
    """

    def __init__(self, model_path: Path, *, min_confidence: float = 0.5) -> None:
        self.model_path = Path(model_path)
        self.min_confidence = min_confidence
        self._probe: str | None | object = _UNPROBED

    def available(self) -> str | None:
        """Returns None when usable, else why not.

        Importing mediapipe is not enough. Its estimator is a native library
        that dlopens graphics dependencies on first use, so a machine can
        import the package cleanly and still fail the moment a landmarker is
        constructed. Probe that properly, once, and cache it -- otherwise the
        first shot of a session is the thing that discovers the problem.
        """
        if not self.model_path.is_file():
            return (
                f"pose model missing at {self.model_path} "
                "-- run scripts/fetch_pose_model.py"
            )
        if self._probe is _UNPROBED:
            self._probe = self._run_probe()
        return self._probe  # type: ignore[return-value]

    def _run_probe(self) -> str | None:
        try:
            import cv2  # noqa: F401
            import mediapipe  # noqa: F401
        except ImportError as exc:
            return f"pose dependencies missing: {exc}"
        try:
            self._build_landmarker().close()
        except Exception as exc:
            return f"pose estimator unusable: {exc}"
        return None

    def _build_landmarker(self):
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python.vision import (
            PoseLandmarker,
            PoseLandmarkerOptions,
            RunningMode,
        )

        return PoseLandmarker.create_from_options(
            PoseLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(self.model_path)),
                # VIDEO mode lets the model use temporal context between
                # frames, which is markedly steadier than treating each frame
                # as an unrelated image.
                running_mode=RunningMode.VIDEO,
                num_poses=1,
                min_pose_detection_confidence=self.min_confidence,
                min_tracking_confidence=self.min_confidence,
            )
        )

    def extract(
        self,
        video: Path,
        *,
        camera: str,
        impact_ms: int | None = None,
        max_fps: float = 60.0,
    ) -> PoseTrack:
        """Landmarks for every sampled frame of ``video``.

        ``max_fps`` caps the sampling rate. A 60 fps down-the-line clip is
        240 frames over four seconds, and pose at 30 Hz is already finer than
        any swing metric needs -- so this halves the work for nothing lost.
        """
        if (reason := self.available()) is not None:
            raise ExtractionError(reason)

        import cv2
        import mediapipe as mp

        capture = cv2.VideoCapture(str(video))
        if not capture.isOpened():
            raise ExtractionError(f"cannot open {video}")

        try:
            source_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
            width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
            height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

            # Sample every Nth frame to respect max_fps.
            stride = max(1, int(round(source_fps / max_fps))) if max_fps > 0 else 1
            track = PoseTrack(
                camera=camera,
                fps=source_fps / stride,
                width=width,
                height=height,
                impact_ms=impact_ms,
            )

            with self._build_landmarker() as landmarker:
                index = 0
                while True:
                    ok, frame = capture.read()
                    if not ok:
                        break
                    if index % stride:
                        index += 1
                        continue

                    t_ms = int(round(index * 1000.0 / source_fps))
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    result = landmarker.detect_for_video(image, t_ms)

                    points = _points_from(result)
                    if points is None:
                        track.missed_frames += 1
                    else:
                        track.frames.append({"t_ms": t_ms, "points": points})
                    index += 1

            log.info(
                "pose: %s -> %d frames (%.0f%% detected) from %s",
                video.name, len(track.frames), track.detection_rate * 100, camera,
            )
            return track
        finally:
            capture.release()


def _points_from(result: Any) -> list[list[float]] | None:
    """Normalised [x, y, visibility] per landmark, or None if nobody found."""
    landmarks = getattr(result, "pose_landmarks", None)
    if not landmarks:
        return None
    first = landmarks[0]
    if len(first) < len(MEDIAPIPE_LANDMARKS):
        return None
    return [
        [
            round(float(point.x), 4),
            round(float(point.y), 4),
            round(float(getattr(point, "visibility", 1.0)), 3),
        ]
        for point in first[: len(MEDIAPIPE_LANDMARKS)]
    ]
