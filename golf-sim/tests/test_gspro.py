"""GSPro Open Connect v1 socket listener.

The launch monitor is the *client*: it connects to 921 and pushes shot JSON,
and this backend impersonates GSPro by acknowledging it.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from backend.gspro import GSProListener

pytestmark = pytest.mark.asyncio

SHOT = {
    "DeviceID": "TestMonitor",
    "Units": "Yards",
    "ShotNumber": 1,
    "APIversion": "1",
    "BallData": {
        "Speed": 132.4, "SpinAxis": -8.3, "TotalSpin": 6200,
        "BackSpin": 6100, "SideSpin": -900, "HLA": 1.4, "VLA": 17.2,
    },
    "ClubData": {
        "Speed": 92.1, "AngleOfAttack": -3.1, "FaceToTarget": -1.1,
        "Loft": 24.6, "Path": 2.4, "ClosureRate": 0.0,
    },
    "ShotDataOptions": {
        "ContainsBallData": True, "ContainsClubData": True,
        "LaunchMonitorIsReady": True, "LaunchMonitorBallDetected": True,
        "IsHeartBeat": False,
    },
}

HEARTBEAT = {
    "DeviceID": "TestMonitor",
    "ShotDataOptions": {
        "ContainsBallData": False, "ContainsClubData": False,
        "LaunchMonitorIsReady": True, "LaunchMonitorBallDetected": False,
        "IsHeartBeat": True,
    },
}


@pytest.fixture
async def listener(settings, correlator):
    settings.gspro_host = "127.0.0.1"
    settings.gspro_port = 0  # let the OS pick a free port
    served = GSProListener(settings, correlator)
    assert await served.start()
    # Port 0 means the real port is only known once bound.
    settings.gspro_port = served._server.sockets[0].getsockname()[1]
    # The real settle is 3 s; the tests only need the ordering to hold.
    settings.gspro_rearm_delay_s = 0.5  # the real settle is 3 s
    settings.gspro_arm_variant = "full"   # probing has its own tests
    settings.gspro_arm_probe_window_s = 0.6
    try:
        yield served
    finally:
        await served.stop()


async def connect(settings, expect_player_info: bool = True):
    """Connect, and swallow the player-info frame pushed on connect.

    Every test written before that frame existed reads the *next* reply as the
    answer to what it sent, so it is consumed here rather than in each test.
    Tests that care about it pass ``expect_player_info=False`` and read it.
    """
    reader, writer = await asyncio.open_connection(
        settings.gspro_host, settings.gspro_port
    )
    # Not sent while relaying: GSPro pushes its own and two would conflict.
    if (expect_player_info and settings.gspro_send_player_info
            and not settings.gspro_forward_enabled):
        await read_json(reader)
    return reader, writer


async def send(writer, payload: dict) -> None:
    writer.write((json.dumps(payload) + "\r\n").encode())
    await writer.drain()


async def read_json(reader) -> dict:
    raw = await asyncio.wait_for(reader.readline(), timeout=5)
    return json.loads(raw.decode())


async def test_a_shot_is_acknowledged_and_becomes_telemetry(
    listener, settings, correlator
):
    reader, writer = await connect(settings)
    try:
        await send(writer, SHOT)
        reply = await read_json(reader)
        assert reply["Code"] == 200
        # SHOT carries both flags.
        assert reply["Message"] == "Club & Ball Data received"
        assert "Player" in reply

        await asyncio.sleep(0.1)
        shot_dir = next(settings.shots_dir.iterdir())
        metadata = json.loads((shot_dir / "metadata.json").read_text())

        assert metadata["sources"]["telemetry"] is True
        telemetry = metadata["telemetry"]
        assert telemetry["source"] == "gspro_connect_v1"
        assert telemetry["ball"]["speed_mph"] == 132.4
        assert telemetry["ball"]["launch_angle_deg"] == 17.2
        assert telemetry["club"]["path_deg"] == 2.4
        assert telemetry["derived"]["smash_factor"] == 1.44
        assert telemetry["derived"]["face_to_path_deg"] == -3.5
        # Launch conditions only; GSPro's physics computes distance.
        assert telemetry["distance"] == {"carry_m": None, "total_m": None}
        assert telemetry["raw"] == SHOT
    finally:
        writer.close()


async def test_heartbeats_are_acknowledged_without_creating_a_shot(
    listener, settings, correlator
):
    reader, writer = await connect(settings)
    try:
        for _ in range(3):
            await send(writer, HEARTBEAT)
            assert (await read_json(reader))["Code"] == 200
        await asyncio.sleep(0.1)
        assert list(settings.shots_dir.iterdir()) == []
        assert listener.shots_received == 0
    finally:
        writer.close()


async def test_status_frames_without_ball_data_create_no_shot(listener, settings):
    reader, writer = await connect(settings)
    try:
        await send(
            writer,
            {
                "DeviceID": "TestMonitor",
                "ShotDataOptions": {
                    "ContainsBallData": False, "ContainsClubData": False,
                    "LaunchMonitorIsReady": True, "LaunchMonitorBallDetected": False,
                    "IsHeartBeat": False,
                },
            },
        )
        assert (await read_json(reader))["Code"] == 200
        await asyncio.sleep(0.1)
        assert list(settings.shots_dir.iterdir()) == []
    finally:
        writer.close()


async def test_back_to_back_objects_in_one_packet_are_all_parsed(listener, settings):
    """Monitors do not reliably delimit frames, so the buffer is drained with
    raw_decode rather than split on newlines."""
    reader, writer = await connect(settings)
    try:
        blob = json.dumps(HEARTBEAT) + json.dumps(SHOT) + json.dumps(HEARTBEAT)
        writer.write(blob.encode())
        await writer.drain()
        codes = [(await read_json(reader))["Code"] for _ in range(3)]
        assert codes == [200, 200, 200]
        await asyncio.sleep(0.1)
        assert listener.shots_received == 1
    finally:
        writer.close()


async def test_a_frame_split_across_packets_is_reassembled(listener, settings):
    reader, writer = await connect(settings)
    try:
        blob = json.dumps(SHOT).encode()
        writer.write(blob[:40])
        await writer.drain()
        await asyncio.sleep(0.05)
        writer.write(blob[40:])
        await writer.drain()
        assert (await read_json(reader))["Code"] == 200
        await asyncio.sleep(0.1)
        assert listener.shots_received == 1
    finally:
        writer.close()


async def test_club_selection_is_pushed_as_a_201_player_message(
    listener, settings, correlator
):
    reader, writer = await connect(settings)
    try:
        assert await listener.set_club("7I") == 1
        message = await read_json(reader)
        assert message["Code"] == 201
        # The exact literal. Connectors match it; a paraphrase is ignored.
        assert message["Message"] == "GSPro Player Information"
        assert message["Player"]["Club"] == "7I"
        # Restored: every session that detected a ball carried these.
        assert message["Player"]["DistanceToTarget"] == 200
        assert message["Player"]["Surface"] == "tee"

        # And it is session state, so it reaches shots from any source.
        assert correlator.current_club == "7I"
        await send(writer, SHOT)
        await read_json(reader)
        await asyncio.sleep(0.1)
        shot_dir = next(settings.shots_dir.iterdir())
        assert json.loads((shot_dir / "metadata.json").read_text())["club_used"] == "7I"
    finally:
        writer.close()


async def test_listener_stops_and_releases_the_port(listener, settings):
    assert listener.live
    await listener.stop()
    assert not listener.live
    with pytest.raises((ConnectionRefusedError, OSError)):
        await asyncio.wait_for(connect(settings), timeout=2)


async def test_binding_a_taken_port_fails_without_killing_the_service(
    listener, settings, correlator
):
    """GSPro also binds 921. That is a mode switch, not a crash."""
    second = GSProListener(settings, correlator)
    assert await second.start() is False
    assert second.live is False
    assert second.last_error is not None
    # The original listener is untouched.
    assert listener.live


# ---------------------------------------------------------------------------
# Frames that are not textbook shots
# ---------------------------------------------------------------------------


UNFLAGGED_SHOT = {
    "DeviceID": "BridgeThatOmitsTheFlag",
    "BallData": {"Speed": 132.4, "VLA": 17.2, "HLA": 1.4, "TotalSpin": 6200},
    "ShotDataOptions": {"LaunchMonitorIsReady": True, "LaunchMonitorBallDetected": True},
}


async def test_a_real_strike_without_the_flag_is_still_a_shot(listener, settings):
    """Not every bridge sets ContainsBallData. Discarding a genuine strike
    because a flag was missing is worse than the alternative, and a non-zero
    ball speed is unambiguous."""
    reader, writer = await connect(settings)
    try:
        await send(writer, UNFLAGGED_SHOT)
        assert (await read_json(reader))["Code"] == 200
        await asyncio.sleep(0.1)

        assert listener.shots_received == 1
        shot_dir = next(settings.shots_dir.iterdir())
        metadata = json.loads((shot_dir / "metadata.json").read_text())
        assert metadata["telemetry"]["ball"]["speed_mph"] == 132.4
    finally:
        writer.close()


async def test_a_zero_speed_frame_is_not_a_shot(listener, settings):
    """Ball placed / ball removed carry BallData with no speed."""
    reader, writer = await connect(settings)
    try:
        await send(writer, {**UNFLAGGED_SHOT, "BallData": {"Speed": 0}})
        assert (await read_json(reader))["Code"] == 200
        await asyncio.sleep(0.1)
        assert listener.shots_received == 0
        assert listener.frames_ignored == 1
        assert list(settings.shots_dir.iterdir()) == []
    finally:
        writer.close()


async def test_ignored_frames_say_why(listener, settings, caplog):
    """A monitor that is connected and producing nothing is the hardest thing
    to debug, so silence is not acceptable."""
    reader, writer = await connect(settings)
    try:
        with caplog.at_level("INFO", logger="backend.gspro"):
            await send(writer, {"DeviceID": "x", "ShotDataOptions": {"LaunchMonitorIsReady": True}})
            await read_json(reader)
            await asyncio.sleep(0.1)
        messages = [record.getMessage() for record in caplog.records]
        assert any("ignoring frame" in m for m in messages)
        assert any("no BallData" in m for m in messages)
    finally:
        writer.close()


async def test_counters_separate_shots_heartbeats_and_ignored(listener, settings):
    reader, writer = await connect(settings)
    try:
        for payload in (HEARTBEAT, SHOT, {"ShotDataOptions": {"LaunchMonitorIsReady": True}}):
            await send(writer, payload)
            await read_json(reader)
        await asyncio.sleep(0.1)
        assert (listener.shots_received, listener.heartbeats_received,
                listener.frames_ignored) == (1, 1, 1)
    finally:
        writer.close()


# ---------------------------------------------------------------------------
# Pass-through to the real GSPro
# ---------------------------------------------------------------------------


class FakeGSPro:
    """Stands in for GSPro: records what arrives, replies like GSPro would."""

    def __init__(self) -> None:
        self.received: list[dict] = []
        self.raw: list[str] = []
        self._server: asyncio.AbstractServer | None = None
        self.port = 0

    async def start(self) -> int:
        self._server = await asyncio.start_server(self._handle, "127.0.0.1", 0)
        self.port = self._server.sockets[0].getsockname()[1]
        return self.port

    async def stop(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _handle(self, reader, writer):
        buffer = ""
        decoder = json.JSONDecoder()
        try:
            while True:
                chunk = await reader.read(65536)
                if not chunk:
                    return
                buffer += chunk.decode()
                while True:
                    stripped = buffer.lstrip()
                    if not stripped:
                        buffer = ""
                        break
                    try:
                        payload, end = decoder.raw_decode(stripped)
                    except json.JSONDecodeError:
                        buffer = stripped
                        break
                    self.raw.append(stripped[:end])
                    self.received.append(payload)
                    buffer = stripped[end:]
                    writer.write(
                        (json.dumps({"Code": 200, "Message": "GSPro here"}) + "\r\n").encode()
                    )
                    await writer.drain()
        except Exception:
            return


@pytest.fixture
async def gspro_upstream():
    fake = FakeGSPro()
    await fake.start()
    try:
        yield fake
    finally:
        await fake.stop()


@pytest.fixture
async def relaying_listener(settings, correlator, gspro_upstream):
    settings.gspro_host = "127.0.0.1"
    settings.gspro_port = 0
    settings.gspro_forward_enabled = True
    settings.gspro_forward_host = "127.0.0.1"
    settings.gspro_forward_port = gspro_upstream.port
    served = GSProListener(settings, correlator)
    assert await served.start()
    settings.gspro_port = served._server.sockets[0].getsockname()[1]
    # The real settle is 3 s; the tests only need the ordering to hold.
    settings.gspro_rearm_delay_s = 0.5  # the real settle is 3 s
    settings.gspro_arm_variant = "full"   # probing has its own tests
    settings.gspro_arm_probe_window_s = 0.6
    try:
        yield served
    finally:
        await served.stop()


async def test_frames_reach_gspro_verbatim(relaying_listener, settings, gspro_upstream):
    """Relayed byte-for-byte, not re-serialised: nothing downstream should
    depend on our key order or float formatting."""
    reader, writer = await connect(settings)
    try:
        raw = json.dumps(SHOT)
        writer.write((raw + "\r\n").encode())
        await writer.drain()
        await asyncio.sleep(0.2)

        assert gspro_upstream.received == [SHOT]
        assert gspro_upstream.raw == [raw]
    finally:
        writer.close()


async def test_gspro_answers_the_monitor_not_us(
    relaying_listener, settings, gspro_upstream
):
    """Exactly one reply reaches the monitor, and it is GSPro's. Two replies
    to one frame is a protocol fault from the monitor's point of view."""
    reader, writer = await connect(settings)
    try:
        await send(writer, SHOT)
        first = await read_json(reader)
        assert first["Message"] == "GSPro here"

        # Nothing else follows: we stayed quiet.
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=0.5)
    finally:
        writer.close()


async def test_the_shot_is_still_recorded_while_relaying(
    relaying_listener, settings, gspro_upstream
):
    reader, writer = await connect(settings)
    try:
        await send(writer, SHOT)
        await read_json(reader)
        await asyncio.sleep(0.2)

        assert relaying_listener.shots_received == 1
        assert relaying_listener.frames_forwarded == 1
        shot_dir = next(settings.shots_dir.iterdir())
        metadata = json.loads((shot_dir / "metadata.json").read_text())
        assert metadata["telemetry"]["ball"]["speed_mph"] == 132.4
    finally:
        writer.close()


async def test_recording_continues_when_gspro_is_down(settings, correlator):
    """The course being closed must not stop the app recording."""
    settings.gspro_host = "127.0.0.1"
    settings.gspro_port = 0
    settings.gspro_forward_enabled = True
    settings.gspro_forward_host = "127.0.0.1"
    settings.gspro_forward_port = 9  # discard: nothing listening
    settings.gspro_forward_timeout_s = 0.5

    served = GSProListener(settings, correlator)
    assert await served.start()
    settings.gspro_port = served._server.sockets[0].getsockname()[1]
    # The real settle is 3 s; the tests only need the ordering to hold.
    settings.gspro_rearm_delay_s = 0.5  # the real settle is 3 s
    settings.gspro_arm_variant = "full"   # probing has its own tests
    settings.gspro_arm_probe_window_s = 0.6
    try:
        reader, writer = await connect(settings)
        try:
            # Forwarding is configured but GSPro is not there, so we are the
            # simulator after all -- including announcing the club.
            assert (await read_json(reader))["Code"] == 201
            await send(writer, SHOT)
            # We answer, because GSPro is not there to.
            assert (await read_json(reader))["Message"] == "Club & Ball Data received"
            await asyncio.sleep(0.2)
            assert served.shots_received == 1
            assert served.frames_forwarded == 0
            assert served.forward_error is not None
        finally:
            writer.close()
    finally:
        await served.stop()


async def test_relaying_to_our_own_port_is_refused(settings, correlator):
    """Would loop every frame back into ourselves forever."""
    settings.gspro_host = "127.0.0.1"
    settings.gspro_port = 9921
    settings.gspro_forward_enabled = True
    settings.gspro_forward_host = "127.0.0.1"
    settings.gspro_forward_port = 9921

    served = GSProListener(settings, correlator)
    assert await served.start() is False
    assert served.live is False
    assert "own address" in served.last_error


# ---------------------------------------------------------------------------
# Player information -- what a monitor may be waiting for before it arms
# ---------------------------------------------------------------------------


async def test_the_club_is_announced_the_moment_a_monitor_connects(
    listener, settings
):
    """A bridge that configures its device per club cannot arm ball detection
    until it has been told one. The Square reports LaunchMonitorIsReady false
    forever otherwise, which reads as broken hardware."""
    reader, writer = await connect(settings, expect_player_info=False)
    try:
        frame = await read_json(reader)
        assert frame["Code"] == 201
        assert frame["Message"] == "GSPro Player Information"
        assert frame["Player"]["Club"] == "DR"
        assert frame["Player"]["Handed"] == "RH"
    finally:
        writer.close()


async def test_a_ready_monitor_is_not_pestered(listener, settings):
    reader, writer = await connect(settings)
    try:
        await send(writer, {
            "DeviceID": "SquareGolf",
            "ShotDataOptions": {"IsHeartBeat": True, "LaunchMonitorIsReady": True},
        })
        assert (await read_json(reader))["Code"] == 200
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=0.4)
    finally:
        writer.close()


# ---------------------------------------------------------------------------
# The Square's real frames, captured in the bay 7 September
# ---------------------------------------------------------------------------

SQUARE_BALL = {
    "DeviceID": "SquareGolf", "Units": "Yards", "ShotNumber": 3, "APIversion": "1",
    "BallData": {"Speed": 94.89098, "SpinAxis": -6.91, "TotalSpin": 5232.0,
                 "BackSpin": 5194.0, "SideSpin": -629.0, "HLA": -3.77,
                 "VLA": 17.19, "CarryDistance": 0.0},
    "ClubData": {"Speed": 0.0, "AngleOfAttack": 0.0, "FaceToTarget": 0.0,
                 "Lie": 0.0, "Loft": 0.0, "Path": 0.0, "SpeedAtImpact": 0.0},
    "ShotDataOptions": {"ContainsBallData": True, "ContainsClubData": False,
                        "LaunchMonitorIsReady": True,
                        "LaunchMonitorBallDetected": True, "IsHeartBeat": True},
}
SQUARE_CLUB = {
    **SQUARE_BALL,
    "ClubData": {"Speed": 0.0, "AngleOfAttack": -3.05, "FaceToTarget": -4.3,
                 "Lie": 0.0, "Loft": 23.71, "Path": -0.49, "SpeedAtImpact": 0.0},
    "ShotDataOptions": {"ContainsBallData": False, "ContainsClubData": True,
                        "LaunchMonitorIsReady": False,
                        "LaunchMonitorBallDetected": False, "IsHeartBeat": True},
}


async def test_a_square_strike_flagged_as_a_heartbeat_is_still_a_shot(
    listener, settings, correlator
):
    """The Square marks every frame IsHeartBeat, real strikes included.
    Trusting the flag threw away a 94.9 mph shot in the bay."""
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_BALL)
        assert (await read_json(reader))["Message"] == "Ball Data received"
        await asyncio.sleep(0.1)
        assert listener.shots_received == 1
        shot = correlator._tracked[-1].package
        assert shot.telemetry.ball.speed_mph == pytest.approx(94.89, abs=0.01)
        assert shot.telemetry.ball.back_spin_rpm == 5194
    finally:
        writer.close()


async def test_one_swing_in_two_frames_is_one_shot(listener, settings, correlator):
    """Ball data, then club data ~700 ms later, same ShotNumber. Both are
    genuine strikes by every content test, so without coalescing the swing
    appears twice."""
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_BALL)
        await read_json(reader)
        await asyncio.sleep(0.1)
        await send(writer, SQUARE_CLUB)
        assert (await read_json(reader))["Code"] == 200   # ack; the re-arm waits
        await asyncio.sleep(0.2)

        assert listener.shots_received == 1, "the swing was recorded twice"
        assert len(correlator._tracked) == 1
        telemetry = correlator._tracked[0].package.telemetry
        # Ball from the first frame, club from the second, in one record.
        assert telemetry.ball.speed_mph == pytest.approx(94.89, abs=0.01)
        assert telemetry.club.loft_deg == pytest.approx(23.71, abs=0.01)
        assert telemetry.club.face_to_target_deg == pytest.approx(-4.3, abs=0.01)
        assert telemetry.club.angle_of_attack_deg == pytest.approx(-3.05, abs=0.01)
    finally:
        writer.close()


async def test_a_different_shot_number_is_a_different_swing(
    listener, settings, correlator
):
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_BALL)
        await read_json(reader)
        await asyncio.sleep(0.1)
        await send(writer, {**SQUARE_BALL, "ShotNumber": 4})
        await read_json(reader)
        await asyncio.sleep(0.2)
        assert listener.shots_received == 2
    finally:
        writer.close()


async def test_the_merge_does_not_kill_the_connection(listener, settings, correlator):
    """A crash inside the merge dropped the monitor mid-session in the bay,
    and the earlier tests missed it because the in-memory package is updated
    before the throw -- so every assertion about the merged data still passed
    while the connection died. This asserts the socket survives instead."""
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_BALL)
        await read_json(reader)
        await asyncio.sleep(0.1)
        await send(writer, SQUARE_CLUB)
        assert (await read_json(reader))["Code"] == 200   # ack; the re-arm waits
        await asyncio.sleep(0.2)

        # Still talking: a further frame is answered, not silence from a
        # connection the server tore down.
        await send(writer, {**SQUARE_BALL, "ShotNumber": 9})
        assert (await read_json(reader))["Message"] == "Ball Data received"
        assert listener.shots_received == 2
    finally:
        writer.close()


async def test_health_reports_what_the_monitor_says_about_itself(
    listener, settings
):
    """`monitor_ready` is tri-state on purpose: a monitor that has never
    reported and one reporting "no" are different faults, and collapsing them
    to a boolean loses the distinction that matters in the bay."""
    assert listener.monitor_ready is None
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_BALL)                   # ready: true
        await read_json(reader)
        await asyncio.sleep(0.1)
        assert listener.monitor_ready is True

        await send(writer, SQUARE_CLUB)                   # ready: false
        await asyncio.sleep(0.5)
        assert listener.monitor_ready is False
    finally:
        writer.close()


async def test_the_ready_report_says_how_long_the_arm_took(listener, settings, caplog):
    """The line that answers "did the re-arm work". Logged on the transition
    back to ready, so it survives a log trimmed to the shot itself."""
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_CLUB)                   # ready: false
        await read_json(reader)
        await asyncio.sleep(0.2)
        assert listener.monitor_ready is False

        with caplog.at_level("INFO", logger="backend.gspro"):
            await send(writer, SQUARE_BALL)               # ready: true
            await asyncio.sleep(0.2)

        assert listener.monitor_ready is True
        assert any("READY after" in r.getMessage() for r in caplog.records)
    finally:
        writer.close()

# ---------------------------------------------------------------------------
# Arm / fire / re-arm. The connector fires one shot per arm and then resets to
# idle over ~2-3s with no "reset done" signal, so the whole protocol is: arm on
# connect, and arm again exactly once, a settle after the club frame.
# ---------------------------------------------------------------------------


async def test_club_data_schedules_one_re_arm_after_the_settle(listener, settings):
    """Club data is the connector's end-of-shot marker. Acknowledge at once,
    say nothing through the reset, then a single 201."""
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_BALL)
        assert (await read_json(reader))["Code"] == 200
        await asyncio.sleep(0.1)

        before = listener.player_info_sent
        await send(writer, SQUARE_CLUB)                  # ContainsClubData: true
        assert (await read_json(reader))["Code"] == 200  # ack, immediately
        assert listener.rearm_pending
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=0.25)

        frame = await asyncio.wait_for(read_json(reader), timeout=1.0)
        assert frame["Code"] == 201
        assert frame["Message"] == "GSPro Player Information", (
            "connectors switch on the literal; a paraphrase never arms"
        )
        assert frame["Player"]["Club"] == "DR"
        assert frame["Player"]["DistanceToTarget"] == 200
        assert listener.player_info_sent == before + 1

        # Exactly one. A repeat is the documented way to freeze the loop.
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=1.2)
        assert listener.rearm_attempts == 1
        assert not listener.rearm_pending
    finally:
        writer.close()


async def test_a_not_ready_report_never_arms_anything(listener, settings):
    """The ready flag is the connector's *ball-ready* state -- false whenever no
    ball is on the mat, which includes the moment a monitor first connects.
    Arming on it fired three seconds into a session that had had no shot, landed
    in the connector's reset and froze it: the face never lit once, 19:30 on
    7 September. It is an indicator, never a trigger."""
    reader, writer = await connect(settings)
    try:
        for _ in range(3):
            await send(writer, {
                "DeviceID": "SquareGolf",
                "ShotDataOptions": {"IsHeartBeat": True, "LaunchMonitorIsReady": False},
            })
            assert (await read_json(reader))["Code"] == 200
        await asyncio.sleep(1.0)

        assert not listener.rearm_pending
        assert listener.rearm_attempts == 0
        assert listener.player_info_sent == 1, "the connect-time arm, and nothing else"
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=0.3)
    finally:
        writer.close()


async def test_a_second_shot_restarts_the_settle_rather_than_stacking(
    listener, settings
):
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_CLUB)
        await read_json(reader)
        await asyncio.sleep(0.2)
        await send(writer, SQUARE_CLUB)                  # inside the settle
        await read_json(reader)

        frame = await asyncio.wait_for(read_json(reader), timeout=1.0)
        assert frame["Code"] == 201
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=0.8)
        assert listener.rearm_attempts == 1, "two club frames, one arm"
    finally:
        writer.close()


async def test_the_re_arm_is_dropped_when_the_monitor_goes_away(listener, settings):
    reader, writer = await connect(settings)
    await send(writer, SQUARE_CLUB)
    await read_json(reader)
    assert listener.rearm_pending
    writer.close()
    await asyncio.sleep(0.9)
    assert listener.rearm_attempts == 0, "nothing written to a closed monitor"
    assert listener._arm_tasks == {}


# ---------------------------------------------------------------------------
# The probe. The official connector re-arms reliably against real GSPro, so a
# message that works exists; we do not know which. Trying them one per bay
# session costs a session per hypothesis, which is what ran this into the
# ground. Trying them all in one session costs one session.
# ---------------------------------------------------------------------------


async def test_the_probe_tries_each_candidate_until_the_device_reports_a_ball(
    listener, settings
):
    settings.gspro_arm_variant = "probe"       # diagnostic mode, never default
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_CLUB)
        assert (await read_json(reader))["Code"] == 200

        # Two candidates go unanswered, then the device sees a ball.
        first = await asyncio.wait_for(read_json(reader), timeout=2.0)
        second = await asyncio.wait_for(read_json(reader), timeout=2.0)
        assert first != second, "a probe that repeats itself learns nothing"

        await send(writer, SQUARE_BALL)        # LaunchMonitorIsReady: true
        await read_json(reader)
        await asyncio.sleep(0.8)

        assert listener.monitor_ready is True
        assert listener.armed_by == listener.ARM_VARIANTS[1], (
            "the winner must be the candidate that was actually outstanding"
        )
        assert not listener.rearm_pending
    finally:
        writer.close()


async def test_every_candidate_is_a_distinct_message(listener, settings):
    """A probe is only worth the freeze risk if the candidates differ."""
    seen = [json.dumps(listener._arm_message(v), sort_keys=True)
            for v in listener.ARM_VARIANTS]
    assert len(set(seen)) == len(seen), "two candidates are the same message"
    # And each is well-formed Open Connect.
    for variant in listener.ARM_VARIANTS:
        msg = listener._arm_message(variant)
        assert msg["Code"] == 201
        assert msg["Message"] in ("GSPro Player Information", "GSPro ready")
        if msg["Message"] == "GSPro Player Information":
            assert msg["Player"]["Club"], "springbok KeyErrors on a 201 with no Club"


async def test_a_pinned_variant_sends_exactly_that_and_stops(listener, settings):
    """Once the answer is known, the protocol is one message. No probing, no
    repeat -- a repeat is how the loop freezes."""
    settings.gspro_arm_variant = "minimal"
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_CLUB)
        assert (await read_json(reader))["Code"] == 200
        frame = await asyncio.wait_for(read_json(reader), timeout=2.0)
        assert frame["Player"] == {"Handed": "RH", "Club": "DR"}

        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=1.5)
        assert listener.rearm_attempts == 1
    finally:
        writer.close()


async def test_the_connect_arm_is_the_shape_that_detected_the_first_ball(
    listener, settings
):
    """Every session in this bay that saw a ball sent DistanceToTarget and
    Surface on connect. GolfForge omits both, but its Square profile was
    validated against a different connector -- DeviceID CustomLaunchMonitor,
    not the SquareGolf this bay runs."""
    reader, writer = await connect(settings, expect_player_info=False)
    try:
        frame = await read_json(reader)
        assert frame["Code"] == 201
        assert frame["Message"] == "GSPro Player Information"
        assert frame["Player"]["Club"] == "DR"
        assert frame["Player"]["DistanceToTarget"] == 200
        assert frame["Player"]["Surface"] == "tee"
    finally:
        writer.close()


async def test_a_resting_square_does_not_flood_the_log(listener, settings, caplog):
    """A Square with a ball sitting on it sends one non-shot frame every two
    seconds, forever. Logged in full, that buries the lines that matter under
    hundreds that do not -- and in this bay the log is the only instrument."""
    reader, writer = await connect(settings)
    resting = {
        "DeviceID": "SquareGolf", "ShotNumber": 2,
        "BallData": {"Speed": 0.0},
        "ShotDataOptions": {
            "ContainsBallData": True, "LaunchMonitorBallDetected": True,
            "LaunchMonitorIsReady": True, "IsHeartBeat": False,
        },
    }
    try:
        with caplog.at_level("INFO", logger="backend.gspro"):
            for _ in range(8):
                await send(writer, resting)
                await read_json(reader)
            await asyncio.sleep(0.2)

        ignored = [r for r in caplog.records if "ignoring frame" in r.getMessage()]
        assert len(ignored) == 1, f"{len(ignored)} lines for one repeated state"
        assert listener.frames_ignored == 8, "the counter still sees every frame"

        # And the reason names what is actually true of the frame. The Square
        # sets ContainsBallData while it watches a ball it has not been hit --
        # calling that "ContainsBallData not set" sent a reader hunting a flag
        # that was there all along.
        message = ignored[0].getMessage()
        assert "ContainsBallData set" in message
        assert "not yet struck" in message
    finally:
        writer.close()


async def test_the_default_sends_one_message_not_five(listener, settings):
    """The default was empty, and empty meant *probe* -- so five arm messages
    in 75 seconds after every shot was the shipped behaviour, which is exactly
    the pattern the reference implementation says freezes the connector's arm
    loop. Meanwhile the runbook said unset meant the message that works. The
    default is now that message."""
    from backend.config import Settings
    assert Settings().gspro_arm_variant == "full"

    settings.gspro_arm_variant = ""            # an empty .env line is not probe
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_CLUB)
        assert (await read_json(reader))["Code"] == 200

        frame = await asyncio.wait_for(read_json(reader), timeout=2.0)
        assert frame["Code"] == 201
        assert frame["Player"]["DistanceToTarget"] == 200, "the 'full' shape"

        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=1.5)
        assert listener.rearm_attempts == 1
    finally:
        writer.close()


async def test_none_sends_nothing_at_all(listener, settings):
    """Worth having as a real option, not a way to switch a feature off. This
    device has been watched re-arming itself, ball after ball, for minutes with
    no message from us. If it stops doing that only once we send something,
    then our message is the fault and silence is the fix."""
    settings.gspro_arm_variant = "none"
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_CLUB)
        assert (await read_json(reader))["Code"] == 200
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(reader.readline(), timeout=1.5)
        assert listener.rearm_attempts == 0
        assert listener.player_info_sent == 1, "the connect-time arm, and no more"
    finally:
        writer.close()


async def test_the_ack_uses_the_only_words_the_connector_knows(listener, settings):
    """The connector's message handler switches on a literal set and files
    everything else as "Unknown message type". We replied "Shot received",
    which is not in that set -- so every strike this bay ever hit was
    acknowledged with a string the connector does not recognise.

    Whether the official build gates its arm cycle on that is unknown. It is
    the only vocabulary mismatch found in a week of looking, so it is pinned
    here rather than left to drift back."""
    known = {"Ball Data received", "Club & Ball Data received",
             "Shot received successfully"}
    reader, writer = await connect(settings)
    try:
        await send(writer, SQUARE_BALL)                  # ContainsBallData
        ball = await read_json(reader)
        assert ball["Message"] == "Ball Data received"
        assert ball["Message"] in known
        await asyncio.sleep(0.1)

        await send(writer, SQUARE_CLUB)                  # ContainsClubData
        club = await read_json(reader)
        assert club["Message"] == "Club & Ball Data received"
        assert club["Message"] in known
    finally:
        writer.close()


async def test_a_shot_with_neither_flag_still_gets_a_known_ack(listener, settings):
    """A bridge that sets no flags but reports a real speed is still a strike,
    and still has to be answered in words the connector knows."""
    reader, writer = await connect(settings)
    try:
        await send(writer, {
            "DeviceID": "TestMonitor", "ShotNumber": 8,
            "BallData": {"Speed": 120.0, "VLA": 14.0, "HLA": 0.0},
            "ShotDataOptions": {"LaunchMonitorIsReady": True, "IsHeartBeat": False},
        })
        assert (await read_json(reader))["Message"] == "Shot received successfully"
    finally:
        writer.close()


async def test_the_log_says_when_the_device_never_came_back(
    listener, settings, caplog, monkeypatch
):
    """Every bay log so far stopped within seconds of the re-arm, so "it didn't
    work" has been the golfer's read rather than the log's. The watch only
    reports -- it never sends, because sending more is what freezes it."""
    monkeypatch.setattr("backend.gspro.ARM_WATCH_S", 0.6)
    reader, writer = await connect(settings)
    try:
        with caplog.at_level("INFO", logger="backend.gspro"):
            await send(writer, SQUARE_CLUB)              # ready: false
            await read_json(reader)
            await asyncio.sleep(1.6)

        assert any("still not armed" in r.getMessage() for r in caplog.records)
        assert listener.rearm_attempts == 1, "the watch must not send anything"
    finally:
        writer.close()
