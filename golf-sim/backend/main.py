"""Golf simulator ingestion service (Build 1).

Consolidates three independent capture streams into timestamped shot packages
on disk:

* Kinovea swing clips, picked up by a filesystem watcher,
* impact-camera clips, uploaded over HTTP by the phone,
* Square Golf launch monitor telemetry, posted as JSON.

Run with::

    uvicorn backend.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .clock import ClockRegistry
from .config import get_settings
from .correlator import ShotCorrelator
from .events import EventBus
from .routers import media, shots, telemetry, ws
from .routers.ws import ControlHub
from .watcher import KinoveaWatcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("golfsim")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.ensure_dirs()

    bus = EventBus()
    correlator = ShotCorrelator(settings, bus)
    watcher = KinoveaWatcher(settings, correlator, asyncio.get_running_loop())

    app.state.settings = settings
    app.state.bus = bus
    app.state.correlator = correlator
    app.state.clocks = ClockRegistry()
    app.state.control_hub = ControlHub()
    app.state.watcher = watcher

    await correlator.start()
    watcher.start()
    log.info("ingest ready on %s:%s (pairing window +/-%ss)",
             settings.host, settings.port, settings.pair_window_seconds)
    try:
        yield
    finally:
        watcher.stop()
        # Flush whatever is still open so no capture is silently lost.
        await correlator.stop(flush=True)
        log.info("ingest stopped")


app = FastAPI(
    title="Golf Simulator Ingest",
    version="1.0.0",
    description=__doc__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry.router)
app.include_router(media.router)
app.include_router(shots.router)
app.include_router(ws.router)


@app.get("/health", tags=["ops"])
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "capture_devices": app.state.control_hub.device_ids,
        "event_subscribers": app.state.bus.subscriber_count,
    }


def run() -> None:
    """Console entry point: ``python -m backend.main``."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    run()
