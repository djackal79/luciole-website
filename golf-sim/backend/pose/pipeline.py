"""Async pose extraction, run after a shot closes.

Extraction takes seconds per clip, so it must never sit in the ingest path.
A shot is written and announced first; pose is marked ``pending``, computed on
a worker, and folded in afterwards with a second ``shot.updated``.

All metadata writes go back through the correlator rather than straight to
disk. The correlator may still be holding the shot in memory and may still
late-attach a straggler to it -- writing behind its back would have that next
write clobber the pose block.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from ..config import Settings
from ..models import DataStatus, SourceName
from .extractor import ExtractionError, PoseExtractor, PoseTrack
from .landmarks import MEDIAPIPE_LANDMARKS
from .metrics import summarise

log = logging.getLogger(__name__)

POSE_FILENAME = "pose.json"
SIDECAR_SCHEMA_VERSION = "1.1"

#: Media sources pose can be estimated from, in preference order.
POSE_INPUTS = (SourceName.BODY_SWING, SourceName.BODY_SWING_DTL)


class PosePipeline:
    def __init__(self, settings: Settings, correlator: Any) -> None:
        self.settings = settings
        self.correlator = correlator
        self.extractor = PoseExtractor(
            settings.pose_model_path, min_confidence=settings.pose_min_confidence
        )
        self._queue: asyncio.Queue[str] = asyncio.Queue(maxsize=settings.pose_queue_size)
        self._worker: asyncio.Task[None] | None = None

    # -- lifecycle ---------------------------------------------------------

    async def start(self) -> None:
        if not self.settings.pose_enabled:
            log.info("pose extraction disabled")
            return
        if (reason := self.extractor.available()) is not None:
            # Not fatal: shots still ingest, they just carry no pose.
            log.warning("pose extraction unavailable -- %s", reason)
            return
        if self._worker is None:
            self._worker = asyncio.create_task(self._run(), name="pose-worker")
            log.info("pose extraction ready (%s)", self.settings.pose_model_path)

    async def stop(self) -> None:
        if self._worker is not None:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
            self._worker = None

    @property
    def live(self) -> bool:
        return self._worker is not None and not self._worker.done()

    # -- queueing ----------------------------------------------------------

    def enqueue(self, shot_id: str) -> bool:
        """Queue a shot. Never blocks -- called with the correlator lock held."""
        if not self.live:
            return False
        try:
            self._queue.put_nowait(shot_id)
            return True
        except asyncio.QueueFull:
            # Better to lose pose on one shot than to stall the range session.
            log.warning("pose queue full; skipping %s", shot_id)
            return False

    # -- worker ------------------------------------------------------------

    async def _run(self) -> None:
        while True:
            shot_id = await self._queue.get()
            try:
                await self._process(shot_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("pose worker error for %s", shot_id)
                # Last resort: never leave a shot pending.
                try:
                    await self.correlator.set_pose(
                        shot_id,
                        {"status": DataStatus.FAILED.value, "error": "pose worker error"},
                    )
                except Exception:
                    log.exception("could not mark %s pose failed", shot_id)
            finally:
                self._queue.task_done()

    async def _process(self, shot_id: str) -> None:
        directory = self.settings.shots_dir / f"shot_{shot_id}"
        metadata = await self.correlator.set_pose(
            shot_id, {"status": DataStatus.PENDING.value, "cameras": []}
        )
        if metadata is None:
            log.warning("pose: shot %s vanished before extraction", shot_id)
            return

        clips = _pose_inputs(metadata, directory)
        if not clips:
            await self.correlator.set_pose(
                shot_id,
                {"status": DataStatus.UNAVAILABLE.value, "error": "no body-swing clip"},
            )
            return

        await self.correlator.set_pose(
            shot_id,
            {"status": DataStatus.PENDING.value, "cameras": [name for name, _, _ in clips]},
        )

        try:
            tracks = await asyncio.to_thread(self._extract_all, clips)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # Deliberately broad. The estimator is a native library and can
            # fail in ways that are not ExtractionError -- a missing graphics
            # dependency raises OSError from deep inside it. Letting that
            # escape would leave the shot reading "computing" forever, which
            # is worse than an honest failure.
            log.warning("pose: %s -- %s", shot_id, exc, exc_info=not isinstance(exc, ExtractionError))
            await self.correlator.set_pose(
                shot_id,
                {"status": DataStatus.FAILED.value, "error": f"{type(exc).__name__}: {exc}"},
            )
            return

        if not any(track.frames for track in tracks.values()):
            await self.correlator.set_pose(
                shot_id,
                {
                    "status": DataStatus.FAILED.value,
                    "cameras": list(tracks),
                    "error": "no golfer detected in any frame",
                },
            )
            return

        await asyncio.to_thread(_write_sidecar, directory, tracks)

        total_frames = sum(len(track.frames) for track in tracks.values())
        await self.correlator.set_pose(
            shot_id,
            {
                "status": DataStatus.READY.value,
                "path": POSE_FILENAME,
                "model": self.settings.pose_model_path.stem,
                "dimensions": "2d",
                "cameras": list(tracks),
                "frame_count": total_frames,
                "error": None,
                "summary": summarise(tracks),
            },
        )
        log.info("pose ready for %s (%d frames)", shot_id, total_frames)

    def _extract_all(
        self, clips: list[tuple[str, Path, dict[str, Any]]]
    ) -> dict[str, PoseTrack]:
        tracks: dict[str, PoseTrack] = {}
        for source, path, entry in clips:
            tracks[source] = self.extractor.extract(
                path,
                camera=entry.get("camera") or source,
                impact_ms=entry.get("impact_ms"),
                max_fps=self.settings.pose_max_fps,
            )
        return tracks


def _pose_inputs(
    metadata: dict[str, Any], directory: Path
) -> list[tuple[str, Path, dict[str, Any]]]:
    """Body-swing clips present on disk, in preference order."""
    found = []
    for source in POSE_INPUTS:
        entry = (metadata.get("media") or {}).get(source.value)
        if not entry or not entry.get("path"):
            continue
        path = directory / entry["path"]
        if path.is_file():
            found.append((source.value, path, entry))
    return found


def _write_sidecar(directory: Path, tracks: dict[str, PoseTrack]) -> None:
    """Atomic, like metadata.json -- a reader must never see half a file."""
    payload = {
        "schema_version": SIDECAR_SCHEMA_VERSION,
        "model": "mediapipe_pose",
        "dimensions": "2d",
        "coordinate_space": "normalised_image",
        "point_format": ["x", "y", "visibility"],
        "landmarks": MEDIAPIPE_LANDMARKS,
        "tracks": {name: track.as_dict() for name, track in tracks.items()},
    }
    tmp = directory / f".{POSE_FILENAME}.tmp"
    tmp.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(directory / POSE_FILENAME)
