# Golf Studio — Single Source of Truth

**Status date:** 2026-09-06 · **Branch:** `claude/golf-simulator-backend-9a46d5`
**Decisions D1, D2 and D6 answered** — see §3.

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
| Second Kinovea camera (DTL) | Down-the-line | **Set up in Kinovea; no ingest path yet — D1** |
| Pressure plates | Weight transfer / CoP | **Parts on hand, unbuilt (~Christmas) — D2** |

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

Things the frontend assumes that the backend does not provide. D1, D2 and D6
are now answered; their decisions are recorded below and are binding.

| # | Divergence | Severity | Status |
|---|---|---|---|
| D0 | Frontend exists only on Antigravity's machine | **Blocking** | Open |
| D1 | UI shows 3 cameras; contract has 2 video sources | High | **Resolved** — add `body_swing_dtl` |
| D2 | Pressure mat UI has no backend or schema | Medium | **Resolved** — reserve schema, defer ingest |
| D3 | 3D biomech UI has no pose data source | High | Scoped — triangulation, needs calibration |
| D4 | Media URL shape may not match the backend route | High | Verify |
| D5 | Master timeline is ambiguous with clips of differing fps/duration | Medium | Decide |
| D6 | Supabase sync is outside the contract entirely | Medium | **Resolved** — backend writes metrics |
| D7 | "Side Offline 8.3 YDS R" equals the spin axis magnitude | Medium | Verify |
| D8 | Two Kinovea cameras collide on one ingest endpoint | High | **New** — see D1 |
| D9 | Frontend owns the Supabase write path | Medium | **New** — see D6 |

### D0 — The frontend is not in the repo

`git ls-tree` across every remote branch finds zero files under
`golf-sim/frontend/`. Build 2 currently exists on one machine, unreviewed,
unrunnable on the sim PC, and one disk failure from gone.

**Everything else in this document is blocked on fixing this.** Nothing can be
reconciled against code nobody else can read.

### D1 — Three cameras versus two video sources — RESOLVED

**Two Kinovea cameras are set up.** The DTL pane is real, not aspirational.

**Decision:** add `body_swing_dtl` as a fourth source key. Additive, so every
existing shot carries `body_swing_dtl: false`, and Build 1's
`GOLFSIM_EXPECTED_SOURCES` is already configurable — whether a missing DTL clip
makes a shot `partial` becomes a config choice, not a code change. Rejected
generalising `media` into a list of camera roles: it breaks every existing
consumer to buy flexibility nobody asked for.

### D8 — Two Kinovea cameras collide on one ingest endpoint — NEW

Falls out of D1 and is not obvious. Both cameras finish recording at roughly
the same instant, and both Automation hooks post to
`POST /api/ingest/body_swing`. The correlator's duplicate-source rule then does
exactly what it was built to do — treats the second clip as a *second swing*
and opens a second shot. Two cameras would silently double every shot.

**Fix (Claude Code):** route on camera role. The endpoint already accepts a
`camera` form field, so `face_on` maps to `body_swing` and `dtl` maps to
`body_swing_dtl`. `scripts/kinovea_hook.bat` grows a role argument so each
camera's Automation entry passes its own.

Also worth knowing: the two cameras run at different rates (30 and 60 fps in
the UI) and are not frame-synchronised with each other. That is fine for
side-by-side review and matters a great deal for D3.

### D2 — Pressure mat — RESOLVED (deferred)

**The parts are on hand but unbuilt — a Christmas-holidays job.**

**Decision:** reserve the schema slot now, ship mock fixtures so the panel can
be built against a real shape, and **defer the ingest endpoint** until the
hardware exists and can say what it actually emits.

The shape: a `pressure` source with its time series in a sibling
`pressure.json` (a 100 Hz capture over 4 s is 400 samples and has no business
inside `metadata.json`), and only summary figures inline for the HUD — peak
GRF, weight split at impact, CoP excursion.

One correction to the UI: "Compatible with BodiTrak / Smart2Move" is a claim we
cannot support. Self-built plates will emit whatever your microcontroller sends
— almost certainly serial or a small HTTP post, not a vendor SDK. Better to say
nothing until the protocol exists than to name products the code has never
spoken to.

### D3 — 3D biomechanics — SCOPED

With two cameras roughly 90° apart, triangulating real 3D joint positions is
genuinely achievable. Monocular MediaPipe could never have given you reliable
pelvis rotation or shoulder turn; two views can.

**It is not free.** Triangulation needs:

1. **Intrinsic calibration** per camera — focal length and lens distortion,
   from a printed checkerboard. Once per camera, reusable until you change the
   lens or resolution.
2. **Extrinsic calibration** — the relative position and rotation of the two
   cameras, from a target visible in both. Redo whenever a camera moves.
3. **Temporal alignment** — 30 fps and 60 fps clips, started independently.
   Impact is the natural shared event to align on, which is what
   `impact_ms` and the calibration slider are already for.

**Staged plan.** Ship 2D first: MediaPipe per camera gives swing plane and
hand path from DTL, spine angle and sway from face-on. That is genuinely
useful and needs no calibration at all. Add triangulated 3D once the
calibration step exists. The panel should say which mode it is showing rather
than implying quaternions it does not have.

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

### D6 — Supabase — RESOLVED

**Scope: everything GSPro sends plus anything the app derives. Not media.**
Clips are large and stay on the sim PC by design; what syncs is shot metadata,
telemetry and derived analytics — the things you would want to query across
sessions and devices.

### D9 — The Supabase write path is on the wrong side — NEW

The frontend has a `supabase.ts`. That makes the browser the writer, which
means **shots only sync while someone has the app open** — and nobody is
looking at a screen mid-swing.

**Recommendation: the backend owns the write, the frontend reads.** The
backend is already running whenever shots happen, it is the single writer so
there is nothing to reconcile, and it is where the data is authoritative. The
existing `supabase.ts` is not wasted — it becomes the read path for history
and analytics.

Sync must also be offline-tolerant. The sim PC shows `CLOUD: LOCAL OFFLINE`,
and a shot must never be lost because the internet was down — the same outbox
pattern the Android watcher uses for uploads.

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
   the lockfile and source; exclude `node_modules` and `dist`.
2. **Run against the real backend**, not internal mocks:
   ```bash
   cd golf-sim
   python scripts/mock_provider.py --seed data/shots
   uvicorn backend.main:app --port 8000
   ```
   Point the app at `http://127.0.0.1:8000` and load all five fixtures from
   `GET /api/shots`. Internal mock dispatchers are useful, but they cannot
   catch D4 — only a real HTTP round trip can.
3. **Fix or confirm the media URL** (D4) and **the side-offline calculation**
   (D7).
4. **Correct S24 Ultra → S23 Plus**, and drop the "Compatible with BodiTrak /
   Smart2Move" claim (D2).
5. **Move Supabase to read-only** (D9). Keep the client, drop the writes.
6. **Hold** on the DTL camera, pressure and biomechanics panels until contract
   v1.1 lands. The shapes are decided but not yet published; anything invented
   in the meantime will not match.

Not wanted: more theming, more animation, more panels. Both themes are done.

### Claude Code (Build 1)

1. **Contract v1.1 — schema first, pipelines second.** Publish
   `body_swing_dtl`, `pressure`, `pose` and per-clip `impact_ms` so both agents
   can work in parallel instead of blocking on each other.
2. **Camera-role routing** (D8) before the second camera can be used at all,
   plus a role argument in `kinovea_hook.bat`.
3. **Extend `mocks/shots.json`** with pose and pressure fixtures, so those
   panels can be built long before the hardware or the pipeline exists.
4. **Pose extraction** — MediaPipe per camera, async after the shot closes,
   2D first (D3).
5. **Camera calibration** — checkerboard intrinsics and extrinsics, then
   triangulated 3D.
6. **Supabase sync** — backend-owned, offline-tolerant outbox (D6, D9).
7. Deferred until the hardware exists: pressure ingest (D2).

### You

- Nothing blocking. The three open questions are answered.
- Worth doing before the pose work lands: **print a checkerboard and take a
  calibration capture** with both cameras seeing it at once. Without that,
  3D stays 2D.

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
