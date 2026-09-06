"""Golf simulator ingest service (Build 1).

Consolidates three independent capture streams into one shot package per
swing, written to ``data/shots/shot_<shot_id>/`` with a ``metadata.json`` that
is the contract Build 2 reads:

* Kinovea body-swing clips, via its Automation hook (watcher as fallback),
* impact-camera clips, uploaded by the phone,
* launch monitor telemetry, over a GSPro Open Connect v1 socket.

Run with::

    uvicorn backend.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .correlator import ShotCorrelator
from .events import EventBus
from .gspro import GSProListener
from .routers import ingest, shots, system, ws
from .routers.system import default_session_id
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
    session_id = settings.session_id or default_session_id()
    correlator = ShotCorrelator(settings, bus, session_id)
    gspro = GSProListener(settings, correlator)
    watcher = (
        KinoveaWatcher(settings, correlator, asyncio.get_running_loop())
        if settings.kinovea_watch_enabled
        else None
    )

    app.state.settings = settings
    app.state.bus = bus
    app.state.correlator = correlator
    app.state.gspro = gspro
    app.state.watcher = watcher

    await correlator.start()
    if settings.gspro_enabled:
        # A failure to bind is expected when GSPro itself is running; the
        # service stays up and the listener can be started later.
        await gspro.start()
    if watcher is not None:
        watcher.start()

    log.info(
        "session %s ready | pairing +/-%dms | shots -> %s",
        session_id,
        settings.pair_window_ms,
        settings.shots_dir,
    )
    try:
        yield
    finally:
        if watcher is not None:
            watcher.stop()
        await gspro.stop()
        # Close whatever is still open so nothing is silently lost.
        await correlator.stop(flush=True)
        log.info("ingest stopped")


app = FastAPI(
    title="Golf Simulator Ingest",
    version="1.0",
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

app.include_router(ingest.router)
app.include_router(shots.router)
app.include_router(system.router)
app.include_router(system.root_router)
app.include_router(ws.router)


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    run()
