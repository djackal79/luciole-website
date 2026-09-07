"""Shot pairing.

The PC is the clock authority. Every artefact is stamped on receipt; a
device-supplied ``trigger_ts`` is kept only as an ordering hint and never
decides a pairing, because a phone's wall clock drifts.

Pairing is on the *trigger event*, not on absolute wall-clock time: both
cameras fire from the same physical strike, so an artefact joins the nearest
open shot that is still missing that source. The window is a guard against
pairing across two different strikes, not the primary matching mechanism.

A shot is emitted as soon as anything lands (``pending``) and updated as the
rest arrives, so the frontend shows the shot immediately rather than waiting
for the window to close.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from . import events, storage
from .config import Settings
from .events import EventBus
from .models import (
    MediaEntry,
    ShotPackage,
    ShotPatch,
    ShotStatus,
    SourceName,
    SyncBlock,
    TelemetryBlock,
    iso,
    local_now,
    shot_id_for,
)

log = logging.getLogger(__name__)


@dataclass
class MediaArrival:
    """A clip that has landed on the PC and is ready to join a shot."""

    source: SourceName
    file: Path
    camera: str
    capture_fps: float | None = None
    container_fps: float | None = None
    duration_ms: int | None = None
    width: int | None = None
    height: int | None = None
    #: Where impact sits inside this clip, in file playback milliseconds.
    #: Follows from the capture trigger's pre-roll buffer.
    impact_ms: int | None = None
    #: True for a file the backend does not own (a Kinovea recording the user
    #: may still want where Kinovea left it).
    copy: bool = False
    #: Device-supplied hint. Ordering only -- never used for matching.
    trigger_hint: str | None = None


@dataclass
class TrackedShot:
    package: ShotPackage
    directory: Path
    #: PC receipt time of this shot's first artefact.
    trigger_ts: float
    closed_at: float | None = None

    @property
    def is_open(self) -> bool:
        return self.closed_at is None


class ShotCorrelator:
    def __init__(self, settings: Settings, bus: EventBus, session_id: str) -> None:
        self.settings = settings
        self.bus = bus
        #: Set by the app once the pose worker exists. Optional, so the
        #: correlator stays usable on its own in tests.
        self.pose_pipeline: Any | None = None
        self.session_id = session_id
        #: Current club selection. Stamped onto every new shot, whichever
        #: source opens it, so a video-only shot is still labelled.
        self.current_club: str | None = None
        self._tracked: list[TrackedShot] = []
        self._lock = asyncio.Lock()
        self._reaper: asyncio.Task[None] | None = None

    # -- lifecycle ---------------------------------------------------------

    async def start(self) -> None:
        if self._reaper is None:
            self._reaper = asyncio.create_task(self._reap_loop(), name="shot-reaper")

    async def stop(self, *, flush: bool = True) -> None:
        if self._reaper is not None:
            self._reaper.cancel()
            try:
                await self._reaper
            except asyncio.CancelledError:
                pass
            self._reaper = None
        if flush:
            await self.close_all()

    async def reset_session(self, session_id: str) -> None:
        """Start a new session; the frontend clears its history drawer.

        Restarts the reaper defensively. A caller that stopped the correlator
        first would otherwise leave it running without one, and every
        subsequent shot would sit open forever instead of timing out into
        ``partial`` -- silent, and invisible until someone noticed no shot ever
        completed again.
        """
        await self.close_all()
        async with self._lock:
            self.session_id = session_id
            self._tracked.clear()
        await self.start()
        self.bus.publish(events.SESSION_RESET, {"session_id": session_id})
        log.info("session reset -> %s", session_id)

    # -- ingest ------------------------------------------------------------

    async def submit_media(
        self, arrival: MediaArrival, *, received_at: float | None = None
    ) -> ShotPackage:
        # received_at lets the fallback watcher back-date its stamp, since it
        # only sees a file once encoding finished. Live ingest never sets it.
        received = time.time() if received_at is None else received_at
        async with self._lock:
            shot, how = self._route(arrival.source, received)
            entry = await self._place_media(shot, arrival)
            shot.package.media[arrival.source.value] = entry
            shot.package.sources[arrival.source.value] = True
            return await self._commit(shot, how, arrival.source)

    async def submit_telemetry(self, telemetry: TelemetryBlock) -> ShotPackage:
        received = time.time()
        async with self._lock:
            shot, how = self._route(SourceName.TELEMETRY, received)
            shot.package.telemetry = telemetry
            shot.package.sources[SourceName.TELEMETRY.value] = True
            return await self._commit(shot, how, SourceName.TELEMETRY)

    # -- routing -----------------------------------------------------------

    def _route(self, source: SourceName, received: float) -> tuple[TrackedShot, str]:
        """Nearest unmatched trigger, else a new shot."""
        window = self.settings.pair_window_s

        open_candidates = [
            shot
            for shot in self._tracked
            if shot.is_open
            and not shot.package.sources.get(source.value)
            and abs(shot.trigger_ts - received) <= window
        ]
        if open_candidates:
            return min(open_candidates, key=lambda s: abs(s.trigger_ts - received)), "attached"

        # A straggler joins the shot it belongs to instead of opening a
        # phantom one. Set GOLFSIM_LATE_ATTACH_MS=0 for strict window
        # behaviour.
        if self.settings.late_attach_s > 0:
            late_candidates = [
                shot
                for shot in self._tracked
                if not shot.is_open
                and not shot.package.sources.get(source.value)
                and received - (shot.closed_at or 0) <= self.settings.late_attach_s
            ]
            if late_candidates:
                return min(late_candidates, key=lambda s: abs(s.trigger_ts - received)), "late"

        return self._create(received), "created"

    def _create(self, received: float) -> TrackedShot:
        moment = local_now()
        directory, shot_id = storage.unique_shot_dir(
            self.settings.shots_dir, shot_id_for(moment)
        )
        package = ShotPackage(
            shot_id=shot_id,
            session_id=self.session_id,
            created_at=iso(moment),
            status=ShotStatus.PENDING,
            sync=SyncBlock(trigger_ts=iso(moment), impact_offset_ms=0),
            club_used=self.current_club,
        )
        shot = TrackedShot(package=package, directory=directory, trigger_ts=received)
        self._tracked.append(shot)
        return shot

    async def _place_media(self, shot: TrackedShot, arrival: MediaArrival) -> MediaEntry:
        destination = shot.directory / f"{arrival.source.value}{arrival.file.suffix.lower()}"
        await asyncio.to_thread(
            storage.place_media, arrival.file, destination, copy=arrival.copy
        )
        probe = await storage.probe_video(self.settings, destination)
        return MediaEntry(
            path=destination.name,
            camera=arrival.camera,
            # capture_fps cannot be probed -- 240 fps footage in a 30 fps
            # container probes as 30 -- so the ingesting client must supply it.
            capture_fps=arrival.capture_fps,
            container_fps=arrival.container_fps or probe.get("container_fps"),
            duration_ms=arrival.duration_ms or probe.get("duration_ms"),
            width=arrival.width or probe.get("width"),
            height=arrival.height or probe.get("height"),
            impact_ms=arrival.impact_ms,
        )

    async def _commit(
        self, shot: TrackedShot, how: str, source: SourceName
    ) -> ShotPackage:
        """Persist and announce a change. Caller holds the lock."""
        complete = all(
            shot.package.sources.get(name) for name in self.settings.expected_sources
        )
        if complete:
            shot.package.status = ShotStatus.COMPLETE
            shot.closed_at = shot.closed_at or time.time()
        await self._persist(shot)

        if complete:
            event = events.SHOT_COMPLETED
            self._request_pose(shot)
        elif how == "created":
            event = events.SHOT_CREATED
        else:
            event = events.SHOT_UPDATED
        self._publish(event, shot)

        log.info(
            "%s %s via %s (%s) sources=%s",
            event,
            shot.package.shot_id,
            source.value,
            how,
            ",".join(k for k, v in shot.package.sources.items() if v),
        )
        return shot.package

    async def _persist(self, shot: TrackedShot) -> None:
        await asyncio.to_thread(
            storage.write_metadata, shot.directory, shot.package.to_json()
        )

    def _request_pose(self, shot: TrackedShot) -> None:
        """Queue extraction once, when the shot closes and a clip exists."""
        if self.pose_pipeline is None:
            return
        if not any(
            shot.package.sources.get(source.value)
            for source in (SourceName.BODY_SWING, SourceName.BODY_SWING_DTL)
        ):
            return
        self.pose_pipeline.enqueue(shot.package.shot_id)

    def _publish(self, event_type: str, shot: TrackedShot) -> None:
        self.bus.publish(event_type, shot.package.to_json(), shot_id=shot.package.shot_id)

    # -- closing -----------------------------------------------------------

    async def _reap_loop(self) -> None:
        interval = self.settings.reaper_interval_ms / 1000.0
        while True:
            try:
                await asyncio.sleep(interval)
                await self._reap_once()
            except asyncio.CancelledError:
                raise
            except Exception:  # keep the reaper alive through transient errors
                log.exception("shot reaper iteration failed")

    async def _reap_once(self) -> None:
        now = time.time()
        async with self._lock:
            for shot in list(self._tracked):
                if shot.is_open and now >= shot.trigger_ts + self.settings.pair_window_s:
                    await self._close_partial(shot, now)
            self._prune(now)

    async def _close_partial(self, shot: TrackedShot, now: float) -> None:
        """Window expired with sources missing.

        Emit shot.completed with status partial rather than holding the shot
        open -- a shot that never completes is worse than one that is honest
        about what is missing.
        """
        shot.package.status = ShotStatus.PARTIAL
        shot.closed_at = now
        await self._persist(shot)
        self._publish(events.SHOT_COMPLETED, shot)
        self._request_pose(shot)
        log.info(
            "shot.completed %s (partial) missing=%s",
            shot.package.shot_id,
            ",".join(k for k, v in shot.package.sources.items() if not v),
        )

    async def close_all(self) -> None:
        now = time.time()
        async with self._lock:
            for shot in list(self._tracked):
                if shot.is_open:
                    await self._close_partial(shot, now)

    def _prune(self, now: float) -> None:
        """Drop closed shots from memory once no straggler could still join.

        They remain on disk; only the in-memory pairing candidates shrink.
        """
        horizon = max(self.settings.late_attach_s, 1.0)
        self._tracked = [
            shot
            for shot in self._tracked
            if shot.is_open or now - (shot.closed_at or 0) <= horizon
        ]

    # -- mutation ----------------------------------------------------------

    async def patch(self, shot_id: str, patch: ShotPatch) -> dict[str, Any] | None:
        """Apply a PATCH to a shot, whether or not it is still in memory."""
        async with self._lock:
            tracked = next(
                (s for s in self._tracked if s.package.shot_id == shot_id), None
            )
            directory = tracked.directory if tracked else self._shot_dir(shot_id)
            if directory is None:
                return None

            if tracked is not None:
                package = tracked.package
                _apply_patch(package, patch)
                metadata = package.to_json()
            else:
                metadata = storage.load_metadata(directory)
                if metadata is None:
                    return None
                _apply_patch_dict(metadata, patch)

            await asyncio.to_thread(storage.write_metadata, directory, metadata)
            self.bus.publish(events.SHOT_PATCHED, metadata, shot_id=shot_id)
            return metadata

    async def merge_telemetry(
        self, shot_id: str, telemetry: TelemetryBlock
    ) -> dict[str, Any] | None:
        """Fold a second telemetry frame into a shot already recorded.

        Some monitors split one strike across frames -- the Square sends ball
        data, then club data about 700 ms later, both with the same
        ShotNumber. Each is a genuine strike on its own, so without this the
        swing appears twice.

        Only fields the existing block is missing are taken, so the first
        frame's measurements are never overwritten by a later frame's zeros.
        Returns ``None`` when the shot has gone, so the caller can record the
        frame as a shot of its own rather than lose it.
        """
        async with self._lock:
            tracked = next(
                (s for s in self._tracked if s.package.shot_id == shot_id), None
            )
            directory = tracked.directory if tracked else self._shot_dir(shot_id)
            if directory is None:
                return None

            if tracked is not None:
                metadata = tracked.package.to_json()
            else:
                metadata = storage.load_metadata(directory)
                if metadata is None:
                    return None

            existing = metadata.get("telemetry") or {}
            incoming = telemetry.model_dump(mode="json")
            for section in ("ball", "club", "derived", "distance"):
                target = existing.setdefault(section, {})
                for key, value in (incoming.get(section) or {}).items():
                    if value in (None, 0, 0.0) or target.get(key) not in (None, 0, 0.0):
                        continue
                    target[key] = value
            # A flight modelled from richer launch data supersedes one that
            # was not modelled at all.
            if existing.get("flight") is None and incoming.get("flight") is not None:
                existing["flight"] = incoming["flight"]
            existing.setdefault("raw_frames", []).append(incoming.get("raw") or {})
            metadata["telemetry"] = existing

            if tracked is not None:
                tracked.package = ShotPackage.model_validate(metadata)
                metadata = tracked.package.to_json()
            storage.write_metadata(directory, metadata)
            self.bus.publish(events.SHOT_UPDATED, metadata, shot_id=shot_id)
            return metadata

    async def set_pose(self, shot_id: str, block: dict[str, Any]) -> dict[str, Any] | None:
        """Merge a pose block into a shot, wherever it currently lives.

        Routed through the correlator rather than written straight to disk: a
        shot may still be tracked in memory and may still late-attach a
        straggler, and that next write would clobber a pose block written
        behind its back.
        """
        async with self._lock:
            tracked = next(
                (s for s in self._tracked if s.package.shot_id == shot_id), None
            )
            directory = tracked.directory if tracked else self._shot_dir(shot_id)
            if directory is None:
                return None

            if tracked is not None:
                metadata = tracked.package.to_json()
            else:
                metadata = storage.load_metadata(directory)
                if metadata is None:
                    return None

            merged = {**(metadata.get("pose") or {}), **block}
            metadata["pose"] = merged
            # Pose counts as a present source only once it is actually
            # readable -- a pending extraction is not data the UI can draw.
            metadata["sources"]["pose"] = merged.get("status") == "ready"

            if tracked is not None:
                tracked.package = ShotPackage.model_validate(metadata)

            await asyncio.to_thread(storage.write_metadata, directory, metadata)
            self.bus.publish(events.SHOT_UPDATED, metadata, shot_id=shot_id)
            return metadata

    def _shot_dir(self, shot_id: str) -> Path | None:
        directory = self.settings.shots_dir / f"shot_{shot_id}"
        return directory if directory.is_dir() else None

    # -- introspection -----------------------------------------------------

    def open_count(self) -> int:
        return sum(1 for shot in self._tracked if shot.is_open)

    def snapshot(self) -> list[dict[str, Any]]:
        now = time.time()
        return [
            {
                "shot_id": shot.package.shot_id,
                "status": shot.package.status,
                "sources": shot.package.sources,
                "closes_in_ms": (
                    None
                    if not shot.is_open
                    else int((shot.trigger_ts + self.settings.pair_window_s - now) * 1000)
                ),
            }
            for shot in self._tracked
        ]


def _apply_patch(package: ShotPackage, patch: ShotPatch) -> None:
    if patch.tags is not None:
        package.tags = patch.tags
    if patch.notes is not None:
        package.notes = patch.notes
    if patch.club_used is not None:
        package.club_used = patch.club_used
    if patch.impact_offset_ms is not None:
        package.sync.impact_offset_ms = patch.impact_offset_ms


def _apply_patch_dict(metadata: dict[str, Any], patch: ShotPatch) -> None:
    if patch.tags is not None:
        metadata["tags"] = patch.tags
    if patch.notes is not None:
        metadata["notes"] = patch.notes
    if patch.club_used is not None:
        metadata["club_used"] = patch.club_used
    if patch.impact_offset_ms is not None:
        metadata.setdefault("sync", {})["impact_offset_ms"] = patch.impact_offset_ms
