# Golf Simulator — Build 1: Ingest, Sync & Pairing

Local backend that consolidates three independent capture streams into one
timestamped shot package per swing:

| Source | Device | Arrives via | Typical latency after impact |
|---|---|---|---|
| Swing video | PC + Kinovea | filesystem watcher on the export dir | 2–6 s |
| Impact video | Samsung phone | HTTP upload (`POST /api/v1/media/impact`) | 0.6–1.6 s |
| Ball/club telemetry | Square Golf LM | HTTP JSON (`POST /api/v1/telemetry`) | ~50 ms |

Build 2 (the dual-video player + telemetry HUD) consumes the packages this
service writes. Nothing in Build 2 needs to know how the data was captured —
it reads `metadata.json` and the two clips.

---

## 1. Recommended impact-camera ingest path

**Do not stream the impact camera. Ring-buffer on the phone, trigger it, and
upload the snapshot.**

### Why not RTSP / DroidCam / OBS

A live stream optimises the wrong variable. What matters at impact is
*temporal resolution*, and a preview stream has none to spare:

| Capture rate | Ball travel per frame (118 mph) | Usable impact frames |
|---|---|---|
| 30 fps (typical DroidCam) | 1.76 m | 0 |
| 60 fps (best case RTSP) | 0.88 m | 0 |
| 240 fps (Camera2 high-speed) | 0.22 m | 1–2 |
| 960 fps (Samsung Super Slow-mo) | 0.055 m | 6–8 |

Ball–club contact lasts roughly 450 µs. At 30–60 fps the ball is simply gone
between one frame and the next. On top of that, DroidCam/OBS re-encode on the
phone with 150–400 ms of variable latency and no frame-accurate capture
timestamps, and you would be spending the whole wireless budget streaming
continuously to keep ~2 useful seconds per shot.

Keep DroidCam/OBS if you like — but only as an *aiming preview* while you
position the phone. It is not the ingest path.

### The architecture that works

1. **Ring buffer.** The phone records continuously into a 3–5 s in-memory ring
   buffer using a `CameraConstrainedHighSpeedCaptureSession` (query
   `CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES` /
   `getHighSpeedVideoFpsRanges()`; Samsung flagships expose 1080p@240).
2. **Trigger.** A message says *"snapshot `[t−1.0 s, t+1.0 s]`"*. The frames are
   **already captured**, so trigger latency does not affect what you record — it
   only has to arrive before the buffer wraps. This single decision moves
   latency out of the capture path entirely, and it is why streaming buys you
   nothing here.
3. **Upload.** Mux the snapshot and `POST` it. A 2 s 1080p240 H.264 clip at
   ~25 Mbps is ~6 MB.
4. **Timestamp.** The upload carries the phone's capture time, corrected to
   host time by the offset measured over the persistent control WebSocket.

### Latency budget (USB tethering)

| Stage | Time |
|---|---|
| Trigger PC → phone | 1–3 ms |
| Ring-buffer snapshot | **0 ms** (already captured) |
| Mux to MP4 | 200–600 ms |
| Upload 6 MB over USB | 300–800 ms |
| Server hash + package write | 50–150 ms |
| **Clip on disk** | **0.6–1.6 s** |
| **Shot package opened** | **~50 ms** — telemetry anchors it long before the video lands |

That last row is the point: the correlator opens the shot on the *telemetry*,
and the clip attaches to it when it arrives. No part of the UI waits on the
upload.

### Transport

Use **USB tethering (RNDIS)** or, better, `adb reverse tcp:8000 tcp:8000` — the
phone then posts to `http://127.0.0.1:8000` and adb forwards it over the cable.
No Wi-Fi, no IP configuration, no firewall rule, sub-millisecond RTT (measured
0.7 ms in the mock harness). If you must go wireless, use 5 GHz with both
devices on the same AP; expect 1–3 s uploads and jittery clock sync.

### Trigger source, best to worst

1. **PC-side broadcast** (`POST /api/v1/trigger`) fired by whatever detects the
   strike first — normally the launch monitor event that already triggers
   Kinovea. One trigger, all three sources agree.
2. **Phone-local audio onset.** The impact transient has a ~1 ms rise and is
   very loud, so detection runs at the audio sample rate and is intrinsically
   finer than the frame interval. But it false-triggers on practice swings,
   club drops and conversation. Run it as a *redundant* trigger tagged
   `trigger_source: "audio"`, not as the primary.
3. **Manual.** Fine for calibration, not for a session.

### If you don't want to write an Android app

Samsung's stock 960 fps Super Slow-mo is a proprietary sensor-DRAM burst. It
cannot be ring-buffered or triggered externally, and it writes to DCIM after
the fact. Fallback path: sync the DCIM folder to the PC (Syncthing, or an
`adb pull` poll) and let the backend pair on file mtime. You get 960 fps at the
cost of ±1–2 s timestamp accuracy — which is exactly why
`GOLFSIM_PAIR_WINDOW_SECONDS` defaults to 3.0 and is configurable. The backend
needs no changes: point a second watcher at the sync folder, or POST the file.

---

## 2. How pairing works

Fragments are matched on **impact timestamp**, never on arrival order or
arrival time.

```
telemetry  ──┐
impact clip ─┼──▶  ShotCorrelator  ──▶  data/shots/shot_<ts>/{metadata.json,swing.mp4,impact.mp4}
swing clip ──┘        │
                      ├─ open shot within ±3 s and still missing this artefact?  → attach
                      ├─ recently finalized shot in the same window?             → late-attach
                      └─ otherwise                                               → open a new shot
```

Rules worth knowing:

- **Telemetry wins the anchor.** The launch monitor sees the actual strike, so
  when telemetry attaches it re-anchors the shot and every offset in
  `metadata.json` is measured from it.
- **The window is anchor-relative.** A shot spans at most ±3 s around its
  anchor; it does not creep forward as each artefact attaches.
- **A shot finalises the instant it is complete**, or after `settle_seconds`
  (default 12 s) as `status: "partial"`. Partial shots are still written — a
  missing clip never costs you the telemetry.
- **Stragglers are late-attached.** An upload that arrives after finalisation
  is moved into the existing package and the metadata is rewritten, for up to
  `late_attach_seconds` (default 90 s). No duplicate directory.
- **Duplicate artefacts open a second shot.** Two swings inside the pairing
  window become two packages rather than one with a clobbered clip.
- **Clock skew is corrected, not assumed away.** Device timestamps are
  converted to host time with an NTP-style offset (median of the lowest-RTT
  probes) measured over `/ws/control`. The mock harness recovers a deliberate
  4.2 s phone skew to within 0.06 ms.

---

## 3. Directory structure

```
golf-sim/
├── README.md
├── requirements.txt              runtime deps
├── requirements-dev.txt          + test/mock deps
├── .env.example                  every tunable, documented
├── pytest.ini
├── backend/
│   ├── main.py                   FastAPI app, lifespan, wiring
│   ├── config.py                 pydantic-settings (GOLFSIM_* env vars)
│   ├── models.py                 wire schemas + metric normalisation
│   ├── correlator.py             the pairing engine
│   ├── storage.py                shot package writer, ffprobe, hashing
│   ├── watcher.py                watchdog observer for Kinovea's export dir
│   ├── clock.py                  NTP-style per-device clock offsets
│   ├── events.py                 in-process pub/sub for the live feed
│   ├── deps.py                   FastAPI dependencies
│   └── routers/
│       ├── telemetry.py          POST /api/v1/telemetry
│       ├── media.py              POST /api/v1/media/{impact,swing}, /trigger
│       ├── shots.py              GET  /api/v1/shots…, /status
│       └── ws.py                 /ws/control (devices), /ws/events (dashboard)
├── scripts/
│   ├── _fixtures.py              synthetic clips + plausible telemetry
│   ├── mock_kinovea.py           writes clips into the export dir, incrementally
│   ├── mock_lm.py                posts Square-style telemetry
│   ├── mock_phone.py             WS clock sync, ring buffer, skewed clock, upload
│   └── simulate_session.py       full range session + pairing report (--check)
├── tests/
│   ├── test_correlator.py        pairing engine, no network
│   └── test_ingest_api.py        end-to-end over real HTTP/WebSocket
└── data/                         created at runtime, git-ignored
    ├── kinovea_export/           watched directory
    ├── staging/                  uploads land here until a shot finalises
    └── shots/
        └── shot_20260906T001603_214Z/
            ├── metadata.json
            ├── swing.mp4
            └── impact.mp4
```

---

## 4. Setup

```bash
cd golf-sim
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

cp .env.example .env               # then edit GOLFSIM_KINOVEA_EXPORT_DIR
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Interactive API docs: <http://127.0.0.1:8000/docs>.
Live operational view: <http://127.0.0.1:8000/api/v1/status>.

`ffmpeg`/`ffprobe` are **optional**. With them, clips get `fps`/`duration`/
resolution recorded in `metadata.json` and the mock scripts generate real
playable video; without them everything still works, the packages just carry
less video detail.

### Per-device configuration

**Kinovea** — set the capture export folder to `GOLFSIM_KINOVEA_EXPORT_DIR`.
Keep Kinovea's delayed-capture buffer on so the clip contains the backswing,
and note the pre-roll: it goes in `GOLFSIM_KINOVEA_IMPACT_OFFSET_SECONDS`.

**Square Golf** — point your bridge at `POST /api/v1/telemetry`. Key spellings
do not need to match: `BallSpeed`, `ball_speed`, `ballSpeedMph` all normalise
to `ball_speed_mph`, and the untouched payload is kept under
`sources.telemetry.raw`. See `METRIC_ALIASES` in `backend/models.py`; add a
spelling there if your bridge emits something unlisted. `smash_factor` and
`face_to_path_deg` are derived when absent.

**Phone** — `adb reverse tcp:8000 tcp:8000`, then hold a WebSocket open to
`ws://127.0.0.1:8000/ws/control?device_id=galaxy-impact`, run the clock-sync
handshake, and `POST` snapshots to `/api/v1/media/impact`. `scripts/mock_phone.py`
is a complete, working reference implementation of that client.

### Calibration

The one number worth measuring is **`GOLFSIM_KINOVEA_WRITE_LAG_SECONDS`**:
Kinovea's file mtime is when it *finished* encoding, several seconds after the
strike.

1. Run the backend and hit one shot with everything live.
2. Open the resulting `metadata.json` and read
   `pairing.offsets_s.swing_video` — that is your lag in seconds.
3. Put that value in `.env` and restart. The offset should now sit near zero.

Three derivation modes are available via `GOLFSIM_KINOVEA_TIMESTAMP_MODE`:

| Mode | Impact time estimated as | Use when |
|---|---|---|
| `mtime` (default) | `mtime − write_lag` | Simple; one calibration constant |
| `filename` | parsed filename + `impact_offset` | Kinovea names files with a timestamp pattern |
| `mtime_minus_duration` | `mtime − write_lag − duration + impact_offset` | Clip length varies shot to shot (needs ffprobe) |

`GOLFSIM_KINOVEA_IMPACT_OFFSET_SECONDS` (and the phone's `pre_roll_s`) are also
written into `metadata.json` as `impact_offset_s` per video — that is what lets
Build 2 align the two players on the *impact frame* rather than on file start.

---

## 5. API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/telemetry` | Square LM shot metrics |
| `POST` | `/api/v1/media/impact` | Impact-cam clip (multipart) |
| `POST` | `/api/v1/media/swing` | Swing clip, for hosts the watcher can't reach |
| `POST` | `/api/v1/trigger` | Broadcast "snapshot your ring buffer" to all devices |
| `GET` | `/api/v1/shots` | List packages (`limit`, `offset`, `status`) |
| `GET` | `/api/v1/shots/{id}` | Full `metadata.json` |
| `GET` | `/api/v1/shots/{id}/media/{file}` | Clip, with HTTP range support for scrubbing |
| `GET` | `/api/v1/status` | Open shots, device clocks, active config |
| `GET` | `/health` | Liveness |
| `WS` | `/ws/control?device_id=…` | Capture devices: clock sync + trigger fan-out |
| `WS` | `/ws/events?replay=N` | Live shot lifecycle feed (Build 2's data source) |

Set `GOLFSIM_INGEST_TOKEN` to require an `X-Golfsim-Token` header on the ingest
endpoints. Leave it empty on a trusted LAN.

### Clock sync handshake (`/ws/control`)

```
phone → {"type":"ping",     "t1": <device clock>}
host  → {"type":"pong",     "t1":…, "t2": <host recv>, "t3": <host send>}
phone → {"type":"sync_ack", "t1":…, "t2":…, "t3":…, "t4": <device clock>}
host  → {"type":"clock",    "offset_ms":…, "rtt_ms":…, "samples":…}
```

`offset = ((t2−t1) + (t3−t4)) / 2`, as in NTP. Repeat ~8 times on connect and
every few minutes after. The server keeps the median of the lowest-RTT half.

Server-initiated:

```
host  → {"type":"capture_trigger", "trigger_id":…, "host_timestamp":…, "source":…}
```

---

## 6. Testing without hitting balls

Unit + end-to-end suite (no server needed, no ffmpeg needed):

```bash
pytest -q            # 15 tests: pairing rules, clock correction, HTTP, WebSocket
```

Full session simulation against a running backend:

```bash
uvicorn backend.main:app --port 8000                      # terminal 1
python scripts/simulate_session.py --shots 3 --check      # terminal 2
```

It fires all three sources per shot with realistic, deliberately out-of-order
latencies, then verifies that each simulated swing produced exactly one
complete package:

```
--- shot 1/3  7i  impact=1788653743.981
    telemetry  + 0.12s  -> opened
    impact     + 1.41s  262144 bytes
    swing      + 1.61s  written to export dir
...
shot_id                      status    club    sources (offset from anchor)
shot_20260906T001603_214Z    complete  5i      impact_video, swing_video, telemetry
shot_20260906T001553_595Z    complete  5i      impact_video, swing_video, telemetry
shot_20260906T001543_980Z    complete  7i      impact_video, swing_video, telemetry
complete: 3/3   simulated: 3

OK: every simulated shot produced exactly one complete package.
```

`--check` exits non-zero if the correlator over- or under-split, which makes it
usable as a regression gate.

Individual mocks, for exercising one path at a time:

```bash
python scripts/mock_lm.py --club Driver --count 3      # telemetry only
python scripts/mock_kinovea.py --count 2               # swing clips only
python scripts/mock_kinovea.py --temp-name             # rename-on-close path
python scripts/mock_phone.py                           # wait for triggers
python scripts/mock_phone.py --self-trigger 3          # audio-triggered shots
python scripts/mock_phone.py --clock-skew 4.2          # prove skew correction
curl -X POST localhost:8000/api/v1/trigger -H 'content-type: application/json' \
     -d '{"source":"launch_monitor"}'
```

`mock_kinovea.py` writes each file **incrementally**, so the watcher's
write-completion detection is genuinely exercised — a naive watcher ingests a
truncated file here.

---

## 7. `metadata.json` — the Build 2 contract

```jsonc
{
  "schema_version": "1.0.0",
  "shot_id": "shot_20260906T001603_214Z",
  "status": "complete",                  // or "partial"
  "club": "5i",
  "session_id": "mock-session",
  "anchor": { "timestamp": 1788653763.214457, "iso": "…", "source": "telemetry" },
  "pairing": {
    "window_seconds": 3.0,
    "offsets_s": { "telemetry": 0.0, "impact_video": 0.0, "swing_video": 1.44 }
  },
  "present_sources": ["impact_video", "swing_video", "telemetry"],
  "missing_sources": [],
  "sources": {
    "swing_video": {
      "present": true,
      "file": "swing.mp4",               // relative to the shot directory
      "bytes": 262144,
      "sha256": "35363df8…",
      "offset_s": 1.44,                  // this clip's impact vs. the anchor
      "impact_offset_s": 0.0,            // where impact sits *inside* this clip
      "origin": { "kind": "kinovea", "original_filename": "…", "timestamp_source": "mtime" },
      "video": { "width": 1280, "height": 720, "fps": 120.0, "duration_s": 2.0 }
    },
    "impact_video": {
      "present": true,
      "file": "impact.mp4",
      "impact_offset_s": 0.75,
      "fps_hint": 240.0,
      "clock_offset_ms": -4199.9,        // correction applied to the phone clock
      "clock_synced": true,              // false ⇒ pairing trusted an unsynced clock
      "origin": { "kind": "impact_cam", "device_id": "galaxy-impact", "trigger_source": "audio" }
    },
    "telemetry": {
      "present": true,
      "metrics": { "ball_speed_mph": 123.49, "club_speed_mph": 86.45,
                   "launch_angle_deg": 14.76, "back_spin_rpm": 5271.0,
                   "club_path_deg": -1.02, "face_angle_deg": 0.34,
                   "smash_factor": 1.428, "face_to_path_deg": 1.36 },
      "raw": { "BallSpeed": 123.49, "clubHeadSpeed": 86.45 }   // vendor payload, verbatim
    }
  }
}
```

Notes for Build 2:

- **To align the two players on impact**, seek each video to its own
  `impact_offset_s`, then apply the residual `offset_s` difference. Do not
  align on file start.
- `sources.<kind>.present` is always there; check it before reading `file`.
  A `partial` package is normal and should render with the sources it has.
- `video.fps` is present only when ffprobe was available. Fall back to
  `fps_hint` for the impact clip.
- `clock_synced: false` means the timestamp came from an unsynchronised device
  clock — worth a subtle warning badge in the HUD.
- Clips are served with HTTP range support, so the scrubber can seek without
  downloading the whole file.

---

## 8. Known limits (deliberate, for Build 2 or later)

- **In-memory correlator state.** Shots open at the moment of a crash are not
  recovered on restart; artefacts already staged are re-paired only if
  resubmitted. Fine for a range session, worth a small WAL if it ever annoys you.
- **`iter_shots` reads the directory on every list call.** At a few thousand
  shots that becomes noticeable; a SQLite index over `metadata.json` is the
  obvious next step.
- **Single-machine.** Everything assumes one host, one filesystem.
