"""In-process pub/sub backing ``/ws/shots``.

Every envelope carries the *complete* metadata object, never a diff. It costs
a few KB and removes a whole class of state-merge bugs in the frontend.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Any, AsyncIterator

from .models import iso, local_now

#: Per-subscriber backlog. A slow client drops events rather than stalling
#: the ingest path.
QUEUE_SIZE = 256

SHOT_CREATED = "shot.created"
SHOT_UPDATED = "shot.updated"
SHOT_COMPLETED = "shot.completed"
SHOT_PATCHED = "shot.patched"
SESSION_RESET = "session.reset"


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._recent: list[dict[str, Any]] = []

    def publish(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        *,
        shot_id: str | None = None,
    ) -> dict[str, Any]:
        event = {
            "type": event_type,
            "ts": iso(local_now()),
            "shot_id": shot_id,
            "payload": payload,
        }
        self._recent.append(event)
        del self._recent[:-50]
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass
        return event

    @property
    def recent(self) -> list[dict[str, Any]]:
        return list(self._recent)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    @contextlib.asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[dict[str, Any]]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)
