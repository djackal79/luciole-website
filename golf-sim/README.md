# Golf Simulator — Build 1: Ingest, Pairing & Telemetry

Local backend that consolidates three independent capture streams into one
shot package per swing. Build 2 (the dual-video player + telemetry HUD) reads
those packages and nothing else.

| Document | For |
|---|---|
| [`CONTRACT.md`](CONTRACT.md) | The Build 1 ↔ Build 2 schema contract. The authority for both builds. |
| [`DEPLOY.md`](DEPLOY.md) | Getting this onto the golf sim PC, LAN access, remote access |
| [`HANDOVER.md`](HANDOVER.md) | Build 2 brief: scope, traps, fixtures, definition of done |
| [`android/impact-watcher/`](android/impact-watcher/README.md) | S23 app: stock camera → impact clip upload |

This implements the **Build 1 ↔ Build 2 Contract** verbatim. Where the
original Build 1 prompt disagreed with the contract, the contract won:

| Original prompt | Contract, as built |
|---|---|
| `metadata.json` with a bespoke schema | contract schema v1.0, telemetry nested inside it |
| Square LM over `POST /api/v1/telemetry` | GSPro Open Connect v1 socket on 127.0.0.1:921 |
| `swing.mp4` / `impact.mp4` | `body_swing.mp4` / `impact_strike.mp4` |
| watchdog on Kinovea's export dir | Kinovea Automation hook; watcher is fallback only |
| pair on device-supplied timestamps | PC stamps on receipt; device time is an ordering hint |
| finalize on completion | emit on first source, update as the rest arrives |

---

## Quick start

```bash
cd golf-sim
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

cp .env.example .env
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Interactive API docs at <http://127.0.0.1:8000/docs>, listener status at
<http://127.0.0.1:8000/api/health>.

`ffmpeg`/`ffprobe` are optional. With them, `duration_ms`/`width`/`height` are
filled in when a client doesn't supply them, and the mock scripts generate real
playable video. Without them everything still works.

---

## Telemetry: the GSPro Open Connect route

Square has no public API. The working route is GSPro Open Connect v1: a plain
TCP socket on `127.0.0.1:921`, no authentication, where the **launch monitor is
the client** and pushes shot JSON. This backend impersonates GSPro — accepts
the connection, parses the shot, and replies with the acknowledgement the
protocol expects.

GSPro also binds 921, so both cannot run at once. That is a mode switch, not a
bug:

```bash
# Practice: Square points at this backend (default)
curl -X POST 'localhost:8000/api/listeners/gspro?enabled=true'

# Course play: release the port, GSPro takes it. The service stays up.
curl -X POST 'localhost:8000/api/listeners/gspro?enabled=false'
```

Failing to bind at startup is logged and survivable, not fatal — `/api/health`
reports `gspro_socket.live: false` with the reason in `last_error`.

### Field mapping

| GSPro field | Schema path |
|---|---|
| `BallData.Speed` | `telemetry.ball.speed_mph` |
| `BallData.TotalSpin` | `telemetry.ball.total_spin_rpm` |
| `BallData.BackSpin` | `telemetry.ball.back_spin_rpm` |
| `BallData.SideSpin` | `telemetry.ball.side_spin_rpm` |
| `BallData.SpinAxis` | `telemetry.ball.spin_axis_deg` |
| `BallData.VLA` | `telemetry.ball.launch_angle_deg` |
| `BallData.HLA` | `telemetry.ball.launch_direction_deg` |
| `ClubData.Speed` | `telemetry.club.speed_mph` |
| `ClubData.AngleOfAttack` | `telemetry.club.angle_of_attack_deg` |
| `ClubData.Path` | `telemetry.club.path_deg` |
| `ClubData.FaceToTarget` | `telemetry.club.face_to_target_deg` |
| `ClubData.Loft` | `telemetry.club.loft_deg` |
| `ClubData.ClosureRate` | `telemetry.club.closure_rate_dps` |

Derived by the backend so the frontend never does arithmetic on nullable
fields: `smash_factor = ball.speed_mph / club.speed_mph` (null without club
data), `face_to_path_deg = face_to_target_deg − path_deg`.

`ShotDataOptions.ContainsClubData` decides whether club fields are real — a
genuine `Path: 0.0` is an ordinary swing, so zero-checking would be wrong.

Protocol details handled: heartbeats (`IsHeartBeat`) are acknowledged without
creating a shot; status frames without ball data likewise; the read buffer is
drained with `raw_decode` rather than split on newlines, because monitors send
frames back to back in one packet and split single frames across packets. Club
selection is pushed to the monitor as a **201 Player** message via
`POST /api/session {"club": "7I"}`, and stamped onto subsequent shots.

**Carry and total distance will be null.** GSPro Open Connect carries launch
conditions only; carry and total are computed by GSPro's physics engine, not
measured by the monitor. Design those two HUD tiles to degrade to an em-dash.
(If a monitor does volunteer `CarryDistance` in yards, it is converted to
metres — the one unit conversion the schema requires on write, since canonical
distance is metres.)

---

## Pairing

**The PC is the clock authority.** Every artefact is stamped on receipt. A
device-supplied `trigger_ts` is kept as an ordering hint and never decides a
pairing, because the phone's wall clock drifts.

Pairing is on the **trigger event**, not absolute wall-clock time: both cameras
fire from the same physical strike, so an artefact joins the *nearest open shot
still missing that source*. The ±3000 ms window guards against pairing across
two different strikes; it is not the primary matching mechanism.

```
telemetry    ──┐
impact clip  ──┼──▶ correlator ──▶ data/shots/shot_<shot_id>/{metadata.json, *.mp4}
body swing   ──┘        │
                        ├─ open shot in window, missing this source? → attach
                        ├─ recently closed shot, missing it?         → late-attach
                        └─ otherwise                                 → new shot
```

- **A shot is emitted as soon as anything lands.** `shot.created` fires with
  `status: pending`, and `metadata.json` is on disk immediately. The frontend
  shows the shot rather than waiting for the window to close.
- **Duplicate sources open a second shot**, so two swings inside the window
  become two packages rather than one with a clobbered clip.
- **Window expiry emits `shot.completed` with `status: partial`.** A shot that
  never completes is worse than one that is honest about what's missing.
- **`club_used` is session state**, stamped on every new shot whichever source
  opened it — so a video-only shot is still labelled.

### One addition beyond the contract

`GOLFSIM_LATE_ATTACH_MS` (default 5000) lets a straggler join a shot that
already closed, instead of opening a phantom shot that can only ever be
partial. It emits `shot.updated` (or `shot.completed` if it completes the set)
and never changes an existing pairing — the source was missing by definition.
Set it to `0` for strict window behaviour. It matters mostly for the fallback
watcher, whose receipts are inherently late.

---

## Camera setup

### Kinovea → `POST /api/ingest/body_swing`

Kinovea's **Automation** tab (Options → Preferences → Capture → Automation)
runs a command after each recording and hands over the filename. Use that
rather than a filesystem watcher: fewer moving parts, lower latency, and no
polling race where a file is read mid-write.

```
curl -X POST http://127.0.0.1:8000/api/ingest/body_swing ^
  -F "path=%1" -F "capture_fps=30" -F "container_fps=30" -F "camera=face_on"
```

Kinovea runs on the same PC, so the hook hands over a **local path** rather
than pushing 100 MB through localhost HTTP. The file is *copied* into the shot
folder, so Kinovea's own recording stays where it left it. (Uploading a `file`
is also accepted, for hosts where the path isn't reachable — a VM or WSL
boundary.)

The fallback watcher (`GOLFSIM_KINOVEA_WATCH_ENABLED=true`) exists only for
clips that appear without a notification. It polls for size stability before
ingesting, because watchdog fires while the encoder is still writing. Its
receipts are late by the encode time, so calibrate `GOLFSIM_KINOVEA_LAG_MS`:
hit one shot, check whether the body swing paired, and raise the value until it
does.

### Phone → `POST /api/ingest/impact`

Multipart: `file`, plus `trigger_ts`, `capture_fps`, `container_fps`, and
optionally `camera`, `duration_ms`, `width`, `height`.

Record continuously into a **ring buffer** and snapshot on trigger rather than
streaming. The frames are already captured, so trigger latency never affects
what you record — it only has to beat the buffer wrap. A live RTSP/DroidCam
preview is the wrong tool for impact: contact lasts ~450 µs and at 30 fps the
ball moves 1.76 m between frames. Use `CameraConstrainedHighSpeedCaptureSession`
(1080p@240 on Samsung flagships) and `adb reverse tcp:8000 tcp:8000` so the
phone posts to `127.0.0.1:8000` over USB.

**`capture_fps` must be supplied by the client** — it cannot be probed. The
phone writes 240 fps footage into a 30 fps container, so ffprobe reports 30.

---

## `capture_fps` vs `container_fps`

Not redundant, and the single easiest thing to get wrong:

- **`container_fps` drives frame stepping.** It is the playback rate.
- **`capture_fps` drives any duration or speed readout.** It is real time.

Confusing them makes every time measurement wrong by 8× — the same trap as
Kinovea's video timing setting.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/shots` | List, newest first. Query: `session_id`, `limit`, `since` |
| `GET` | `/api/shots/{id}` | One full metadata object |
| `PATCH` | `/api/shots/{id}` | `tags`, `notes`, `club_used`, `impact_offset_ms` only |
| `POST` | `/api/ingest/impact` | Multipart from the phone |
| `POST` | `/api/ingest/body_swing` | Kinovea Automation hook (`path`) or upload (`file`) |
| `GET` | `/shots/{folder}/{file}` | Static media, **range requests supported** |
| `GET` | `/api/health` | Which listeners are live |
| `POST` | `/api/session` | New session (+ optional club). Emits `session.reset` |
| `POST` | `/api/listeners/gspro?enabled=` | Start/stop the socket without a restart |
| `WS` | `/ws/shots` | Live feed. `?replay=N` re-sends the last N events |

`PATCH` rejects anything outside its four fields with a 422 rather than
silently ignoring it. Range support is verified by test: without it the
frontend's scrubber and frame stepping cannot work, because the browser can't
seek a video it has to download linearly.

The last two rows are additions the contract implies but does not list: it
specifies a `session.reset` event and a mode switch on port 921, both of which
need something to trigger them. Set `GOLFSIM_INGEST_TOKEN` to require an
`X-Golfsim-Token` header on the ingest endpoints.

### WebSocket events

| Type | When |
|---|---|
| `shot.created` | First source for a new shot. `status: pending` |
| `shot.updated` | A further source paired in |
| `shot.completed` | All sources present, or the window expired |
| `shot.patched` | Tags, notes, club or `impact_offset_ms` changed |
| `session.reset` | New session; clear the history drawer |

Every envelope is `{type, ts, shot_id, payload}` and every payload is the
**complete metadata object**, never a diff. `session.reset` carries
`{"session_id": ...}` and a null `shot_id`.

---

## Mock data

Five scenarios, in the exact schema, so the frontend is not only ever tested on
the happy path:

| # | Status | What it exercises |
|---|---|---|
| 1 | complete | All three sources, full ball + club data |
| 2 | partial | Telemetry + body swing, phone missed the impact clip |
| 3 | partial | Both videos, LM not connected (`telemetry: null`) |
| 4 | complete | Ball data only, `ContainsClubData` false → `smash_factor` null |
| 5 | complete | Heavy draw: spin axis −16.7°, face-to-path −6.0° |

`mocks/shots.json` is checked in — import it directly, no backend needed.
Timestamps are fixed, so the fixtures don't churn; scenario 1 carries the
contract document's own example `shot_id`.

```bash
python scripts/mock_provider.py --print          # JSON array on stdout
python scripts/mock_provider.py --seed data/shots  # into a live data dir, with media
```

Run it with ffmpeg installed to get playable clips rather than stub files.

### Live simulation

```bash
uvicorn backend.main:app --port 8000                    # terminal 1
python scripts/simulate_session.py --shots 3 --check    # terminal 2
```

Fires all three sources per shot with realistic, out-of-order latencies —
telemetry over the real GSPro socket, both clips over HTTP — and verifies the
pairing:

```
--- shot 1/2  5I
    telemetry   + 0.05s  ball=123.5mph  ack=200
    body_swing  + 1.29s  -> 20260906T010033-961
    impact      + 1.63s  -> 20260906T010033-961

shot_id                  status    club   sources
20260906T010042-640      complete  7I     body_swing, impact_strike, telemetry
20260906T010033-961      complete  7I     body_swing, impact_strike, telemetry

OK: every simulated shot produced exactly one fully paired package.
```

`--check` exits non-zero if the correlator over- or under-split, so it works as
a regression gate.

Individual mocks:

```bash
python scripts/mock_lm.py --club 7I --count 3     # GSPro socket client
python scripts/mock_lm.py --no-club-data          # smash_factor becomes null
python scripts/mock_lm.py --heartbeat             # must not create a shot
python scripts/mock_kinovea.py                    # Automation hook path
python scripts/mock_kinovea.py --watcher          # fallback watcher path
python scripts/mock_phone.py --clock-skew 4.2     # skewed clock must not split shots
```

### Tests

```bash
pytest -q      # 54 tests
```

- `test_schema.py` — asserts the metadata shape literally: key order, ISO-8601
  offsets, omitted media keys, the contract's own worked example
  (132.4 / 92.1 → smash 1.44, face-to-path −3.5), GSPro mapping.
- `test_correlator.py` — pairing, window expiry, late attach, duplicate
  sources, skewed device clocks, patch persistence, session reset.
- `test_gspro.py` — the socket protocol: acks, heartbeats, frames split across
  packets and concatenated in one, 201 club push, port release, bind conflict.
- `test_api.py` — every endpoint, including range requests and traversal.

---

## Directory structure

```
golf-sim/
├── README.md
├── requirements.txt / requirements-dev.txt
├── .env.example                  every tunable, documented
├── backend/
│   ├── main.py                   FastAPI app, lifespan, wiring
│   ├── config.py                 pydantic-settings (GOLFSIM_*)
│   ├── models.py                 the contract schema + GSPro mapping
│   ├── correlator.py             pairing engine
│   ├── gspro.py                  GSPro Open Connect v1 socket listener
│   ├── storage.py                package writer, atomic metadata, ffprobe
│   ├── watcher.py                Kinovea fallback watcher
│   ├── events.py                 pub/sub behind /ws/shots
│   ├── deps.py
│   └── routers/
│       ├── ingest.py             /api/ingest/{impact,body_swing}
│       ├── shots.py              /api/shots…, /shots/{folder}/{file}
│       ├── system.py             /api/health, /api/session, /api/listeners
│       └── ws.py                 /ws/shots
├── scripts/
│   ├── mock_provider.py          the five contract scenarios
│   ├── mock_lm.py                GSPro socket client
│   ├── mock_kinovea.py           Automation hook + watcher paths
│   ├── mock_phone.py             ring buffer, skewed clock, upload
│   └── simulate_session.py       full session + pairing report
├── mocks/                        checked-in fixtures for Build 2
└── data/                         runtime, git-ignored
    └── shots/shot_20260906T143052-478/
        ├── metadata.json
        ├── body_swing.mp4
        └── impact_strike.mp4
```

---

## Notes for Build 2

- **Align the players on impact**, not on file start: seek each video by
  `sync.impact_offset_ms` (positive = impact video lags body swing). The
  calibration slider writes it back with `PATCH`, so it survives reload.
- **Check `sources.*` before reading `media.*`.** An absent source omits its
  media key entirely; a `partial` package is normal and must render with what
  it has, including telemetry-only and video-only.
- `telemetry` is `null` when absent, rather than an empty object.
- `duration_ms`/`width`/`height` can be `null` when neither the client supplied
  them nor ffprobe was available. `capture_fps`/`container_fps` are always set
  in practice, defaulting from config.
- Media URLs are `/shots/shot_{shot_id}/{path}`.
- `raw` holds the unmodified provider payload — reach into it for a field the
  mapping doesn't cover rather than waiting on a schema change.

## Known limits

- **Correlator state is in memory.** Shots open at the moment of a crash are
  not reconciled on restart; `metadata.json` is already on disk for each, so
  nothing is lost, but they stay `pending`.
- **`GET /api/shots` reads the directory on every call.** At a few thousand
  shots, add a SQLite index over `metadata.json`.
- **Port 921 is privileged on Linux/macOS.** Not an issue on Windows, where
  this is meant to run; elsewhere use `GOLFSIM_GSPRO_PORT` or a capability.
