"""Square Golf launch monitor ingest."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ..correlator import Fragment
from ..deps import ClocksDep, CorrelatorDep, require_token
from ..models import SourceKind, TelemetryIn, utc_iso

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["telemetry"])


@router.post("/telemetry", dependencies=[Depends(require_token)])
async def ingest_telemetry(
    payload: TelemetryIn,
    correlator: CorrelatorDep,
    clocks: ClocksDep,
) -> dict[str, object]:
    """Accept one shot's ball/club metrics.

    Vendor key spellings are normalised (see ``models.METRIC_ALIASES``) while
    the untouched payload is preserved under ``sources.telemetry.raw``.
    """
    device_timestamp = payload.resolved_timestamp()
    host_timestamp, offset = clocks.to_host(payload.device_id, device_timestamp)

    metrics = payload.normalized_metrics()
    fragment = Fragment(
        kind=SourceKind.TELEMETRY,
        timestamp=host_timestamp,
        payload={
            "device_id": payload.device_id,
            "club": payload.club,
            "session_id": payload.session_id,
            "metrics": metrics,
            "raw": payload.raw_payload(),
            "clock_offset_ms": None if offset is None else round(offset * 1000.0, 3),
            "clock_synced": offset is not None,
        },
    )
    outcome = await correlator.submit(fragment)
    log.info(
        "telemetry %s club=%s ball=%s -> %s",
        utc_iso(host_timestamp),
        payload.club,
        metrics.get("ball_speed_mph"),
        outcome,
    )
    return {
        "accepted": True,
        "timestamp": host_timestamp,
        "timestamp_iso": utc_iso(host_timestamp),
        "clock_offset_ms": None if offset is None else round(offset * 1000.0, 3),
        "normalized_metrics": metrics,
        "correlation": outcome,
    }
