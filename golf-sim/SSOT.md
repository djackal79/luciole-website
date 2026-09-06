# Golf Studio — Single Source of Truth

**Status date:** 2026-09-06 · **Branch:** `claude/golf-simulator-backend-9a46d5`
**Schema v1.1 shipped** — two-camera routing, pose and pressure blocks, per-clip
`impact_ms`. See [`CONTRACT.md`](CONTRACT.md) §v1.1.

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
| Mock fixtures (7 scenarios) | Claude Code | **Done** | `mocks/shots.json` |
| Frontend (React/Vite) | Antigravity | **In the repo, builds clean** | `frontend/` |
| Pose extraction (2D) | Claude Code | **Done** — MediaPipe, async, tested live | `backend/pose/` |
| 3D biomechanics | Claude Code | Blocked on camera calibration | — |
| Pressure / force mat | Claude Code | **Schema + fixtures shipped**; ingest deferred | `scripts/_sidecars.py` |
| Kinovea hook | Claude Code | **Done** | `scripts/kinovea_hook.bat` |

### Hardware

| Device | Role | Path into the backend |
|---|---|---|
| PC + Kinovea | Body swing (face-on) | Automation hook → `POST /api/ingest/body_swing` |
| Samsung **S23 Plus** | Impact, Super Slow-mo | Impact Watcher app → `POST /api/ingest/impact` |
| Square launch monitor | Ball/club telemetry | GSPro Open Connect socket, `127.0.0.1:921` |
| Second Kinovea camera (DTL) | Down-the-line | `kinovea_hook_dtl.bat` → `POST /api/ingest/body_swing` |
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
| D0 | Frontend exists only on Antigravity's machine | — | **Closed** — pushed, 36 files, builds |
| D1 | UI shows 3 cameras; contract has 2 video sources | High | **Shipped** — `body_swing_dtl` |
| D2 | Pressure mat UI has no backend or schema | Medium | **Schema shipped**, ingest deferred |
| D3 | 3D biomech UI has no pose data source | High | Scoped — triangulation, needs calibration |
| D4 | Media URL shape may not match the backend route | — | **Verified correct** |
| D5 | Master timeline is ambiguous with clips of differing fps/duration | Medium | **Shipped** — per-clip `impact_ms` |
| D6 | Supabase sync is outside the contract entirely | Medium | **Resolved** — backend writes metrics |
| D7 | "Side Offline 8.3 YDS R" equals the spin axis magnitude | — | **Verified correct** |
| D8 | Two Kinovea cameras collide on one ingest endpoint | High | **Fixed** — routed on `source` |
| D9 | Frontend owns the Supabase write path | Medium | **New** — see D6 |
| D10 | `POST /session/end` cancelled the shot reaper | High | **Found and fixed** |
| D11 | Root-level route aliases duplicate the contract paths | Low | Converge |

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

### D10 — `/session/end` cancelled the shot reaper — FIXED

Antigravity's `POST /session/end` called `correlator.stop(flush=True)`, which
cancels the reaper task. Nothing restarted it, so after one "end session" no
shot could ever time out into `partial` again for the life of the process —
shots would close only when all three sources happened to arrive. Silent, and
invisible until somebody noticed nothing ever completed.

Fixed on both sides: the endpoint now flushes rather than tearing down, and
`reset_session` restarts the reaper defensively so any future caller cannot
reproduce it. Two regression tests pin it.

### D11 — Root-level route aliases

The frontend added unprefixed aliases: `/health`, `/session/start`,
`/session/end`, `/listener/toggle`, duplicating the contract's `/api/*` paths.
They work, and `/session/end` is genuinely useful — the contract has no way to
end a session.

Left in place rather than deleted, since the app calls them. But the `/api/*`
paths are canonical, and two routes for one thing will drift. Worth converging
on `/api/session/end` and dropping the aliases when convenient.

### D4 — Media URL — VERIFIED CORRECT

The brief described `/shots/{id}/media/{kind}`, which does not exist. The code
builds `/shots/shot_${shot_id}/${media.path}`, which is exactly right. The
prose was loose; the code was correct. Vite proxies both `/shots` and `/api`
to port 8000 in dev.

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

### D7 — Side offline — VERIFIED CORRECT

The pushed code computes a genuine estimate — HLA displacement plus a
spin-axis curve term, correctly signed so a negative axis finishes left — and
gates it behind `hasRawCarry`, showing "est" or an em-dash otherwise. The
`8.3` in the screenshot came from an earlier build.

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
6. **Contract v1.1 has landed — the shapes are published.** Build the DTL
   camera, biomechanics and pressure panels against `CONTRACT.md` §v1.1 and
   fixtures 6 and 7 in `mocks/shots.json`. Read the landmark order from
   `pose.json` rather than hard-coding it, and handle `pose.status: "pending"`
   from the start — extraction finishes after the shot appears.

Not wanted: more theming, more animation, more panels. Both themes are done.

### Claude Code (Build 1)

1. ~~Contract v1.1 — schema first, pipelines second.~~ **Done.**
   `body_swing_dtl`, `pose`, `pressure`, per-clip `impact_ms`, and every source
   key always emitted.
2. ~~Camera-role routing (D8).~~ **Done.** Routed on an explicit `source`
   field, with `kinovea_hook.bat` and `kinovea_hook_dtl.bat` for the two
   cameras. Verified live: both hooks pair into one shot.
3. ~~Pose and pressure fixtures.~~ **Done.** Scenarios 6 and 7 in
   `mocks/shots.json`, with `pose.json` / `pressure.json` sidecars generated by
   `scripts/_sidecars.py`.
4. ~~Pose extraction — MediaPipe per camera, async, 2D first.~~ **Done.**
   `backend/pose/`, model fetched by `scripts/fetch_pose_model.py`, verified
   live: shot closes, pose goes pending, both cameras extract, `pose.json`
   lands and `shot.updated` fires. Swing plane and spine angle only; the
   depth-dependent metrics stay null.
5. **Camera calibration** — checkerboard intrinsics and extrinsics, then
   triangulated 3D. *Next, and blocked on a calibration capture from you.*
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
