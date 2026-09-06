"""The metadata.json shape is the contract; assert it literally."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from backend.models import (
    BallData,
    ClubData,
    ShotPackage,
    SyncBlock,
    derive,
    shot_id_for,
    telemetry_from_gspro,
)
from mock_provider import build_scenarios


def test_shot_id_is_compact_local_time_to_the_millisecond():
    moment = datetime(2026, 9, 6, 14, 30, 52, 478_000).astimezone()
    assert shot_id_for(moment) == "20260906T143052-478"


def test_shot_ids_sort_lexically_in_time_order():
    ids = [
        shot_id_for(datetime(2026, 9, 6, 14, 30, 52, 478_000).astimezone()),
        shot_id_for(datetime(2026, 9, 6, 14, 30, 52, 903_000).astimezone()),
        shot_id_for(datetime(2026, 9, 6, 14, 31, 2, 100_000).astimezone()),
        shot_id_for(datetime(2026, 9, 7, 1, 0, 0, 0).astimezone()),
    ]
    assert ids == sorted(ids)


def test_folder_name_prefixes_the_shot_id():
    package = ShotPackage(
        shot_id="20260906T143052-478",
        session_id="s",
        created_at="2026-09-06T14:30:52.478+10:00",
        sync=SyncBlock(trigger_ts="2026-09-06T14:30:52.478+10:00"),
    )
    assert package.folder_name == "shot_20260906T143052-478"


def test_top_level_keys_match_the_contract_exactly():
    package = build_scenarios()[0].to_json()
    assert list(package) == [
        "schema_version", "shot_id", "session_id", "created_at", "status",
        "sources", "media", "sync", "telemetry", "club_used", "tags", "notes",
    ]
    assert package["schema_version"] == "1.0"
    assert list(package["sources"]) == ["body_swing", "impact_strike", "telemetry"]
    assert list(package["sync"]) == ["trigger_ts", "impact_offset_ms"]
    assert list(package["telemetry"]) == [
        "source", "received_at", "ball", "club", "derived", "distance", "raw"
    ]
    assert list(package["media"]["impact_strike"]) == [
        "path", "camera", "capture_fps", "container_fps", "duration_ms", "width", "height"
    ]


def test_timestamps_are_iso8601_with_offset():
    package = build_scenarios()[0].to_json()
    pattern = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$")
    assert pattern.match(package["created_at"])
    assert pattern.match(package["sync"]["trigger_ts"])
    assert pattern.match(package["telemetry"]["received_at"])


def test_capture_fps_and_container_fps_are_both_carried():
    """240 fps footage in a 30 fps container. Confusing the two makes every
    time measurement wrong by 8x."""
    impact = build_scenarios()[0].to_json()["media"]["impact_strike"]
    assert impact["capture_fps"] == 240
    assert impact["container_fps"] == 30


def test_absent_media_key_is_omitted_entirely():
    telemetry_and_swing = build_scenarios()[1].to_json()
    assert telemetry_and_swing["sources"]["impact_strike"] is False
    assert "impact_strike" not in telemetry_and_swing["media"]
    assert set(telemetry_and_swing["media"]) == {"body_swing"}


def test_carry_and_total_are_null_on_the_gspro_path():
    for package in build_scenarios():
        if package.telemetry is not None:
            assert package.telemetry.distance.carry_m is None
            assert package.telemetry.distance.total_m is None


def test_the_five_required_scenarios_are_present():
    packages = build_scenarios()
    assert len(packages) == 5

    complete_full, partial_no_impact, partial_no_telemetry, ball_only, draw = packages

    assert complete_full.status == "complete"
    assert all(complete_full.sources.values())
    assert complete_full.telemetry.club.speed_mph is not None

    assert partial_no_impact.status == "partial"
    assert partial_no_impact.sources["impact_strike"] is False

    assert partial_no_telemetry.status == "partial"
    assert partial_no_telemetry.sources["telemetry"] is False
    assert partial_no_telemetry.telemetry is None

    assert ball_only.status == "complete"
    assert ball_only.telemetry.ball.speed_mph is not None
    assert ball_only.telemetry.club.speed_mph is None
    assert ball_only.telemetry.derived.smash_factor is None

    assert draw.telemetry.ball.spin_axis_deg < 0
    assert draw.telemetry.derived.face_to_path_deg <= -5


def test_derived_matches_the_contract_worked_example():
    ball = BallData(speed_mph=132.4)
    club = ClubData(speed_mph=92.1, path_deg=2.4, face_to_target_deg=-1.1)
    derived = derive(ball, club)
    assert derived.smash_factor == 1.44
    assert derived.face_to_path_deg == -3.5


def test_smash_factor_is_null_without_club_data():
    assert derive(BallData(speed_mph=132.4), ClubData()).smash_factor is None


@pytest.mark.parametrize("contains_club_data", [True, False])
def test_gspro_mapping(contains_club_data):
    """ContainsClubData decides whether club fields are real -- a genuine 0.0
    path is an ordinary swing, so zero-checking would be wrong."""
    payload = {
        "Units": "Yards",
        "BallData": {
            "Speed": 132.4, "TotalSpin": 6200, "BackSpin": 6100, "SideSpin": -900,
            "SpinAxis": -8.3, "VLA": 17.2, "HLA": 1.4,
        },
        "ClubData": {
            "Speed": 92.1, "AngleOfAttack": -3.1, "Path": 0.0,
            "FaceToTarget": -1.1, "Loft": 24.6, "ClosureRate": 0.0,
        },
        "ShotDataOptions": {
            "ContainsBallData": True,
            "ContainsClubData": contains_club_data,
            "IsHeartBeat": False,
        },
    }
    telemetry = telemetry_from_gspro(payload, datetime.now().astimezone())

    assert telemetry.source == "gspro_connect_v1"
    assert telemetry.ball.speed_mph == 132.4
    assert telemetry.ball.launch_angle_deg == 17.2       # VLA
    assert telemetry.ball.launch_direction_deg == 1.4    # HLA
    assert telemetry.raw == payload                      # stored verbatim

    if contains_club_data:
        assert telemetry.club.path_deg == 0.0
        assert telemetry.club.closure_rate_dps == 0.0
        assert telemetry.derived.smash_factor == 1.44
    else:
        assert telemetry.club.speed_mph is None
        assert telemetry.club.path_deg is None
        assert telemetry.derived.smash_factor is None


def test_mock_fixtures_round_trip_through_json():
    for package in build_scenarios():
        assert ShotPackage.model_validate(json.loads(json.dumps(package.to_json())))
