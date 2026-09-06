"""Wire and on-disk schemas.

``metadata.json`` is the contract between Build 1 (ingest) and Build 2
(player + HUD), so it is versioned explicitly.
"""

from __future__ import annotations

import math
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

METADATA_SCHEMA_VERSION = "1.0.0"


class SourceKind(str, Enum):
    SWING_VIDEO = "swing_video"
    IMPACT_VIDEO = "impact_video"
    TELEMETRY = "telemetry"


class ShotStatus(str, Enum):
    #: Still accepting artefacts.
    OPEN = "open"
    #: Every expected artefact arrived.
    COMPLETE = "complete"
    #: Settle window elapsed with artefacts missing.
    PARTIAL = "partial"


def utc_iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat(timespec="milliseconds")


def parse_timestamp(value: Any, *, default: float | None = None) -> float:
    """Accept epoch seconds, epoch milliseconds or an ISO-8601 string."""
    if value is None or value == "":
        if default is not None:
            return default
        raise ValueError("timestamp is required")
    if isinstance(value, (int, float)):
        seconds = float(value)
        # Anything past year 2286 in seconds is almost certainly milliseconds.
        if seconds > 1e11:
            seconds /= 1000.0
        return seconds
    text = str(value).strip()
    try:
        return parse_timestamp(float(text))
    except ValueError:
        pass
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


# ---------------------------------------------------------------------------
# Launch monitor telemetry
# ---------------------------------------------------------------------------

#: Canonical metric name -> accepted inbound spellings. The Square Golf app,
#: its CSV export and the various community bridges all disagree on casing and
#: units, so we normalise aggressively rather than pinning one dialect.
METRIC_ALIASES: dict[str, tuple[str, ...]] = {
    "ball_speed_mph": ("ball_speed", "ballspeed", "ball_speed_mph", "ballspeedmph", "bs"),
    "club_speed_mph": (
        "club_speed", "clubspeed", "club_speed_mph", "clubheadspeed",
        "club_head_speed", "chs",
    ),
    "smash_factor": ("smash_factor", "smashfactor", "smash", "efficiency"),
    "launch_angle_deg": (
        "launch_angle", "launchangle", "vertical_launch", "verticallaunchangle",
        "launch_angle_deg", "vla",
    ),
    "azimuth_deg": (
        "azimuth", "launch_direction", "launchdirection", "horizontal_launch",
        "horizontallaunchangle", "hla", "side_angle",
    ),
    "back_spin_rpm": ("back_spin", "backspin", "spin", "total_spin", "backspinrpm"),
    "side_spin_rpm": ("side_spin", "sidespin", "sidespinrpm"),
    "spin_axis_deg": ("spin_axis", "spinaxis", "spin_axis_deg"),
    "club_path_deg": ("club_path", "clubpath", "path"),
    "face_angle_deg": ("face_angle", "faceangle", "face", "club_face", "clubface"),
    "face_to_path_deg": ("face_to_path", "facetopath", "face_to_path_deg"),
    "attack_angle_deg": ("attack_angle", "attackangle", "angle_of_attack", "aoa"),
    "dynamic_loft_deg": ("dynamic_loft", "dynamicloft"),
    "carry_yds": ("carry", "carry_distance", "carrydistance", "carry_yds"),
    "total_yds": ("total", "total_distance", "totaldistance", "total_yds", "distance"),
    "offline_yds": ("offline", "side", "side_distance", "lateral"),
    "apex_ft": ("apex", "peak_height", "height", "apex_ft"),
    "descent_angle_deg": ("descent_angle", "descentangle", "landing_angle"),
}

_ALIAS_LOOKUP: dict[str, str] = {
    alias: canonical
    for canonical, aliases in METRIC_ALIASES.items()
    for alias in aliases
}


def _alias_key(raw_key: str) -> str:
    return "".join(ch for ch in raw_key.lower() if ch.isalnum() or ch == "_")


def normalize_metrics(raw: dict[str, Any]) -> dict[str, float]:
    """Map a vendor payload onto canonical metric names.

    Unknown keys are dropped here but preserved verbatim under ``raw`` in
    ``metadata.json``, so nothing is ever lost.
    """
    metrics: dict[str, float] = {}
    for key, value in raw.items():
        if not isinstance(value, (int, float, str)):
            continue
        canonical = _ALIAS_LOOKUP.get(_alias_key(str(key)))
        if canonical is None or canonical in metrics:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if math.isnan(number) or math.isinf(number):
            continue
        metrics[canonical] = number
    return _derive_metrics(metrics)


def _derive_metrics(metrics: dict[str, float]) -> dict[str, float]:
    """Fill in the metrics that are pure functions of the others."""
    ball = metrics.get("ball_speed_mph")
    club = metrics.get("club_speed_mph")
    if "smash_factor" not in metrics and ball is not None and club:
        metrics["smash_factor"] = round(ball / club, 3)

    face = metrics.get("face_angle_deg")
    path = metrics.get("club_path_deg")
    if "face_to_path_deg" not in metrics and face is not None and path is not None:
        metrics["face_to_path_deg"] = round(face - path, 2)
    return metrics


class TelemetryIn(BaseModel):
    """Shot telemetry pushed by the Square Golf bridge.

    Vendor-specific keys may be sent at the top level or nested under
    ``metrics``; both are normalised the same way.
    """

    model_config = ConfigDict(extra="allow")

    timestamp: Any | None = Field(
        default=None,
        description="Impact time: epoch seconds, epoch millis or ISO-8601. "
        "Defaults to server receive time.",
    )
    device_id: str = "square_golf"
    club: str | None = None
    session_id: str | None = None
    metrics: dict[str, Any] | None = None

    def resolved_timestamp(self) -> float:
        return parse_timestamp(self.timestamp, default=time.time())

    def raw_payload(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload.pop("timestamp", None)
        nested = payload.pop("metrics", None)
        if isinstance(nested, dict):
            payload.update(nested)
        return payload

    def normalized_metrics(self) -> dict[str, float]:
        return normalize_metrics(self.raw_payload())


# ---------------------------------------------------------------------------
# Media upload
# ---------------------------------------------------------------------------


class MediaAccepted(BaseModel):
    accepted: bool = True
    kind: SourceKind
    #: Host-clock impact timestamp the correlator will pair on.
    timestamp: float
    timestamp_iso: str
    #: Correction applied from the device clock, in milliseconds.
    clock_offset_ms: float | None = None
    bytes_received: int | None = None


class TriggerRequest(BaseModel):
    """Ask every connected capture device to snapshot its ring buffer."""

    timestamp: Any | None = None
    source: str = "manual"
    note: str | None = None


class TriggerResponse(BaseModel):
    trigger_id: str
    host_timestamp: float
    devices_notified: int


# ---------------------------------------------------------------------------
# Shot package (metadata.json)
# ---------------------------------------------------------------------------


class ShotSummary(BaseModel):
    shot_id: str
    status: ShotStatus
    anchor_timestamp: float
    anchor_iso: str
    club: str | None = None
    present_sources: list[str]
    missing_sources: list[str]


class ShotListResponse(BaseModel):
    count: int
    shots: list[ShotSummary]
