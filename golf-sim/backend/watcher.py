"""Fallback filesystem watcher for Kinovea exports.

The preferred path is Kinovea's Automation hook (Options -> Preferences ->
Capture -> Automation), which runs a command after each recording and hands
over the filename. That posts straight to ``/api/ingest/body_swing``: fewer
moving parts, lower latency, and no polling race where a file is read
mid-write.

This watcher exists only for clips that appear without a notification. It is
off by default (``GOLFSIM_KINOVEA_WATCH_ENABLED``) and has to solve a problem
the hook does not: watchdog reports ``on_created`` while the encoder is still
writing, so the file is polled for size stability first.
"""

from __future__ import annotations

import asyncio
import logging
import queue
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from .config import Settings
from .correlator import MediaArrival, ShotCorrelator
from .models import SourceName

log = logging.getLogger(__name__)


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
        # Many encoders write a temp name and rename on close.
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

    @property
    def live(self) -> bool:
        return self._observer is not None

    @property
    def _extensions(self) -> set[str]:
        return {ext.lower() for ext in self.settings.kinovea_extensions}

    def start(self) -> None:
        watch_dir = self.settings.kinovea_export_dir
        watch_dir.mkdir(parents=True, exist_ok=True)

        self._worker = threading.Thread(target=self._drain, name="kinovea-ingest", daemon=True)
        self._worker.start()

        self._observer = Observer()
        self._observer.schedule(
            _ExportEventHandler(self._queue, self._extensions), str(watch_dir), recursive=False
        )
        self._observer.start()
        log.info("Kinovea fallback watcher active on %s", watch_dir)

    def stop(self) -> None:
        self._stop.set()
        if self._observer is not None:
            self._observer.stop()
            self._observer.join(timeout=5)
            self._observer = None
        if self._worker is not None:
            self._worker.join(timeout=5)
            self._worker = None

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

        arrival = MediaArrival(
            source=SourceName.BODY_SWING,
            file=path,
            camera=self.settings.body_swing_camera,
            capture_fps=self.settings.body_swing_capture_fps,
            container_fps=self.settings.body_swing_container_fps,
            copy=True,
        )
        # The file only became visible after encoding, so its receipt stamp is
        # later than the strike. Back-date it or the pairing window misses.
        received_at = time.time() - self.settings.kinovea_lag_ms / 1000.0
        future = asyncio.run_coroutine_threadsafe(
            self.correlator.submit_media(arrival, received_at=received_at), self.loop
        )
        package = future.result(timeout=30)
        log.info("watcher ingested %s -> %s", path.name, package.shot_id)

    def _wait_until_stable(self, path: Path) -> bool:
        deadline = time.time() + self.settings.file_stable_timeout_ms / 1000.0
        interval = self.settings.file_stable_interval_ms / 1000.0
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
            time.sleep(interval)
        return False
