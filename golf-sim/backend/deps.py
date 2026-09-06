"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from .config import Settings, get_settings
from .correlator import ShotCorrelator
from .events import EventBus


def get_correlator(request: Request) -> ShotCorrelator:
    return request.app.state.correlator


def get_bus(request: Request) -> EventBus:
    return request.app.state.bus


def get_gspro(request: Request):
    return request.app.state.gspro


def get_watcher(request: Request):
    return request.app.state.watcher


def require_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_golfsim_token: Annotated[str | None, Header()] = None,
) -> None:
    """No-op unless ``GOLFSIM_INGEST_TOKEN`` is configured."""
    if settings.ingest_token and x_golfsim_token != settings.ingest_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid ingest token"
        )


SettingsDep = Annotated[Settings, Depends(get_settings)]
CorrelatorDep = Annotated[ShotCorrelator, Depends(get_correlator)]
BusDep = Annotated[EventBus, Depends(get_bus)]
