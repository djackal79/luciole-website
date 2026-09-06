# Golf Sim App · Build 1 ↔ Build 2 Contract

**Schema v1.2.** Additive over v1.0 — nothing has been removed or renamed. See §v1.1 and §v1.2 at the end.

**The single source of truth for both builds.** Backend writes exactly this;
frontend reads exactly this. Give this document to both agents verbatim —
where it disagrees with either original prompt, this wins.

---

## Naming — settle this first

Build 1's prompt said `metadata.json`, Build 2's said `metrics.json`. **The
file is `metadata.json`** and it contains telemetry inside it. There is no
separate metrics file.

## Directory layout

```
shots/
  shot_20260906T143052-478/
    metadata.json
    body_swing.mp4        # Kinovea, may be absent
    impact_strike.mp4     # phone high-speed, may be absent
```

`shot_id` is the folder name minus the `shot_` prefix: compact UTC-offset local
time to millisecond precision, lexically sortable.

## metadata.json

```json
{
  "schema_version": "1.0",
  "shot_id": "20260906T143052-478",
  "session_id": "20260906-morning",
  "created_at": "2026-09-06T14:30:52.478+10:00",
  "status": "complete",
  "sources": {
    "body_swing": true,
    "impact_strike": true,
    "telemetry": true
  },
  "media": {
    "body_swing": {
      "path": "body_swing.mp4",
      "camera": "face_on",
      "capture_fps": 30,
      "container_fps": 30,
      "duration_ms": 4000,
      "width": 1280,
      "height": 720
    },
    "impact_strike": {
      "path": "impact_strike.mp4",
      "camera": "impact",
      "capture_fps": 240,
      "container_fps": 30,
      "duration_ms": 1500,
      "width": 1920,
      "height": 1080
    }
  },
  "sync": {
    "trigger_ts": "2026-09-06T14:30:52.478+10:00",
    "impact_offset_ms": 0
  },
  "telemetry": {
    "source": "gspro_connect_v1",
    "received_at": "2026-09-06T14:30:53.102+10:00",
    "ball": {
      "speed_mph": 132.4,
      "total_spin_rpm": 6200,
      "back_spin_rpm": 6100,
      "side_spin_rpm": -900,
      "spin_axis_deg": -8.3,
      "launch_angle_deg": 17.2,
      "launch_direction_deg": 1.4
    },
    "club": {
      "speed_mph": 92.1,
      "angle_of_attack_deg": -3.1,
      "path_deg": 2.4,
      "face_to_target_deg": -1.1,
      "loft_deg": 24.6,
      "closure_rate_dps": null
    },
    "derived": {
      "smash_factor": 1.44,
      "face_to_path_deg": -3.5
    },
    "distance": {
      "carry_m": null,
      "total_m": null
    },
    "raw": {}
  },
  "club_used": null,
  "tags": [],
  "notes": ""
}
```

**Carry and total distance will be null.** GSPro Open Connect carries launch
conditions only — carry and total are computed by GSPro's physics engine, not
measured by the launch monitor. If the frontend needs distance, it either
renders an em-dash, or you add a ballistics model later. Build 2's original
prompt asked for both as if they'd arrive; they won't on this path. Design the
HUD so those two tiles degrade gracefully.

**`capture_fps` vs `container_fps` is not redundant.** The phone writes 240 fps
footage into a normal-rate container, so `container_fps` drives playback and
`capture_fps` drives real time. Frame stepping must use `container_fps`; any
duration or speed readout must use `capture_fps`. Getting these confused makes
every time measurement wrong by 8× — the same trap as Kinovea's video timing
setting.

## Field rules

| Field | Rule |
|---|---|
| `status` | `pending` (awaiting more sources), `complete` (all three present), `partial` (pairing window expired, some missing) |
| `sources.*` | Booleans. Frontend must render a usable view with any combination, including telemetry-only or video-only. |
| `media.*` | Omit the key entirely if that source is absent. Never emit a media entry with a path that isn't on disk. |
| `path` | Relative to the shot folder. Frontend builds the URL as `/shots/shot_{shot_id}/{path}`. |
| `impact_offset_ms` | Frontend's calibration slider writes here via PATCH so it survives reload. Positive = impact video lags body swing. |
| `club_used` | Nullable string. GSPro's 201 response carries club selection when available; otherwise user-set from the UI. |
| `tags` | Free strings. UI offers "Good Strike", "Pushed", "Shank", "Fat", "Thin"; the schema doesn't constrain them. |
| `raw` | The unmodified GSPro Connect payload. Always store it — you will want a field you didn't map. |

## Units — canonical, no exceptions

Speeds mph, angles degrees, spin rpm, distances metres, durations milliseconds,
timestamps ISO 8601 with offset. GSPro emits mph and the schema keeps it; the
frontend converts for display and owns the m/yds toggle. **Never convert on
write.**

## Telemetry source

Square has no public API. The working route is **GSPro Open Connect v1** — a
plain socket server on `127.0.0.1:921`, no authentication, where the launch
monitor connects as the client and pushes shot JSON. The backend impersonates
GSPro: accept the connection, parse the shot, reply with the acknowledgement
the protocol expects.

GSPro also binds 921, so both can't run at once. That's a mode switch, not a
bug: practice sessions point Square at this backend, course play points it at
GSPro. Worth building the backend so the listener can be stopped without
killing the service.

### GSPro Connect → schema mapping

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

Derived, computed by the backend so the frontend never does arithmetic on
nullable fields: `smash_factor = ball.speed_mph / club.speed_mph` (null if club
data absent), `face_to_path_deg = face_to_target_deg − path_deg`.
`ShotDataOptions.ContainsClubData` tells you whether club fields are real or
absent — honour it rather than checking for zeros.

## WebSocket contract

`ws://localhost:8000/ws/shots`

Sources arrive at different times, so the backend emits a shot as soon as
anything lands and updates it as the rest arrives. The frontend shows the shot
immediately rather than waiting for the pairing window to close.

```json
{
  "type": "shot.created",
  "ts": "2026-09-06T14:30:52.512+10:00",
  "shot_id": "20260906T143052-478",
  "payload": { "/* full metadata.json object */": null }
}
```

| type | When |
|---|---|
| `shot.created` | First source for a new shot lands. `status` is `pending`. |
| `shot.updated` | A further source is paired in. Payload is the full object, not a diff. |
| `shot.completed` | All sources present, or the pairing window expired. `status` is `complete` or `partial`. |
| `shot.patched` | Tags, notes or `impact_offset_ms` changed (including by another client). |
| `session.reset` | New session started; frontend clears its history drawer. |

Every payload is the complete metadata object. **No partial diffs** — it costs a
few KB and removes a whole class of state-merge bugs.

## REST endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/shots` | List. Query: `session_id`, `limit`, `since`. Returns newest first. |
| `GET /api/shots/{id}` | One full metadata object. |
| `PATCH /api/shots/{id}` | Accepts `tags`, `notes`, `club_used`, `impact_offset_ms` only. Emits `shot.patched`. |
| `POST /api/ingest/impact` | Multipart from the phone: file plus `trigger_ts`, `capture_fps`, `container_fps`. |
| `GET /shots/{folder}/{file}` | Static media, range requests supported — required for video scrubbing. |
| `GET /api/health` | Which listeners are live: GSPro socket, Kinovea hook, phone endpoint. |

**Range request support is not optional.** Without HTTP range headers the
frontend's scrubber and frame stepping won't work — the browser can't seek a
video it has to download linearly. FastAPI's `FileResponse` handles this; a
naive streaming response does not.

## Pairing rules

**The PC is the clock authority.** Do not trust the phone's clock — it will
drift. Stamp on receipt, treat the phone's `trigger_ts` as a hint for ordering
only, and pair on the trigger event rather than absolute wall-clock time. Both
cameras fire from the same physical strike, so "nearest unmatched trigger" is
far more robust than "nearest timestamp".

Pairing window default ±3000 ms, configurable. When the window expires with
sources missing, emit `shot.completed` with status `partial` rather than
holding the shot open — a shot that never completes is worse than one that's
honest about what's missing.

**Kinovea doesn't need a filesystem watcher.** Its Automation tab (Options →
Preferences → Capture → Automation) runs a command after each recording and can
hand over the filename directly. Use that to POST to the backend instead of
watchdog — fewer moving parts, lower latency, and no polling race where you
read a file mid-write. Keep the watcher only as a fallback for files that
appear without a notification.

## Mock data

Both builds ship a mock provider using this exact schema. Include at least one
shot of each of these, or the frontend will only ever be tested on the happy
path:

1. `complete` — all three sources, full ball + club data
2. `partial` — telemetry + body swing, no impact video (phone missed it)
3. `partial` — both videos, no telemetry (LM not connected)
4. `complete` — ball data only, `ContainsClubData` false → `smash_factor` null
5. `complete` — heavy draw: negative `spin_axis`, `face_to_path` strongly negative


---

# Schema v1.1 — additions

Everything in v1.0 still holds. These are additions, and every one is
optional: a v1.0 consumer that ignores them keeps working.

## Every source key is always emitted

`sources` now always carries all six keys, so the frontend needs only a truth
check, never an existence check:

```json
"sources": {
  "body_swing": true,
  "body_swing_dtl": true,
  "impact_strike": true,
  "telemetry": true,
  "pose": false,
  "pressure": false
}
```

## `body_swing_dtl` — second Kinovea camera

Two cameras are set up: face-on and down-the-line. DTL is a full media entry
under the same rules as `body_swing`, and its file is `body_swing_dtl.mp4`.

It is **optional**: a shot without it is still `complete`. Add
`body_swing_dtl` to `GOLFSIM_EXPECTED_SOURCES` only once both cameras are
trusted to fire every time.

**Ingest routes on an explicit `source` field, not on the `camera` label.**
Both Automation hooks fire within milliseconds of each other, so without
distinct sources the correlator applies its duplicate-source rule and opens a
second shot — silently doubling every swing.

```
POST /api/ingest/body_swing
  source = body_swing | body_swing_dtl     <- routing key
  camera = face_on | dtl | <anything>      <- display label only
```

`camera` stays a free label so renaming a camera cannot misroute its clips.

## `media.*.impact_ms` — per-clip impact position

Where impact sits inside **that** clip, in file playback milliseconds — what
you would assign to `video.currentTime * 1000`.

This is what lets the player align on the strike rather than on file start,
which matters because the clips have different durations, different capture
rates and different pre-rolls.

Often `null`. Kinovea's pre-roll is configurable and knowable; the phone's
Super Slow-mo auto-trigger picks its own and does not tell us. That gap is what
`sync.impact_offset_ms` and the calibration slider close — they stay.

## `pose` — derived, not captured

Computed from the body-swing clips after the shot closes, so it arrives later
than everything else and the UI must handle `pending`.

```json
"pose": {
  "status": "ready",              // pending | ready | failed | unavailable
  "path": "pose.json",
  "model": "mediapipe_pose_lite",
  "dimensions": "2d",             // "3d" once the cameras are calibrated
  "cameras": ["body_swing"],
  "frame_count": 120,
  "error": null,
  "summary": {
    "swing_plane_deg": 62.4,
    "spine_angle_deg": 31.2,
    "shoulder_turn_deg": null,
    "pelvis_rotation_deg": null,
    "x_factor_deg": null,
    "hand_speed_mph": 21.4
  }
}
```

**The nulls are the point.** A single camera cannot recover shoulder turn,
pelvis rotation or X-factor with any honesty — those need two calibrated views
and triangulation. Swing plane and spine angle survive monocular estimation.
Render nulls as an em-dash, exactly as with carry distance.

`sources.pose` is true only when `status` is `ready`. A pending extraction is
not data the UI can draw.

## `pressure` — force / pressure plates

Hardware not yet built. The schema is reserved and fixtures ship, so the panel
can be built now; the ingest endpoint waits until the plates exist and can say
what they emit.

```json
"pressure": {
  "status": "ready",              // ready | unavailable
  "path": "pressure.json",
  "device": "custom_dual_plate",
  "sample_rate_hz": 100,
  "samples": 401,
  "impact_ms": 2450,
  "summary": {
    "peak_grf_n": 750.0,
    "trail_pct_at_impact": 45.0,
    "lead_pct_at_impact": 55.0,
    "cop_excursion_mm": 62.5
  }
}
```

## Sidecar files

Pose and pressure are time series and do not belong in `metadata.json`: pose at
30 fps over 4 s is 120 frames of 33 landmarks (~88 KB), pressure at 100 Hz is
401 samples (~42 KB). Both live beside the clips and are referenced by `path`,
served through the same media route:

```
shots/shot_20260906T143436-478/
  metadata.json
  body_swing.mp4
  body_swing_dtl.mp4
  impact_strike.mp4
  pose.json
  pressure.json
```

**Both sidecars timestamp relative to their own capture start and carry their
own `impact_ms`**, so the frontend maps either onto the master timeline the
same way:

```
t_from_impact = t_ms - impact_ms
```

`pose.json` — **keyed by camera**, because two Kinovea cameras run and the
player draws a skeleton over each view. It is also where a triangulated
`world` track will sit once the cameras are calibrated.

```json
{
  "schema_version": "1.1",
  "model": "mediapipe_pose",
  "dimensions": "2d",
  "coordinate_space": "normalised_image",
  "point_format": ["x", "y", "visibility"],
  "landmarks": ["nose", "left_eye_inner", "..."],
  "tracks": {
    "body_swing": {
      "camera": "face_on",
      "fps": 30.0,
      "width": 1280, "height": 720,
      "impact_ms": 2450,
      "frame_count": 120,
      "detection_rate": 0.98,
      "frames": [ { "t_ms": 0, "points": [[0.5, 0.2, 0.95], "..."] } ]
    },
    "body_swing_dtl": { "...": null }
  }
}
```

`detection_rate` is the fraction of sampled frames where the model found the
golfer. A few misses are normal (motion blur at impact); a low rate means the
framing is wrong, and the summary metrics are suppressed below 60%.

`landmarks` is the **MediaPipe Pose order**, and `points` indexes into it.
Use the order from the file rather than hard-coding it, or a skeleton that
works on fixtures will break on real data. 2D points are normalised image
coordinates in `[0,1]` with the origin top-left, plus a visibility score;
3D will be metres in a world frame.

`pressure.json`:

```json
{
  "schema_version": "1.0",
  "device": "custom_dual_plate",
  "sample_rate_hz": 100.0,
  "units": { "force": "N", "position": "mm", "time": "ms" },
  "impact_ms": 2450,
  "sample_count": 401,
  "samples": [
    { "t_ms": 0, "trail_pct": 52.0, "lead_pct": 48.0, "grf_n": 585.0,
      "cop": { "x_mm": -3.4, "y_mm": 0.0 } }
  ],
  "summary": { "peak_grf_n": 750.0, "...": null }
}
```

## Mock scenarios, v1.1

The contract's five keep their exact shot ids. Two more exercise v1.1:

6. `complete` — both cameras, pose `ready` (2D), pressure `ready`
7. `complete` — both cameras, pose `pending`, pressure `unavailable`

Scenario 7 exists so the biomechanics panel is built against a running
extraction from the start, rather than having that state bolted on later.

## Cloud sync

Scope is telemetry and derived metrics. **Never media** — clips stay on the sim
PC by design.

**The backend owns the write; the frontend reads.** The browser is the wrong
writer: shots would only sync while someone has the app open, and nobody is
watching a screen mid-swing.


---

# Schema v1.2 — modelled ball flight

Carry and total are **still null** in `telemetry.distance`. That has not
changed and will not: the monitor measures launch conditions, and `distance`
means measured.

What is new is `telemetry.flight`, which carries a **modelled** trajectory
computed from those launch conditions. It is deliberately a separate block, so
a model output can never be mistaken for a monitor reading.

```json
"flight": {
  "model": "drag_magnus_rk4_v1",
  "carry_m": 223.01,
  "total_m": 242.57,
  "apex_m": 29.75,
  "descent_angle_deg": 38.5,
  "offline_m": -9.01,
  "flight_time_s": 6.4,
  "conditions": { "altitude_m": 0.0, "temperature_c": 20.0 }
}
```

`flight` is `null` when the monitor reported no ball speed or no launch angle,
and when modelling is switched off (`GOLFSIM_FLIGHT_MODEL_ENABLED=false`).

## What the model is

The trajectory is integrated with RK4 at 1 ms: drag and Magnus lift both
depend on instantaneous airspeed and on spin that decays through the flight,
so there is no honest closed form. Coefficients were fitted against published
carry distances for four clubs spanning driver to wedge — within 4% on each,
2.9% RMS — and the resulting lift coefficients (0.165 at driver spin through
0.22 at wedge spin) land where measured golf ball data puts them.

`offline_m` is negative left, positive right. A negative `spin_axis_deg` is a
draw for a right-hander and produces a negative `offline_m`.

`conditions` records the air the number was produced in, so a figure can be
reproduced later. Configure with `GOLFSIM_FLIGHT_ALTITUDE_M` and
`GOLFSIM_FLIGHT_TEMPERATURE_C`.

## For the frontend

- **Label it as an estimate.** It is a model, not a measurement, and the user
  should be able to tell.
- **`total_m` is the least trustworthy number here.** Roll depends on turf,
  moisture and slope, none of which a launch monitor knows. Carry, apex and
  descent angle are on much firmer ground.
- **Do not compute ballistics client-side any more.** One implementation, in
  the backend, tested against known distances. If a number looks wrong, it is
  wrong for every consumer at once, which is the point.
- Units are canonical: metres. The frontend still owns the m/yds toggle.

---

# Schema v1.3 — calibrated cameras and 3D pose

Supersedes v1.2 where they disagree. Nothing here removes or renames a v1.2
field; the 3D block is strictly additive and the 2D path is unchanged.

`pose.json` becomes `schema_version` **1.2**. `metadata.json` keeps its shape.

## What changes for a consumer

Two things, both optional to adopt:

1. `pose.dimensions` reads `"3d"` instead of `"2d"` when the shot was
   triangulated, and `pose.summary.shoulder_turn_deg`,
   `pelvis_rotation_deg` and `x_factor_deg` carry numbers instead of `null`.
2. `pose.json` grows a sibling `world` block next to `tracks`.

`tracks` is untouched — still per-camera, still normalised image coordinates,
because a skeleton drawn over the video needs image coordinates. `world` is a
separate, additional track in metres.

```json
{
  "schema_version": "1.2",
  "dimensions": "3d",
  "tracks": { "body_swing": { ... }, "body_swing_dtl": { ... } },
  "world": {
    "coordinate_space": "world_metres",
    "origin": "calibration board's first inner corner, Z up",
    "point_format": ["x", "y", "z", "reprojection_px"],
    "t_ms_origin": "impact",
    "frame_count": 96,
    "frames": [
      { "t_ms": -1483.33, "points": [[0.121, -0.048, 1.352, 0.31], null, ...] }
    ]
  }
}
```

### Reading `world`

- **Times are already relative to impact.** Unlike `tracks`, which time from
  capture start and carry their own `impact_ms`, `world.frames[].t_ms` is
  `t_from_impact` directly. Negative is backswing. Do not subtract anything.
- **`points[i]` is `null` where the landmark could not be solved.** Either only
  one camera saw it, or the two disagreed. Draw a gap, not a guess — the array
  is always full length and index-aligned to `landmarks`.
- **The fourth number is the reprojection error in pixels**, i.e. how far apart
  the two cameras placed that point. Anything above 25 px is dropped rather
  than emitted, so what arrives is under that; a point at 15 px is still
  weaker than one at 1 px and can be drawn fainter if it helps.
- Z is up. The origin is a corner of the calibration board on the floor, so
  Z is roughly height above the mat.

## When 3D does *not* appear

`dimensions` stays `"2d"` and the three angles stay `null` whenever any of
these hold. All are normal, none are errors, and the 2D pose is unaffected:

- the rig has not been calibrated, or only one camera has been placed;
- only one body-swing clip reached the shot;
- **either clip is missing `media.*.impact_ms`.** Two capture screens start
  recording independently, so impact is the only clock the clips share.
  Guessing the offset produces a body angle tens of degrees wrong at a
  reprojection error under half a pixel — the geometry cannot detect it, so
  the backend refuses instead;
- the triangulated skeleton is not anatomically possible, which means the
  calibration scale or the time alignment is wrong.

So `impact_ms` is promoted from a nicety to **the gate on 3D**. It stays
optional in the schema and often `null` for the phone's impact clip, but the
two body-swing clips need it for the depth metrics.

## `calibration.json`

Not part of the shot package and never served to the frontend. It lives at
`GOLFSIM_POSE_CALIBRATION_PATH` (default `models/calibration.json`), is written
by `scripts/calibrate_cameras.py`, and is re-read per shot so calibrating does
not need a backend restart.

The board is a **ChArUco** board, not a plain chessboard. A plain chessboard's
corner ordering comes from how the detector walked the image and is unique only
up to the pattern's symmetry, so two cameras 90° apart can describe the same
board in world frames 180° apart — each fitting its own view perfectly while
triangulation between them returns nonsense. ArUco markers carry their own
identity, so every view agrees on the origin by construction.

---

# Schema v1.4 — saying why, and recovering from a crash

Supersedes v1.3 where they disagree. Additive: two new read-only fields and
one behaviour change on restart. Nothing is removed or renamed.

## `pose.depth_reason` — why the depth metrics are missing

Most shots will not be 3D for a while, and every reason for that is an
ordinary state rather than a fault. A panel of blank metrics cannot say which
one applies, so the backend now says it in words.

```json
"pose": {
  "status": "ready",
  "dimensions": "2d",
  "depth_reason": "no impact frame on body_swing_dtl — set IMPACT_MS in the Kinovea hook for each camera",
  "summary": { "shoulder_turn_deg": null, ... }
}
```

`null` when the three depth metrics arrived. Otherwise one of:

| Situation | Reads roughly |
|---|---|
| No calibration file | *the cameras have not been calibrated yet* |
| One camera placed | *only 1 of 2 cameras has been placed against the board* |
| One body-swing clip | *this shot has only one body-swing clip, and 3D needs both* |
| Missing impact frame | *no impact frame on `<camera>` — set IMPACT\_MS…* |
| Skeleton not anatomically possible | *shoulder width triangulates to 54 cm (expected 28-52)…* |

**`dimensions: "3d"` does not on its own mean the angles arrived.** The last
row above produces a 3D track that is still written and still worth drawing —
seeing the skeleton come out wrong is how a mis-measured board gets found —
while its derived angles are withheld. Read `depth_reason`, not `dimensions`,
to decide whether to show the numbers.

Phrase these to the user as information, not as errors. Four of the five are
just "not set up yet".

## `listeners.pose_worker.calibration` on `GET /api/health`

Whether the rig can produce 3D at all, without reading a shot.

```json
"calibration": {
  "ready": true,
  "path": "models/calibration.json",
  "calibrated_at": "2026-09-06T11:04:22+00:00",
  "board": { "squares_x": 10, "squares_y": 7, "square_mm": 150.0, ... },
  "cameras": {
    "body_swing":     { "placed": true, "lens_rms_px": 0.31, "pose_rms_px": 0.44,
                        "position_m": [0.02, -3.48, 1.41] },
    "body_swing_dtl": { "placed": true, "lens_rms_px": 0.29, "pose_rms_px": 0.51,
                        "position_m": [3.51, 0.01, 1.39] }
  },
  "detail": null
}
```

- `ready` is the one to gate a "3D" indicator on. `detail` says what is left
  when it is false, and is `null` when it is true.
- `position_m` is where each camera solved to, in metres, Z up, from the
  board's first inner corner. **This is the number to check against a tape
  measure.** If it is wrong then so is every distance the 3D metrics are built
  on — most often because the board's real square size does not match what was
  passed to the calibration script. Worth surfacing somewhere a human will see
  it, not just in diagnostics.
- `lens_rms_px` above about 1.0 means the lens fit was poor. `pose_rms_px` is
  the placement fit.
- Read from disk on every call, so calibrating takes effect immediately and no
  restart is needed.

## Shots interrupted by a restart

Pose extraction runs on an in-memory queue that does not survive the process.
Previously a shot that was extracting when the backend died read `pending` for
ever, and nothing would ever finish it.

On startup the backend now re-queues every shot still marked `pending` on
disk, oldest first, and marks any it cannot re-queue as `failed` with
`error: "extraction was interrupted by a restart and could not be resumed"`.

For the frontend this changes nothing structurally — but `pending` is now
genuinely temporary, so it is safe to show a spinner and wait.

---

# Schema v1.5 — the flight path itself

Additive. One new field on `telemetry.flight`.

## `telemetry.flight.path`

The trajectory the model actually flew, rather than six numbers describing it.

```json
"flight": {
  "carry_m": 245.33, "apex_m": 31.21, "descent_angle_deg": 38.4,
  "path": [[0.0, 0.0, 0.0], [5.79, 1.05, 0.0], ... , [245.33, 0.0, 0.0]]
}
```

Each point is `[downrange_m, height_m, offline_m]`:

- **downrange** — along the target line, always increasing.
- **height** — above the tee. Starts and ends at 0.
- **offline** — negative left, positive right, matching `offline_m`.

At most 48 points, evenly spaced in time rather than distance so the descent
is described as well as the launch. The first point is the tee and the last is
exactly the landing point, so `path[-1][0]` agrees with `carry_m`. About 1 KB.

The integrator has always computed this and thrown it away. It is published
because **a wedge and a driver are different shapes**, and no amount of styling
can get that out of three summary numbers: drawn from `carry`, `apex` and
`descent` alone, every shot is the same parabola with different labels. A
modelled 7-iron peaks at 21 m over 154 m; a pitching wedge peaks at 23 m over
122 m. Same apex, entirely different flight.

Draw it directly:

- **Side view** — `x = downrange`, `y = height`.
- **Top-down view** — `x = offline`, `y = downrange`. This is where draw and
  fade are visible, and it cannot be faked from `offline_m` alone because the
  curvature builds through the flight rather than being a straight line to the
  landing point.

Present it as a model, as with the other `flight` fields — it is not a
measurement. `path` is absent (an empty list) whenever `flight` itself could
not be modelled.
