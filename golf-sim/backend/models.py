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

SCHEMA_VERSION = "1.2"

YARDS_TO_METRES = 0.9144

#: Names the model in every package, so a number can be traced to what made it.
FLIGHT_MODEL_NAME = "drag_magnus_rk4_v1"


class SourceName(str, Enum):
    BODY_SWING = "body_swing"
    #: Second Kinovea camera, down-the-line. Optional (schema v1.1).
    BODY_SWING_DTL = "body_swing_dtl"
    IMPACT_STRIKE = "impact_strike"
    TELEMETRY = "telemetry"
    #: Derived from the body-swing clips after the shot closes, not captured.
    POSE = "pose"
    #: Force / pressure plates. Optional, hardware not yet built.
    PRESSURE = "pressure"


#: Sources that are video files under ``media``.
VIDEO_SOURCES = (SourceName.BODY_SWING, SourceName.BODY_SWING_DTL, SourceName.IMPACT_STRIKE)

#: Every key that always appears in ``sources``, so the frontend can read them
#: without existence checks.
ALL_SOURCES = tuple(SourceName)


class DataStatus(str, Enum):
    """Lifecycle of a derived or optional data block."""

    #: Extraction queued or running. The frontend should show progress.
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"
    #: No such input exists for this shot -- no plates, no second camera.
    UNAVAILABLE = "unavailable"


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
    #: Where impact sits inside THIS clip, in file playback milliseconds --
    #: what you would assign to `video.currentTime * 1000`. Schema v1.1.
    #:
    #: Often null: Kinovea's pre-roll is configurable and knowable, but the
    #: phone's Super Slow-mo auto-trigger picks its own and does not say. That
    #: gap is what sync.impact_offset_ms and the calibration slider close.
    impact_ms: int | None = None


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


class FlightBlock(BaseModel):
    """Modelled trajectory, not measured.

    Deliberately separate from ``distance``, which means *measured* and stays
    null on this path. Merging them would make a model output indistinguishable
    from a monitor reading, and the whole point of the null is that the reader
    knows which is which.
    """

    model: str
    carry_m: float | None = None
    total_m: float | None = None
    apex_m: float | None = None
    descent_angle_deg: float | None = None
    offline_m: float | None = None
    flight_time_s: float | None = None
    #: The air it was flown through, so a number can be reproduced later.
    conditions: dict[str, float] = Field(default_factory=dict)


class TelemetryBlock(BaseModel):
    source: str = "gspro_connect_v1"
    received_at: str
    ball: BallData = Field(default_factory=BallData)
    club: ClubData = Field(default_factory=ClubData)
    derived: DerivedData = Field(default_factory=DerivedData)
    distance: DistanceData = Field(default_factory=DistanceData)
    #: Modelled trajectory. Present when the launch conditions support one;
    #: never a substitute for `distance`.
    flight: FlightBlock | None = None
    #: The unmodified provider payload. Always stored -- you will want a field
    #: you didn't map.
    raw: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Pose (derived) and pressure (captured) -- schema v1.1
#
# Both are time series, and a time series has no business inside
# metadata.json: pose at 30 fps over 4 s is 120 frames of 33 landmarks, and
# pressure at 100 Hz is 400 samples. They live in sidecar files next to the
# clips, and metadata carries only the reference plus what the HUD needs.
#
# Both sidecars timestamp frames relative to their own clip or capture start,
# and carry their own impact_ms, so the frontend maps to the master timeline
# with one subtraction: t_from_impact = t_ms - impact_ms.
# ---------------------------------------------------------------------------


class PoseSummary(BaseModel):
    """Angles the HUD shows. Nulls are expected and meaningful.

    A single camera cannot recover pelvis rotation, shoulder turn or X-factor
    with any honesty -- those need two calibrated views. Swing plane and spine
    angle survive monocular estimation.
    """

    swing_plane_deg: float | None = None
    spine_angle_deg: float | None = None
    shoulder_turn_deg: float | None = None
    pelvis_rotation_deg: float | None = None
    x_factor_deg: float | None = None
    hand_speed_mph: float | None = None


class PoseBlock(BaseModel):
    status: DataStatus = DataStatus.UNAVAILABLE
    #: Sidecar filename, relative to the shot folder.
    path: str | None = None
    model: str | None = None
    #: "2d" -- normalised image coordinates from one camera.
    #: "3d" -- metres, triangulated from two calibrated cameras.
    dimensions: str | None = None
    #: Which media sources fed the estimate.
    cameras: list[str] = Field(default_factory=list)
    frame_count: int | None = None
    #: Populated when status is "failed", so the UI can say why.
    error: str | None = None
    #: Why shoulder turn, pelvis rotation and X-factor are absent, in words.
    #: Null when they arrived. Most values are ordinary states rather than
    #: faults -- an uncalibrated rig, a shot with one camera -- so the UI
    #: should read as informative, not alarming. Note this can be set while
    #: `dimensions` is "3d": a triangulated skeleton that is not anatomically
    #: possible is still drawn, but its angles are withheld.
    depth_reason: str | None = None
    summary: PoseSummary | None = None


class PressureSummary(BaseModel):
    peak_grf_n: float | None = None
    trail_pct_at_impact: float | None = None
    lead_pct_at_impact: float | None = None
    cop_excursion_mm: float | None = None


class PressureBlock(BaseModel):
    status: DataStatus = DataStatus.UNAVAILABLE
    path: str | None = None
    device: str | None = None
    sample_rate_hz: float | None = None
    samples: int | None = None
    #: Impact position within the capture, in milliseconds from its start.
    impact_ms: int | None = None
    summary: PressureSummary | None = None


class ShotPackage(BaseModel):
    """The complete ``metadata.json`` object, in contract field order."""

    model_config = ConfigDict(use_enum_values=True)

    schema_version: str = SCHEMA_VERSION
    shot_id: str
    session_id: str
    created_at: str
    status: ShotStatus = ShotStatus.PENDING
    #: Every key is always present, so the frontend never needs an existence
    #: check -- only a truth check.
    sources: dict[str, bool] = Field(
        default_factory=lambda: {source.value: False for source in ALL_SOURCES}
    )
    media: dict[str, MediaEntry] = Field(default_factory=dict)
    sync: SyncBlock
    telemetry: TelemetryBlock | None = None
    pose: PoseBlock | None = None
    pressure: PressureBlock | None = None
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


def telemetry_from_gspro(
    payload: dict[str, Any],
    received_at: datetime,
    conditions: Any | None = None,
) -> TelemetryBlock:
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
        flight=model_flight(ball, conditions),
        raw=payload,
    )


def model_flight(ball: BallData, conditions: Any | None = None) -> FlightBlock | None:
    """Run the trajectory model over the measured launch conditions."""
    from .flight import Conditions, Launch, simulate

    if conditions is not None and not isinstance(conditions, Conditions):
        # Sentinel from the caller meaning modelling is switched off.
        return None
    if ball.speed_mph is None or ball.launch_angle_deg is None:
        return None

    conditions = conditions or Conditions()
    result = simulate(
        Launch(
            ball_speed_mph=ball.speed_mph,
            launch_angle_deg=ball.launch_angle_deg,
            launch_direction_deg=ball.launch_direction_deg or 0.0,
            back_spin_rpm=ball.back_spin_rpm or 0.0,
            side_spin_rpm=ball.side_spin_rpm or 0.0,
            spin_axis_deg=ball.spin_axis_deg,
        ),
        conditions,
    )
    if result is None:
        return None

    return FlightBlock(
        model=FLIGHT_MODEL_NAME,
        conditions={
            "altitude_m": conditions.altitude_m,
            "temperature_c": conditions.temperature_c,
        },
        **result.as_dict(),
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
    """Is this frame a struck ball?

    The spec says ``ContainsBallData`` announces ball data, and well-behaved
    senders set it. Not all bridges do, so a frame carrying real BallData with
    a non-zero ball speed is accepted regardless -- silently discarding a
    genuine strike because a flag was missing is the worse failure. A zero
    speed keeps status frames (ball placed, ball removed) from becoming shots.
    """
    return shot_rejection_reason(payload) is None


def shot_rejection_reason(payload: dict[str, Any]) -> str | None:
    """Why this frame is not a shot, for logging. ``None`` means it is one."""
    options = payload.get("ShotDataOptions") or {}
    if options.get("IsHeartBeat"):
        return "heartbeat"

    ball = payload.get("BallData")
    if not isinstance(ball, dict) or not ball:
        return f"no BallData (top-level keys: {sorted(payload) or 'none'})"

    if options.get("ContainsBallData"):
        return None

    speed = ball.get("Speed")
    if isinstance(speed, bool) or not isinstance(speed, (int, float)):
        return (
            "ContainsBallData not set and BallData.Speed is "
            f"{speed!r} (BallData keys: {sorted(ball)})"
        )
    if speed <= 0:
        return f"ContainsBallData not set and BallData.Speed is {speed}"
    return None
