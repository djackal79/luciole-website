"""End-to-end ingest over the real HTTP/WebSocket surface."""

from __future__ import annotations

import json
import time

import pytest
from fastapi.testclient import TestClient

from backend.config import Settings, get_settings
from backend.main import app

MP4_STUB = bytes.fromhex("0000001c66747970697336")  # ftyp box header
MP4_STUB += b"\x00" * 4096


@pytest.fixture
def client(tmp_path, monkeypatch):
    settings = Settings(
        data_root=tmp_path / "data",
        kinovea_export_dir=tmp_path / "kinovea",
        settle_seconds=0.5,
        reaper_interval_seconds=0.05,
        _env_file=None,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    monkeypatch.setattr("backend.main.get_settings", lambda: settings)
    with TestClient(app) as test_client:
        test_client.settings = settings
        yield test_client
    app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/health").json()["ok"] is True


def test_telemetry_normalizes_vendor_key_spellings(client):
    response = client.post(
        "/api/v1/telemetry",
        json={
            "timestamp": time.time(),
            "club": "7i",
            "BallSpeed": 118.4,
            "clubHeadSpeed": 84.0,
            "launchAngle": 17.2,
            "Backspin": 6400,
            "clubPath": 1.8,
            "faceAngle": -0.6,
        },
    )
    assert response.status_code == 200
    metrics = response.json()["normalized_metrics"]
    assert metrics["ball_speed_mph"] == 118.4
    assert metrics["club_speed_mph"] == 84.0
    assert metrics["back_spin_rpm"] == 6400
    # Derived, not supplied.
    assert metrics["smash_factor"] == pytest.approx(1.410, abs=0.001)
    assert metrics["face_to_path_deg"] == pytest.approx(-2.4, abs=0.001)


def test_full_shot_pairs_across_all_three_endpoints(client):
    impact = time.time()

    telemetry = client.post(
        "/api/v1/telemetry",
        json={"timestamp": impact, "club": "7i", "ball_speed": 118.4},
    )
    assert telemetry.status_code == 200

    swing = client.post(
        "/api/v1/media/swing",
        data={"captured_at": impact - 1.4, "impact_offset_s": 1.4},
        files={"file": ("swing.mp4", MP4_STUB, "video/mp4")},
    )
    assert swing.status_code == 200

    impact_clip = client.post(
        "/api/v1/media/impact",
        data={
            "captured_at": impact + 0.3,
            "device_id": "galaxy",
            "trigger_source": "audio",
            "pre_roll_s": 1.0,
            "fps": 240,
        },
        files={"file": ("impact.mp4", MP4_STUB, "video/mp4")},
    )
    assert impact_clip.status_code == 200

    shots = client.get("/api/v1/shots").json()
    assert shots["count"] == 1
    summary = shots["shots"][0]
    assert summary["status"] == "complete"
    assert summary["club"] == "7i"

    detail = client.get(f"/api/v1/shots/{summary['shot_id']}").json()
    assert detail["sources"]["impact_video"]["origin"]["trigger_source"] == "audio"
    assert detail["sources"]["impact_video"]["impact_offset_s"] == 1.0
    assert detail["sources"]["swing_video"]["impact_offset_s"] == 1.4

    media = client.get(f"/api/v1/shots/{summary['shot_id']}/media/impact.mp4")
    assert media.status_code == 200
    assert media.content == MP4_STUB


def test_media_traversal_is_rejected(client):
    assert client.get("/api/v1/shots/..%2F..%2Fetc/metadata.json").status_code == 404


def test_clock_sync_offsets_a_device_timestamp(client):
    """A phone whose clock is 5 s fast must still pair correctly."""
    skew = 5.0
    with client.websocket_connect("/ws/control?device_id=galaxy") as socket:
        assert socket.receive_json()["type"] == "welcome"
        for _ in range(4):
            t1 = time.time() + skew
            socket.send_json({"type": "ping", "t1": t1})
            pong = socket.receive_json()
            socket.send_json(
                {
                    "type": "sync_ack",
                    "t1": t1,
                    "t2": pong["t2"],
                    "t3": pong["t3"],
                    "t4": time.time() + skew,
                }
            )
            clock = socket.receive_json()
        assert clock["type"] == "clock"
        assert clock["offset_ms"] == pytest.approx(-skew * 1000, abs=200)

        impact = time.time()
        client.post(
            "/api/v1/telemetry", json={"timestamp": impact, "club": "7i", "ball_speed": 110}
        )
        # Phone reports its own (skewed) clock; the server must correct it.
        response = client.post(
            "/api/v1/media/impact",
            data={"captured_at": impact + skew, "device_id": "galaxy"},
            files={"file": ("impact.mp4", MP4_STUB, "video/mp4")},
        )
        assert response.json()["timestamp"] == pytest.approx(impact, abs=0.25)

    status = client.get("/api/v1/status").json()
    assert len(status["open_shots"]) == 1
    assert status["open_shots"][0]["have"] == ["impact_video", "telemetry"]


def test_trigger_reaches_a_connected_capture_device(client):
    with client.websocket_connect("/ws/control?device_id=galaxy") as socket:
        socket.receive_json()
        response = client.post("/api/v1/trigger", json={"source": "launch_monitor"})
        assert response.json()["devices_notified"] == 1
        message = socket.receive_json()
        assert message["type"] == "capture_trigger"
        assert message["source"] == "launch_monitor"


def test_events_socket_streams_shot_lifecycle(client):
    with client.websocket_connect("/ws/events") as socket:
        client.post("/api/v1/telemetry", json={"timestamp": time.time(), "club": "7i"})
        assert socket.receive_json()["type"] == "shot_opened"
        assert socket.receive_json()["type"] == "fragment_attached"
