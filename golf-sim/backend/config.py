"""Configuration.

Every value can be overridden with a ``GOLFSIM_``-prefixed environment
variable or an entry in ``golf-sim/.env`` (see ``.env.example``).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="GOLFSIM_",
        extra="ignore",
    )

    # ---- server -----------------------------------------------------------
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    # ---- storage ----------------------------------------------------------
    data_root: Path = Path("./data")
    #: Blank means "derive one on boot", e.g. ``20260906-morning``.
    session_id: str = ""

    # ---- pairing ----------------------------------------------------------
    #: Contract default. Artefacts of one strike must reach the PC inside this
    #: window of each other, measured on PC receipt time.
    pair_window_ms: int = 3000
    #: Grace after a shot closes during which a straggler still joins it
    #: instead of opening a phantom shot. Set to 0 for strict window behaviour.
    late_attach_ms: int = 5000
    reaper_interval_ms: int = 250
    expected_sources: list[str] = Field(
        default_factory=lambda: ["body_swing", "impact_strike", "telemetry"]
    )

    # ---- GSPro Open Connect v1 listener -----------------------------------
    gspro_enabled: bool = True
    gspro_host: str = "127.0.0.1"
    #: GSPro itself binds 921, so only one of the two can listen at a time.
    #: The listener can be stopped at runtime without killing the service.
    gspro_port: int = 921
    gspro_device_id: str = "GolfSimIngest"
    #: Log every frame the monitor sends. For working out what a bridge
    #: actually emits when shots are not registering.
    gspro_log_frames: bool = False
    #: Push a Code 201 "GSPro Player Information" frame on connect, and again
    #: after each shot once the device has settled (below). The Square's
    #: bridge configures the device per club and enables ball detection on
    #: that message; it never arms without it. Set false if a monitor objects.
    gspro_send_player_info: bool = True
    gspro_default_club: str = "DR"
    gspro_player_handed: str = "RH"

    #: Restored: every session in which the *first* ball was detected sent
    #: these two fields. GolfForge omits them, but GolfForge's Square profile
    #: was validated against brentyates' connector (DeviceID
    #: "CustomLaunchMonitor"), not the official one this bay runs (DeviceID
    #: "SquareGolf"). Local evidence beats a reference for other hardware.
    gspro_distance_to_target: int = 200

    #: The connector fires one shot per arm, then resets to idle over ~2-3 s
    #: with no "reset done" signal. Club data marks end-of-shot; the re-arm
    #: waits this long after it. Arming inside the reset freezes the loop.
    gspro_rearm_delay_s: float = 3.0

    #: Which message re-arms the device after a shot.
    #:
    #:   full | distance_change | club_change | minimal | ready
    #:                     send that one message, once. The reference server
    #:                     sends exactly one and never retries.
    #:   none              send nothing, and let the device re-arm itself.
    #:   probe             try each candidate in turn, reporting which one
    #:                     works. Diagnostic only -- see below.
    #:
    #: Empty or unset means ``full``. It previously meant ``probe``, which made
    #: five arm messages in 75 seconds the *default* behaviour after every
    #: shot: the exact pattern the reference implementation says freezes the
    #: connector's arm loop. That was a bug in this default, not a decision.
    #:
    #: ``probe`` is a recovery tool. It accepts the freeze risk in exchange for
    #: identifying the working message in one bay session rather than one
    #: hypothesis per session, and is worth it only once the device has already
    #: failed to arm.
    gspro_arm_variant: str = "full"
    #: How long to wait for a ball to be reported after each probe attempt.
    #: Only used by ``probe``.
    gspro_arm_probe_window_s: float = 15.0

    # ---- GSPro pass-through -----------------------------------------------
    #: Relay every frame on to the real GSPro, so the course plays while this
    #: app records. Only one process can bind a port, so run the listener on
    #: 922 and point the launch monitor bridge there; GSPro keeps 921.
    #:
    #:     bridge --> GOLFSIM_GSPRO_PORT (922) --> GSPro (921)
    gspro_forward_enabled: bool = False
    gspro_forward_host: str = "127.0.0.1"
    gspro_forward_port: int = 921
    gspro_forward_timeout_s: float = 3.0

    # ---- media defaults ---------------------------------------------------
    body_swing_camera: str = "face_on"
    body_swing_capture_fps: float = 30.0
    body_swing_container_fps: float = 30.0
    #: Second Kinovea camera, down-the-line.
    body_swing_dtl_camera: str = "dtl"
    body_swing_dtl_capture_fps: float = 60.0
    body_swing_dtl_container_fps: float = 60.0
    impact_camera: str = "impact"
    impact_capture_fps: float = 240.0
    impact_container_fps: float = 30.0

    # ---- Kinovea fallback watcher -----------------------------------------
    #: Preferred path is Kinovea's Automation hook posting to
    #: /api/ingest/body_swing. The watcher exists only for clips that appear
    #: without a notification.
    kinovea_watch_enabled: bool = False
    kinovea_export_dir: Path = Path("./data/kinovea_export")
    kinovea_extensions: list[str] = Field(
        default_factory=lambda: [".mp4", ".avi", ".mkv", ".mov"]
    )
    #: The watcher only sees a file once encoding finished, which is later than
    #: the strike. Back-dates its receipt stamp so pairing still lands.
    kinovea_lag_ms: int = 0
    file_stable_checks: int = 3
    file_stable_interval_ms: int = 400
    file_stable_timeout_ms: int = 120_000

    # ---- ball flight model -------------------------------------------------
    #: The monitor measures launch conditions only, so carry and apex are
    #: modelled. Results land in telemetry.flight, never in telemetry.distance.
    flight_model_enabled: bool = True
    flight_altitude_m: float = 0.0
    flight_temperature_c: float = 20.0

    # ---- pose extraction ---------------------------------------------------
    pose_enabled: bool = True
    #: Not shipped with the repo -- fetch once with scripts/fetch_pose_model.py.
    pose_model_path: Path = Path("./models/pose_landmarker_lite.task")
    #: Caps the sampling rate, halving the work on a 60 fps clip.
    #:
    #: 30 Hz is enough for every metric computed today, because they are all
    #: *positions* held at an instant -- shoulder turn and X-factor at the top
    #: of the backswing, spine angle at address. It is NOT enough for anything
    #: differentiated. A downswing lasts about 250 ms, which is 7 frames at
    #: 30 Hz and 15 at 60; velocity from 7 samples is coarse and acceleration
    #: is noise. So the day this rig computes a kinematic sequence -- peak
    #: angular velocity of pelvis, then thorax, then arms -- raise this to at
    #: least 60 and preferably match the camera.
    pose_max_fps: float = 30.0
    pose_min_confidence: float = 0.5
    #: Written by scripts/calibrate_cameras.py. Absent means pose stays 2D:
    #: shoulder turn, pelvis rotation and X-factor need two placed cameras.
    #: Re-read per shot, so calibrating does not need a backend restart.
    pose_calibration_path: Path = Path("./models/calibration.json")
    #: Shots waiting on extraction. Beyond this, pose is skipped rather than
    #: allowed to back up behind a range session.
    pose_queue_size: int = 8

    # ---- store-and-forward capture ----------------------------------------
    #: The stock-camera + watcher path reaches the PC seconds after the strike
    #: (Samsung processes the clip, then it uploads), so receipt time cannot
    #: pair it -- and a wider window would pair it to the *next* swing. When
    #: set, a plausible client-supplied trigger_ts is used for impact clips
    #: instead. Off by default: the contract's rule is that the PC stamps on
    #: receipt, and that is right for any live-trigger capture path.
    impact_trust_trigger_ts: bool = False
    #: A trigger_ts further than this from receipt time is a broken clock, not
    #: upload lag. Such a hint is ignored and the clip stamped on receipt.
    trigger_ts_max_skew_ms: int = 30_000

    # ---- uploads ----------------------------------------------------------
    max_upload_bytes: int = 512 * 1024 * 1024
    #: Optional shared secret; when set, ingest requires ``X-Golfsim-Token``.
    ingest_token: str = ""

    # ---- media probing ----------------------------------------------------
    ffprobe_path: str = "ffprobe"
    probe_timeout_seconds: float = 10.0

    @field_validator(
        "data_root", "kinovea_export_dir", "pose_model_path", "pose_calibration_path"
    )
    @classmethod
    def _expand(cls, value: Path) -> Path:
        return Path(value).expanduser()

    # ---- derived ----------------------------------------------------------
    @property
    def shots_dir(self) -> Path:
        return self.data_root / "shots"

    @property
    def pair_window_s(self) -> float:
        return self.pair_window_ms / 1000.0

    @property
    def late_attach_s(self) -> float:
        return self.late_attach_ms / 1000.0

    def ensure_dirs(self) -> None:
        for directory in (self.data_root, self.shots_dir, self.kinovea_export_dir):
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
