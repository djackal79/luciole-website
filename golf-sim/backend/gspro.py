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

#: Do not re-announce the club more often than this. A monitor that reports
#: "not ready" on every frame of a burst should get one nudge, not twenty.
PLAYER_INFO_MIN_GAP_S = 1.0

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
        self._player_info_at: float = 0.0
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
            # its own and two would conflict.
            await self._announce_player(writer)
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

        # The re-arm is deferred to a finally below so it lands *after* the
        # reply to this frame. GSPro's real order is acknowledge the shot,
        # then send player information; a 201 arriving before the ack is a
        # sequence no connector ever sees in the wild.
        rearm = self._note_readiness(payload) if not relayed else False
        try:
            await self._handle(payload, writer, relayed)
        finally:
            if rearm:
                await self._announce_player(writer, force=True, rearm=True)

    def _note_readiness(self, payload: dict[str, Any]) -> bool:
        """Record what the monitor says about itself. True if it needs arming.

        Checked on *every* frame, not just heartbeats. The Square goes unready
        the instant it has reported a strike and says so on the club frame,
        which is a shot frame -- so a check that only ran on heartbeats armed
        the device once and never again.
        """
        options = payload.get("ShotDataOptions") or {}
        ready = options.get("LaunchMonitorIsReady")
        if ready is None:
            return False

        was, self._monitor_ready = self._monitor_ready, bool(ready)
        if self._monitor_ready is not was:
            # The one transition worth a line in the log. Coming back to ready
            # after a strike is the proof the re-arm landed; staying unready is
            # the proof it did not, and there is no other way to tell those
            # apart from the bay.
            log.info(
                "gspro: monitor reports %s",
                "READY -- armed for the next strike" if ready else "NOT READY",
            )
        if ready is not False:
            return False

        # Announce whenever this is *news*: the monitor was ready and has just
        # gone unready, or we had never heard its readiness at all. Only a
        # repeat of an already-known not-ready state is throttled -- the
        # connect-time announce stamps the throttle clock, so anything looser
        # swallows the not-ready frame that arrives inside the first second,
        # which is every monitor that was never ready to begin with.
        if was is not False:
            return True
        return time.monotonic() - self._player_info_at >= PLAYER_INFO_MIN_GAP_S

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
    def forward_active(self) -> bool:
        """Is a relay leg open right now?

        The outbound connection is per monitor session, so this is false
        between sessions and that is not a fault -- ``forward_error`` is what
        says whether anything went wrong.
        """
        return self.forwarding and self.forward_error is None and self.client_count > 0

    # -- outbound ----------------------------------------------------------

    def _player_info(self, club: str | None = None) -> dict[str, Any]:
        """The message GSPro pushes to tell a connector which club is in play.

        Code 201 in Open Connect, and it is not merely informational: a bridge
        that has to configure its device per club may wait for this before it
        arms shot detection at all. The Square is such a device -- a working
        implementation sends club configuration and only then the command that
        arms ball detection -- so a monitor reporting
        ``LaunchMonitorIsReady: false`` forever may simply never have been told
        what it is hitting.

        We never sent this. Replies carried a Player block inside a Code 200
        acknowledgement, which is not the message a connector waits on.
        """
        return {
            "Code": 201,
            "Message": "GSPro Player Information",
            "Player": {
                "Handed": self.settings.gspro_player_handed,
                "Club": club or self.current_club or self.settings.gspro_default_club,
                "DistanceToTarget": self.settings.gspro_distance_to_target,
                "Surface": "tee",
            },
        }

    def _decoy_club(self) -> str:
        """A club that is definitely not the one in play."""
        real = self.current_club or self.settings.gspro_default_club
        decoy = self.settings.gspro_rearm_decoy_club
        if decoy.upper() == real.upper():
            # Whatever the decoy is set to, it must differ from the real club
            # or the change the monitor is waiting for never happens.
            return "DR" if real.upper() != "DR" else "7I"
        return decoy

    async def _announce_player(
        self,
        writer: asyncio.StreamWriter,
        *,
        force: bool = False,
        rearm: bool = False,
    ) -> None:
        """Tell the monitor the club, if we are the one answering it.

        ``force`` skips the throttle. ``rearm`` changes the club and changes it
        back, which is what actually arms a Square that has just reported a
        strike.

        Repeating the club it already has does nothing. Measured in the bay on
        7 September: a Code 201 goes out after every shot and the device stays
        at ``LaunchMonitorIsReady: false`` indefinitely. Under GSPro the
        community workaround for the same symptom is to press K -- club up --
        which is a 201 carrying a *different* club. The change is the signal,
        not the message.

        So a re-arm sends a decoy club, holds briefly, then sends the real one:
        two distinct selections, ending on the right club so shot tagging is
        unaffected.
        """
        if not self.settings.gspro_send_player_info:
            return
        now = time.monotonic()
        if not force and now - self._player_info_at < PLAYER_INFO_MIN_GAP_S:
            return
        self._player_info_at = now
        self.player_info_sent += 1
        real = self.current_club or self.settings.gspro_default_club

        if rearm and self.settings.gspro_rearm_club_nudge:
            decoy = self._decoy_club()
            log.info("gspro: re-arming -- club %s then back to %s", decoy, real)
            if not await self._send(writer, self._player_info(decoy)):
                return
            await asyncio.sleep(self.settings.gspro_rearm_gap_s)
            self._player_info_at = time.monotonic()
        else:
            log.info(
                "gspro: sent player info (club %s) -- a monitor that never arms "
                "is usually waiting for this", real,
            )
        await self._send(writer, self._player_info())

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
