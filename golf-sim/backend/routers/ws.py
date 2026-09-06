"""WebSocket endpoints.

``/ws/control``  capture devices: clock sync + trigger fan-out
``/ws/events``   dashboards: live shot lifecycle feed (Build 2's data source)
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from ..clock import ClockRegistry

log = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])

#: Sent to an idle dashboard so proxies do not drop the socket.
EVENT_KEEPALIVE_SECONDS = 20.0


class ControlHub:
    """Registry of connected capture devices."""

    def __init__(self) -> None:
        self._sockets: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def register(self, device_id: str, socket: WebSocket) -> None:
        async with self._lock:
            existing = self._sockets.get(device_id)
            self._sockets[device_id] = socket
        if existing is not None and existing is not socket:
            # A phone that reconnects after a network blip leaves a zombie.
            with contextlib.suppress(Exception):
                await existing.close(code=status.WS_1012_SERVICE_RESTART)

    async def unregister(self, device_id: str, socket: WebSocket) -> None:
        async with self._lock:
            if self._sockets.get(device_id) is socket:
                del self._sockets[device_id]

    async def broadcast(self, message: dict[str, Any]) -> int:
        async with self._lock:
            targets = list(self._sockets.items())
        delivered = 0
        for device_id, socket in targets:
            try:
                await socket.send_json(message)
                delivered += 1
            except Exception:
                log.warning("dropping unreachable capture device %s", device_id)
                await self.unregister(device_id, socket)
        return delivered

    @property
    def device_ids(self) -> list[str]:
        return sorted(self._sockets)


@router.websocket("/ws/control")
async def control_socket(
    websocket: WebSocket,
    device_id: str = Query(default="impact_cam"),
) -> None:
    """Capture-device channel.

    Client -> server:
      ``{"type": "hello",     "device_id": "...", "capabilities": {...}}``
      ``{"type": "ping",      "t1": <device epoch s>}``
      ``{"type": "sync_ack",  "t1":…, "t2":…, "t3":…, "t4": <device epoch s>}``
      ``{"type": "clip_ready","captured_at":…, "bytes":…}``  (informational)

    Server -> client:
      ``{"type": "pong", "t1":…, "t2":…, "t3":…}``
      ``{"type": "clock", "offset_ms":…, "rtt_ms":…}``
      ``{"type": "capture_trigger", "trigger_id":…, "host_timestamp":…}``
    """
    await websocket.accept()
    hub: ControlHub = websocket.app.state.control_hub
    clocks: ClockRegistry = websocket.app.state.clocks
    await hub.register(device_id, websocket)
    log.info("capture device connected: %s", device_id)

    try:
        await websocket.send_json(
            {"type": "welcome", "device_id": device_id, "host_timestamp": time.time()}
        )
        while True:
            message = await websocket.receive_json()
            kind = message.get("type")

            if kind == "ping":
                # t2 = receive time, t3 = send time. The client measures t4 and
                # replies with sync_ack so the server can compute the offset too.
                t2 = time.time()
                await websocket.send_json(
                    {"type": "pong", "t1": message.get("t1"), "t2": t2, "t3": time.time()}
                )

            elif kind == "sync_ack":
                try:
                    clock = clocks.observe(
                        device_id,
                        float(message["t1"]),
                        float(message["t2"]),
                        float(message["t3"]),
                        float(message["t4"]),
                    )
                except (KeyError, TypeError, ValueError):
                    await websocket.send_json(
                        {"type": "error", "detail": "sync_ack needs numeric t1..t4"}
                    )
                    continue
                await websocket.send_json({"type": "clock", **clock.as_dict()})

            elif kind == "hello":
                log.info("device %s capabilities: %s", device_id, message.get("capabilities"))

            elif kind == "clip_ready":
                log.debug("device %s reports clip ready: %s", device_id, message)

            else:
                await websocket.send_json({"type": "error", "detail": f"unknown type {kind!r}"})

    except WebSocketDisconnect:
        log.info("capture device disconnected: %s", device_id)
    except Exception:
        log.exception("control socket error for %s", device_id)
    finally:
        await hub.unregister(device_id, websocket)


@router.websocket("/ws/events")
async def events_socket(websocket: WebSocket, replay: int = Query(default=0, ge=0, le=50)) -> None:
    """Live shot lifecycle feed for the Build 2 dashboard."""
    await websocket.accept()
    bus = websocket.app.state.bus

    async with bus.subscribe() as queue:
        for event in bus.recent[-replay:] if replay else []:
            await websocket.send_json(event)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=EVENT_KEEPALIVE_SECONDS)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "keepalive", "at": time.time()})
                    continue
                await websocket.send_json(event)
        except WebSocketDisconnect:
            return
        except Exception:
            log.exception("events socket error")
