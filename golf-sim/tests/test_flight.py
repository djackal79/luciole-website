"""Ball flight model.

The monitor measures launch conditions only, so everything here is modelled.
These tests pin it against published carry distances and against physics that
must hold regardless of how the coefficients are tuned.
"""

from __future__ import annotations

import math

import pytest

import backend.flight as flight
from backend.flight import Conditions, Launch, simulate
from backend.models import BallData, FlightBlock, model_flight

M_TO_YARDS = flight.M_TO_YARDS

#: Launch conditions and the carry they are known to produce, spanning the
#: spin range from driver to wedge.
CLUBS = [
    ("Driver", 152.0, 13.4, 2650.0, 248),
    ("5 iron", 128.0, 15.1, 5200.0, 187),
    ("7 iron", 118.0, 17.6, 6600.0, 162),
    ("Wedge", 96.0, 24.8, 9100.0, 128),
]


def carry_yards(speed, vla, spin, **kwargs) -> float:
    result = simulate(
        Launch(ball_speed_mph=speed, launch_angle_deg=vla, back_spin_rpm=spin, **kwargs)
    )
    assert result is not None
    return result.carry_m * M_TO_YARDS


@pytest.mark.parametrize("name,speed,vla,spin,expected", CLUBS)
def test_carry_matches_published_distances(name, speed, vla, spin, expected):
    assert carry_yards(speed, vla, spin) == pytest.approx(expected, rel=0.05)


@pytest.mark.parametrize("name,speed,vla,spin,expected", CLUBS)
def test_lift_coefficients_stay_physical(name, speed, vla, spin, expected):
    """A fit that matched the distances with unphysical coefficients would be
    four numbers memorised, not a model. Measured golf ball lift sits roughly
    between 0.1 and 0.3 across this spin range."""
    ratio = (spin * flight.RPM_TO_RADS) * flight.BALL_RADIUS_M / (speed * flight.MPH_TO_MS)
    cl = flight.CL_MAX * (1.0 - math.exp(-flight.CL_RATE * ratio))
    cd = flight.CD0 + flight.CD_SPIN * ratio
    assert 0.10 <= cl <= 0.30, f"{name}: Cl {cl:.3f} outside measured range"
    assert 0.20 <= cd <= 0.35, f"{name}: Cd {cd:.3f} outside measured range"


def test_apex_and_descent_are_realistic():
    result = simulate(Launch(ball_speed_mph=152, launch_angle_deg=13.4, back_spin_rpm=2650))
    assert 80 <= result.apex_m * flight.M_TO_FEET <= 130   # driver apex, feet
    assert 30 <= result.descent_angle_deg <= 45
    assert 5.0 <= result.flight_time_s <= 8.0


# ---- curvature ------------------------------------------------------------


def test_a_negative_spin_axis_curves_left():
    """Draw for a right-hander. Getting this backwards would put every shot on
    the wrong side of the fairway."""
    result = simulate(
        Launch(ball_speed_mph=130, launch_angle_deg=15, back_spin_rpm=5000, spin_axis_deg=-12)
    )
    assert result.offline_m < -3


def test_a_positive_spin_axis_curves_right():
    result = simulate(
        Launch(ball_speed_mph=130, launch_angle_deg=15, back_spin_rpm=5000, spin_axis_deg=12)
    )
    assert result.offline_m > 3


def test_no_spin_axis_flies_straight():
    result = simulate(
        Launch(ball_speed_mph=130, launch_angle_deg=15, back_spin_rpm=5000, spin_axis_deg=0)
    )
    assert abs(result.offline_m) < 0.5


def test_launch_direction_offsets_the_whole_flight():
    straight = simulate(Launch(ball_speed_mph=130, launch_angle_deg=15, back_spin_rpm=5000))
    pushed = simulate(
        Launch(
            ball_speed_mph=130, launch_angle_deg=15, back_spin_rpm=5000,
            launch_direction_deg=5,
        )
    )
    assert pushed.offline_m > straight.offline_m + 5


def test_side_spin_is_used_when_no_axis_is_reported():
    """Not every monitor reports a spin axis; side spin implies one."""
    result = simulate(
        Launch(
            ball_speed_mph=130, launch_angle_deg=15,
            back_spin_rpm=5000, side_spin_rpm=-1500,
        )
    )
    assert result.offline_m < -3


# ---- physics that must hold -----------------------------------------------


def test_backspin_makes_the_ball_carry_further():
    """Lift, not luck. A sign error here made a driver carry a third of its
    real distance and still looked like a plausible trajectory."""
    with_spin = carry_yards(150, 13, 2600)
    without = carry_yards(150, 13, 0)
    assert with_spin > without * 1.4


def test_thin_air_carries_further():
    sea_level = simulate(
        Launch(ball_speed_mph=150, launch_angle_deg=13, back_spin_rpm=2600), Conditions()
    )
    denver = simulate(
        Launch(ball_speed_mph=150, launch_angle_deg=13, back_spin_rpm=2600),
        Conditions(altitude_m=1600),
    )
    assert denver.carry_m > sea_level.carry_m
    # Roughly 1% per 300 m is the usual rule of thumb.
    gain = (denver.carry_m / sea_level.carry_m - 1) * 100
    assert 3 < gain < 9


def test_faster_ball_carries_further():
    assert carry_yards(160, 13, 2600) > carry_yards(140, 13, 2600)


def test_total_is_never_shorter_than_carry():
    for _, speed, vla, spin, _ in CLUBS:
        result = simulate(
            Launch(ball_speed_mph=speed, launch_angle_deg=vla, back_spin_rpm=spin)
        )
        assert result.total_m >= result.carry_m


def test_steeper_descent_rolls_less():
    shallow = simulate(Launch(ball_speed_mph=150, launch_angle_deg=11, back_spin_rpm=2200))
    steep = simulate(Launch(ball_speed_mph=100, launch_angle_deg=30, back_spin_rpm=9500))
    shallow_roll = (shallow.total_m - shallow.carry_m) / shallow.carry_m
    steep_roll = (steep.total_m - steep.carry_m) / steep.carry_m
    assert shallow_roll > steep_roll


def test_the_result_does_not_depend_on_the_integration_step():
    """If halving the step moved the answer, the step would be part of the
    model rather than an implementation detail."""
    original = flight.STEP_S
    try:
        flight.STEP_S = 0.002
        coarse = carry_yards(150, 13, 2600)
        flight.STEP_S = 0.0005
        fine = carry_yards(150, 13, 2600)
    finally:
        flight.STEP_S = original
    assert coarse == pytest.approx(fine, rel=0.005)


# ---- refusing to guess ----------------------------------------------------


def test_no_ball_speed_means_no_model():
    assert simulate(Launch(ball_speed_mph=0, launch_angle_deg=15)) is None
    assert model_flight(BallData(launch_angle_deg=15)) is None


def test_no_launch_angle_means_no_model():
    assert model_flight(BallData(speed_mph=130)) is None


def test_the_model_never_fills_in_measured_distance():
    """distance means measured and stays null. A model output that landed
    there would be indistinguishable from a monitor reading."""
    from backend.models import local_now, telemetry_from_gspro

    telemetry = telemetry_from_gspro(
        {
            "BallData": {"Speed": 152, "VLA": 13.4, "BackSpin": 2650, "SpinAxis": -8.3},
            "ShotDataOptions": {"ContainsBallData": True, "ContainsClubData": False},
        },
        local_now(),
    )
    assert telemetry.distance.carry_m is None
    assert telemetry.distance.total_m is None
    assert telemetry.flight is not None
    assert telemetry.flight.carry_m > 200
    assert telemetry.flight.model == "drag_magnus_rk4_v1"
    # The air is recorded, so a number can be reproduced later.
    assert telemetry.flight.conditions == {"altitude_m": 0.0, "temperature_c": 20.0}


def test_modelling_can_be_switched_off():
    from backend.models import local_now, telemetry_from_gspro

    telemetry = telemetry_from_gspro(
        {
            "BallData": {"Speed": 152, "VLA": 13.4, "BackSpin": 2650},
            "ShotDataOptions": {"ContainsBallData": True},
        },
        local_now(),
        conditions=object(),  # sentinel: disabled
    )
    assert telemetry.flight is None


# ---------------------------------------------------------------------------
# The flown path
# ---------------------------------------------------------------------------


def test_the_path_starts_at_the_tee_and_ends_where_the_ball_landed():
    flight = simulate(Launch(ball_speed_mph=167, launch_angle_deg=10.9, back_spin_rpm=2686))
    path = flight.as_dict()["path"]

    assert path[0] == [0.0, 0.0, 0.0]
    assert path[-1][1] == pytest.approx(0.0, abs=0.01)
    assert path[-1][0] == pytest.approx(flight.carry_m, abs=0.05)
    assert 2 < len(path) <= 48


def test_the_path_actually_flies():
    """Rises, peaks at the reported apex, comes back down."""
    flight = simulate(Launch(ball_speed_mph=140, launch_angle_deg=14.0, back_spin_rpm=5000))
    heights = [point[1] for point in flight.as_dict()["path"]]

    assert max(heights) == pytest.approx(flight.apex_m, rel=0.05)
    peak = heights.index(max(heights))
    assert heights[:peak] == sorted(heights[:peak])
    assert heights[peak:] == sorted(heights[peak:], reverse=True)


def test_downrange_never_goes_backwards():
    flight = simulate(Launch(ball_speed_mph=150, launch_angle_deg=12.0, back_spin_rpm=4000))
    downrange = [point[0] for point in flight.as_dict()["path"]]
    assert downrange == sorted(downrange)


def test_a_wedge_and_a_driver_are_different_shapes():
    """The reason the path is published at all. A stock parabola cannot show
    that a wedge climbs steeply and lands short while a driver runs flat and
    far -- and the old trajectory card drew both with the same curve."""
    driver = simulate(Launch(ball_speed_mph=167, launch_angle_deg=10.9, back_spin_rpm=2686))
    wedge = simulate(Launch(ball_speed_mph=102, launch_angle_deg=24.2, back_spin_rpm=9304))

    # Height relative to how far it went: the wedge's arc is far steeper.
    driver_ratio = driver.apex_m / driver.carry_m
    wedge_ratio = wedge.apex_m / wedge.carry_m
    assert wedge_ratio > driver_ratio * 1.4, f"{wedge_ratio:.3f} vs {driver_ratio:.3f}"


def test_a_shot_that_cannot_be_modelled_has_no_path():
    assert simulate(Launch(ball_speed_mph=0, launch_angle_deg=12.0)) is None


def test_the_path_reaches_the_shot_package():
    flight = simulate(Launch(ball_speed_mph=150, launch_angle_deg=13.0, back_spin_rpm=3000))
    block = FlightBlock(model="test", **flight.as_dict())
    assert len(block.path) > 2
    assert block.path[0] == [0.0, 0.0, 0.0]
