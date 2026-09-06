"""NTP-style clock synchronisation for capture devices.

The phone timestamps its own ring-buffer snapshots. Its wall clock drifts from
the PC's by anywhere between a few milliseconds and several seconds, which is
enough to break a +/-3 s pairing window and *far* too much for the
frame-accurate scrubbing planned for Build 2. So every device that pushes
media keeps a control WebSocket open and exchanges timing probes over it.
"""

from __future__ import annotations

import statistics
import threading
import time
from collections import deque
from dataclasses import dataclass, field

#: Probes retained per device; the offset is the median of the best half.
SAMPLE_WINDOW = 16


@dataclass
class ClockSample:
    offset_s: float
    rtt_s: float
    at: float = field(default_factory=time.time)


@dataclass
class DeviceClock:
    device_id: str
    samples: deque[ClockSample]
    offset_s: float = 0.0
    rtt_ms: float = 0.0
    updated_at: float = field(default_factory=time.time)
    sample_count: int = 0

    def as_dict(self) -> dict[str, float | str | int]:
        return {
            "device_id": self.device_id,
            "offset_ms": round(self.offset_s * 1000.0, 3),
            "rtt_ms": round(self.rtt_ms, 3),
            "samples": self.sample_count,
            "updated_at": self.updated_at,
        }


class ClockRegistry:
    """Tracks ``host_time - device_time`` for each capture device."""

    def __init__(self) -> None:
        self._clocks: dict[str, DeviceClock] = {}
        self._lock = threading.Lock()

    def observe(
        self, device_id: str, t1: float, t2: float, t3: float, t4: float
    ) -> DeviceClock:
        """Record one round trip.

        ``t1``/``t4`` are device-clock send/receive times, ``t2``/``t3`` are the
        host-clock receive/send times, exactly as in NTP. The offset is the
        mean of the two one-way deltas, which cancels a symmetric path delay.
        """
        offset = ((t2 - t1) + (t3 - t4)) / 2.0
        rtt = max((t4 - t1) - (t3 - t2), 0.0)

        with self._lock:
            clock = self._clocks.get(device_id)
            if clock is None:
                clock = DeviceClock(device_id=device_id, samples=deque(maxlen=SAMPLE_WINDOW))
                self._clocks[device_id] = clock
            clock.samples.append(ClockSample(offset_s=offset, rtt_s=rtt))
            clock.sample_count += 1
            clock.updated_at = time.time()
            self._recompute(clock)
            return clock

    @staticmethod
    def _recompute(clock: DeviceClock) -> None:
        """Median-of-best-half: low-RTT probes carry the least path asymmetry."""
        ordered = sorted(clock.samples, key=lambda s: s.rtt_s)
        best = ordered[: max(1, len(ordered) // 2)]
        clock.offset_s = statistics.median(s.offset_s for s in best)
        clock.rtt_ms = statistics.median(s.rtt_s for s in best) * 1000.0

    def offset(self, device_id: str) -> float | None:
        with self._lock:
            clock = self._clocks.get(device_id)
            return clock.offset_s if clock else None

    def to_host(self, device_id: str, device_timestamp: float) -> tuple[float, float | None]:
        """Convert a device-clock timestamp to host time.

        Returns ``(host_timestamp, offset_seconds)``. When the device has never
        synchronised, the timestamp is passed through untouched and the offset
        is ``None`` so callers can flag the shot as unsynchronised.
        """
        offset = self.offset(device_id)
        if offset is None:
            return device_timestamp, None
        return device_timestamp + offset, offset

    def snapshot(self) -> list[dict[str, float | str | int]]:
        with self._lock:
            return [clock.as_dict() for clock in self._clocks.values()]

    def forget(self, device_id: str) -> None:
        with self._lock:
            self._clocks.pop(device_id, None)
