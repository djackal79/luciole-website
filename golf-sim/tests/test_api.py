"""End-to-end over the real HTTP and WebSocket surface."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from backend.config import Settings, get_settings
from backend.main import app
from tests.conftest import MP4_STUB


def present_sources(shot: dict) -> set[str]:
    """The sources actually present. Every key is always emitted in v1.1, so
    comparing the whole dict would break on each new optional source."""
    return {name for name, present in shot["sources"].items() if present}


@pytest.fixture
def client(tmp_path, monkeypatch):
    settings = Settings(
        data_root=tmp_path / "data",
        kinovea_export_dir=tmp_path / "kinovea",
        pair_window_ms=3000,
        reaper_interval_ms=50,
        gspro_enabled=False,
        kinovea_watch_enabled=False,
        # Hermetic: never read a real rig calibration from ./models.
        pose_calibration_path=tmp_path / "calibration.json",
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


# ---- two Kinovea cameras (schema v1.1) ------------------------------------


def test_the_two_kinovea_cameras_pair_into_one_shot(client):
    """Both Automation hooks fire within milliseconds of each other. Routed on
    distinct sources they are one swing; without that they would be two."""
    face_on = upload_body_swing(client, source="body_swing").json()["shot_id"]
    dtl = upload_body_swing(client, source="body_swing_dtl").json()["shot_id"]
    assert face_on == dtl

    shot = client.get(f"/api/shots/{face_on}").json()
    assert shot["sources"]["body_swing"] is True
    assert shot["sources"]["body_swing_dtl"] is True
    assert set(shot["media"]) == {"body_swing", "body_swing_dtl"}
    assert shot["media"]["body_swing_dtl"]["path"] == "body_swing_dtl.mp4"

    # Distinct files, not one overwriting the other.
    for name in ("body_swing.mp4", "body_swing_dtl.mp4"):
        assert client.get(f"/shots/shot_{face_on}/{name}").status_code == 200


def test_the_same_camera_twice_is_still_two_shots(client):
    """The duplicate-source rule must survive the routing change: two face-on
    clips are two swings, not one shot with a clobbered clip."""
    first = upload_body_swing(client, source="body_swing").json()["shot_id"]
    second = upload_body_swing(client, source="body_swing").json()["shot_id"]
    assert first != second


def test_dtl_defaults_come_from_config_not_the_face_on_camera(client):
    shot_id = upload_body_swing(
        client, source="body_swing_dtl", capture_fps="", container_fps=""
    ).json()["shot_id"]
    entry = client.get(f"/api/shots/{shot_id}").json()["media"]["body_swing_dtl"]
    assert entry["camera"] == "dtl"
    assert entry["capture_fps"] == 60.0


def test_an_unknown_source_is_rejected(client):
    """A typo in a Kinovea hook must fail loudly, not silently file the clip
    as a face-on swing."""
    response = client.post(
        "/api/ingest/body_swing",
        data={"source": "down_the_line"},
        files={"file": ("clip.mp4", MP4_STUB, "video/mp4")},
    )
    assert response.status_code == 400
    assert "body_swing_dtl" in response.json()["detail"]


def test_dtl_absence_does_not_make_a_shot_partial(client):
    """DTL is optional by default; only adding it to GOLFSIM_EXPECTED_SOURCES
    should make a missing DTL clip incomplete."""
    shot_id = upload_body_swing(client, source="body_swing").json()["shot_id"]
    upload_impact(client)
    shot = client.get(f"/api/shots/{shot_id}").json()
    assert shot["sources"]["body_swing_dtl"] is False
    assert shot["status"] == "pending"


# ---- health ---------------------------------------------------------------


def test_health_reports_each_listener(client):
    body = client.get("/api/health").json()
    assert body["ok"] is True
    assert set(body["listeners"]) == {
        "gspro_socket", "kinovea_hook", "phone_endpoint", "pose_worker"
    }
    assert body["listeners"]["gspro_socket"]["port"] == 921
    assert body["listeners"]["phone_endpoint"]["endpoint"] == "/api/ingest/impact"
    assert body["pairing"]["window_ms"] == 3000
    assert body["session_id"]


# ---- ingest ---------------------------------------------------------------


def test_impact_upload_opens_a_pending_shot(client):
    body = upload_impact(client).json()
    assert body["status"] == "pending"
    shot = body["shot"]
    assert present_sources(shot) == {"impact_strike"}
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
    assert present_sources(shot) == {"body_swing", "impact_strike"}
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


# ---- store-and-forward pairing --------------------------------------------
#
# The stock-camera + watcher path uploads a clip seconds after the strike.
# Two settings have to cooperate for that to pair correctly:
#
#   late_attach_ms          keeps the shot reachable after its window closed
#   impact_trust_trigger_ts makes late-attach pick the RIGHT shot, by matching
#                           on the clip's capture time instead of its arrival
#
# Without the second, a clip is simply nearest to whichever swing happened
# most recently -- which, once you are hitting balls steadily, is the wrong one.


def _sf_settings(tmp_path, monkeypatch, **overrides):
    base = dict(
        data_root=tmp_path / "data",
        kinovea_export_dir=tmp_path / "kinovea",
        # Compressed timings so the suite stays fast: a 0.6 s gap between
        # swings stands in for the real 10-30 s, and a 1.2 s upload lag for
        # the real 4-9 s.
        pair_window_ms=200,
        late_attach_ms=5000,
        reaper_interval_ms=50,
        gspro_enabled=False,
        kinovea_watch_enabled=False,
        _env_file=None,
    )
    base.update(overrides)
    settings = Settings(**base)
    app.dependency_overrides[get_settings] = lambda: settings
    monkeypatch.setattr("backend.main.get_settings", lambda: settings)
    return settings


@pytest.fixture
def trusting_client(tmp_path, monkeypatch):
    _sf_settings(
        tmp_path, monkeypatch, impact_trust_trigger_ts=True, trigger_ts_max_skew_ms=30_000
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def stamping_client(tmp_path, monkeypatch):
    _sf_settings(tmp_path, monkeypatch, impact_trust_trigger_ts=False)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _capture_now() -> str:
    from datetime import datetime

    return datetime.now().astimezone().isoformat(timespec="milliseconds")


def _two_swings_then_a_late_clip(client, trigger_ts: str | None):
    """Swing A, swing B, then A's impact clip arriving after both closed.

    Returns ``(shot_a, shot_b, shot_the_clip_joined)``.
    """
    captured_at = _capture_now()
    shot_a = upload_body_swing(client).json()["shot_id"]
    time.sleep(0.6)
    shot_b = upload_body_swing(client).json()["shot_id"]
    time.sleep(0.6)

    hint = trigger_ts if trigger_ts is not None else captured_at
    clip = upload_impact(client, **({} if trigger_ts == "" else {"trigger_ts": hint}))
    return shot_a, shot_b, clip.json()["shot_id"]


def test_a_late_clip_joins_the_swing_it_was_captured_with(trusting_client):
    """The clip belongs to swing A and says so; it must not land on swing B
    just because B happened more recently."""
    shot_a, shot_b, joined = _two_swings_then_a_late_clip(trusting_client, None)
    assert joined == shot_a
    assert joined != shot_b

    shot = trusting_client.get(f"/api/shots/{shot_a}").json()
    assert present_sources(shot) == {"body_swing", "impact_strike"}
    # And swing B is left honestly incomplete rather than wearing A's clip.
    assert trusting_client.get(f"/api/shots/{shot_b}").json()["sources"][
        "impact_strike"
    ] is False


def test_receipt_stamping_puts_a_late_clip_on_the_wrong_swing(stamping_client):
    """This is the failure the setting exists to prevent, pinned so nobody
    'simplifies' it away. Receipt stamping is still the right default for any
    capture path whose clips arrive promptly."""
    shot_a, shot_b, joined = _two_swings_then_a_late_clip(stamping_client, None)
    assert joined == shot_b


def test_an_implausible_clock_falls_back_to_receipt(trusting_client):
    """Upload lag is seconds. A 27-year offset is a broken clock, and filing
    the shot in 1999 is worse than pairing it to the wrong swing."""
    _, shot_b, joined = _two_swings_then_a_late_clip(
        trusting_client, "1999-01-01T00:00:00.000+00:00"
    )
    assert joined == shot_b
    assert joined.startswith("2")


def test_an_unparseable_trigger_ts_falls_back_to_receipt(trusting_client):
    _, shot_b, joined = _two_swings_then_a_late_clip(trusting_client, "not-a-time")
    assert joined == shot_b


def test_a_missing_trigger_ts_falls_back_to_receipt(trusting_client):
    _, shot_b, joined = _two_swings_then_a_late_clip(trusting_client, "")
    assert joined == shot_b


def test_clips_carry_their_own_impact_position(client):
    """The capture trigger's pre-roll decides where impact sits in the clip.
    Without this the player can only align on file start, which is wrong for
    clips of different lengths."""
    swing = upload_body_swing(client, impact_ms=3000).json()["shot_id"]
    upload_impact(client, impact_ms=750)

    media = client.get(f"/api/shots/{swing}").json()["media"]
    assert media["body_swing"]["impact_ms"] == 3000
    assert media["impact_strike"]["impact_ms"] == 750


def test_impact_position_is_optional(client):
    """Unknown is honest: the phone's auto-trigger picks its own pre-roll and
    does not report it. The calibration slider covers that."""
    shot_id = upload_body_swing(client).json()["shot_id"]
    assert client.get(f"/api/shots/{shot_id}").json()["media"]["body_swing"]["impact_ms"] is None


def test_health_says_the_rig_is_not_calibrated(client):
    """Before today there was no way to ask a running backend this, so the
    diagnostics panel could not show it and you had to run a script."""
    state = client.get("/api/health").json()["listeners"]["pose_worker"]["calibration"]
    assert state["ready"] is False
    assert "calibrate_cameras" in state["detail"]
    assert state["cameras"] == {}


def test_health_reports_a_calibrated_rig_and_where_the_cameras_are(client):
    """The camera positions are the number to check against a tape measure."""
    from tests.test_calibration import rig

    rig().save(client.settings.pose_calibration_path)
    state = client.get("/api/health").json()["listeners"]["pose_worker"]["calibration"]

    assert state["ready"] is True
    assert state["detail"] is None
    assert set(state["cameras"]) == {"body_swing", "body_swing_dtl"}
    assert state["cameras"]["body_swing"]["placed"] is True
    assert state["cameras"]["body_swing"]["position_m"] == pytest.approx(
        [0.0, -3.5, 1.4], abs=0.01
    )
    assert state["board"]["square_mm"] == 150.0


def test_health_names_the_camera_still_to_be_placed(client):
    from backend.pose.calibration import Calibration, CameraCalibration
    from tests.test_calibration import DTL, FACE_ON, HEIGHT, WIDTH

    Calibration(cameras={
        "body_swing": FACE_ON,
        "body_swing_dtl": CameraCalibration(
            (WIDTH, HEIGHT), DTL.matrix, DTL.distortion, 0.2
        ),
    }).save(client.settings.pose_calibration_path)

    state = client.get("/api/health").json()["listeners"]["pose_worker"]["calibration"]
    assert state["ready"] is False
    assert "body_swing_dtl" in state["detail"]
    assert "position_m" not in state["cameras"]["body_swing_dtl"]


def test_calibrating_takes_effect_without_a_restart(client):
    """Read from disk per call, so the panel never says 'not calibrated'
    after you have just calibrated."""
    from tests.test_calibration import rig

    assert client.get("/api/health").json()[
        "listeners"]["pose_worker"]["calibration"]["ready"] is False
    rig().save(client.settings.pose_calibration_path)
    assert client.get("/api/health").json()[
        "listeners"]["pose_worker"]["calibration"]["ready"] is True
