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
import time
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..config import Settings
from ..correlator import MediaArrival
from ..deps import CorrelatorDep, SettingsDep, require_token
from ..models import SourceName, parse_ts

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


def _pairing_timestamp(settings: Settings, trigger_ts: str | None) -> float | None:
    """Which clock the impact clip pairs on.

    ``None`` means "stamp on receipt" -- the contract default, and correct for
    any path where the clip arrives promptly. Store-and-forward capture (the
    stock camera app plus a watcher) arrives seconds late, so with
    ``impact_trust_trigger_ts`` the client's capture time is used instead,
    provided it is close enough to now to be upload lag rather than a broken
    clock.
    """
    if not settings.impact_trust_trigger_ts or not trigger_ts:
        return None
    parsed = parse_ts(trigger_ts)
    if parsed is None:
        log.warning("unparseable trigger_ts %r; stamping on receipt", trigger_ts)
        return None
    skew_ms = abs(parsed.timestamp() - time.time()) * 1000.0
    if skew_ms > settings.trigger_ts_max_skew_ms:
        log.warning(
            "trigger_ts %s is %.0fms from now (max %dms); stamping on receipt",
            trigger_ts, skew_ms, settings.trigger_ts_max_skew_ms,
        )
        return None
    log.info("pairing impact clip on client trigger_ts %s (lag %.0fms)", trigger_ts, skew_ms)
    return parsed.timestamp()


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
    impact_ms: Annotated[
        int | None,
        Form(description="Where impact sits inside this clip, in playback ms"),
    ] = None,
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
            impact_ms=impact_ms,
            trigger_hint=trigger_ts,
        ),
        received_at=_pairing_timestamp(settings, trigger_ts),
    )
    return {"shot_id": package.shot_id, "status": package.status, "shot": package.to_json()}


#: Which Kinovea camera a clip came from. This is the routing key, kept
#: separate from the ``camera`` label so that relabelling a camera in the UI
#: cannot silently misroute its clips.
BODY_SWING_SOURCES = {
    SourceName.BODY_SWING.value: SourceName.BODY_SWING,
    SourceName.BODY_SWING_DTL.value: SourceName.BODY_SWING_DTL,
}


@router.post("/body_swing", dependencies=[Depends(require_token)])
async def ingest_body_swing(
    settings: SettingsDep,
    correlator: CorrelatorDep,
    file: Annotated[UploadFile | None, File(description="Kinovea clip")] = None,
    source: Annotated[
        str, Form(description="body_swing (face-on) or body_swing_dtl")
    ] = SourceName.BODY_SWING.value,
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
    impact_ms: Annotated[
        int | None,
        Form(description="Where impact sits inside this clip, in playback ms"),
    ] = None,
) -> dict:
    """Receive a Kinovea body-swing clip, by upload or by local path.

    Two cameras run at once and their Automation hooks fire within
    milliseconds of each other. Without a distinct ``source`` per camera the
    correlator sees two clips of the same kind, applies its duplicate-source
    rule, and opens a second shot -- silently doubling every swing. So each
    camera's hook must send its own source.
    """
    if (file is None) == (path is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="supply exactly one of 'file' or 'path'",
        )

    kind = BODY_SWING_SOURCES.get(source)
    if kind is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"source must be one of {sorted(BODY_SWING_SOURCES)}, got {source!r}",
        )
    is_dtl = kind is SourceName.BODY_SWING_DTL

    if path is not None:
        clip, copy = _local_source(path), True
    else:
        clip, copy = await _stage_upload(file, settings), False

    package = await correlator.submit_media(
        MediaArrival(
            source=kind,
            file=clip,
            camera=camera or (
                settings.body_swing_dtl_camera if is_dtl else settings.body_swing_camera
            ),
            capture_fps=capture_fps or (
                settings.body_swing_dtl_capture_fps if is_dtl
                else settings.body_swing_capture_fps
            ),
            container_fps=container_fps or (
                settings.body_swing_dtl_container_fps if is_dtl
                else settings.body_swing_container_fps
            ),
            duration_ms=duration_ms,
            width=width,
            height=height,
            impact_ms=impact_ms,
            copy=copy,
            trigger_hint=trigger_ts,
        )
    )
    return {"shot_id": package.shot_id, "status": package.status, "shot": package.to_json()}
