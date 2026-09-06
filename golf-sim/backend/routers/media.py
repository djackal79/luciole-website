"""Video clip ingest for the impact camera (and manual swing-video push)."""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status

from ..correlator import Fragment
from ..deps import ClocksDep, CorrelatorDep, SettingsDep, get_control_hub, require_token
from ..models import (
    MediaAccepted,
    SourceKind,
    TriggerRequest,
    TriggerResponse,
    parse_timestamp,
    utc_iso,
)
from .. import storage

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["media"])

ALLOWED_SUFFIXES = {".mp4", ".mov", ".mkv", ".avi", ".webm"}
CHUNK = 1024 * 1024


async def _stream_to_staging(
    upload: UploadFile, settings: SettingsDep
) -> tuple[Path, int]:
    suffix = Path(upload.filename or "clip.mp4").suffix.lower() or ".mp4"
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"unsupported video extension {suffix!r}",
        )
    staged = storage.stage_path(settings, suffix)
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
    return staged, written


@router.post(
    "/media/impact",
    response_model=MediaAccepted,
    dependencies=[Depends(require_token)],
)
async def upload_impact_clip(
    settings: SettingsDep,
    correlator: CorrelatorDep,
    clocks: ClocksDep,
    file: Annotated[UploadFile, File(description="High-speed impact clip")],
    captured_at: Annotated[
        str | None,
        Form(description="Device-clock impact time (epoch s/ms or ISO-8601)"),
    ] = None,
    device_id: Annotated[str, Form()] = "impact_cam",
    trigger_source: Annotated[str, Form()] = "unknown",
    pre_roll_s: Annotated[float, Form(description="Seconds of clip before impact")] = 0.0,
    fps: Annotated[float | None, Form()] = None,
) -> MediaAccepted:
    """Receive a ring-buffer snapshot from the impact camera.

    ``captured_at`` is in the *phone's* clock; it is converted to host time
    using the offset measured over ``/ws/control``. Uploading without ever
    having synchronised still works, but the shot is flagged
    ``clock_synced: false`` because the pairing is only as good as the phone's
    wall clock.
    """
    device_timestamp = parse_timestamp(captured_at, default=time.time())
    host_timestamp, offset = clocks.to_host(device_id, device_timestamp)

    staged, written = await _stream_to_staging(file, settings)

    fragment = Fragment(
        kind=SourceKind.IMPACT_VIDEO,
        timestamp=host_timestamp,
        payload={
            "origin": {
                "kind": "impact_cam",
                "device_id": device_id,
                "original_filename": file.filename,
                "trigger_source": trigger_source,
                "device_timestamp": round(device_timestamp, 6),
            },
            "impact_offset_s": pre_roll_s,
            "fps_hint": fps,
            "clock_offset_ms": None if offset is None else round(offset * 1000.0, 3),
            "clock_synced": offset is not None,
        },
        staged_path=staged,
    )
    outcome = await correlator.submit(fragment)
    log.info("impact clip %s (%d bytes) -> %s", file.filename, written, outcome)

    return MediaAccepted(
        kind=SourceKind.IMPACT_VIDEO,
        timestamp=host_timestamp,
        timestamp_iso=utc_iso(host_timestamp),
        clock_offset_ms=None if offset is None else round(offset * 1000.0, 3),
        bytes_received=written,
    )


@router.post(
    "/media/swing",
    response_model=MediaAccepted,
    dependencies=[Depends(require_token)],
)
async def upload_swing_clip(
    settings: SettingsDep,
    correlator: CorrelatorDep,
    file: Annotated[UploadFile, File(description="Kinovea swing clip")],
    captured_at: Annotated[str | None, Form()] = None,
    impact_offset_s: Annotated[float, Form()] = 0.0,
) -> MediaAccepted:
    """Push a swing clip directly, for hosts where the export directory is not
    reachable by the watcher (network share, VM boundary, WSL)."""
    host_timestamp = parse_timestamp(captured_at, default=time.time())
    staged, written = await _stream_to_staging(file, settings)

    fragment = Fragment(
        kind=SourceKind.SWING_VIDEO,
        timestamp=host_timestamp,
        payload={
            "origin": {
                "kind": "kinovea",
                "original_filename": file.filename,
                "timestamp_source": "client-supplied",
            },
            "impact_offset_s": impact_offset_s,
        },
        staged_path=staged,
    )
    outcome = await correlator.submit(fragment)
    log.info("swing clip %s (%d bytes) -> %s", file.filename, written, outcome)

    return MediaAccepted(
        kind=SourceKind.SWING_VIDEO,
        timestamp=host_timestamp,
        timestamp_iso=utc_iso(host_timestamp),
        bytes_received=written,
    )


@router.post(
    "/trigger",
    response_model=TriggerResponse,
    dependencies=[Depends(require_token)],
)
async def broadcast_trigger(request: Request, body: TriggerRequest) -> TriggerResponse:
    """Tell every connected capture device to snapshot its ring buffer.

    Wire this to whatever detects the strike first (the launch monitor bridge,
    a mat vibration sensor, a PC-side audio gate). Because the phone records
    continuously into a ring buffer, the trigger only has to arrive before the
    buffer wraps -- it is not in the capture latency path at all.
    """
    hub = get_control_hub(request)
    host_timestamp = parse_timestamp(body.timestamp, default=time.time())
    trigger_id = uuid.uuid4().hex[:12]
    notified = await hub.broadcast(
        {
            "type": "capture_trigger",
            "trigger_id": trigger_id,
            "host_timestamp": host_timestamp,
            "source": body.source,
            "note": body.note,
        }
    )
    log.info("trigger %s broadcast to %d device(s)", trigger_id, notified)
    return TriggerResponse(
        trigger_id=trigger_id,
        host_timestamp=host_timestamp,
        devices_notified=notified,
    )
