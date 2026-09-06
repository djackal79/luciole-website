from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.config import Settings  # noqa: E402
from backend.correlator import ShotCorrelator  # noqa: E402
from backend.events import EventBus  # noqa: E402

#: A valid ftyp box, so uploads look like video without needing ffmpeg.
MP4_STUB = bytes.fromhex("0000001c66747970697336") + b"\x00" * 4096


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        data_root=tmp_path / "data",
        kinovea_export_dir=tmp_path / "kinovea",
        pair_window_ms=3000,
        late_attach_ms=5000,
        reaper_interval_ms=50,
        gspro_enabled=False,
        kinovea_watch_enabled=False,
        _env_file=None,
    )


@pytest.fixture
def bus() -> EventBus:
    return EventBus()


@pytest.fixture
def correlator(settings: Settings, bus: EventBus) -> ShotCorrelator:
    settings.ensure_dirs()
    return ShotCorrelator(settings, bus, "test-session")
