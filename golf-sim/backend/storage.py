"""Shot package persistence.

On-disk layout::

    data/shots/
      shot_20260906T143052-478/
        metadata.json
        body_swing.mp4        # may be absent
        impact_strike.mp4     # may be absent

metadata.json is rewritten on every mutation, so disk always reflects the
current state of a shot -- including while it is still ``pending``.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from .config import Settings

log = logging.getLogger(__name__)

METADATA_FILENAME = "metadata.json"


def unique_shot_dir(shots_dir: Path, shot_id: str) -> tuple[Path, str]:
    """Reserve a folder, disambiguating the rare same-millisecond clash."""
    candidate_id = shot_id
    suffix = 1
    while True:
        directory = shots_dir / f"shot_{candidate_id}"
        try:
            directory.mkdir(parents=True, exist_ok=False)
            return directory, candidate_id
        except FileExistsError:
            candidate_id = f"{shot_id}x{suffix}"
            suffix += 1


def write_metadata(shot_dir: Path, metadata: dict[str, Any]) -> None:
    """Atomic write, so a reader never sees a half-written metadata.json."""
    tmp = shot_dir / f".{METADATA_FILENAME}.tmp"
    tmp.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, shot_dir / METADATA_FILENAME)


def load_metadata(shot_dir: Path) -> dict[str, Any] | None:
    path = shot_dir / METADATA_FILENAME
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("unreadable metadata in %s: %s", shot_dir, exc)
        return None


def place_media(source: Path, destination: Path, *, copy: bool) -> None:
    """Put a clip inside the shot folder.

    ``copy`` is for files the backend does not own -- a Kinovea recording the
    user may still want in its original location.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    if copy:
        shutil.copy2(source, destination)
        return
    try:
        os.replace(source, destination)
    except OSError:  # different filesystem
        shutil.move(str(source), str(destination))


def iter_shots(settings: Settings) -> list[dict[str, Any]]:
    """All shot packages, newest first (shot_id is lexically sortable)."""
    if not settings.shots_dir.is_dir():
        return []
    shots = []
    for child in sorted(settings.shots_dir.iterdir(), reverse=True):
        if child.is_dir() and (metadata := load_metadata(child)):
            shots.append(metadata)
    return shots


def probe_video_sync(settings: Settings, path: Path) -> dict[str, Any]:
    """Read stream properties with ffprobe.

    ffprobe is optional; without it the fields stay ``None`` and the package is
    still valid. Note this yields the *container* rate -- 240 fps footage in a
    30 fps container probes as 30, which is exactly why capture_fps is
    supplied by the ingesting client rather than inferred here.
    """
    command = [
        settings.ffprobe_path,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,avg_frame_rate:format=duration",
        "-of", "json",
        str(path),
    ]
    try:
        result = subprocess.run(
            command, capture_output=True, timeout=settings.probe_timeout_seconds, check=False
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as exc:
        log.debug("ffprobe unavailable for %s: %s", path.name, exc)
        return {}
    if result.returncode != 0:
        return {}

    try:
        parsed = json.loads(result.stdout or b"{}")
    except json.JSONDecodeError:
        return {}

    stream = (parsed.get("streams") or [{}])[0]
    info: dict[str, Any] = {}
    if stream.get("width"):
        info["width"] = int(stream["width"])
    if stream.get("height"):
        info["height"] = int(stream["height"])
    rate = stream.get("avg_frame_rate")
    if rate and rate != "0/0":
        numerator, _, denominator = rate.partition("/")
        try:
            denom = float(denominator or 1)
            if denom:
                info["container_fps"] = round(float(numerator) / denom, 3)
        except ValueError:
            pass
    duration = (parsed.get("format") or {}).get("duration")
    if duration:
        try:
            info["duration_ms"] = int(round(float(duration) * 1000))
        except ValueError:
            pass
    return info


async def probe_video(settings: Settings, path: Path) -> dict[str, Any]:
    return await asyncio.to_thread(probe_video_sync, settings, path)
