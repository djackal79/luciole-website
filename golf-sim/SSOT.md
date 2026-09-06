# Golf Studio — Single Source of Truth

**Status date:** 2026-09-06 · **Branch:** `claude/golf-simulator-backend-9a46d5`

Four agents are working on this (Claude Code, Claude chat, Gemini chat,
Antigravity) across surfaces that cannot see each other. This document is the
reconciliation point.

## The rule

**The repository is the truth. A chat transcript is not.** If a decision is not
in this repo, it does not exist — the next agent will not know it, and neither
will you in three weeks.

| Question | Answer lives in |
|---|---|
| What is the data contract? | [`CONTRACT.md`](CONTRACT.md) |
| What is built, by whom, and what is next? | **this file** |
| How does the backend work? | [`README.md`](README.md) |
| How do I get it onto the sim PC? | [`DEPLOY.md`](DEPLOY.md) |
| What should the frontend do? | [`HANDOVER.md`](HANDOVER.md) |
| How does the impact camera work? | [`android/impact-watcher/README.md`](android/impact-watcher/README.md) |

---

## 1. System map

| Component | Owner | State | Location |
|---|---|---|---|
| Ingest backend (FastAPI) | Claude Code | **Done**, 59 tests | `backend/` |
| GSPro Open Connect listener | Claude Code | **Done** | `backend/gspro.py` |
| Shot pairing correlator | Claude Code | **Done** | `backend/correlator.py` |
| S23 impact watcher (Android) | Claude Code | **Written, untested on hardware** | `android/impact-watcher/` |
| Mock fixtures (5 scenarios) | Claude Code | **Done** | `mocks/shots.json` |
| Frontend (React/Vite) | Antigravity | **Built, NOT IN THE REPO** | *nowhere — see D0* |
| 3D biomechanics | Claude Code | **Not started** — UI placeholder only | — |
| Pressure / force mat | Claude Code | **Not started** — UI placeholder only | — |
| Kinovea hook | Claude Code | **Done** | `scripts/kinovea_hook.bat` |

### Hardware

| Device | Role | Path into the backend |
|---|---|---|
| PC + Kinovea | Body swing (face-on) | Automation hook → `POST /api/ingest/body_swing` |
| Samsung **S23 Plus** | Impact, Super Slow-mo | Impact Watcher app → `POST /api/ingest/impact` |
| Square launch monitor | Ball/club telemetry | GSPro Open Connect socket, `127.0.0.1:921` |
| Second Kinovea camera (DTL) | Down-the-line | **No path exists — see D1** |
| Pressure plates | Weight transfer / CoP | **No path exists — see D2** |

> The frontend brief says "Samsung S24 Ultra". It is an **S23 Plus**. Correct
> this wherever it appears.

---

## 2. What Antigravity got right

Worth stating plainly, because it means the contract is doing its job:

- The telemetry on screen is **exactly** fixture scenario 1 — shot
  `20260906T143052-478`, ball 132.4, club 92.1, smash 1.44, face-to-path −3.5,
  spin axis 8.3° L. The schema mapping is correct end to end.
- **Carry renders as an em-dash** with "LM unmeasured" and "Distance: —
  (Contract)". This is the single most likely thing to have been got wrong,
  and it was got right.
- Frame stepping divides by `container_fps`, not `capture_fps`.
- Null telemetry renders "Sensor Absent" rather than throwing.
- The calibration slider PATCHes `impact_offset_ms` back.

Both themes look finished. **Do not spend more time on visual polish** — the
gap now is data, not design.

---

## 3. Divergence register

Things the frontend assumes that the backend does not provide. Each needs a
decision before more code is written on either side.

| # | Divergence | Severity | Status |
|---|---|---|---|
| D0 | Frontend exists only on Antigravity's machine | **Blocking** | Push it |
| D1 | UI shows 3 cameras; contract has 2 video sources | **Blocking** | Decide |
| D2 | Pressure mat UI has no backend, no schema, no hardware path | High | Decide |
| D3 | 3D biomech UI has no pose data source | High | Decide |
| D4 | Media URL shape may not match the backend route | High | Verify |
| D5 | Master timeline is ambiguous with clips of differing fps/duration | Medium | Decide |
| D6 | Supabase sync is outside the contract entirely | Medium | Decide |
| D7 | "Side Offline 8.3 YDS R" equals the spin axis magnitude | Medium | Verify |

### D0 — The frontend is not in the repo

`git ls-tree` across every remote branch finds zero files under
`golf-sim/frontend/`. Build 2 currently exists on one machine, unreviewed,
unrunnable on the sim PC, and one disk failure from gone.

**Everything else in this document is blocked on fixing this.** Nothing can be
reconciled against code nobody else can read.

### D1 — Three cameras versus two video sources

The UI renders Face-On (30 fps), Behind/DTL (60 fps) and Impact Strike
(240 fps). The contract defines exactly two video sources, `body_swing` and
`impact_strike`. There is no DTL slot in `sources`, in `media`, or in the
backend's ingest endpoints.

**Recommendation:** add `body_swing_dtl` as an **optional** fourth source.
Additive, so every existing shot simply carries `body_swing_dtl: false`, and
Build 1's `GOLFSIM_EXPECTED_SOURCES` is already configurable — so whether a
missing DTL clip makes a shot `partial` becomes a config choice, not a code
change. Rejected the alternative of generalising `media` into a list of camera
roles: it breaks every existing consumer to buy flexibility nobody has asked
for.

**Question for you:** do you actually have a second camera for DTL, or is that
pane aspirational? This matters more than it looks — see D3.

### D2 — Pressure mat

The UI shows trail/lead weight split, a CoP trace, and 750 N of ground force,
labelled "Sensor Ready" and "Compatible with BodiTrak / Smart2Move". None of
that exists: no source key, no ingest endpoint, no data shape.

**Recommendation:** a new optional `pressure` source. The time series does not
belong inline — a 100 Hz capture over 4 s is 400 samples and would swamp
`metadata.json`. Mirror the media pattern instead: a sibling `pressure.json`
in the shot folder, referenced from metadata, with only summary figures inline
for the HUD (peak GRF, weight split at impact, CoP excursion).

**Question for you:** do you own a plate, or is this a future purchase?
Building an ingest path against hardware you do not have is speculative work,
and the protocol will be whatever the vendor's SDK dictates.

### D3 — 3D biomechanics

The placeholder says it is "ready to receive 3D quaternion or joint vectors
from MediaPipe / OpenPose". Nothing produces them.

**Recommendation:** treat pose as **derived, not captured** — computed from
the body-swing video after the shot closes, written to `pose.json`, with a
`status` field so the UI can show "computing" and then swap in real data.

**The honest constraint:** MediaPipe Pose from a *single* camera gives 2D
landmarks plus a weak monocular depth estimate. Pelvis rotation, shoulder turn
and X-factor — the numbers the panel actually displays — are not reliably
recoverable from one view. Two calibrated cameras can triangulate them
properly.

**So D1 and D3 are the same decision.** The DTL camera is not just another
angle; it is what makes 3D pose genuinely 3D. If you want real biomechanics,
the second camera earns its place. If you do not want a second camera, the
panel should be scoped down to 2D swing-plane analysis from face-on, and
labelled as such rather than implying quaternions.

### D4 — Media URL

The brief describes `api.ts` calling `/shots/{id}/media/{kind}`. The backend
serves `GET /shots/{folder}/{filename}`, where `folder` is `shot_{shot_id}`
(with the prefix) and `filename` comes from `metadata.media.<source>.path`.
If the code does what the prose says, every video 404s.

Likely the prose is loose and the code is right — the screenshots render, but
they render *canvas simulations*, which would look identical either way.
**Verify against a running backend**, not against internal mocks.

### D5 — Master timeline

The scrubber reads `04.00s (30 FPS Container • 240 FPS Capture)`, which mixes
the body swing's duration with the impact clip's capture rate. With clips of
different durations, different capture rates and different impact positions,
"the" timeline is undefined.

**Recommendation:** the master timeline is **real time in milliseconds,
anchored at impact = 0**. Each clip maps onto it through its own capture rate.
To make that possible, add `impact_ms` to each media entry — where impact sits
inside that clip, in file playback milliseconds, so the player can seek
directly without doing fps arithmetic.

It will often be `null`: Kinovea's pre-roll is configurable and knowable, but
Samsung's Super Slow-mo auto-trigger decides its own pre-roll and does not tell
us. That is exactly the gap `sync.impact_offset_ms` and the calibration slider
exist to close, and why the slider must stay.

### D6 — Supabase

Cloud sync is not in the contract. Media cannot go there — the clips are large
and live on the sim PC by design. Metadata sync for cross-device history is
plausible, but it needs a stated purpose before it is wired in.

### D7 — Side offline

The trajectory card shows `SIDE OFFLINE 8.3 YDS R`. Fixture 1 has
`spin_axis_deg: -8.3`. A lateral distance in yards should not be numerically
identical to a spin axis in degrees — that smells like a field being reused.
It also reads oddly: a negative spin axis is a left tilt, so a draw should
finish left of where it started.

Estimated ballistics are a fine feature. **The rule is that estimates must
never be written into `telemetry.distance` and never PATCHed back** — those
fields mean *measured*, and null is the honest value. The UI's "Model:
Em-Dash (—)" toggle suggests this is already understood; codifying it here so
it survives.

---

## 4. Next steps

### Antigravity (Build 2)

In this order. Do not skip to 5.

1. **Push the frontend to `claude/golf-simulator-backend-9a46d5` under
   `golf-sim/frontend/`.** Nothing else can proceed. Include `package.json`,
   lockfile and source; exclude `node_modules` and `dist`.
2. **Run against the real backend**, not internal mocks:
   ```bash
   cd golf-sim
   python scripts/mock_provider.py --seed data/shots
   uvicorn backend.main:app --port 8000
   ```
   Then point the app at `http://127.0.0.1:8000` and load all five fixtures
   from `GET /api/shots`. Internal mock dispatchers are useful, but they cannot
   catch D4 — only a real HTTP round trip can.
3. **Fix or confirm the media URL** (D4) and **the side-offline calculation**
   (D7).
4. **Correct S24 Ultra → S23 Plus** wherever it appears.
5. **Hold on the third camera, pressure mat and biomechanics.** They are
   waiting on schema decisions above. Leave the panels as they are; do not
   invent data shapes for them, because whatever you invent will not match
   what the backend ends up sending.

Not wanted right now: more theming, more animation, more panels. Both themes
are finished.

### Claude Code (Build 1)

1. **Contract v1.1 — schema first, implementation second.** Add the optional
   `body_swing_dtl`, `pressure` and `pose` source keys, and per-clip
   `impact_ms`. Publishing the shapes before building the pipelines is what
   lets both agents work in parallel instead of blocking on each other.
2. **Extend `mocks/shots.json`** with fixtures carrying pose and pressure data,
   so Antigravity can build those panels against real shapes before the
   hardware or the pipeline exists.
3. **Pose extraction pipeline** — MediaPipe over the body-swing clip, async
   after the shot closes, written to `pose.json`. Scope depends on D1/D3.
4. **Pressure ingest** — only once D2 is answered.
5. Nice-to-have, not urgent: a startup reconciliation pass so shots left
   `pending` by a crash get closed.

### You

Three answers unblock everything: **D1** (is there a second camera?),
**D2** (do you own a pressure plate?), and **D6** (what is Supabase for?).

---

## 5. Context for the chat surfaces

Claude chat and Gemini chat cannot read this repo. When bringing either up to
date, give them the branch, this file's path, and this summary:

> Golf Studio, repo `djackal79/luciole-website`, branch
> `claude/golf-simulator-backend-9a46d5`, everything under `golf-sim/`.
> Build 1 (Python ingest backend, GSPro socket, shot pairing, S23 impact
> watcher) is done and tested. Build 2 (React frontend, two themes) is built
> by Antigravity but not yet pushed. `golf-sim/SSOT.md` is the status document
> and `golf-sim/CONTRACT.md` is the data contract; where anything disagrees
> with them, they win. Open decisions: a third camera, pressure-mat hardware,
> and the pose pipeline for 3D biomechanics.

Do not ask either chat to hold project state in its context. Ask it to read
these files, or paste the relevant one.
