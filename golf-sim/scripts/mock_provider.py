#!/usr/bin/env python3
"""Mock shot packages in the exact contract schema, for both builds.

Ships the five scenarios the contract requires, so the frontend is not only
ever tested on the happy path:

1. complete  -- all three sources, full ball + club data
2. partial   -- telemetry + body swing, no impact video (phone missed it)
3. partial   -- both videos, no telemetry (LM not connected)
4. complete  -- ball data only, ContainsClubData false -> smash_factor null
5. complete  -- heavy draw: negative spin axis, face_to_path strongly negative

    python scripts/mock_provider.py --out mocks            # fixtures + media
    python scripts/mock_provider.py --seed data/shots      # into a live data dir
    python scripts/mock_provider.py --print                # JSON array on stdout
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import make_clip  # noqa: E402
from backend.models import (  # noqa: E402
    BallData,
    ClubData,
    DistanceData,
    MediaEntry,
    ShotPackage,
    ShotStatus,
    SyncBlock,
    TelemetryBlock,
    derive,
    iso,
    local_now,
    shot_id_for,
)

SESSION_ID = "20260906-morning"

#: Fixed so the checked-in fixtures are reproducible and do not churn. It is
#: the contract document's own example instant, so scenario 1 carries the
#: shot_id the contract shows.
FIXTURE_BASE = datetime(2026, 9, 6, 14, 30, 52, 478_000)

BODY_SWING_MEDIA = MediaEntry(
    path="body_swing.mp4",
    camera="face_on",
    capture_fps=30,
    container_fps=30,
    duration_ms=4000,
    width=1280,
    height=720,
)
#: 240 fps footage in a 30 fps container -- the distinction Build 2 must honour.
IMPACT_MEDIA = MediaEntry(
    path="impact_strike.mp4",
    camera="impact",
    capture_fps=240,
    container_fps=30,
    duration_ms=1500,
    width=1920,
    height=1080,
)


def _telemetry(ball: BallData, club: ClubData, moment: datetime, raw: dict) -> TelemetryBlock:
    return TelemetryBlock(
        source="gspro_connect_v1",
        received_at=iso(moment + timedelta(milliseconds=624)),
        ball=ball,
        club=club,
        derived=derive(ball, club),
        # Launch conditions only: carry and total are GSPro physics, not
        # measured by the monitor.
        distance=DistanceData(),
        raw=raw,
    )


def _package(
    moment: datetime,
    *,
    status: ShotStatus,
    body_swing: bool,
    impact_strike: bool,
    telemetry: TelemetryBlock | None,
    club_used: str | None = None,
    tags: list[str] | None = None,
    notes: str = "",
    impact_offset_ms: int = 0,
) -> ShotPackage:
    media = {}
    if body_swing:
        media["body_swing"] = BODY_SWING_MEDIA
    if impact_strike:
        media["impact_strike"] = IMPACT_MEDIA
    return ShotPackage(
        shot_id=shot_id_for(moment),
        session_id=SESSION_ID,
        created_at=iso(moment),
        status=status,
        sources={
            "body_swing": body_swing,
            "impact_strike": impact_strike,
            "telemetry": telemetry is not None,
        },
        media=media,
        sync=SyncBlock(trigger_ts=iso(moment), impact_offset_ms=impact_offset_ms),
        telemetry=telemetry,
        club_used=club_used,
        tags=tags or [],
        notes=notes,
    )


def build_scenarios(base: datetime | None = None) -> list[ShotPackage]:
    base = (base or FIXTURE_BASE).astimezone()
    packages: list[ShotPackage] = []

    # 1. complete -- all three sources, full ball + club data
    moment = base
    ball = BallData(
        speed_mph=132.4, total_spin_rpm=6200, back_spin_rpm=6100, side_spin_rpm=-900,
        spin_axis_deg=-8.3, launch_angle_deg=17.2, launch_direction_deg=1.4,
    )
    club = ClubData(
        speed_mph=92.1, angle_of_attack_deg=-3.1, path_deg=2.4,
        face_to_target_deg=-1.1, loft_deg=24.6, closure_rate_dps=None,
    )
    packages.append(
        _package(
            moment,
            status=ShotStatus.COMPLETE,
            body_swing=True,
            impact_strike=True,
            telemetry=_telemetry(ball, club, moment, _raw(ball, club)),
            club_used="7I",
            tags=["Good Strike"],
            notes="Baseline reference shot.",
        )
    )

    # 2. partial -- telemetry + body swing, phone missed the impact clip
    moment = base + timedelta(seconds=42)
    ball = BallData(
        speed_mph=118.9, total_spin_rpm=6840, back_spin_rpm=6800, side_spin_rpm=740,
        spin_axis_deg=6.2, launch_angle_deg=18.9, launch_direction_deg=-2.1,
    )
    club = ClubData(
        speed_mph=83.6, angle_of_attack_deg=-4.2, path_deg=-2.9,
        face_to_target_deg=-0.4, loft_deg=24.6, closure_rate_dps=None,
    )
    packages.append(
        _package(
            moment,
            status=ShotStatus.PARTIAL,
            body_swing=True,
            impact_strike=False,
            telemetry=_telemetry(ball, club, moment, _raw(ball, club)),
            club_used="7I",
            tags=["Pushed"],
        )
    )

    # 3. partial -- both videos, launch monitor not connected
    moment = base + timedelta(seconds=95)
    packages.append(
        _package(
            moment,
            status=ShotStatus.PARTIAL,
            body_swing=True,
            impact_strike=True,
            telemetry=None,
            club_used="7I",
            notes="LM was unplugged; video only.",
            impact_offset_ms=-120,
        )
    )

    # 4. complete -- ball data only, ContainsClubData false -> smash null
    moment = base + timedelta(seconds=138)
    ball = BallData(
        speed_mph=124.7, total_spin_rpm=5980, back_spin_rpm=5960, side_spin_rpm=-210,
        spin_axis_deg=-2.0, launch_angle_deg=16.4, launch_direction_deg=0.6,
    )
    club = ClubData()  # ContainsClubData was false
    packages.append(
        _package(
            moment,
            status=ShotStatus.COMPLETE,
            body_swing=True,
            impact_strike=True,
            telemetry=_telemetry(ball, club, moment, _raw(ball, None)),
            club_used=None,
            notes="Monitor reported ball data only.",
        )
    )

    # 5. complete -- heavy draw
    moment = base + timedelta(seconds=181)
    ball = BallData(
        speed_mph=121.8, total_spin_rpm=7120, back_spin_rpm=6820, side_spin_rpm=-2040,
        spin_axis_deg=-16.7, launch_angle_deg=15.8, launch_direction_deg=3.1,
    )
    club = ClubData(
        speed_mph=85.0, angle_of_attack_deg=-3.4, path_deg=4.2,
        face_to_target_deg=-1.8, loft_deg=24.6, closure_rate_dps=61.4,
    )
    packages.append(
        _package(
            moment,
            status=ShotStatus.COMPLETE,
            body_swing=True,
            impact_strike=True,
            telemetry=_telemetry(ball, club, moment, _raw(ball, club)),
            club_used="7I",
            tags=["Good Strike"],
            notes="Face 6.0 deg closed to a 4.2 deg in-to-out path: heavy draw.",
            impact_offset_ms=80,
        )
    )
    return packages


def _raw(ball: BallData, club: ClubData | None) -> dict:
    """The provider payload these numbers would have arrived in."""
    payload = {
        "DeviceID": "MockMonitor",
        "Units": "Yards",
        "APIversion": "1",
        "BallData": {
            "Speed": ball.speed_mph,
            "SpinAxis": ball.spin_axis_deg,
            "TotalSpin": ball.total_spin_rpm,
            "BackSpin": ball.back_spin_rpm,
            "SideSpin": ball.side_spin_rpm,
            "HLA": ball.launch_direction_deg,
            "VLA": ball.launch_angle_deg,
        },
        "ShotDataOptions": {
            "ContainsBallData": True,
            "ContainsClubData": club is not None,
            "LaunchMonitorIsReady": True,
            "LaunchMonitorBallDetected": True,
            "IsHeartBeat": False,
        },
    }
    if club is not None:
        payload["ClubData"] = {
            "Speed": club.speed_mph,
            "AngleOfAttack": club.angle_of_attack_deg,
            "FaceToTarget": club.face_to_target_deg,
            "Loft": club.loft_deg,
            "Path": club.path_deg,
            "ClosureRate": club.closure_rate_dps,
        }
    return payload


def write_packages(packages: list[ShotPackage], root: Path, *, media: bool) -> None:
    root.mkdir(parents=True, exist_ok=True)
    # An aggregate the frontend can import as fixtures without running anything.
    (root / "shots.json").write_text(
        json.dumps([p.to_json() for p in packages], indent=2) + "\n", encoding="utf-8"
    )
    for package in packages:
        directory = root / package.folder_name
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "metadata.json").write_text(
            json.dumps(package.to_json(), indent=2) + "\n", encoding="utf-8"
        )
        if not media:
            continue
        for name, entry in package.media.items():
            make_clip(
                directory / entry.path,
                seconds=(entry.duration_ms or 2000) / 1000.0,
                container_fps=int(entry.container_fps or 30),
                size=f"{min(entry.width or 640, 640)}x{min(entry.height or 480, 480)}",
                label=name,
            )
    print(f"wrote {len(packages)} shot package(s) to {root}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, help="write fixture folders here")
    parser.add_argument("--seed", type=Path, help="write into a live shots dir")
    parser.add_argument("--no-media", action="store_true", help="metadata.json only")
    parser.add_argument("--print", dest="dump", action="store_true",
                        help="print the five packages as a JSON array")
    parser.add_argument("--now", action="store_true",
                        help="timestamp the scenarios now instead of the fixed base")
    args = parser.parse_args()

    packages = build_scenarios(local_now() if args.now else None)
    if args.dump or not (args.out or args.seed):
        print(json.dumps([p.to_json() for p in packages], indent=2))
    for target in (args.out, args.seed):
        if target is not None:
            write_packages(packages, target, media=not args.no_media)


if __name__ == "__main__":
    main()
