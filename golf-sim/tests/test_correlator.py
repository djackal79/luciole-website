"""Pairing-engine behaviour. No network, no real swings."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import pytest

from backend.correlator import Fragment, ShotCorrelator
from backend.models import ShotStatus, SourceKind
from backend.storage import iter_shots

pytestmark = pytest.mark.asyncio


def clip(tmp_path: Path, name: str, payload: bytes = b"\x00" * 2048) -> Path:
    path = tmp_path / name
    path.write_bytes(payload)
    return path


def telemetry_fragment(ts: float, club: str = "7i") -> Fragment:
    return Fragment(
        kind=SourceKind.TELEMETRY,
        timestamp=ts,
        payload={
            "device_id": "square_golf",
            "club": club,
            "metrics": {"ball_speed_mph": 118.4, "launch_angle_deg": 17.2},
            "raw": {},
        },
    )


async def test_three_sources_within_window_pair_into_one_shot(correlator, settings, tmp_path):
    base = time.time()
    await correlator.submit(
        Fragment(SourceKind.SWING_VIDEO, base - 1.2, {}, clip(tmp_path, "swing.mp4"))
    )
    await correlator.submit(
        Fragment(SourceKind.IMPACT_VIDEO, base + 0.4, {}, clip(tmp_path, "impact.mp4"))
    )
    await correlator.submit(telemetry_fragment(base))

    shots = iter_shots(settings)
    assert len(shots) == 1
    shot = shots[0]
    assert shot["status"] == ShotStatus.COMPLETE.value
    assert shot["present_sources"] == ["impact_video", "swing_video", "telemetry"]
    assert shot["missing_sources"] == []
    assert shot["club"] == "7i"
    # Telemetry is authoritative, so it becomes the anchor and sits at offset 0.
    assert shot["anchor"]["source"] == "telemetry"
    assert shot["pairing"]["offsets_s"]["telemetry"] == 0.0
    assert shot["pairing"]["offsets_s"]["swing_video"] == pytest.approx(-1.2, abs=0.01)


async def test_files_are_moved_into_the_package(correlator, settings, tmp_path):
    base = time.time()
    swing = clip(tmp_path, "swing.mp4", b"S" * 4096)
    await correlator.submit(Fragment(SourceKind.SWING_VIDEO, base, {}, swing))
    await correlator.submit(
        Fragment(SourceKind.IMPACT_VIDEO, base, {}, clip(tmp_path, "impact.mp4"))
    )
    await correlator.submit(telemetry_fragment(base))

    shot_dir = next(settings.shots_dir.iterdir())
    assert (shot_dir / "metadata.json").is_file()
    assert (shot_dir / "swing.mp4").read_bytes() == b"S" * 4096
    assert (shot_dir / "impact.mp4").is_file()
    # Staging is left clean.
    assert list(settings.staging_dir.iterdir()) == []

    metadata = json.loads((shot_dir / "metadata.json").read_text())
    assert metadata["sources"]["swing_video"]["bytes"] == 4096
    assert len(metadata["sources"]["swing_video"]["sha256"]) == 64


async def test_shots_outside_the_window_stay_separate(correlator, settings, tmp_path):
    base = time.time()
    await correlator.submit(telemetry_fragment(base))
    # 3.0 s window, so +5 s is a different swing.
    await correlator.submit(telemetry_fragment(base + 5.0, club="PW"))

    await asyncio.sleep(settings.settle_seconds + 0.4)
    await correlator.start()
    await asyncio.sleep(0.2)
    await correlator.stop()

    shots = iter_shots(settings)
    assert len(shots) == 2
    assert {s["club"] for s in shots} == {"7i", "PW"}
    assert all(s["status"] == ShotStatus.PARTIAL.value for s in shots)


async def test_duplicate_kind_opens_a_second_shot(correlator, settings, tmp_path):
    """Back-to-back swings inside the window must not clobber each other."""
    base = time.time()
    await correlator.submit(
        Fragment(SourceKind.SWING_VIDEO, base, {}, clip(tmp_path, "a.mp4", b"A" * 1024))
    )
    await correlator.submit(
        Fragment(SourceKind.SWING_VIDEO, base + 1.0, {}, clip(tmp_path, "b.mp4", b"B" * 1024))
    )
    assert len(correlator.open_snapshot()) == 2

    await correlator.flush_all()
    bodies = {
        (d / "swing.mp4").read_bytes()[:1]
        for d in settings.shots_dir.iterdir()
    }
    assert bodies == {b"A", b"B"}


async def test_incomplete_shot_is_written_as_partial(correlator, settings, tmp_path):
    await correlator.start()
    await correlator.submit(
        Fragment(SourceKind.SWING_VIDEO, time.time(), {}, clip(tmp_path, "swing.mp4"))
    )
    await asyncio.sleep(settings.settle_seconds + 0.4)
    await correlator.stop()

    shot = iter_shots(settings)[0]
    assert shot["status"] == ShotStatus.PARTIAL.value
    assert shot["missing_sources"] == ["impact_video", "telemetry"]
    assert shot["sources"]["telemetry"] == {"present": False}


async def test_straggler_is_late_attached_to_a_finalized_shot(correlator, settings, tmp_path):
    """A slow phone upload must still land in the shot it belongs to."""
    base = time.time()
    await correlator.submit(
        Fragment(SourceKind.SWING_VIDEO, base, {}, clip(tmp_path, "swing.mp4"))
    )
    await correlator.submit(telemetry_fragment(base))
    await correlator.flush_all()

    shot_dir = next(settings.shots_dir.iterdir())
    assert json.loads((shot_dir / "metadata.json").read_text())["status"] == "partial"

    await correlator.submit(
        Fragment(SourceKind.IMPACT_VIDEO, base + 0.2, {}, clip(tmp_path, "impact.mp4"))
    )

    # No second directory was created, and the package is now complete.
    assert len(list(settings.shots_dir.iterdir())) == 1
    metadata = json.loads((shot_dir / "metadata.json").read_text())
    assert metadata["status"] == ShotStatus.COMPLETE.value
    assert (shot_dir / "impact.mp4").is_file()


async def test_nearest_anchor_wins_when_several_shots_are_open(correlator, tmp_path):
    base = time.time()
    await correlator.submit(telemetry_fragment(base))
    await correlator.submit(telemetry_fragment(base + 2.5, club="PW"))

    # 2.2 s is within the window of both anchors, but closer to the second.
    await correlator.submit(
        Fragment(SourceKind.SWING_VIDEO, base + 2.2, {}, clip(tmp_path, "swing.mp4"))
    )
    open_shots = {s["anchor_timestamp"]: s["have"] for s in correlator.open_snapshot()}
    assert open_shots[base] == ["telemetry"]
    assert open_shots[base + 2.5] == ["swing_video", "telemetry"]


async def test_window_is_anchor_relative_and_boundary_inclusive(correlator, tmp_path):
    """The window is measured from the anchor, not from the last artefact.

    So a shot spans at most +/-3 s around its anchor; it does not creep
    forward as each new artefact attaches.
    """
    base = time.time()
    await correlator.submit(telemetry_fragment(base))

    # Exactly on the boundary -> attaches.
    await correlator.submit(
        Fragment(SourceKind.SWING_VIDEO, base + 3.0, {}, clip(tmp_path, "swing.mp4"))
    )
    assert len(correlator.open_snapshot()) == 1

    # A millisecond past it -> new shot, even though it is adjacent to the
    # swing clip that just attached.
    await correlator.submit(
        Fragment(SourceKind.IMPACT_VIDEO, base + 3.001, {}, clip(tmp_path, "impact.mp4"))
    )
    snapshot = correlator.open_snapshot()
    assert len(snapshot) == 2
    assert [s["have"] for s in snapshot] == [["swing_video", "telemetry"], ["impact_video"]]
