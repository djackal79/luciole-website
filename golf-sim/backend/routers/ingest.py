"""Video ingest.

``/api/ingest/impact``      multipart upload from the phone.
``/api/ingest/body_swing``  Kinovea's Automation hook.

Kinovea runs on the same PC, so its hook can hand over a local *path* instead
of uploading bytes -- no point pushing 100 MB through localhost HTTP. Both
forms are accepted; a path is copied into the shot folder so the original
stays where Kinovea left it.
"""

from __future__ import annotations

import logging
import tempfile
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..correlator import MediaArrival
from ..deps import CorrelatorDep, SettingsDep, require_token
from ..models import SourceName

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

ALLOWED_SUFFIXES = {".mp4", ".mov", ".mkv", ".avi", ".webm"}
CHUNK = 1024 * 1024


async def _stage_upload(upload: UploadFile, settings: SettingsDep) -> Path:
    suffix = Path(upload.filename or "clip.mp4").suffix.lower() or ".mp4"
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"unsupported video extension {suffix!r}",
        )
    staging = Path(tempfile.gettempdir()) / "golfsim-staging"
    staging.mkdir(parents=True, exist_ok=True)
    staged = staging / f"{uuid.uuid4().hex}{suffix}"

    written = 0
    try:
        with staged.open("wb") as handle:
            while chunk := await upload.read(CHUNK):
                written += len(chunk)
                if written > settings.max_upload_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="clip exceeds max_upload_bytes",
                    )
                handle.write(chunk)
    except Exception:
        staged.unlink(missing_ok=True)
        raise
    if written == 0:
        staged.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty upload")
    return staged


def _local_source(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"no such file: {raw_path}"
        )
    if path.suffix.lower() not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"unsupported video extension {path.suffix!r}",
        )
    return path


@router.post("/impact", dependencies=[Depends(require_token)])
async def ingest_impact(
    settings: SettingsDep,
    correlator: CorrelatorDep,
    file: Annotated[UploadFile, File(description="High-speed impact clip")],
    trigger_ts: Annotated[str | None, Form(description="Device clock; ordering hint only")] = None,
    capture_fps: Annotated[float | None, Form()] = None,
    container_fps: Annotated[float | None, Form()] = None,
    camera: Annotated[str | None, Form()] = None,
    duration_ms: Annotated[int | None, Form()] = None,
    width: Annotated[int | None, Form()] = None,
    height: Annotated[int | None, Form()] = None,
) -> dict:
    """Receive the phone's high-speed clip.

    ``trigger_ts`` is recorded as an ordering hint and nothing more -- the shot
    is stamped on receipt, because the phone's wall clock drifts.
    """
    staged = await _stage_upload(file, settings)
    package = await correlator.submit_media(
        MediaArrival(
            source=SourceName.IMPACT_STRIKE,
            file=staged,
            camera=camera or settings.impact_camera,
            capture_fps=capture_fps or settings.impact_capture_fps,
            container_fps=container_fps or settings.impact_container_fps,
            duration_ms=duration_ms,
            width=width,
            height=height,
            trigger_hint=trigger_ts,
        )
    )
    return {"shot_id": package.shot_id, "status": package.status, "shot": package.to_json()}


@router.post("/body_swing", dependencies=[Depends(require_token)])
async def ingest_body_swing(
    settings: SettingsDep,
    correlator: CorrelatorDep,
    file: Annotated[UploadFile | None, File(description="Kinovea clip")] = None,
    path: Annotated[
        str | None, Form(description="Local path, as handed over by Kinovea's Automation hook")
    ] = None,
    trigger_ts: Annotated[str | None, Form()] = None,
    capture_fps: Annotated[float | None, Form()] = None,
    container_fps: Annotated[float | None, Form()] = None,
    camera: Annotated[str | None, Form()] = None,
    duration_ms: Annotated[int | None, Form()] = None,
    width: Annotated[int | None, Form()] = None,
    height: Annotated[int | None, Form()] = None,
) -> dict:
    """Receive the Kinovea body-swing clip, by upload or by local path."""
    if (file is None) == (path is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="supply exactly one of 'file' or 'path'",
        )

    if path is not None:
        source, copy = _local_source(path), True
    else:
        source, copy = await _stage_upload(file, settings), False

    package = await correlator.submit_media(
        MediaArrival(
            source=SourceName.BODY_SWING,
            file=source,
            camera=camera or settings.body_swing_camera,
            capture_fps=capture_fps or settings.body_swing_capture_fps,
            container_fps=container_fps or settings.body_swing_container_fps,
            duration_ms=duration_ms,
            width=width,
            height=height,
            copy=copy,
            trigger_hint=trigger_ts,
        )
    )
    return {"shot_id": package.shot_id, "status": package.status, "shot": package.to_json()}
