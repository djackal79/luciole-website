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
import time
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

#: Sentinel meaning "do not model the flight".
_DISABLED = object()

#: Monitors send JSON objects back to back, sometimes newline-delimited and
#: sometimes not, so the buffer is drained with raw_decode rather than split().
#: A second frame with the same ShotNumber inside this window is the same
#: swing, not a new one. Observed gap between the Square's ball and club
#: frames is about 0.8 s.
SHOT_COALESCE_S = 4.0

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
        self.player_info_sent = 0
        self._last_shot_number: Any = None
        self._last_shot_id: str | None = None
        self._last_shot_at: float = 0.0
        self._rearm_attempts = 0
        self._unready_since: float | None = None
        #: One pending re-arm per monitor. Cancelled the moment it reports
        #: ready, and on disconnect.
        self._arm_tasks: dict[asyncio.StreamWriter, asyncio.Task[None]] = {}
        self._monitor_ready: bool | None = None
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

    def _conditions(self) -> Any | None:
        """Air for the flight model, or None to skip modelling entirely."""
        if not self.settings.flight_model_enabled:
            return _DISABLED
        from .flight import Conditions

        return Conditions(
            altitude_m=self.settings.flight_altitude_m,
            temperature_c=self.settings.flight_temperature_c,
        )

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
            self._cancel_rearm(writer)
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
        if forward is None:
            # Only when we are the simulator. With pass-through, GSPro sends
            # its own and two would conflict. On connect the device is idle,
            # so this one is safe to send at once -- it arms the first shot.
            if await self._announce_player(writer):
                log.info(
                    "gspro: sent player info on connect (club %s) -- this arms "
                    "the first strike", self._club(),
                )
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
            self._cancel_rearm(writer)
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

        if not relayed:
            self._note_readiness(payload, writer)
        await self._handle(payload, writer, relayed)

    def _note_readiness(
        self, payload: dict[str, Any], writer: asyncio.StreamWriter
    ) -> None:
        """Record what the monitor says about itself, and schedule the re-arm.

        Checked on *every* frame, not just heartbeats: the Square goes unready
        the instant it has reported a strike and says so on the club frame,
        which is a shot frame.

        The re-arm is a **timer**, never an immediate reply. Two measured
        facts force that. The Square freezes if it is re-armed inside its own
        post-shot cycle -- the face never lights again for the rest of the
        session -- and that cycle runs a few seconds past the club-data frame.
        And the bridge only sends a frame when its ready state *changes*, so
        after a shot the line goes quiet: nothing arrives to hang a retry on.
        A re-arm driven by incoming frames therefore fires once, too early,
        and never again. Seven September, in full.
        """
        options = payload.get("ShotDataOptions") or {}
        ready = options.get("LaunchMonitorIsReady")
        if ready is None:
            return
        now = time.monotonic()
        was, self._monitor_ready = self._monitor_ready, bool(ready)

        if ready:
            if was is not True:
                if self._unready_since is not None:
                    # The line that answers "did the re-arm work". Both
                    # numbers are only known here, and it survives a log
                    # trimmed to the shot.
                    log.info(
                        "gspro: armed again after %.1fs and %d re-arm attempt(s)",
                        now - self._unready_since, self._rearm_attempts,
                    )
                else:
                    log.info("gspro: monitor reports READY -- armed for the next strike")
            self._cancel_rearm(writer)
            self._unready_since = None
            self._rearm_attempts = 0
            return

        # Club data marks the end of a shot, which is the moment the settle
        # clock starts -- whatever the ready flag did on the ball frame. A
        # bare transition into not-ready (first contact, or a bridge that
        # reports ball state) starts it too. A *repeat* of not-ready does not
        # restart it, or a bridge that heartbeats the state would push the
        # re-arm out forever.
        end_of_shot = options.get("ContainsClubData") is True
        if was is not False:
            self._unready_since = now
            self._rearm_attempts = 0
            log.info(
                "gspro: monitor reports NOT READY -- re-arm in %.1fs (told "
                "sooner, the Square freezes)", self.settings.gspro_rearm_delay_s,
            )
        if was is not False or end_of_shot:
            self._schedule_rearm(writer)

    def _schedule_rearm(self, writer: asyncio.StreamWriter) -> None:
        self._cancel_rearm(writer)
        task = asyncio.create_task(self._rearm_later(writer), name="gspro-rearm")
        self._arm_tasks[writer] = task
        task.add_done_callback(lambda t: self._arm_tasks.pop(writer, None)
                               if self._arm_tasks.get(writer) is t else None)

    def _cancel_rearm(self, writer: asyncio.StreamWriter) -> None:
        task = self._arm_tasks.pop(writer, None)
        if task is not None and not task.done():
            task.cancel()

    async def _rearm_later(self, writer: asyncio.StreamWriter) -> None:
        """Wait out the device's post-shot cycle, then arm it once.

        A validated server sends exactly one 201 after the settle and never
        retries. The slow repeat here is insurance only: the failure mode is
        *early*, never late, so a 201 ten seconds on cannot do harm, and a
        monitor that ignores six of them is a fault to log, not to hammer.
        """
        await asyncio.sleep(self.settings.gspro_rearm_delay_s)
        limit = self.settings.gspro_rearm_max_attempts
        while self._monitor_ready is False and writer in self._writers:
            since = time.monotonic() - (self._unready_since or time.monotonic())
            if self._rearm_attempts >= limit:
                log.warning(
                    "gspro: still not ready %.0fs and %d re-arms after the shot -- "
                    "giving up. Select a club in the app to nudge it, and keep "
                    "this log: the monitor is ignoring a message a validated "
                    "server arms it with", since, self._rearm_attempts,
                )
                return
            self._rearm_attempts += 1
            log.info(
                "gspro: re-arm %d sent (club %s) %.1fs after the shot",
                self._rearm_attempts, self._club(), since,
            )
            if not await self._announce_player(writer):
                return
            await asyncio.sleep(self.settings.gspro_rearm_retry_s)

    async def _handle(
        self, payload: dict[str, Any], writer: asyncio.StreamWriter, relayed: bool
    ) -> None:
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

        telemetry = telemetry_from_gspro(payload, local_now(), self._conditions())
        if not relayed:
            await self._send(writer, self._ack(200, "Shot received"))

        # One swing, two frames. The Square reports ball data first and club
        # data about 700 ms later, both carrying the same ShotNumber, and both
        # are genuine strikes by every content test. Submitting each would put
        # two shots on screen for one swing, so the second is merged into the
        # first instead.
        number = payload.get("ShotNumber")
        now = time.monotonic()
        if (
            number is not None
            and number == self._last_shot_number
            and self._last_shot_id is not None
            and now - self._last_shot_at <= SHOT_COALESCE_S
        ):
            merged = await self.correlator.merge_telemetry(
                self._last_shot_id, telemetry
            )
            if merged is not None:
                log.info(
                    "gspro: shot %s frame merged into %s (club data arrives "
                    "separately)", number, self._last_shot_id,
                )
                self._last_shot_at = now
                return
            # The shot has gone; fall through and record this as its own.

        self.shots_received += 1
        package = await self.correlator.submit_telemetry(telemetry)
        self._last_shot_number = number
        self._last_shot_id = package.shot_id
        self._last_shot_at = now

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
    def monitor_ready(self) -> bool | None:
        """The monitor's own last word on whether it is armed.

        ``None`` means it has never said, which is not the same as unready --
        a monitor that has reported nothing and one that has reported "no" are
        different faults.
        """
        return self._monitor_ready

    @property
    def rearm_pending(self) -> bool:
        """A re-arm is scheduled or in its retry loop."""
        return any(not t.done() for t in self._arm_tasks.values())

    @property
    def rearm_attempts(self) -> int:
        """Re-arms sent since the monitor last reported itself ready.

        Zero while it is armed. A number that climbs and never resets is the
        signature of a monitor ignoring the club change.
        """
        return self._rearm_attempts

    @property
    def forward_active(self) -> bool:
        """Is a relay leg open right now?

        The outbound connection is per monitor session, so this is false
        between sessions and that is not a fault -- ``forward_error`` is what
        says whether anything went wrong.
        """
        return self.forwarding and self.forward_error is None and self.client_count > 0

    # -- outbound ----------------------------------------------------------

    def _club(self) -> str:
        return self.current_club or self.settings.gspro_default_club

    def _player_info(self) -> dict[str, Any]:
        """The message GSPro pushes to tell a connector which club is in play.

        Code 201 in Open Connect, and for the Square it is not informational:
        it is the arm signal. The bridge configures the device for the club and
        then enables ball detection, and it does so on the *exact* message
        text "GSPro Player Information" -- connectors match that literal, so a
        paraphrase is silently ignored.

        Kept to the two fields a validated server sends. Anything more is a
        variable this bay cannot afford.
        """
        return {
            "Code": 201,
            "Message": "GSPro Player Information",
            "Player": {
                "Handed": self.settings.gspro_player_handed,
                "Club": self._club(),
            },
        }

    async def _announce_player(self, writer: asyncio.StreamWriter) -> bool:
        """Send the club, if we are the one answering the monitor."""
        if not self.settings.gspro_send_player_info:
            return False
        self.player_info_sent += 1
        return await self._send(writer, self._player_info())

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
        reaches the monitor. Returns the number of monitors notified.

        Sent as the exact literal the bridge matches on. The previous wording,
        "Player Information", was a 201 the Square's connector ignores.
        """
        self.correlator.current_club = club
        if club is None:
            return 0
        delivered = 0
        for writer in list(self._writers):
            if await self._announce_player(writer):
                delivered += 1
        return delivered

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
