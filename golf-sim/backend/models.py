"""The shot package schema -- the Build 1 / Build 2 contract.

``metadata.json`` is written exactly as specified in the contract document.
Telemetry lives *inside* it; there is no separate metrics file.

Units are canonical and never converted on write: speeds mph, angles degrees,
spin rpm, distances metres, durations milliseconds, timestamps ISO 8601 with
offset. The frontend owns display conversion and the m/yds toggle.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = "1.0"

YARDS_TO_METRES = 0.9144


class SourceName(str, Enum):
    BODY_SWING = "body_swing"
    IMPACT_STRIKE = "impact_strike"
    TELEMETRY = "telemetry"


class ShotStatus(str, Enum):
    #: Awaiting more sources.
    PENDING = "pending"
    #: All three sources present.
    COMPLETE = "complete"
    #: Pairing window expired with sources missing.
    PARTIAL = "partial"


# ---------------------------------------------------------------------------
# Timestamps
# ---------------------------------------------------------------------------


def local_now() -> datetime:
    """Local time carrying its UTC offset, as every timestamp in the schema."""
    return datetime.now().astimezone()


def iso(moment: datetime | float) -> str:
    if isinstance(moment, (int, float)):
        moment = datetime.fromtimestamp(moment).astimezone()
    return moment.isoformat(timespec="milliseconds")


def shot_id_for(moment: datetime | float) -> str:
    """``20260906T143052-478`` -- compact local time, millisecond precision.

    Lexically sortable. The folder is this with a ``shot_`` prefix.
    """
    if isinstance(moment, (int, float)):
        moment = datetime.fromtimestamp(moment).astimezone()
    return f"{moment.strftime('%Y%m%dT%H%M%S')}-{moment.microsecond // 1000:03d}"


def parse_ts(value: Any) -> datetime | None:
    """Parse an ISO-8601 (or epoch) timestamp; ``None`` when unusable.

    Only ever applied to hints, never to anything the pairing depends on --
    the PC is the clock authority.
    """
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        seconds = float(value)
        if seconds > 1e11:  # milliseconds
            seconds /= 1000.0
        return datetime.fromtimestamp(seconds).astimezone()
    text = str(value).strip()
    try:
        return parse_ts(float(text))
    except ValueError:
        pass
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed.astimezone() if parsed.tzinfo else parsed.astimezone()


# ---------------------------------------------------------------------------
# metadata.json
# ---------------------------------------------------------------------------


class MediaEntry(BaseModel):
    """One video. Absent sources omit their ``media`` key entirely."""

    path: str
    camera: str
    #: Real-world capture rate. Drives duration and speed readouts.
    capture_fps: float | None = None
    #: Container playback rate. Drives frame stepping. Not redundant with
    #: capture_fps: 240 fps footage is written into a 30 fps container, so
    #: confusing the two makes every time measurement wrong by 8x.
    container_fps: float | None = None
    duration_ms: int | None = None
    width: int | None = None
    height: int | None = None


class SyncBlock(BaseModel):
    trigger_ts: str
    #: Frontend calibration slider writes here via PATCH so it survives
    #: reload. Positive = impact video lags body swing.
    impact_offset_ms: int = 0


class BallData(BaseModel):
    speed_mph: float | None = None
    total_spin_rpm: float | None = None
    back_spin_rpm: float | None = None
    side_spin_rpm: float | None = None
    spin_axis_deg: float | None = None
    launch_angle_deg: float | None = None
    launch_direction_deg: float | None = None


class ClubData(BaseModel):
    speed_mph: float | None = None
    angle_of_attack_deg: float | None = None
    path_deg: float | None = None
    face_to_target_deg: float | None = None
    loft_deg: float | None = None
    closure_rate_dps: float | None = None


class DerivedData(BaseModel):
    """Computed by the backend so the frontend never does arithmetic on
    nullable fields."""

    smash_factor: float | None = None
    face_to_path_deg: float | None = None


class DistanceData(BaseModel):
    """Normally null: GSPro Open Connect carries launch conditions only.

    Carry and total are computed by GSPro's physics engine, not measured by
    the launch monitor. Populated only if a monitor volunteers them.
    """

    carry_m: float | None = None
    total_m: float | None = None


class TelemetryBlock(BaseModel):
    source: str = "gspro_connect_v1"
    received_at: str
    ball: BallData = Field(default_factory=BallData)
    club: ClubData = Field(default_factory=ClubData)
    derived: DerivedData = Field(default_factory=DerivedData)
    distance: DistanceData = Field(default_factory=DistanceData)
    #: The unmodified provider payload. Always stored -- you will want a field
    #: you didn't map.
    raw: dict[str, Any] = Field(default_factory=dict)


class ShotPackage(BaseModel):
    """The complete ``metadata.json`` object, in contract field order."""

    model_config = ConfigDict(use_enum_values=True)

    schema_version: str = SCHEMA_VERSION
    shot_id: str
    session_id: str
    created_at: str
    status: ShotStatus = ShotStatus.PENDING
    sources: dict[str, bool] = Field(
        default_factory=lambda: {
            SourceName.BODY_SWING.value: False,
            SourceName.IMPACT_STRIKE.value: False,
            SourceName.TELEMETRY.value: False,
        }
    )
    media: dict[str, MediaEntry] = Field(default_factory=dict)
    sync: SyncBlock
    telemetry: TelemetryBlock | None = None
    club_used: str | None = None
    tags: list[str] = Field(default_factory=list)
    notes: str = ""

    @property
    def folder_name(self) -> str:
        return f"shot_{self.shot_id}"

    def to_json(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class ShotPatch(BaseModel):
    """PATCH accepts these four fields only."""

    model_config = ConfigDict(extra="forbid")

    tags: list[str] | None = None
    notes: str | None = None
    club_used: str | None = None
    impact_offset_ms: int | None = None


class SessionRequest(BaseModel):
    session_id: str | None = None
    #: Pushed to a connected launch monitor as a GSPro 201 Player message.
    club: str | None = None


# ---------------------------------------------------------------------------
# GSPro Open Connect v1 -> schema
# ---------------------------------------------------------------------------


def _number(source: dict[str, Any], key: str) -> float | None:
    value = source.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def telemetry_from_gspro(payload: dict[str, Any], received_at: datetime) -> TelemetryBlock:
    """Map a GSPro Open Connect v1 shot onto the schema.

    ``ShotDataOptions.ContainsClubData`` decides whether club fields are real;
    honour it rather than checking for zeros, because a genuine 0.0 path is a
    perfectly ordinary swing.
    """
    ball_raw = payload.get("BallData") or {}
    club_raw = payload.get("ClubData") or {}
    options = payload.get("ShotDataOptions") or {}

    ball = BallData(
        speed_mph=_number(ball_raw, "Speed"),
        total_spin_rpm=_number(ball_raw, "TotalSpin"),
        back_spin_rpm=_number(ball_raw, "BackSpin"),
        side_spin_rpm=_number(ball_raw, "SideSpin"),
        spin_axis_deg=_number(ball_raw, "SpinAxis"),
        launch_angle_deg=_number(ball_raw, "VLA"),
        launch_direction_deg=_number(ball_raw, "HLA"),
    )

    club = ClubData()
    if options.get("ContainsClubData"):
        club = ClubData(
            speed_mph=_number(club_raw, "Speed"),
            angle_of_attack_deg=_number(club_raw, "AngleOfAttack"),
            path_deg=_number(club_raw, "Path"),
            face_to_target_deg=_number(club_raw, "FaceToTarget"),
            loft_deg=_number(club_raw, "Loft"),
            closure_rate_dps=_number(club_raw, "ClosureRate"),
        )

    return TelemetryBlock(
        source="gspro_connect_v1",
        received_at=iso(received_at),
        ball=ball,
        club=club,
        derived=derive(ball, club),
        distance=_distance_from_gspro(ball_raw, payload.get("Units")),
        raw=payload,
    )


def derive(ball: BallData, club: ClubData) -> DerivedData:
    smash = None
    if ball.speed_mph is not None and club.speed_mph:
        smash = round(ball.speed_mph / club.speed_mph, 2)

    face_to_path = None
    if club.face_to_target_deg is not None and club.path_deg is not None:
        face_to_path = round(club.face_to_target_deg - club.path_deg, 2)

    return DerivedData(smash_factor=smash, face_to_path_deg=face_to_path)


def _distance_from_gspro(ball_raw: dict[str, Any], units: Any) -> DistanceData:
    """Usually empty. Canonical distance is metres, so a monitor that does
    report yards is converted here -- that is the one unit conversion the
    schema requires on write."""
    carry = _number(ball_raw, "CarryDistance")
    total = _number(ball_raw, "TotalDistance")
    if str(units or "").strip().lower().startswith("yard"):
        carry = None if carry is None else round(carry * YARDS_TO_METRES, 2)
        total = None if total is None else round(total * YARDS_TO_METRES, 2)
    return DistanceData(carry_m=carry, total_m=total)


def is_heartbeat(payload: dict[str, Any]) -> bool:
    return bool((payload.get("ShotDataOptions") or {}).get("IsHeartBeat"))


def is_shot(payload: dict[str, Any]) -> bool:
    options = payload.get("ShotDataOptions") or {}
    if options.get("IsHeartBeat"):
        return False
    return bool(options.get("ContainsBallData")) and bool(payload.get("BallData"))
