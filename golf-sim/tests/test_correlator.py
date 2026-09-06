"""Pairing behaviour. No network, no real swings."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import pytest

from backend import events
from backend.correlator import MediaArrival
from backend.models import (
    BallData,
    ClubData,
    ShotPatch,
    SourceName,
    TelemetryBlock,
    derive,
    iso,
    local_now,
)

pytestmark = pytest.mark.asyncio


def clip(tmp_path: Path, name: str, payload: bytes = b"\x00" * 2048) -> Path:
    path = tmp_path / name
    path.write_bytes(payload)
    return path


def media(tmp_path: Path, source: SourceName, name: str, **kwargs) -> MediaArrival:
    return MediaArrival(
        source=source,
        file=clip(tmp_path, name, kwargs.pop("payload", b"\x00" * 2048)),
        camera=kwargs.pop("camera", "face_on"),
        capture_fps=kwargs.pop("capture_fps", 30.0),
        container_fps=kwargs.pop("container_fps", 30.0),
        **kwargs,
    )


def telemetry(speed: float = 132.4) -> TelemetryBlock:
    ball = BallData(speed_mph=speed, launch_angle_deg=17.2)
    club = ClubData(speed_mph=92.1, path_deg=2.4, face_to_target_deg=-1.1)
    return TelemetryBlock(
        received_at=iso(local_now()), ball=ball, club=club, derived=derive(ball, club)
    )


def metadata_of(settings, shot_id: str) -> dict:
    path = settings.shots_dir / f"shot_{shot_id}" / "metadata.json"
    return json.loads(path.read_text())


async def test_three_sources_pair_into_one_complete_shot(correlator, settings, tmp_path):
    await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    await correlator.submit_media(
        media(tmp_path, SourceName.IMPACT_STRIKE, "b.mp4", camera="impact", capture_fps=240.0)
    )
    package = await correlator.submit_telemetry(telemetry())

    assert len(list(settings.shots_dir.iterdir())) == 1
    written = metadata_of(settings, package.shot_id)
    assert written["status"] == "complete"
    assert written["sources"] == {
        "body_swing": True, "impact_strike": True, "telemetry": True
    }
    assert written["media"]["impact_strike"]["capture_fps"] == 240.0
    assert written["media"]["impact_strike"]["container_fps"] == 30.0
    assert written["telemetry"]["derived"]["smash_factor"] == 1.44


async def test_metadata_is_on_disk_while_the_shot_is_still_pending(
    correlator, settings, tmp_path
):
    """The frontend shows a shot immediately, so disk must reflect it too."""
    package = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    written = metadata_of(settings, package.shot_id)
    assert written["status"] == "pending"
    assert written["sources"]["body_swing"] is True
    assert written["media"]["body_swing"]["path"] == "body_swing.mp4"
    assert "impact_strike" not in written["media"]
    assert written["telemetry"] is None


async def test_media_lands_under_its_canonical_name(correlator, settings, tmp_path):
    package = await correlator.submit_media(
        media(tmp_path, SourceName.BODY_SWING, "kinovea-export-1234.mp4", payload=b"S" * 4096)
    )
    shot_dir = settings.shots_dir / f"shot_{package.shot_id}"
    assert (shot_dir / "body_swing.mp4").read_bytes() == b"S" * 4096


async def test_a_copied_source_file_stays_where_it_was(correlator, settings, tmp_path):
    """Kinovea's own recording must survive ingest in its original location."""
    original = clip(tmp_path, "kinovea.mp4", b"K" * 1024)
    await correlator.submit_media(
        MediaArrival(
            source=SourceName.BODY_SWING, file=original, camera="face_on", copy=True
        )
    )
    assert original.is_file()


async def test_window_expiry_writes_a_partial_shot(correlator, settings, tmp_path):
    settings.pair_window_ms = 300
    await correlator.start()
    package = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    await asyncio.sleep(0.6)
    await correlator.stop()

    written = metadata_of(settings, package.shot_id)
    assert written["status"] == "partial"
    assert written["sources"] == {
        "body_swing": True, "impact_strike": False, "telemetry": False
    }


async def test_shots_outside_the_window_stay_separate(correlator, settings, tmp_path):
    settings.pair_window_ms = 200
    first = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    await asyncio.sleep(0.35)
    second = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "b.mp4"))
    assert first.shot_id != second.shot_id
    assert len(list(settings.shots_dir.iterdir())) == 2


async def test_duplicate_source_opens_a_second_shot(correlator, settings, tmp_path):
    """Back-to-back swings inside the window must not clobber each other."""
    first = await correlator.submit_media(
        media(tmp_path, SourceName.BODY_SWING, "a.mp4", payload=b"A" * 1024)
    )
    second = await correlator.submit_media(
        media(tmp_path, SourceName.BODY_SWING, "b.mp4", payload=b"B" * 1024)
    )
    assert first.shot_id != second.shot_id
    bodies = {
        (d / "body_swing.mp4").read_bytes()[:1] for d in settings.shots_dir.iterdir()
    }
    assert bodies == {b"A", b"B"}


async def test_straggler_joins_the_shot_instead_of_opening_a_phantom(
    correlator, settings, tmp_path
):
    settings.pair_window_ms = 200
    settings.late_attach_ms = 5000
    await correlator.start()
    package = await correlator.submit_telemetry(telemetry())
    await asyncio.sleep(0.5)
    assert metadata_of(settings, package.shot_id)["status"] == "partial"

    await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    await correlator.submit_media(
        media(tmp_path, SourceName.IMPACT_STRIKE, "b.mp4", camera="impact")
    )
    await correlator.stop()

    assert len(list(settings.shots_dir.iterdir())) == 1
    assert metadata_of(settings, package.shot_id)["status"] == "complete"


async def test_late_attach_can_be_disabled(correlator, settings, tmp_path):
    settings.pair_window_ms = 200
    settings.late_attach_ms = 0
    await correlator.start()
    await correlator.submit_telemetry(telemetry())
    await asyncio.sleep(0.5)
    await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    await correlator.stop()
    assert len(list(settings.shots_dir.iterdir())) == 2


async def test_device_clock_skew_cannot_affect_pairing(correlator, settings, tmp_path):
    """The PC is the clock authority; trigger_ts is an ordering hint only."""
    await correlator.submit_telemetry(telemetry())
    package = await correlator.submit_media(
        media(
            tmp_path,
            SourceName.IMPACT_STRIKE,
            "b.mp4",
            camera="impact",
            trigger_hint="1999-01-01T00:00:00.000+00:00",
        )
    )
    assert package.sources["telemetry"] and package.sources["impact_strike"]
    assert len(list(settings.shots_dir.iterdir())) == 1


async def test_event_sequence_for_a_full_shot(correlator, bus, tmp_path):
    async with bus.subscribe() as queue:
        await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
        await correlator.submit_media(
            media(tmp_path, SourceName.IMPACT_STRIKE, "b.mp4", camera="impact")
        )
        await correlator.submit_telemetry(telemetry())
        seen = [queue.get_nowait() for _ in range(3)]

    assert [e["type"] for e in seen] == [
        events.SHOT_CREATED, events.SHOT_UPDATED, events.SHOT_COMPLETED
    ]
    # Every payload is the complete object, never a diff.
    for event in seen:
        assert event["payload"]["shot_id"] == event["shot_id"]
        assert set(event["payload"]) >= {"sources", "media", "sync", "telemetry"}
    assert seen[-1]["payload"]["status"] == "complete"


async def test_patch_persists_and_announces(correlator, settings, bus, tmp_path):
    package = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    async with bus.subscribe() as queue:
        updated = await correlator.patch(
            package.shot_id,
            ShotPatch(tags=["Shank"], notes="hosel", club_used="7I", impact_offset_ms=-125),
        )
        event = queue.get_nowait()

    assert event["type"] == events.SHOT_PATCHED
    assert updated["tags"] == ["Shank"]
    assert updated["sync"]["impact_offset_ms"] == -125
    written = metadata_of(settings, package.shot_id)
    assert written["notes"] == "hosel"
    assert written["club_used"] == "7I"
    assert written["sync"]["impact_offset_ms"] == -125


async def test_patch_works_after_the_shot_left_memory(correlator, settings, tmp_path):
    """The calibration slider must still work on an old shot."""
    package = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    correlator._tracked.clear()
    updated = await correlator.patch(package.shot_id, ShotPatch(impact_offset_ms=42))
    assert updated["sync"]["impact_offset_ms"] == 42
    assert metadata_of(settings, package.shot_id)["sync"]["impact_offset_ms"] == 42


async def test_patch_of_an_unknown_shot_returns_none(correlator):
    assert await correlator.patch("nope", ShotPatch(notes="x")) is None


async def test_session_club_is_stamped_on_every_new_shot(correlator, tmp_path):
    """Whichever source opens the shot -- a video-only shot is still labelled."""
    correlator.current_club = "7I"
    from_video = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    assert from_video.club_used == "7I"

    correlator.current_club = "DR"
    correlator._tracked.clear()
    from_telemetry = await correlator.submit_telemetry(telemetry())
    assert from_telemetry.club_used == "DR"


async def test_session_reset_closes_open_shots_and_announces(
    correlator, settings, bus, tmp_path
):
    package = await correlator.submit_media(media(tmp_path, SourceName.BODY_SWING, "a.mp4"))
    async with bus.subscribe() as queue:
        await correlator.reset_session("20260906-afternoon")
        types = []
        while not queue.empty():
            types.append(queue.get_nowait())

    assert [e["type"] for e in types] == [events.SHOT_COMPLETED, events.SESSION_RESET]
    assert types[-1]["payload"] == {"session_id": "20260906-afternoon"}
    assert metadata_of(settings, package.shot_id)["status"] == "partial"

    later = await correlator.submit_telemetry(telemetry())
    assert later.session_id == "20260906-afternoon"
