"""Configuration for the golf simulator ingestion backend.

Every value can be overridden with a ``GOLFSIM_``-prefixed environment
variable or an entry in ``golf-sim/.env`` (see ``.env.example``).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

KinoveaTimestampMode = Literal["filename", "mtime", "mtime_minus_duration"]


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
    #: Directory Kinovea is configured to export finished clips into.
    kinovea_export_dir: Path = Path("./data/kinovea_export")

    # ---- pairing ----------------------------------------------------------
    #: Two artefacts belong to the same shot when their impact timestamps are
    #: within +/- this many seconds of each other.
    pair_window_seconds: float = 3.0
    #: How long an incomplete shot stays open before it is written out as
    #: ``partial``. Must comfortably exceed the slowest upload.
    settle_seconds: float = 12.0
    #: A finalized shot can still absorb a straggler for this long.
    late_attach_seconds: float = 90.0
    reaper_interval_seconds: float = 0.5
    #: Artefacts required before a shot counts as ``complete``.
    expected_sources: list[str] = Field(
        default_factory=lambda: ["swing_video", "impact_video", "telemetry"]
    )

    # ---- Kinovea ingest ---------------------------------------------------
    kinovea_extensions: list[str] = Field(
        default_factory=lambda: [".mp4", ".avi", ".mkv", ".mov"]
    )
    kinovea_timestamp_mode: KinoveaTimestampMode = "mtime"
    #: Seconds between the real-world impact and Kinovea closing the file
    #: (encode + flush). Subtracted from mtime. Calibrate once, see README.
    kinovea_write_lag_seconds: float = 0.0
    #: Where impact sits *inside* the exported clip. Kinovea's delayed capture
    #: keeps a pre-roll, so impact is not at t=0. Recorded in metadata so the
    #: Build 2 player can align both videos on the impact frame.
    kinovea_impact_offset_seconds: float = 0.0
    #: strptime patterns tried against the filename in "filename" mode.
    kinovea_filename_time_formats: list[str] = Field(
        default_factory=lambda: [
            "%Y%m%d-%H%M%S",
            "%Y%m%d_%H%M%S",
            "%Y-%m-%d %H-%M-%S",
            "%Y-%m-%dT%H-%M-%S",
        ]
    )
    #: Ingest files already present in the export dir when the service boots.
    ingest_existing_on_start: bool = False

    # ---- write-completion detection ---------------------------------------
    #: A file is considered fully written once its size is unchanged across
    #: this many consecutive polls.
    file_stable_checks: int = 3
    file_stable_interval_seconds: float = 0.4
    file_stable_timeout_seconds: float = 120.0

    # ---- uploads ----------------------------------------------------------
    max_upload_bytes: int = 512 * 1024 * 1024
    #: Optional shared secret; when set, ingest endpoints require
    #: ``X-Golfsim-Token``. Leave empty on a trusted LAN.
    ingest_token: str = ""

    # ---- media probing ----------------------------------------------------
    ffprobe_path: str = "ffprobe"
    probe_timeout_seconds: float = 10.0

    @field_validator("data_root", "kinovea_export_dir")
    @classmethod
    def _expand(cls, value: Path) -> Path:
        return Path(value).expanduser()

    # ---- derived ----------------------------------------------------------
    @property
    def shots_dir(self) -> Path:
        return self.data_root / "shots"

    @property
    def staging_dir(self) -> Path:
        return self.data_root / "staging"

    def ensure_dirs(self) -> None:
        for directory in (
            self.data_root,
            self.shots_dir,
            self.staging_dir,
            self.kinovea_export_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
