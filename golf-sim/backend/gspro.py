"""GSPro Open Connect v1 listener.

Square has no public API. The working route is GSPro Open Connect v1: a plain
TCP socket on 127.0.0.1:921, no authentication, where the *launch monitor* is
the client and pushes shot JSON. This backend impersonates GSPro -- accept the
connection, parse the shot, reply with the acknowledgement the protocol
expects.

GSPro also binds 921, so both cannot run at once. That is a mode switch, not a
bug: practice sessions point Square at this backend, course play points it at
GSPro. The listener can therefore be stopped and restarted without killing the
service (``POST /api/listeners/gspro``).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from .config import Settings
from .correlator import ShotCorrelator
from .models import is_heartbeat, is_shot, local_now, telemetry_from_gspro

log = logging.getLogger(__name__)

#: Monitors send JSON objects back to back, sometimes newline-delimited and
#: sometimes not, so the buffer is drained with raw_decode rather than split().
MAX_BUFFER_BYTES = 1024 * 1024


class GSProListener:
    def __init__(self, settings: Settings, correlator: ShotCorrelator) -> None:
        self.settings = settings
        self.correlator = correlator
        self._server: asyncio.AbstractServer | None = None
        self._writers: set[asyncio.StreamWriter] = set()
        self.last_error: str | None = None
        self.shots_received = 0

    # -- lifecycle ---------------------------------------------------------

    @property
    def live(self) -> bool:
        return self._server is not None and self._server.is_serving()

    @property
    def client_count(self) -> int:
        return len(self._writers)

    async def start(self) -> bool:
        if self.live:
            return True
        try:
            self._server = await asyncio.start_server(
                self._handle_client, self.settings.gspro_host, self.settings.gspro_port
            )
        except OSError as exc:
            # Almost always "address already in use" -- GSPro has 921.
            self.last_error = f"{exc.__class__.__name__}: {exc}"
            self._server = None
            log.warning(
                "GSPro listener could not bind %s:%s (%s). Is GSPro running?",
                self.settings.gspro_host,
                self.settings.gspro_port,
                exc,
            )
            return False
        self.last_error = None
        log.info(
            "GSPro Open Connect listener on %s:%s",
            self.settings.gspro_host,
            self.settings.gspro_port,
        )
        return True

    async def stop(self) -> None:
        for writer in list(self._writers):
            await self._disconnect(writer)
        if self._server is not None:
            self._server.close()
            try:
                await self._server.wait_closed()
            except Exception:
                pass
            self._server = None
            log.info("GSPro listener stopped; port %s released", self.settings.gspro_port)

    # -- connection --------------------------------------------------------

    async def _handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        peer = writer.get_extra_info("peername")
        self._writers.add(writer)
        log.info("launch monitor connected from %s", peer)
        buffer = ""
        try:
            while True:
                chunk = await reader.read(65536)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                if len(buffer) > MAX_BUFFER_BYTES:
                    log.warning("dropping oversized GSPro buffer from %s", peer)
                    buffer = ""
                    continue
                buffer = await self._drain(buffer, writer)
        except (ConnectionResetError, asyncio.IncompleteReadError):
            pass
        except Exception:
            log.exception("GSPro connection error for %s", peer)
        finally:
            self._writers.discard(writer)
            await self._disconnect(writer)
            log.info("launch monitor disconnected from %s", peer)

    async def _drain(self, buffer: str, writer: asyncio.StreamWriter) -> str:
        """Pull every complete JSON object out of the buffer."""
        decoder = json.JSONDecoder()
        while True:
            stripped = buffer.lstrip()
            if not stripped:
                return ""
            try:
                payload, end = decoder.raw_decode(stripped)
            except json.JSONDecodeError:
                # Either a partial object, or genuine garbage. Keep waiting for
                # more bytes; the size cap above stops it growing forever.
                return stripped
            buffer = stripped[end:]
            await self._dispatch(payload, writer)

    async def _dispatch(self, payload: Any, writer: asyncio.StreamWriter) -> None:
        if not isinstance(payload, dict):
            return

        if is_heartbeat(payload):
            await self._send(writer, self._ack(200, "Heartbeat received"))
            return

        if not is_shot(payload):
            # Status frames: monitor arming, ball placed, ball removed.
            await self._send(writer, self._ack(200, "Status received"))
            return

        telemetry = telemetry_from_gspro(payload, local_now())
        self.shots_received += 1
        await self._send(writer, self._ack(200, "Shot received"))
        await self.correlator.submit_telemetry(telemetry)

    # -- outbound ----------------------------------------------------------

    def _ack(self, code: int, message: str) -> dict[str, Any]:
        return {
            "Code": code,
            "Message": message,
            "Player": {
                "Handed": "RH",
                "Club": self.current_club or "DR",
                "DistanceToTarget": 0,
            },
        }

    async def set_club(self, club: str | None) -> int:
        """Push a GSPro 201 Player message, which is how club selection
        reaches the monitor. Returns the number of monitors notified."""
        self.correlator.current_club = club
        if club is None:
            return 0
        return await self.broadcast(self._ack(201, "Player Information"))

    @property
    def current_club(self) -> str | None:
        return self.correlator.current_club

    async def broadcast(self, message: dict[str, Any]) -> int:
        delivered = 0
        for writer in list(self._writers):
            if await self._send(writer, message):
                delivered += 1
        return delivered

    async def _send(self, writer: asyncio.StreamWriter, message: dict[str, Any]) -> bool:
        try:
            writer.write((json.dumps(message) + "\r\n").encode("utf-8"))
            await writer.drain()
            return True
        except Exception:
            self._writers.discard(writer)
            await self._disconnect(writer)
            return False

    @staticmethod
    async def _disconnect(writer: asyncio.StreamWriter) -> None:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass
