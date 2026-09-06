"""``/ws/shots`` -- the live shot feed.

Sources arrive at different times, so a shot is emitted as soon as anything
lands and updated as the rest arrives. The frontend shows the shot immediately
rather than waiting for the pairing window to close.

Every payload is the complete metadata object, never a diff.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ..models import iso, local_now

log = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])

#: Sent to an idle client so proxies do not drop the socket.
KEEPALIVE_SECONDS = 20.0


@router.websocket("/ws/shots")
async def shots_socket(
    websocket: WebSocket, replay: int = Query(default=0, ge=0, le=50)
) -> None:
    await websocket.accept()
    bus = websocket.app.state.bus

    async with bus.subscribe() as queue:
        for event in bus.recent[-replay:] if replay else []:
            await websocket.send_json(event)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                except asyncio.TimeoutError:
                    await websocket.send_json(
                        {"type": "keepalive", "ts": iso(local_now()), "shot_id": None,
                         "payload": None}
                    )
                    continue
                await websocket.send_json(event)
        except WebSocketDisconnect:
            return
        except Exception:
            log.exception("shots socket error")
