"""Timestamp correlation: three async streams in, one shot package out.

The three capture sources are completely independent and arrive out of order
with wildly different latencies:

* **telemetry** — a few ms after impact (the authoritative impact time),
* **impact video** — 1-4 s after impact (ring-buffer snapshot, mux, upload),
* **swing video** — 2-6 s after impact (Kinovea post-roll + encode + flush).

Fragments are therefore matched on *impact timestamp*, never on arrival order
or arrival time. A shot stays open until either every expected artefact has
landed or ``settle_seconds`` elapse, whichever comes first.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config import Settings
from .events import EventBus
from .models import METADATA_SCHEMA_VERSION, ShotStatus, SourceKind, utc_iso
from . import storage

log = logging.getLogger(__name__)


@dataclass
class Fragment:
    """One artefact of a shot, already converted to host-clock time."""

    kind: SourceKind
    #: Host-clock epoch seconds at which impact occurred.
    timestamp: float
    payload: dict[str, Any] = field(default_factory=dict)
    #: Populated for media fragments; the file lives in the staging dir.
    staged_path: Path | None = None
    received_at: float = field(default_factory=time.time)


@dataclass
class OpenShot:
    anchor_ts: float
    anchor_kind: SourceKind
    created_at: float
    fragments: dict[SourceKind, Fragment] = field(default_factory=dict)

    def deadline(self, settle_seconds: float) -> float:
        # Grace runs from the anchor, but never less than `settle_seconds`
        # after the shot first appeared -- a Kinovea file whose timestamp was
        # back-dated must not finalise the instant it lands.
        return max(self.anchor_ts, self.created_at) + settle_seconds


@dataclass
class FinalizedShot:
    shot_id: str
    directory: Path
    anchor_ts: float
    finalized_at: float
    metadata: dict[str, Any]


class ShotCorrelator:
    def __init__(self, settings: Settings, bus: EventBus) -> None:
        self.settings = settings
        self.bus = bus
        self._open: list[OpenShot] = []
        self._finalized: list[FinalizedShot] = []
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
            await self.flush_all()

    # -- ingest ------------------------------------------------------------

    async def submit(self, fragment: Fragment) -> str:
        """Attach a fragment to a shot, opening one if nothing matches.

        Returns a human-readable description of what happened, for logging.
        """
        async with self._lock:
            shot = self._match_open(fragment)
            if shot is not None:
                self._attach(shot, fragment)
                outcome = "attached-open"
                if self._is_complete(shot):
                    await self._finalize(shot, ShotStatus.COMPLETE)
                    outcome = "attached-open-completed"
                return outcome

            finalized = self._match_finalized(fragment)
            if finalized is not None:
                await self._attach_late(finalized, fragment)
                return "attached-late"

            shot = OpenShot(
                anchor_ts=fragment.timestamp,
                anchor_kind=fragment.kind,
                created_at=time.time(),
            )
            self._open.append(shot)
            self.bus.publish(
                "shot_opened",
                {
                    "anchor_timestamp": shot.anchor_ts,
                    "anchor_iso": utc_iso(shot.anchor_ts),
                    "anchor_kind": shot.anchor_kind.value,
                },
            )
            self._attach(shot, fragment)
            if self._is_complete(shot):
                await self._finalize(shot, ShotStatus.COMPLETE)
                return "opened-completed"
            return "opened"

    # -- matching ----------------------------------------------------------

    def _match_open(self, fragment: Fragment) -> OpenShot | None:
        """Nearest open shot inside the window that still needs this artefact.

        Shots that already hold this artefact are skipped rather than
        overwritten, so two swings inside the pairing window become two shots
        instead of one shot with a clobbered clip.
        """
        window = self.settings.pair_window_seconds
        candidates = [
            shot
            for shot in self._open
            if fragment.kind not in shot.fragments
            and abs(shot.anchor_ts - fragment.timestamp) <= window
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda shot: abs(shot.anchor_ts - fragment.timestamp))

    def _match_finalized(self, fragment: Fragment) -> FinalizedShot | None:
        now = time.time()
        window = self.settings.pair_window_seconds
        candidates = [
            shot
            for shot in self._finalized
            if abs(shot.anchor_ts - fragment.timestamp) <= window
            and now - shot.finalized_at <= self.settings.late_attach_seconds
            and not shot.metadata["sources"].get(fragment.kind.value, {}).get("present")
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda shot: abs(shot.anchor_ts - fragment.timestamp))

    def _attach(self, shot: OpenShot, fragment: Fragment) -> None:
        shot.fragments[fragment.kind] = fragment
        # The launch monitor sees the actual strike, so it wins the anchor.
        if fragment.kind is SourceKind.TELEMETRY and shot.anchor_kind is not SourceKind.TELEMETRY:
            shot.anchor_ts = fragment.timestamp
            shot.anchor_kind = SourceKind.TELEMETRY
        self.bus.publish(
            "fragment_attached",
            {
                "kind": fragment.kind.value,
                "anchor_timestamp": shot.anchor_ts,
                "offset_s": round(fragment.timestamp - shot.anchor_ts, 4),
                "have": sorted(k.value for k in shot.fragments),
            },
        )

    def _is_complete(self, shot: OpenShot) -> bool:
        return all(
            SourceKind(name) in shot.fragments for name in self.settings.expected_sources
        )

    # -- finalisation ------------------------------------------------------

    async def _reap_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(self.settings.reaper_interval_seconds)
                await self._reap_once()
            except asyncio.CancelledError:
                raise
            except Exception:  # keep the reaper alive through transient errors
                log.exception("shot reaper iteration failed")

    async def _reap_once(self) -> None:
        now = time.time()
        async with self._lock:
            expired = [
                shot for shot in self._open if now >= shot.deadline(self.settings.settle_seconds)
            ]
            for shot in expired:
                await self._finalize(shot, ShotStatus.PARTIAL)
            self._prune_finalized(now)

    async def flush_all(self) -> None:
        """Write out every open shot; used on shutdown."""
        async with self._lock:
            for shot in list(self._open):
                status = ShotStatus.COMPLETE if self._is_complete(shot) else ShotStatus.PARTIAL
                await self._finalize(shot, status)

    def _prune_finalized(self, now: float) -> None:
        cutoff = self.settings.late_attach_seconds
        self._finalized = [s for s in self._finalized if now - s.finalized_at <= cutoff]

    async def _finalize(self, shot: OpenShot, status: ShotStatus) -> FinalizedShot:
        """Caller must hold ``self._lock``."""
        if shot in self._open:
            self._open.remove(shot)

        shot_dir = await asyncio.to_thread(
            storage.unique_shot_dir, self.settings.shots_dir, shot.anchor_ts
        )
        metadata = self._base_metadata(shot, shot_dir.name, status)

        for kind_name in self.settings.expected_sources:
            kind = SourceKind(kind_name)
            fragment = shot.fragments.get(kind)
            if fragment is None:
                metadata["sources"][kind_name] = {"present": False}
                continue
            metadata["sources"][kind_name] = await self._materialize(
                fragment, shot_dir, shot.anchor_ts
            )

        # Artefacts outside `expected_sources` are still worth keeping.
        for kind, fragment in shot.fragments.items():
            if kind.value not in metadata["sources"]:
                metadata["sources"][kind.value] = await self._materialize(
                    fragment, shot_dir, shot.anchor_ts
                )

        self._refresh_derived(metadata)
        await asyncio.to_thread(storage.write_metadata, shot_dir, metadata)

        finalized = FinalizedShot(
            shot_id=metadata["shot_id"],
            directory=shot_dir,
            anchor_ts=shot.anchor_ts,
            finalized_at=time.time(),
            metadata=metadata,
        )
        self._finalized.append(finalized)
        log.info(
            "finalized %s (%s) sources=%s",
            finalized.shot_id,
            metadata["status"],
            ",".join(metadata["present_sources"]) or "none",
        )
        self.bus.publish("shot_finalized", {"shot_id": finalized.shot_id, "shot": metadata})
        return finalized

    def _base_metadata(self, shot: OpenShot, shot_id: str, status: ShotStatus) -> dict[str, Any]:
        telemetry = shot.fragments.get(SourceKind.TELEMETRY)
        payload = telemetry.payload if telemetry else {}
        return {
            "schema_version": METADATA_SCHEMA_VERSION,
            "shot_id": shot_id,
            "status": status.value,
            "created_at": utc_iso(shot.created_at),
            "finalized_at": utc_iso(time.time()),
            "club": payload.get("club"),
            "session_id": payload.get("session_id"),
            "anchor": {
                "timestamp": round(shot.anchor_ts, 6),
                "iso": utc_iso(shot.anchor_ts),
                "source": shot.anchor_kind.value,
            },
            "pairing": {
                "window_seconds": self.settings.pair_window_seconds,
                "settle_seconds": self.settings.settle_seconds,
                "offsets_s": {},
            },
            "present_sources": [],
            "missing_sources": [],
            "sources": {},
        }

    async def _materialize(
        self, fragment: Fragment, shot_dir: Path, anchor_ts: float
    ) -> dict[str, Any]:
        """Move a fragment's file into the package and describe it."""
        entry: dict[str, Any] = {
            "present": True,
            "timestamp": round(fragment.timestamp, 6),
            "timestamp_iso": utc_iso(fragment.timestamp),
            "offset_s": round(fragment.timestamp - anchor_ts, 4),
            "received_at": utc_iso(fragment.received_at),
        }
        entry.update({k: v for k, v in fragment.payload.items() if k != "club"})

        if fragment.staged_path is not None:
            name = storage.CANONICAL_FILENAMES.get(fragment.kind.value, fragment.kind.value)
            destination = shot_dir / f"{name}{fragment.staged_path.suffix.lower()}"
            await asyncio.to_thread(storage.move_into, fragment.staged_path, destination)
            entry["file"] = destination.name
            entry["bytes"] = destination.stat().st_size
            entry["sha256"] = await asyncio.to_thread(storage.sha256_file, destination)
            probe = await storage.probe_video(self.settings, destination)
            if probe:
                entry["video"] = probe
        return entry

    @staticmethod
    def _refresh_derived(metadata: dict[str, Any]) -> None:
        present, missing, offsets = [], [], {}
        for name, entry in metadata["sources"].items():
            if entry.get("present"):
                present.append(name)
                offsets[name] = entry.get("offset_s", 0.0)
            else:
                missing.append(name)
        metadata["present_sources"] = sorted(present)
        metadata["missing_sources"] = sorted(missing)
        metadata["pairing"]["offsets_s"] = offsets

    async def _attach_late(self, finalized: FinalizedShot, fragment: Fragment) -> None:
        """Absorb a straggler into an already-written package."""
        entry = await self._materialize(fragment, finalized.directory, finalized.anchor_ts)
        metadata = finalized.metadata
        metadata["sources"][fragment.kind.value] = entry
        if fragment.kind is SourceKind.TELEMETRY:
            metadata["club"] = fragment.payload.get("club") or metadata.get("club")
            metadata["session_id"] = (
                fragment.payload.get("session_id") or metadata.get("session_id")
            )
        self._refresh_derived(metadata)
        if all(
            metadata["sources"].get(name, {}).get("present")
            for name in self.settings.expected_sources
        ):
            metadata["status"] = ShotStatus.COMPLETE.value
        metadata["finalized_at"] = utc_iso(time.time())
        await asyncio.to_thread(storage.write_metadata, finalized.directory, metadata)
        log.info("late-attached %s to %s", fragment.kind.value, finalized.shot_id)
        self.bus.publish(
            "shot_updated", {"shot_id": finalized.shot_id, "shot": metadata, "late": True}
        )

    # -- introspection -----------------------------------------------------

    def open_snapshot(self) -> list[dict[str, Any]]:
        return [
            {
                "anchor_timestamp": shot.anchor_ts,
                "anchor_iso": utc_iso(shot.anchor_ts),
                "anchor_kind": shot.anchor_kind.value,
                "have": sorted(kind.value for kind in shot.fragments),
                "deadline_in_s": round(
                    shot.deadline(self.settings.settle_seconds) - time.time(), 2
                ),
            }
            for shot in self._open
        ]
