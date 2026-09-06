"""Filesystem watcher for Kinovea's export directory.

Two problems make this less trivial than "watchdog fires, ingest file":

1. **Partial files.** watchdog reports ``on_created`` the moment the file is
   opened, while Kinovea is still muxing into it. We poll for size/mtime
   stability before handing the file to the correlator.
2. **Timestamps.** ``mtime`` is when Kinovea *finished* writing, which is
   seconds after the ball was struck. See ``kinovea_timestamp_mode``.

watchdog runs its own threads, so submissions are marshalled back onto the
FastAPI event loop with ``run_coroutine_threadsafe``.
"""

from __future__ import annotations

import asyncio
import logging
import queue
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from .config import Settings
from .correlator import Fragment, ShotCorrelator
from .models import SourceKind
from . import storage

log = logging.getLogger(__name__)

_TIMESTAMP_HINT = re.compile(r"\d{4}[-_]?\d{2}[-_]?\d{2}[ T_-]?\d{2}[-_:]?\d{2}[-_:]?\d{2}")


class _ExportEventHandler(FileSystemEventHandler):
    def __init__(self, sink: queue.Queue[Path], extensions: set[str]) -> None:
        self._sink = sink
        self._extensions = extensions

    def _offer(self, raw_path: str) -> None:
        path = Path(raw_path)
        if path.suffix.lower() in self._extensions:
            self._sink.put(path)

    def on_created(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self._offer(event.src_path)

    def on_moved(self, event: FileSystemEvent) -> None:
        # Kinovea (and many encoders) write to a temp name and rename on close.
        if not event.is_directory:
            self._offer(event.dest_path)

    def on_modified(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self._offer(event.src_path)


class KinoveaWatcher:
    def __init__(
        self,
        settings: Settings,
        correlator: ShotCorrelator,
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        self.settings = settings
        self.correlator = correlator
        self.loop = loop
        self._queue: queue.Queue[Path] = queue.Queue()
        self._observer: Observer | None = None
        self._worker: threading.Thread | None = None
        self._stop = threading.Event()
        self._seen: set[str] = set()
        self._seen_lock = threading.Lock()

    # -- lifecycle ---------------------------------------------------------

    def start(self) -> None:
        watch_dir = self.settings.kinovea_export_dir
        watch_dir.mkdir(parents=True, exist_ok=True)

        if self.settings.ingest_existing_on_start:
            for existing in sorted(watch_dir.iterdir()):
                if existing.is_file() and existing.suffix.lower() in self._extensions:
                    self._queue.put(existing)

        self._worker = threading.Thread(
            target=self._drain, name="kinovea-ingest", daemon=True
        )
        self._worker.start()

        handler = _ExportEventHandler(self._queue, self._extensions)
        self._observer = Observer()
        self._observer.schedule(handler, str(watch_dir), recursive=False)
        self._observer.start()
        log.info("watching Kinovea export dir: %s", watch_dir)

    def stop(self) -> None:
        self._stop.set()
        if self._observer is not None:
            self._observer.stop()
            self._observer.join(timeout=5)
            self._observer = None
        if self._worker is not None:
            self._worker.join(timeout=5)
            self._worker = None

    @property
    def _extensions(self) -> set[str]:
        return {ext.lower() for ext in self.settings.kinovea_extensions}

    # -- worker ------------------------------------------------------------

    def _drain(self) -> None:
        while not self._stop.is_set():
            try:
                path = self._queue.get(timeout=0.25)
            except queue.Empty:
                continue
            try:
                self._process(path)
            except Exception:
                log.exception("failed to ingest Kinovea export %s", path)

    def _process(self, path: Path) -> None:
        key = str(path.resolve())
        with self._seen_lock:
            if key in self._seen:
                return
            self._seen.add(key)

        if not self._wait_until_stable(path):
            log.warning("gave up waiting for %s to stop growing", path.name)
            with self._seen_lock:
                self._seen.discard(key)
            return

        impact_ts, timestamp_source, probe = self._impact_timestamp(path)
        staged = storage.stage_path(self.settings, path.suffix.lower())
        storage.move_into(path, staged)

        payload: dict[str, Any] = {
            "origin": {
                "kind": "kinovea",
                "original_filename": path.name,
                "timestamp_source": timestamp_source,
                "write_lag_s": self.settings.kinovea_write_lag_seconds,
            },
            #: Where the strike sits inside this clip -- Build 2 aligns the two
            #: players on this, not on file start.
            "impact_offset_s": self.settings.kinovea_impact_offset_seconds,
        }
        if probe:
            payload["origin"]["probed_duration_s"] = probe.get("duration_s")

        fragment = Fragment(
            kind=SourceKind.SWING_VIDEO,
            timestamp=impact_ts,
            payload=payload,
            staged_path=staged,
        )
        future = asyncio.run_coroutine_threadsafe(
            self.correlator.submit(fragment), self.loop
        )
        outcome = future.result(timeout=30)
        log.info("ingested swing video %s -> %s", path.name, outcome)

    def _wait_until_stable(self, path: Path) -> bool:
        """Block until the file stops growing, or the timeout expires."""
        deadline = time.time() + self.settings.file_stable_timeout_seconds
        stable_for = 0
        last: tuple[int, float] | None = None
        while time.time() < deadline and not self._stop.is_set():
            try:
                stat = path.stat()
            except FileNotFoundError:
                return False
            current = (stat.st_size, stat.st_mtime)
            if last is not None and current == last and stat.st_size > 0:
                stable_for += 1
                if stable_for >= self.settings.file_stable_checks:
                    return True
            else:
                stable_for = 0
            last = current
            time.sleep(self.settings.file_stable_interval_seconds)
        return False

    def _impact_timestamp(self, path: Path) -> tuple[float, str, dict[str, Any] | None]:
        """Best estimate of when the ball was actually struck.

        See ``kinovea_timestamp_mode`` in ``config.py``; calibration guidance
        lives in the README.
        """
        mode = self.settings.kinovea_timestamp_mode
        lag = self.settings.kinovea_write_lag_seconds
        offset = self.settings.kinovea_impact_offset_seconds
        mtime = path.stat().st_mtime
        probe: dict[str, Any] | None = None

        if mode == "filename":
            parsed = self._timestamp_from_filename(path.name)
            if parsed is not None:
                return parsed + offset, "filename", None
            log.warning("no timestamp in %s, falling back to mtime", path.name)
            return mtime - lag, "mtime-fallback", None

        if mode == "mtime_minus_duration":
            probe = storage.probe_video_sync(self.settings, path)
            duration = (probe or {}).get("duration_s")
            if duration is not None:
                return mtime - lag - float(duration) + offset, "mtime_minus_duration", probe
            log.warning("could not probe duration of %s, falling back to mtime", path.name)
            return mtime - lag, "mtime-fallback", probe

        return mtime - lag, "mtime", None

    def _timestamp_from_filename(self, name: str) -> float | None:
        match = _TIMESTAMP_HINT.search(name)
        if match is None:
            return None
        candidate = match.group(0)
        for fmt in self.settings.kinovea_filename_time_formats:
            try:
                # Kinovea names files in local time.
                return datetime.strptime(candidate, fmt).astimezone().timestamp()
            except ValueError:
                continue
        # Last resort: strip separators and try a canonical layout.
        digits = re.sub(r"\D", "", candidate)
        if len(digits) == 14:
            try:
                return datetime.strptime(digits, "%Y%m%d%H%M%S").astimezone().timestamp()
            except ValueError:
                return None
        return None
