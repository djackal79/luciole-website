"""Tiny in-process pub/sub used to fan shot lifecycle events out to clients.

Build 2's dashboard subscribes over ``/ws/events`` and gets a live feed of
shots opening, artefacts attaching and packages finalising.
"""

from __future__ import annotations

import asyncio
import contextlib
import time
from typing import Any, AsyncIterator

#: Per-subscriber backlog. A slow dashboard drops events rather than stalling
#: the ingest path.
QUEUE_SIZE = 256


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._recent: list[dict[str, Any]] = []

    def publish(self, event_type: str, payload: dict[str, Any] | None = None) -> None:
        event = {"type": event_type, "at": time.time(), **(payload or {})}
        self._recent.append(event)
        del self._recent[:-50]
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    @property
    def recent(self) -> list[dict[str, Any]]:
        return list(self._recent)

    @contextlib.asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[dict[str, Any]]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)
