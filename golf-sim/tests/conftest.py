from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.config import Settings  # noqa: E402
from backend.correlator import ShotCorrelator  # noqa: E402
from backend.events import EventBus  # noqa: E402


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        data_root=tmp_path / "data",
        kinovea_export_dir=tmp_path / "kinovea",
        pair_window_seconds=3.0,
        settle_seconds=1.0,
        late_attach_seconds=30.0,
        reaper_interval_seconds=0.05,
        _env_file=None,
    )


@pytest.fixture
def correlator(settings: Settings) -> ShotCorrelator:
    settings.ensure_dirs()
    return ShotCorrelator(settings, EventBus())
