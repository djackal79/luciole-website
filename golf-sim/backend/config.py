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

    # ---- pose extraction ---------------------------------------------------
    pose_enabled: bool = True
    #: Not shipped with the repo -- fetch once with scripts/fetch_pose_model.py.
    pose_model_path: Path = Path("./models/pose_landmarker_lite.task")
    #: Caps the sampling rate. Pose at 30 Hz is already finer than any swing
    #: metric needs, so a 60 fps DTL clip is halved for nothing lost.
    pose_max_fps: float = 30.0
    pose_min_confidence: float = 0.5
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

    @field_validator("data_root", "kinovea_export_dir", "pose_model_path")
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
