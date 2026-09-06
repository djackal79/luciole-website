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
    try:
        yield served
    finally:
        await served.stop()


async def connect(settings):
    return await asyncio.open_connection(settings.gspro_host, settings.gspro_port)


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
        assert reply["Message"] == "Shot received"
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
        assert message["Message"] == "Player Information"
        assert message["Player"]["Club"] == "7I"

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
