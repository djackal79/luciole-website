"""Health, session control and listener control."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from ..deps import CorrelatorDep, SettingsDep, get_gspro, get_watcher
from ..models import SessionRequest, local_now

router = APIRouter(prefix="/api", tags=["system"])


def _calibration_state(settings: Any) -> dict[str, Any]:
    """Whether the rig can produce 3D, and what is left if not.

    Read from disk on each call rather than cached, matching the pose worker:
    running the calibration script takes effect immediately, and the panel
    showing "not calibrated" after you just calibrated would be its own bug.
    """
    from ..pose.calibration import Calibration, camera_position

    path = settings.pose_calibration_path
    calibration = Calibration.load(path)
    if calibration is None:
        return {
            "ready": False,
            "path": str(path),
            "cameras": {},
            "detail": "no calibration file; run scripts/calibrate_cameras.py",
        }

    cameras: dict[str, Any] = {}
    for name, camera in calibration.cameras.items():
        entry: dict[str, Any] = {
            "placed": camera.placed,
            "lens_rms_px": round(camera.rms_px, 3),
            "pose_rms_px": (
                None if camera.pose_rms_px is None else round(camera.pose_rms_px, 3)
            ),
        }
        if camera.placed:
            # The number to check against a tape measure. If this is wrong,
            # so is every distance the 3D metrics are built on.
            entry["position_m"] = [round(float(v), 3) for v in camera_position(camera)]
        cameras[name] = entry

    unplaced = sorted(set(cameras) - set(calibration.triangulable))
    return {
        "ready": calibration.ready,
        "path": str(path),
        "calibrated_at": calibration.created_at,
        "board": calibration.board.as_dict(),
        "cameras": cameras,
        "detail": (
            None
            if calibration.ready
            else f"needs 2 placed cameras, have {len(calibration.triangulable)}"
            + (f" ({', '.join(unplaced)} not placed)" if unplaced else "")
        ),
    }


@router.get("/health")
async def health(
    request: Request, settings: SettingsDep, correlator: CorrelatorDep
) -> dict[str, Any]:
    """Which listeners are live."""
    gspro = get_gspro(request)
    watcher = get_watcher(request)
    return {
        "ok": True,
        "session_id": correlator.session_id,
        "listeners": {
            "gspro_socket": {
                "live": gspro.live,
                "host": settings.gspro_host,
                "port": settings.gspro_port,
                "clients": gspro.client_count,
                "shots_received": gspro.shots_received,
                "heartbeats_received": gspro.heartbeats_received,
                "frames_ignored": gspro.frames_ignored,
                "last_error": gspro.last_error,
                "pass_through": {
                    "enabled": settings.gspro_forward_enabled,
                    "target": (
                        f"{settings.gspro_forward_host}:{settings.gspro_forward_port}"
                        if settings.gspro_forward_enabled else None
                    ),
                    # Per monitor session, so false between shots is normal.
                    "active": gspro.forward_active,
                    "frames_forwarded": gspro.frames_forwarded,
                    "last_error": gspro.forward_error,
                },
            },
            "kinovea_hook": {
                "live": True,
                "endpoint": "/api/ingest/body_swing",
                "watcher_fallback": watcher is not None and watcher.live,
                "watch_dir": str(settings.kinovea_export_dir),
            },
            "phone_endpoint": {"live": True, "endpoint": "/api/ingest/impact"},
            "pose_worker": {
                "live": request.app.state.pose.live,
                "enabled": settings.pose_enabled,
                "model": str(settings.pose_model_path),
                "reason": request.app.state.pose.extractor.available(),
                "calibration": _calibration_state(settings),
            },
        },
        "pairing": {
            "window_ms": settings.pair_window_ms,
            "late_attach_ms": settings.late_attach_ms,
            "open_shots": correlator.open_count(),
        },
        "ws_clients": request.app.state.bus.subscriber_count,
    }


@router.post("/session")
async def start_session(
    request: Request, correlator: CorrelatorDep, body: SessionRequest
) -> dict[str, Any]:
    """Start a new session. Emits session.reset; the frontend clears history.

    An optional club is pushed to the connected launch monitor as a GSPro 201
    Player message and stamped onto subsequent shots.
    """
    session_id = body.session_id or default_session_id()
    await correlator.reset_session(session_id)

    gspro = get_gspro(request)
    notified = await gspro.set_club(body.club) if body.club else 0
    return {
        "session_id": session_id,
        "club": gspro.current_club,
        "monitors_notified": notified,
    }


@router.post("/listeners/gspro")
async def set_gspro_listener(request: Request, enabled: bool = True) -> dict[str, Any]:
    """Start or stop the GSPro socket without restarting the service.

    GSPro binds 921 too, so this is the practice/course mode switch.
    """
    gspro = get_gspro(request)
    if enabled:
        started = await gspro.start()
        return {"live": gspro.live, "started": started, "last_error": gspro.last_error}
    await gspro.stop()
    return {"live": gspro.live, "started": False, "last_error": None}


root_router = APIRouter(tags=["system-root"])

@root_router.get("/health")
async def root_health(request: Request, settings: SettingsDep, correlator: CorrelatorDep) -> dict[str, Any]:
    return await health(request, settings, correlator)

@root_router.post("/session/start")
async def root_start_session(request: Request, correlator: CorrelatorDep, body: SessionRequest) -> dict[str, Any]:
    return await start_session(request, correlator, body)

@root_router.post("/session/end")
async def root_end_session(request: Request, correlator: CorrelatorDep) -> dict[str, Any]:
    """End the current session and flush open shots."""
    old_session = correlator.session_id
    # close_all(), not stop(): stop() cancels the reaper, and nothing here
    # would bring it back. reset_session restarts it either way, but ending a
    # session should never have torn down the worker in the first place.
    await correlator.close_all()
    new_id = default_session_id()
    await correlator.reset_session(new_id)
    return {"ended_session_id": old_session, "new_session_id": new_id, "ok": True}

@root_router.post("/listener/toggle")
async def root_toggle_listener(request: Request, enabled: bool = True) -> dict[str, Any]:
    return await set_gspro_listener(request, enabled)


def default_session_id() -> str:
    """``20260906-morning``."""
    now = local_now()
    hour = now.hour
    if hour < 12:
        part = "morning"
    elif hour < 17:
        part = "afternoon"
    elif hour < 21:
        part = "evening"
    else:
        part = "night"
    return f"{now.strftime('%Y%m%d')}-{part}"

