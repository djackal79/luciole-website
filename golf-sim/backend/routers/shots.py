"""Read API over the shot packages on disk."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from ..deps import ClocksDep, CorrelatorDep, SettingsDep
from ..models import ShotListResponse, ShotStatus, ShotSummary
from .. import storage

router = APIRouter(prefix="/api/v1", tags=["shots"])


def _shot_dir(settings: SettingsDep, shot_id: str) -> Path:
    """Resolve a shot directory, refusing anything that escapes ``shots/``."""
    root = settings.shots_dir.resolve()
    candidate = (root / shot_id).resolve()
    if candidate.parent != root or not candidate.is_dir():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown shot")
    return candidate


@router.get("/shots", response_model=ShotListResponse)
async def list_shots(
    settings: SettingsDep,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    shot_status: ShotStatus | None = Query(default=None, alias="status"),
) -> ShotListResponse:
    shots = storage.iter_shots(settings)
    if shot_status is not None:
        shots = [s for s in shots if s.get("status") == shot_status.value]
    window = shots[offset : offset + limit]
    return ShotListResponse(
        count=len(shots),
        shots=[
            ShotSummary(
                shot_id=s["shot_id"],
                status=s["status"],
                anchor_timestamp=s["anchor"]["timestamp"],
                anchor_iso=s["anchor"]["iso"],
                club=s.get("club"),
                present_sources=s.get("present_sources", []),
                missing_sources=s.get("missing_sources", []),
            )
            for s in window
        ],
    )


@router.get("/shots/{shot_id}")
async def get_shot(settings: SettingsDep, shot_id: str) -> dict:
    metadata = storage.load_shot(_shot_dir(settings, shot_id))
    if metadata is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown shot")
    return metadata


@router.get("/shots/{shot_id}/media/{filename}")
async def get_shot_media(settings: SettingsDep, shot_id: str, filename: str) -> FileResponse:
    """Serve a clip. Starlette answers Range requests here, which is what the
    Build 2 scrubber needs for seeking without downloading the whole file."""
    directory = _shot_dir(settings, shot_id)
    target = (directory / filename).resolve()
    if target.parent != directory or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown media file")
    return FileResponse(target)


@router.get("/status")
async def ingest_status(
    settings: SettingsDep,
    correlator: CorrelatorDep,
    clocks: ClocksDep,
) -> dict:
    """Operational snapshot: what is mid-flight right now."""
    return {
        "watching": str(settings.kinovea_export_dir),
        "shots_dir": str(settings.shots_dir),
        "pair_window_seconds": settings.pair_window_seconds,
        "settle_seconds": settings.settle_seconds,
        "expected_sources": settings.expected_sources,
        "open_shots": correlator.open_snapshot(),
        "device_clocks": clocks.snapshot(),
    }
