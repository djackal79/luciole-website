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
from dataclasses import dataclass
from typing import Any

from .config import Settings
from .correlator import ShotCorrelator
from .models import (
    is_heartbeat,
    is_shot,
    local_now,
    shot_rejection_reason,
    telemetry_from_gspro,
)

log = logging.getLogger(__name__)

#: Monitors send JSON objects back to back, sometimes newline-delimited and
#: sometimes not, so the buffer is drained with raw_decode rather than split().
MAX_BUFFER_BYTES = 1024 * 1024


@dataclass
class _Forward:
    """An outbound connection to the real GSPro, paired to one monitor."""

    writer: asyncio.StreamWriter
    pump: asyncio.Task[None]


class GSProListener:
    def __init__(self, settings: Settings, correlator: ShotCorrelator) -> None:
        self.settings = settings
        self.correlator = correlator
        self._server: asyncio.AbstractServer | None = None
        self._writers: set[asyncio.StreamWriter] = set()
        self.last_error: str | None = None
        self.shots_received = 0
        self.heartbeats_received = 0
        self.frames_ignored = 0
        self.frames_forwarded = 0
        self.forward_error: str | None = None

    # -- lifecycle ---------------------------------------------------------

    @property
    def live(self) -> bool:
        return self._server is not None and self._server.is_serving()

    @property
    def client_count(self) -> int:
        return len(self._writers)

    @property
    def forwarding(self) -> bool:
        return self.settings.gspro_forward_enabled

    def _forward_target(self) -> tuple[str, int]:
        return self.settings.gspro_forward_host, self.settings.gspro_forward_port

    async def start(self) -> bool:
        if self.live:
            return True

        if self.forwarding:
            host, port = self._forward_target()
            if port == self.settings.gspro_port and host == self.settings.gspro_host:
                # Relaying to our own listening address would loop every frame
                # back into ourselves forever.
                self.last_error = (
                    f"pass-through target {host}:{port} is this listener's own "
                    "address; move the listener to another port (e.g. 922)"
                )
                log.error("GSPro pass-through misconfigured -- %s", self.last_error)
                return False
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

        forward = await self._open_forward(writer) if self.forwarding else None
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
                buffer = await self._drain(buffer, writer, forward)
        except (ConnectionResetError, asyncio.IncompleteReadError):
            pass
        except Exception:
            log.exception("GSPro connection error for %s", peer)
        finally:
            await self._close_forward(forward)
            self._writers.discard(writer)
            await self._disconnect(writer)
            log.info("launch monitor disconnected from %s", peer)

    async def _drain(
        self, buffer: str, writer: asyncio.StreamWriter, forward: "_Forward | None"
    ) -> str:
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
            # The exact text of this frame. Relayed verbatim rather than
            # re-serialised, so GSPro receives byte-for-byte what the monitor
            # sent and nothing depends on our key order or float formatting.
            raw = stripped[:end]
            buffer = stripped[end:]
            await self._dispatch(payload, writer, forward, raw)

    async def _dispatch(
        self,
        payload: Any,
        writer: asyncio.StreamWriter,
        forward: "_Forward | None" = None,
        raw: str | None = None,
    ) -> None:
        if not isinstance(payload, dict):
            log.warning("gspro: ignoring non-object frame: %r", payload)
            return

        # Relay before parsing, so pass-through adds as little delay as
        # possible. When it succeeds GSPro answers the monitor and we stay
        # silent -- two replies to one frame is what a monitor would see as a
        # protocol fault. We only answer when GSPro is not there to.
        relayed = await self._relay(forward, raw)

        if self.settings.gspro_log_frames:
            log.info("gspro frame: %s", json.dumps(payload)[:4000])

        if is_heartbeat(payload):
            self.heartbeats_received += 1
            if not relayed:
                await self._send(writer, self._ack(200, "Heartbeat received"))
            return

        if (reason := shot_rejection_reason(payload)) is not None:
            # Never silent. A monitor that is connected but producing nothing
            # is the hardest thing to debug, so say exactly what arrived and
            # why it was not treated as a strike.
            self.frames_ignored += 1
            log.info("gspro: ignoring frame -- %s", reason)
            if not relayed:
                await self._send(writer, self._ack(200, "Status received"))
            return

        telemetry = telemetry_from_gspro(payload, local_now())
        self.shots_received += 1
        if not relayed:
                await self._send(writer, self._ack(200, "Shot received"))
        await self.correlator.submit_telemetry(telemetry)

    # -- pass-through ------------------------------------------------------

    async def _open_forward(self, monitor: asyncio.StreamWriter) -> "_Forward | None":
        """Open the outbound leg to the real GSPro for this monitor.

        Failure is not fatal. If GSPro is not running we keep recording shots
        and answer the monitor ourselves, so the app works whether or not the
        course is up.
        """
        host, port = self._forward_target()
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=self.settings.gspro_forward_timeout_s,
            )
        except Exception as exc:
            self.forward_error = f"{type(exc).__name__}: {exc}"
            log.warning(
                "GSPro pass-through: cannot reach %s:%s (%s) -- recording only",
                host, port, exc,
            )
            return None

        self.forward_error = None
        log.info("GSPro pass-through: relaying to %s:%s", host, port)
        pump = asyncio.create_task(
            self._pump(reader, monitor), name="gspro-forward-pump"
        )
        return _Forward(writer=writer, pump=pump)

    async def _relay(self, forward: "_Forward | None", raw: str | None) -> bool:
        """Send one frame on to GSPro verbatim. False if it did not go."""
        if forward is None or raw is None:
            return False
        try:
            forward.writer.write((raw + "\r\n").encode("utf-8"))
            await forward.writer.drain()
            self.frames_forwarded += 1
            return True
        except Exception as exc:
            # GSPro went away mid-session. Fall back to answering the monitor
            # ourselves rather than leaving it waiting on a reply.
            self.forward_error = f"{type(exc).__name__}: {exc}"
            log.warning("GSPro pass-through: relay failed (%s) -- recording only", exc)
            return False

    async def _pump(
        self, gspro: asyncio.StreamReader, monitor: asyncio.StreamWriter
    ) -> None:
        """Copy GSPro's replies straight back to the monitor, untouched."""
        try:
            while True:
                chunk = await gspro.read(65536)
                if not chunk:
                    log.info("GSPro pass-through: GSPro closed the connection")
                    return
                monitor.write(chunk)
                await monitor.drain()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("GSPro pass-through: reply pump stopped (%s)", exc)

    @staticmethod
    async def _close_forward(forward: "_Forward | None") -> None:
        if forward is None:
            return
        forward.pump.cancel()
        try:
            await forward.pump
        except (asyncio.CancelledError, Exception):
            pass
        try:
            forward.writer.close()
            await forward.writer.wait_closed()
        except Exception:
            pass

    @property
    def forward_active(self) -> bool:
        """Is a relay leg open right now?

        The outbound connection is per monitor session, so this is false
        between sessions and that is not a fault -- ``forward_error`` is what
        says whether anything went wrong.
        """
        return self.forwarding and self.forward_error is None and self.client_count > 0

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
