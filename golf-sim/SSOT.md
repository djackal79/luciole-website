# Golf Studio — Single Source of Truth

**Status date:** 2026-09-06 · **Branch:** `claude/golf-simulator-backend-9a46d5`
**Running on the sim PC.** Backend, frontend and pose pipeline all up; hardware
bring-up in progress. See [`RUNBOOK.md`](RUNBOOK.md).

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
| S23 impact watcher (Android) | Claude Code | Written, **not yet built or run** | `android/impact-watcher/` |
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

### Hardware bring-up (as of tonight)

| Link | State |
|---|---|
| Backend + frontend on the sim PC | **Working.** Mock shots render, pairing verified |
| GSPro socket ← SQG-GSPRO-Connect | **Working.** Bridge connects, protocol confirmed |
| Square LM (original, **not Omni**) → SQG-GSPRO-Connect | **Blocked.** Monitor not registering the ball — D12 |
| Kinovea post-recording hooks | Configured; per capture screen, not Preferences |
| Kinovea capture trigger | **Not found yet** — D13 |
| Phone watcher | Not started |

Two operational rules learned the hard way, both now in the runbook: the
bridge does not auto-reconnect, so start the backend **first**; and the
backend can only see the bridge half of the monitor chain, so `clients: 1`
with no shots means the Bluetooth link, not the code.

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
| D3 | 3D biomech UI has no pose data source | High | **Shipped** — calibration + triangulation; needs a board capture |
| D4 | Media URL shape may not match the backend route | — | **Verified correct** |
| D5 | Master timeline is ambiguous with clips of differing fps/duration | Medium | **Shipped** — per-clip `impact_ms` |
| D6 | Supabase sync is outside the contract entirely | Medium | **Resolved** — backend writes metrics |
| D7 | "Side Offline 8.3 YDS R" equals the spin axis magnitude | — | **Verified correct** |
| D8 | Two Kinovea cameras collide on one ingest endpoint | High | **Fixed** — routed on `source` |
| D9 | Frontend owns the Supabase write path | Medium | **New** — see D6 |
| D10 | `POST /session/end` cancelled the shot reaper | High | **Found and fixed** |
| D15 | Reprojection error cannot see a time skew between the two cameras | High | **Closed by refusal** — see below |
| D16 | A plain chessboard has no absolute origin | High | **Closed** — ChArUco board |
| D11 | Root-level route aliases duplicate the contract paths | Low | Converge |
| D12 | Square LM not registering the ball | **Blocking hardware** | Vendor-side |
| D13 | Kinovea capture trigger not located | Medium | Research |
| D14 | flighthook could replace the LM bridge | — | **Ruled out** — Omni only, bay has the original Square |

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

### D14 — flighthook as the launch monitor bridge — NOT APPLICABLE

**Ruled out: the bay has the original Square LM, not the Omni.** flighthook
supports the Omni only — the original Square and Square Home use a different
club-code scheme and are explicitly unsupported. Recorded here so nobody
re-proposes it.

**SQG-GSPRO-Connect therefore stays**, and the pass-through built into this
backend matters more than it did: that bridge forwards to exactly one target,
so relaying through this listener is the *only* way to run the app and GSPro
together. Without it, it is one or the other.

The DMCA'd `squaregolf-connector` may well have covered the original unit,
which is why its absence is felt. Nothing to do about that.

The rest of this entry is kept for reference should the hardware change.

[divotmaker/flighthook](https://github.com/divotmaker/flighthook) is a
maintained Rust bridge that talks to the **Square Golf Omni over BLE directly**
(GATT, no pairing) and forwards to GSPro. Its GSPro target is configurable:

```toml
[gspro.0]
address = "127.0.0.1:922"   # this backend, not GSPro
```

which means it drops into the existing chain with **no code change here**:

```
Square Omni --BLE--> flighthook --OpenConnect--> this backend (922) --relay--> GSPro (921)
```

It replaces SQG-GSPRO-Connect, removing the intermediate app and the link that
does not auto-reconnect. It also exposes its own REST/WebSocket shot stream on
5880, which is an alternative to impersonating Open Connect, but the drop-in
above needs nothing written so it is the one to try first.

**Caveat: only the Omni is supported.** The original Square and Square Home use
a different club-code scheme and are explicitly unsupported. Confirm which unit
is in the bay before switching.

**Treat any Square BLE decoder as impermanent.** A comparable project,
`brentyates/squaregolf-connector`, has been taken down under DMCA, and
`allsquare` is doing the same work in the same territory.

That is survivable here only because this backend speaks GSPro Open Connect --
a documented, widely implemented protocol -- rather than talking to the unit
itself. The bridge is a swappable component behind that boundary, so if one
disappears another takes its place with no change to this code. For the same
reason, a Square BLE library should never be pulled *into* the backend,
however appealing "one fewer moving part" sounds: that is exactly the
dependency that gets removed. Keep a local copy of whichever bridge binary is
in use.

One finding may still transfer, as a hypothesis rather than a fact: on the
Omni, a ball struck near the **front edge of the detection zone** returns zero
spin, which flighthook treats as a failed read. If the original unit shares
that geometry it points at ball placement, alongside the advice to raise the
unit and keep the ball on the laser dot.

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

### D15 — Reprojection error is blind to time skew — CLOSED BY REFUSAL

The obvious check on a triangulated point is how far apart the two cameras
placed it. With the cameras 90° apart that check cannot do the job: face-on
fixes X and Z, down-the-line fixes Y, so almost any (X, Y) pair satisfies both
rays. Feeding the two views different instants of the swing reprojects at well
under a pixel while the body angle comes out tens of degrees wrong.

Measured on synthetic data where the true shoulder turn is 90°:

| Skew between the two clips | Shoulder turn | Worst reprojection | Caught? |
|---|---|---|---|
| none | 90° — correct | 0.00 px | — |
| 50 ms | 61° | 0.14 px | **no** |
| 100 ms | 37° | 0.28 px | **no** |
| 200 ms | 8° | 0.53 px | yes, by anatomy |

Every one of those is cleaner-looking than the ~4 px that 2 px of honest
landmark jitter produces. Reprojection error is not merely a weak signal here;
it points the wrong way.

Two defences, and it matters which does what:

1. **Both clips must carry a real `media.*.impact_ms`.** Missing it on either
   camera means there is no shared clock at all, and the backend declines to
   triangulate rather than lining one clip's impact up against the other's
   first frame. This is the one that closes the common case.
2. **The triangulated skeleton must be anatomically possible.** A shoulder or
   hip width outside human range means the reconstruction is wrong — most
   often a mistyped board square size, which scales the whole world while
   leaving every angle plausible. This is a backstop for gross errors, and the
   table above shows its limit: it catches 200 ms, not 50 ms.

**So the honest position is that a modest, wrong-but-present `impact_ms` is not
detectable from the geometry, and nothing downstream will flag it.** The
practical requirement that follows: `IMPACT_MS` in the Kinovea hooks needs to
be right to within roughly one frame — 33 ms at 30 fps — not merely present.
It comes from the capture trigger's pre-roll, which is a setting rather than a
guess, so this is achievable; it just has to be done deliberately once and
re-checked if the trigger's buffer changes.

### D16 — Chessboard origin ambiguity — CLOSED

`findChessboardCorners` returns corners in the order it walked the image, and
that order is unique only up to the pattern's own symmetry. One view can come
back numbered from one end of the board and another from the other — the same
board described in two world frames 180° apart. Each camera still fits its own
view perfectly, so nothing in the reprojection error complains; triangulation
between the two frames is simply garbage.

Two cameras 90° apart photographing one board on the floor are the case most
likely to hit this. The board is therefore a **ChArUco** board: every white
square carries a coded marker, so the origin is absolute and every view agrees
on it. It also calibrates from a partly occluded board, which a chessboard
cannot.

---

## 4. Next steps

### Antigravity (Build 2)

**Status: DONE** (All v1.1 and v1.2 contract features implemented and pushed)

1. ~~**Push the frontend**~~ **Done.** Frontend exists under `golf-sim/frontend/` and pushed to `claude/golf-simulator-backend-9a46d5`.
2. ~~**Run against the real backend**~~ **Done.** Frontend actively uses real HTTP/WebSocket backend endpoints, eliminating mocks.
3. ~~**Fix media URL and side-offline**~~ **Done.** Media dynamically resolves to `/shots/shot_{id}/{media.path}`. Ballistics estimate is replaced by `telemetry.flight` from v1.2.
4. ~~**Correct S24 Ultra -> S23 Plus, and drop BodiTrak**~~ **Done.**
5. ~~**Move Supabase to read-only**~~ **Done.** `supabase.ts` handles read-only queries for historical sync.
6. ~~**Contract v1.1 and v1.2 features**~~ **Done.**
   - Dynamic alignment of 3 video cameras using `impact_ms` via timeline offset.
   - Skeletons render on dual canvases referencing real `pose.json` point index arrays.
   - Expandable Diagnostics block tracking `listeners.gspro_socket` stats (clients, heartbeats, pass_through) and `pose_worker` status.
   - `PressureMatVisualizer` reads `pressure.json` and accurately maps CoP.
   - `TrajectoryCard` and `TelemetryHUD` now parse v1.2 backend `telemetry.flight` with proper `—` and `est` rendering behavior.

**Next up:** `FRONTEND_BRIEF.md` (correctness) then `DESIGN_BRIEF.md`
(motion and visual polish, now in scope). `FRONTEND_BRIEF.md` — one crash to fix
(`Pose3DCanvas` violates the Rules of Hooks and will take the panel down the
first time a 3D shot loads), three places where a mock-fixture constant stands
in for real data, and two new backend fields worth showing.

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
5. ~~Camera calibration and triangulated 3D.~~ **Done.**
   `backend/pose/calibration.py`, `backend/pose/triangulate.py`,
   `scripts/calibrate_cameras.py`, contract v1.3. Shoulder turn, pelvis
   rotation and X-factor are computed the moment a board capture exists; the
   `world` block of metre-space landmarks is written alongside the 2D tracks.
   *Now blocked only on printing the board and taking the capture.*
5b. ~~Ball flight model.~~ **Done.** `backend/flight.py`, schema v1.2,
   `telemetry.flight`. RK4 with drag, Magnus and spin decay, fitted to within
   4% of published carries from driver to wedge. `telemetry.distance` still
   means measured and still stays null. **The frontend should stop computing
   ballistics client-side** and read this instead.
6. **Supabase sync** — backend-owned, offline-tolerant outbox (D6, D9).
7. Deferred until the hardware exists: pressure ingest (D2).

### You

- **Print the calibration board.** This is now the only thing standing between
  the rig and 3D biomechanics. `python scripts/calibrate_cameras.py board
  --out board.png` writes the exact pattern the code looks for — a ChArUco
  board, 1.5 × 1.05 m, so a print shop rather than the office printer. Mount
  it on something stiff, then **measure a square with a ruler**: that number
  sets the scale of the whole world and "fit to page" quietly changes it.
  Do not substitute a chessboard off the internet; the markers are what stop
  the two cameras disagreeing about which way round the board is.
- **Set `IMPACT_MS` in both Kinovea hooks.** Both ship blank, and without it
  on both cameras the backend will not triangulate however well the rig is
  calibrated. It is the pre-roll of your capture trigger — buffer 3 s and
  impact sits ~3000 ms into the clip. This is a refusal, not a bug: a 50 ms
  alignment error turns a real 90° shoulder turn into 61° at 0.4 px of
  reprojection error, so nothing downstream could catch it.
- Still open from before: the Square is not registering the ball, and
  Kinovea's audio trigger has not been located.

## 5. Context for the chat surfaces

Claude chat and Gemini chat cannot read this repo. When bringing either up to
date, give them the branch, this file's path, and this summary:

> Golf Studio, repo `djackal79/luciole-website`, branch
> `claude/golf-simulator-backend-9a46d5`, everything under `golf-sim/`.
> Build 1 (Python ingest backend) is done. Build 2 (React frontend, v1.2 contract) is complete and pushed to remote. `golf-sim/SSOT.md` is the status document
> and `golf-sim/CONTRACT.md` is the data contract; where anything disagrees
> with them, they win. Open decisions: a third camera, pressure-mat hardware,
> and the pose pipeline for 3D biomechanics.

Do not ask either chat to hold project state in its context. Ask it to read
these files, or paste the relevant one.
