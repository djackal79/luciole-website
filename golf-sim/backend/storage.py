"""Shot package persistence.

On-disk layout::

    data/
      staging/                     uploads land here until a shot finalises
      kinovea_export/              watched directory (Kinovea writes here)
      shots/
        shot_20260906T142233_512Z/
          metadata.json
          swing.mp4
          impact.mp4
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings

log = logging.getLogger(__name__)

CANONICAL_FILENAMES = {
    "swing_video": "swing",
    "impact_video": "impact",
}


def shot_id_for(anchor_ts: float) -> str:
    """``shot_20260906T142233_512Z`` — sortable, filesystem-safe, unambiguous."""
    moment = datetime.fromtimestamp(anchor_ts, tz=timezone.utc)
    return f"shot_{moment.strftime('%Y%m%dT%H%M%S')}_{moment.microsecond // 1000:03d}Z"


def unique_shot_dir(shots_dir: Path, anchor_ts: float) -> Path:
    """Reserve a shot directory, disambiguating the rare same-millisecond clash."""
    base = shot_id_for(anchor_ts)
    candidate = shots_dir / base
    suffix = 1
    while True:
        try:
            candidate.mkdir(parents=True, exist_ok=False)
            return candidate
        except FileExistsError:
            candidate = shots_dir / f"{base}-{suffix}"
            suffix += 1


def sha256_file(path: Path, *, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stage_path(settings: Settings, suffix: str) -> Path:
    settings.staging_dir.mkdir(parents=True, exist_ok=True)
    return settings.staging_dir / f"{uuid.uuid4().hex}{suffix}"


def move_into(source: Path, destination: Path) -> None:
    """Move across filesystems if needed; ``os.replace`` alone cannot."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.replace(source, destination)
    except OSError:
        shutil.move(str(source), str(destination))


def write_metadata(shot_dir: Path, metadata: dict[str, Any]) -> Path:
    """Atomic write so a reader never observes a half-written metadata.json."""
    target = shot_dir / "metadata.json"
    tmp = shot_dir / ".metadata.json.tmp"
    tmp.write_text(json.dumps(metadata, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    os.replace(tmp, target)
    return target


def probe_video_sync(settings: Settings, path: Path) -> dict[str, Any] | None:
    """Read stream properties with ffprobe. Returns ``None`` when unavailable.

    ffprobe is optional: without it the package is still valid, it just lacks
    fps/duration hints for the Build 2 scrubber.
    """
    command = [
        settings.ffprobe_path,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,avg_frame_rate,nb_frames:format=duration,size",
        "-of", "json",
        str(path),
    ]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            timeout=settings.probe_timeout_seconds,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as exc:
        log.debug("ffprobe unavailable for %s: %s", path.name, exc)
        return None
    if result.returncode != 0:
        log.debug("ffprobe failed for %s: %s", path.name, result.stderr.decode(errors="replace"))
        return None

    try:
        parsed = json.loads(result.stdout or b"{}")
    except json.JSONDecodeError:
        return None

    streams = parsed.get("streams") or [{}]
    stream = streams[0]
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
                info["fps"] = round(float(numerator) / denom, 3)
        except ValueError:
            pass
    if stream.get("nb_frames"):
        try:
            info["frame_count"] = int(stream["nb_frames"])
        except ValueError:
            pass
    duration = (parsed.get("format") or {}).get("duration")
    if duration:
        try:
            info["duration_s"] = round(float(duration), 4)
        except ValueError:
            pass
    return info or None


async def probe_video(settings: Settings, path: Path) -> dict[str, Any] | None:
    return await asyncio.to_thread(probe_video_sync, settings, path)


def load_shot(shot_dir: Path) -> dict[str, Any] | None:
    metadata_path = shot_dir / "metadata.json"
    if not metadata_path.is_file():
        return None
    try:
        return json.loads(metadata_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("unreadable metadata in %s: %s", shot_dir, exc)
        return None


def iter_shots(settings: Settings) -> list[dict[str, Any]]:
    """All finalized shot packages, newest first."""
    if not settings.shots_dir.is_dir():
        return []
    shots = []
    for child in sorted(settings.shots_dir.iterdir(), reverse=True):
        if not child.is_dir():
            continue
        metadata = load_shot(child)
        if metadata:
            shots.append(metadata)
    return shots
