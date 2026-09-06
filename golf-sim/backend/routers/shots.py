"""Shot read/patch API and media serving."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from .. import storage
from ..deps import CorrelatorDep, SettingsDep
from ..models import ShotPatch, parse_ts

router = APIRouter(tags=["shots"])


def _resolve_dir(settings: SettingsDep, folder: str) -> Path:
    """Resolve a shot folder, refusing anything that escapes ``shots/``."""
    root = settings.shots_dir.resolve()
    candidate = (root / folder).resolve()
    if candidate.parent != root or not candidate.is_dir():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown shot")
    return candidate


@router.get("/api/shots")
async def list_shots(
    settings: SettingsDep,
    session_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    since: str | None = Query(
        default=None, description="ISO-8601; returns shots created strictly after this"
    ),
) -> list[dict[str, Any]]:
    """Newest first. shot_id is lexically sortable, so this is a plain sort."""
    shots = storage.iter_shots(settings)
    if session_id:
        shots = [s for s in shots if s.get("session_id") == session_id]
    if since:
        cutoff = parse_ts(since)
        if cutoff is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="unparseable 'since'"
            )
        shots = [
            s
            for s in shots
            if (created := parse_ts(s.get("created_at"))) is not None and created > cutoff
        ]
    return shots[:limit]


@router.get("/api/shots/{shot_id}")
async def get_shot(settings: SettingsDep, shot_id: str) -> dict[str, Any]:
    metadata = storage.load_metadata(_resolve_dir(settings, f"shot_{shot_id}"))
    if metadata is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown shot")
    return metadata


@router.patch("/api/shots/{shot_id}")
async def patch_shot(
    correlator: CorrelatorDep, shot_id: str, patch: ShotPatch
) -> dict[str, Any]:
    """Accepts tags, notes, club_used and impact_offset_ms only.

    The frontend's calibration slider writes impact_offset_ms here so it
    survives reload. Emits shot.patched to every client, including the one
    that made the change.
    """
    metadata = await correlator.patch(shot_id, patch)
    if metadata is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown shot")
    return metadata


@router.get("/shots/{folder}/{filename}")
async def get_media(settings: SettingsDep, folder: str, filename: str) -> FileResponse:
    """Static media with HTTP range support.

    Range support is not optional: without it the frontend's scrubber and
    frame stepping cannot work, because the browser can't seek a video it has
    to download linearly. Starlette's FileResponse answers Range; a naive
    streaming response does not.
    """
    directory = _resolve_dir(settings, folder)
    target = (directory / filename).resolve()
    if target.parent != directory or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown file")
    return FileResponse(target)
