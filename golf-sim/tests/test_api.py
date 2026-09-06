"""End-to-end over the real HTTP and WebSocket surface."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.config import Settings, get_settings
from backend.main import app
from tests.conftest import MP4_STUB


@pytest.fixture
def client(tmp_path, monkeypatch):
    settings = Settings(
        data_root=tmp_path / "data",
        kinovea_export_dir=tmp_path / "kinovea",
        pair_window_ms=3000,
        reaper_interval_ms=50,
        gspro_enabled=False,
        kinovea_watch_enabled=False,
        _env_file=None,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    monkeypatch.setattr("backend.main.get_settings", lambda: settings)
    with TestClient(app) as test_client:
        test_client.settings = settings
        yield test_client
    app.dependency_overrides.clear()


def upload_impact(client, **data):
    return client.post(
        "/api/ingest/impact",
        data={"capture_fps": 240, "container_fps": 30, **data},
        files={"file": ("clip.mp4", MP4_STUB, "video/mp4")},
    )


def upload_body_swing(client, **data):
    return client.post(
        "/api/ingest/body_swing",
        data={"capture_fps": 30, "container_fps": 30, **data},
        files={"file": ("clip.mp4", MP4_STUB, "video/mp4")},
    )


# ---- health ---------------------------------------------------------------


def test_health_reports_each_listener(client):
    body = client.get("/api/health").json()
    assert body["ok"] is True
    assert set(body["listeners"]) == {"gspro_socket", "kinovea_hook", "phone_endpoint"}
    assert body["listeners"]["gspro_socket"]["port"] == 921
    assert body["listeners"]["phone_endpoint"]["endpoint"] == "/api/ingest/impact"
    assert body["pairing"]["window_ms"] == 3000
    assert body["session_id"]


# ---- ingest ---------------------------------------------------------------


def test_impact_upload_opens_a_pending_shot(client):
    body = upload_impact(client).json()
    assert body["status"] == "pending"
    shot = body["shot"]
    assert shot["sources"] == {
        "body_swing": False, "impact_strike": True, "telemetry": False
    }
    assert shot["media"]["impact_strike"]["capture_fps"] == 240
    assert shot["media"]["impact_strike"]["container_fps"] == 30
    assert shot["media"]["impact_strike"]["camera"] == "impact"


def test_body_swing_accepts_a_local_path_from_the_kinovea_hook(client, tmp_path):
    """Kinovea runs on the same PC, so the hook hands over a filename rather
    than pushing 100 MB through localhost."""
    source = tmp_path / "kinovea-export.mp4"
    source.write_bytes(MP4_STUB)

    body = client.post(
        "/api/ingest/body_swing",
        data={"path": str(source), "capture_fps": 30, "container_fps": 30},
    ).json()

    assert body["shot"]["media"]["body_swing"]["path"] == "body_swing.mp4"
    # Copied, not moved: Kinovea's own file stays put.
    assert source.is_file()

    served = client.get(f"/shots/shot_{body['shot_id']}/body_swing.mp4")
    assert served.content == MP4_STUB


def test_body_swing_requires_exactly_one_of_file_or_path(client, tmp_path):
    assert client.post("/api/ingest/body_swing", data={}).status_code == 400

    source = tmp_path / "clip.mp4"
    source.write_bytes(MP4_STUB)
    both = client.post(
        "/api/ingest/body_swing",
        data={"path": str(source)},
        files={"file": ("clip.mp4", MP4_STUB, "video/mp4")},
    )
    assert both.status_code == 400


def test_missing_local_path_is_rejected(client):
    response = client.post("/api/ingest/body_swing", data={"path": "/no/such/clip.mp4"})
    assert response.status_code == 400


def test_unsupported_extension_is_rejected(client):
    response = client.post(
        "/api/ingest/impact", files={"file": ("clip.txt", b"nope", "text/plain")}
    )
    assert response.status_code == 415


def test_both_videos_pair_into_one_shot(client):
    first = upload_impact(client).json()["shot_id"]
    second = upload_body_swing(client).json()["shot_id"]
    assert first == second

    shot = client.get(f"/api/shots/{first}").json()
    assert shot["sources"] == {
        "body_swing": True, "impact_strike": True, "telemetry": False
    }
    assert shot["status"] == "pending"          # still waiting on telemetry
    assert set(shot["media"]) == {"body_swing", "impact_strike"}


def test_a_skewed_device_trigger_ts_does_not_split_the_shot(client):
    """trigger_ts is an ordering hint; the PC stamps the shot."""
    first = upload_body_swing(client).json()["shot_id"]
    second = upload_impact(client, trigger_ts="1999-01-01T00:00:00.000+00:00").json()
    assert second["shot_id"] == first


# ---- listing and patching -------------------------------------------------


def test_list_filters_by_session_and_since(client):
    shot_id = upload_impact(client).json()["shot_id"]
    session_id = client.get("/api/health").json()["session_id"]

    assert len(client.get("/api/shots").json()) == 1
    assert len(client.get("/api/shots", params={"session_id": session_id}).json()) == 1
    assert client.get("/api/shots", params={"session_id": "other"}).json() == []

    created = client.get(f"/api/shots/{shot_id}").json()["created_at"]
    assert client.get("/api/shots", params={"since": created}).json() == []
    assert len(client.get("/api/shots", params={"since": "2020-01-01T00:00:00+00:00"}).json()) == 1


def test_patch_accepts_only_the_four_contract_fields(client):
    shot_id = upload_impact(client).json()["shot_id"]

    patched = client.patch(
        f"/api/shots/{shot_id}",
        json={
            "tags": ["Good Strike", "Pushed"],
            "notes": "flighted",
            "club_used": "7I",
            "impact_offset_ms": -140,
        },
    ).json()
    assert patched["tags"] == ["Good Strike", "Pushed"]
    assert patched["sync"]["impact_offset_ms"] == -140

    # Survives reload.
    assert client.get(f"/api/shots/{shot_id}").json()["sync"]["impact_offset_ms"] == -140

    # Anything else is refused rather than silently written.
    rejected = client.patch(f"/api/shots/{shot_id}", json={"status": "complete"})
    assert rejected.status_code == 422


def test_patch_of_an_unknown_shot_is_404(client):
    assert client.patch("/api/shots/nope", json={"notes": "x"}).status_code == 404


# ---- media ----------------------------------------------------------------


def test_media_supports_range_requests(client):
    """Without Range the scrubber cannot seek; this is not optional."""
    shot_id = upload_impact(client).json()["shot_id"]
    url = f"/shots/shot_{shot_id}/impact_strike.mp4"

    full = client.get(url)
    assert full.status_code == 200
    assert full.headers["accept-ranges"] == "bytes"

    ranged = client.get(url, headers={"Range": "bytes=10-29"})
    assert ranged.status_code == 206
    assert ranged.headers["content-range"] == f"bytes 10-29/{len(MP4_STUB)}"
    assert ranged.content == MP4_STUB[10:30]


def test_media_path_traversal_is_rejected(client):
    assert client.get("/shots/..%2F..%2Fetc/passwd").status_code == 404
    shot_id = upload_impact(client).json()["shot_id"]
    assert client.get(f"/shots/shot_{shot_id}/..%2Fmetadata.json").status_code == 404


# ---- session --------------------------------------------------------------


def test_new_session_resets_and_relabels(client):
    upload_impact(client)
    response = client.post("/api/session", json={"session_id": "20260906-afternoon"}).json()
    assert response["session_id"] == "20260906-afternoon"

    upload_impact(client)
    sessions = {shot["session_id"] for shot in client.get("/api/shots").json()}
    assert "20260906-afternoon" in sessions


# ---- websocket ------------------------------------------------------------


def test_ws_streams_the_full_object_on_every_event(client):
    with client.websocket_connect("/ws/shots") as socket:
        shot_id = upload_impact(client).json()["shot_id"]
        created = socket.receive_json()
        assert created["type"] == "shot.created"
        assert created["shot_id"] == shot_id
        assert created["payload"]["status"] == "pending"

        upload_body_swing(client)
        updated = socket.receive_json()
        assert updated["type"] == "shot.updated"
        # Full object, not a diff.
        assert set(updated["payload"]) >= {"sources", "media", "sync", "telemetry"}

        client.patch(f"/api/shots/{shot_id}", json={"tags": ["Thin"]})
        patched = socket.receive_json()
        assert patched["type"] == "shot.patched"
        assert patched["payload"]["tags"] == ["Thin"]


def test_ws_announces_session_reset(client):
    with client.websocket_connect("/ws/shots") as socket:
        client.post("/api/session", json={"session_id": "20260906-evening"})
        event = socket.receive_json()
        assert event["type"] == "session.reset"
        assert event["payload"] == {"session_id": "20260906-evening"}
