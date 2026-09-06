"""Ball flight model.

GSPro Open Connect carries launch conditions only -- speed, launch angles and
spin. Carry, total, apex and descent are not measured by the monitor, so they
have to be modelled, which is why the contract has them null and anticipated
this being added later.

Everything here is an **estimate** and is kept in ``telemetry.flight``, well
away from ``telemetry.distance``, which means measured and stays null. A number
that looks measured but is not is worse than a blank.

The model integrates the trajectory directly rather than using a closed form,
because drag and Magnus lift both depend on instantaneous speed and on spin
that decays through the flight -- there is no honest closed form for that.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

#: Ball. R1.68in diameter, 45.93 g -- the conforming limits.
BALL_MASS_KG = 0.04593
BALL_RADIUS_M = 0.02134
BALL_AREA_M2 = math.pi * BALL_RADIUS_M**2

GRAVITY = 9.80665

#: Sea-level air density at 15 C, kg/m3.
RHO_SEA_LEVEL = 1.225

#: Spin decays roughly exponentially through the flight. ~25 s time constant
#: is the usual figure; over a 6 s flight the ball keeps ~79% of its spin.
SPIN_DECAY_TAU_S = 25.0

#: Drag rises with spin: Cd = CD0 + CD_SPIN * S, where S is the spin ratio
#: (surface speed over airspeed). Lift saturates rather than rising forever,
#: so an exponential approach is used instead of the linear fit often quoted.
#:
#: Fitted against published carry distances for four clubs spanning the spin
#: range (driver S=0.09 through pitching wedge S=0.47), landing within 4% on
#: each and 2.9% RMS. The resulting lift coefficients, 0.165 at driver spin up
#: to 0.22 at wedge spin, sit where measured golf ball data puts them, which is
#: the check that matters -- a fit that matched the distances with unphysical
#: coefficients would just be four numbers memorised.
CD0 = 0.22
CD_SPIN = 0.20
CL_MAX = 0.22
CL_RATE = 16.0

MPH_TO_MS = 0.44704
RPM_TO_RADS = 2.0 * math.pi / 60.0
M_TO_YARDS = 1.09361
M_TO_FEET = 3.28084

#: Integration step. 1 ms keeps RK4 error far below the model's own accuracy.
STEP_S = 0.001
MAX_FLIGHT_S = 15.0

#: Points kept in the published trajectory. The integrator takes thousands of
#: 1 ms steps; a few dozen is plenty to draw a smooth curve, and keeps the shot
#: package small enough that nobody has to think about it.
PATH_POINTS = 48


@dataclass(frozen=True)
class Conditions:
    """Air the ball flies through. Indoor sim defaults."""

    altitude_m: float = 0.0
    temperature_c: float = 20.0

    @property
    def air_density(self) -> float:
        """Density from the barometric formula, adjusted for temperature."""
        pressure_ratio = (1.0 - 2.25577e-5 * self.altitude_m) ** 5.25588
        temperature_k = self.temperature_c + 273.15
        return RHO_SEA_LEVEL * pressure_ratio * (288.15 / temperature_k)


@dataclass(frozen=True)
class Launch:
    """What the monitor measured."""

    ball_speed_mph: float
    launch_angle_deg: float
    launch_direction_deg: float = 0.0
    back_spin_rpm: float = 0.0
    side_spin_rpm: float = 0.0
    spin_axis_deg: float | None = None


@dataclass(frozen=True)
class Flight:
    """Modelled result. Metres and degrees, per the schema's canonical units."""

    carry_m: float
    total_m: float
    apex_m: float
    descent_angle_deg: float
    offline_m: float
    flight_time_s: float
    #: The flown path itself: [downrange, height, offline] in metres, from the
    #: tee to the landing point. Summary numbers describe a curve; this is the
    #: curve, so a wedge and a driver can be drawn as the different shapes they
    #: actually are instead of as one stock parabola with different labels.
    path: list[tuple[float, float, float]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "carry_m": round(self.carry_m, 2),
            "total_m": round(self.total_m, 2),
            "apex_m": round(self.apex_m, 2),
            "descent_angle_deg": round(self.descent_angle_deg, 1),
            "offline_m": round(self.offline_m, 2),
            "flight_time_s": round(self.flight_time_s, 2),
            "path": [[round(v, 3) for v in point] for point in self.path],
        }


def _spin_vector(launch: Launch) -> tuple[float, float, float]:
    """Spin as a vector in rad/s.

    Axes: x downrange, y up, z right, right-handed.

    Backspin is a rotation about **+z**: by the right-hand rule that carries
    the top of the ball backwards, and omega x v then points up, which is the
    lift. Getting this sign wrong makes backspin push the ball into the
    ground, and a driver carries about a third of its real distance.

    Tilting that axis is what curves the ball, so a draw and a fade differ
    only in the sign of the tilt. A negative spin axis must tilt omega so the
    sideways force is negative, i.e. left for a right-hander.
    """
    back = launch.back_spin_rpm * RPM_TO_RADS
    if launch.spin_axis_deg is not None:
        tilt = math.radians(launch.spin_axis_deg)
    elif launch.back_spin_rpm:
        tilt = math.atan2(launch.side_spin_rpm, launch.back_spin_rpm)
    else:
        tilt = 0.0

    return (0.0, -back * math.sin(tilt), back * math.cos(tilt))


def _accel(
    velocity: tuple[float, float, float],
    spin: tuple[float, float, float],
    rho: float,
) -> tuple[float, float, float]:
    vx, vy, vz = velocity
    speed = math.sqrt(vx * vx + vy * vy + vz * vz)
    if speed < 1e-6:
        return (0.0, -GRAVITY, 0.0)

    wx, wy, wz = spin
    spin_rate = math.sqrt(wx * wx + wy * wy + wz * wz)

    # Spin ratio: surface speed over airspeed.
    ratio = (spin_rate * BALL_RADIUS_M) / speed if spin_rate else 0.0
    cd = CD0 + CD_SPIN * ratio
    cl = CL_MAX * (1.0 - math.exp(-CL_RATE * ratio)) if ratio else 0.0

    q = 0.5 * rho * BALL_AREA_M2 * speed * speed / BALL_MASS_KG

    # Drag opposes motion.
    drag = (-q * cd * vx / speed, -q * cd * vy / speed, -q * cd * vz / speed)

    # Magnus lift acts along spin x velocity.
    lift = (0.0, 0.0, 0.0)
    if cl and spin_rate:
        cross = (
            wy * vz - wz * vy,
            wz * vx - wx * vz,
            wx * vy - wy * vx,
        )
        magnitude = math.sqrt(sum(c * c for c in cross))
        if magnitude > 1e-9:
            lift = tuple(q * cl * c / magnitude for c in cross)  # type: ignore[assignment]

    return (
        drag[0] + lift[0],
        drag[1] + lift[1] - GRAVITY,
        drag[2] + lift[2],
    )


def simulate(launch: Launch, conditions: Conditions | None = None) -> Flight | None:
    """Integrate the trajectory. ``None`` when the inputs cannot support one."""
    if not launch.ball_speed_mph or launch.ball_speed_mph <= 0:
        return None
    if launch.launch_angle_deg is None:
        return None

    conditions = conditions or Conditions()
    rho = conditions.air_density

    speed = launch.ball_speed_mph * MPH_TO_MS
    vla = math.radians(launch.launch_angle_deg)
    hla = math.radians(launch.launch_direction_deg or 0.0)

    position = (0.0, 0.0, 0.0)
    velocity = (
        speed * math.cos(vla) * math.cos(hla),
        speed * math.sin(vla),
        speed * math.cos(vla) * math.sin(hla),
    )
    spin0 = _spin_vector(launch)

    apex = 0.0
    elapsed = 0.0
    flown: list[tuple[float, float, float]] = [position]

    while elapsed < MAX_FLIGHT_S:
        decay = math.exp(-elapsed / SPIN_DECAY_TAU_S)
        spin = tuple(component * decay for component in spin0)

        # RK4 on velocity; position integrates from the velocity estimates.
        k1 = _accel(velocity, spin, rho)  # type: ignore[arg-type]
        v2 = tuple(velocity[i] + 0.5 * STEP_S * k1[i] for i in range(3))
        k2 = _accel(v2, spin, rho)  # type: ignore[arg-type]
        v3 = tuple(velocity[i] + 0.5 * STEP_S * k2[i] for i in range(3))
        k3 = _accel(v3, spin, rho)  # type: ignore[arg-type]
        v4 = tuple(velocity[i] + STEP_S * k3[i] for i in range(3))
        k4 = _accel(v4, spin, rho)  # type: ignore[arg-type]

        new_velocity = tuple(
            velocity[i] + STEP_S / 6.0 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
            for i in range(3)
        )
        new_position = tuple(
            position[i] + STEP_S * 0.5 * (velocity[i] + new_velocity[i])
            for i in range(3)
        )

        apex = max(apex, new_position[1])
        elapsed += STEP_S
        flown.append(new_position)  # type: ignore[arg-type]

        if new_position[1] <= 0.0 and elapsed > STEP_S:
            # Interpolate to the exact ground crossing rather than overshooting.
            span = position[1] - new_position[1]
            fraction = position[1] / span if span else 0.0
            landing = tuple(
                position[i] + (new_position[i] - position[i]) * fraction
                for i in range(3)
            )
            descent = math.degrees(
                math.atan2(abs(new_velocity[1]), math.hypot(new_velocity[0], new_velocity[2]))
            )
            carry = math.hypot(landing[0], landing[2])
            flown[-1] = landing  # type: ignore[assignment]
            return Flight(
                carry_m=carry,
                total_m=carry + _roll(carry, descent),
                apex_m=apex,
                descent_angle_deg=descent,
                offline_m=landing[2],
                flight_time_s=elapsed - STEP_S + STEP_S * fraction,
                path=_downsample(flown),
            )

        position, velocity = new_position, new_velocity  # type: ignore[assignment]

    return None


def _downsample(flown: list[tuple[float, float, float]]) -> list[tuple[float, float, float]]:
    """Thin thousands of integration steps to a drawable handful.

    Evenly spaced in time rather than in distance, which keeps the descent --
    where the ball is moving slowest and the shape is most telling -- as well
    described as the launch. The first and last points are always kept, so the
    curve starts at the tee and ends exactly where the ball landed.
    """
    if len(flown) <= PATH_POINTS:
        return flown
    last = len(flown) - 1
    indices = sorted({round(i * last / (PATH_POINTS - 1)) for i in range(PATH_POINTS)})
    return [flown[i] for i in indices]


def _roll(carry_m: float, descent_angle_deg: float) -> float:
    """Run-out after landing.

    Crude by necessity: real roll depends on turf, moisture and slope, none of
    which a launch monitor knows. A steep descent digs in and a shallow one
    releases, so roll is scaled off the descent angle and capped. Treat it as
    the least trustworthy number here.
    """
    if descent_angle_deg <= 0:
        return 0.0
    fraction = max(0.0, 0.28 - 0.005 * descent_angle_deg)
    return carry_m * fraction
