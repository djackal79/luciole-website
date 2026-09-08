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
| Square LM (original, **not Omni**) → SQG-GSPRO-Connect | **Working 8 Sep.** Arms on connect and re-arms itself, ball after ball — D25 |
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
| D12 | Square LM not registering the ball | **Blocking hardware** | **Resolved 7 Sep** — never hardware; see D17/D18 |
| D17 | The Square flags *every* frame `IsHeartBeat`, strikes included | High | **Fixed** — content decides, not the flag |
| D18 | The Square must be re-armed after every shot | High | **Fixed** — Code 201 on any not-ready frame |
| D19 | Re-arming needs a club *change*; a repeat is ignored | High | **Retracted** — timing was the confound |
| D21 | Re-arming inside the post-shot cycle freezes the Square | **High** | **Fixed** — club data, settle 3 s, **exactly one** 201 |
| D22 | A frozen Square stays frozen until it is power-cycled | Medium | **Open** — no software recovery found |
| D23 | The reference profile was validated on a *different* connector | **High** | **Found** — local evidence wins on framing and 201 shape |
| D24 | One hypothesis per bay session is unaffordable | **High** | **Fixed** — the backend probes and reports the winner |
| D25 | The Square arms and detects ball after ball | — | **Solved 8 Sep** — connect-time 201, CRLF, with DistanceToTarget + Surface. Applies *before* a shot; after one is D26 |
| D26 | Probing was the default, and may be what freezes it | **High** | **Default fixed**; `none` vs `full` still to be settled in the bay |
| D20 | The bay logs never contain the failure being debugged | High | **Closed** — the physical symptom was the missing data; see D21 |
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

### D17 — The Square flags every frame as a heartbeat — FIXED

Measured in the bay, 7 September. The Square sets
`ShotDataOptions.IsHeartBeat: true` on **every** frame it sends, a real strike
included. The listener trusted the flag and discarded the frame, so a genuine
94.89 mph drive with 5194 rpm of backspin was logged as a keep-alive and
thrown away.

The flag is therefore not a classifier. `is_heartbeat()` now requires the flag
*and* an absence of shot content: a frame carrying ball speed is a shot no
matter what it calls itself. The real frames are pinned verbatim in
`tests/test_gspro.py` as `SQUARE_BALL` and `SQUARE_CLUB`, so a future
"tidy-up" of that predicate fails loudly.

Corollary found the same evening: one swing arrives as **two** frames sharing a
`ShotNumber` — ball data first, club data about 700 ms later, each genuine by
every content test. Submitting both put the swing on screen twice, so the
second is merged into the first (`ShotCorrelator.merge_telemetry`), filling
only fields the shot lacks. It never overwrites a real measurement with a later
frame's zeros, because the club frame reports `BallData.Speed: 0`.

### D18 — The Square must be re-armed after every shot — FIXED

Predicted from `OpenShotGolf`'s connection sequence (§3c) and then confirmed on
the hardware: **one shot per session, then silence.**

Two protocol facts, both measured:

1. A Square that has never been told a club sits at
   `LaunchMonitorIsReady: false` forever. It arms on a GSPro **Code 201
   "GSPro Player Information"** frame. A `Player` block inside a Code 200
   acknowledgement — which is what this backend sent — is not that message.
   Sending a real 201 on connect armed the device immediately.
2. The Square goes unready again the instant it has reported a strike, and it
   says so on the **club** frame. Which is a *shot* frame by D17's content
   test, so it returns from `_dispatch` before the heartbeat branch where the
   re-arm lived. The device was armed once and never again.

The readiness check therefore runs on **every** frame, ahead of any return
path, not just heartbeats. It is throttled to one nudge per second so a
warming-up monitor heartbeating at 10 Hz does not draw ten club frames a second
back — but the throttle only ever suppresses a *repeat* of an already-known
not-ready state. Any transition into not-ready, and any not-ready report from a
monitor whose readiness was previously unknown, always sends.

That last clause is the one that took two goes. The connect-time announce
stamps the throttle clock, so a monitor that reports not-ready within the next
second — which is every monitor that was never ready to begin with — had its
one nudge silently swallowed, and nothing armed it. Both failure modes are
pinned by tests that were checked against a deliberate re-introduction of each
bug.

### D19 — The Square re-arms on a club *change* — RETRACTED

Wrong, and recorded as such. The inference was: a 201 with the same club did
not arm the device; GSPro users fix the same symptom by pressing K (club up),
which is a 201 with a different club; therefore the change is the signal.

The confound was timing. K is a human pressing a key seconds after the shot.
Every 201 this backend sent — same club or decoy — went out within 260 ms of
the club frame, inside the window in which the device cannot be re-armed at
all (D21). The club change was never tested outside that window, so the
experiment could not have distinguished the two explanations. The decoy-club
nudge is removed; the setting with it.

### D20 — What the bay logs do *not* show — OPEN

Three evenings' worth of pasted log covers the shot and about three seconds
either side. Every one of them ends before the thing in question happens, and
three fixes were made on inference from that window. Recording the reasoning
error so it is not repeated.

What the logs actually establish, across 18:41:52 (78.1 mph), 18:48:40
(92.7 mph) and 18:59:19 (84.4 mph):

- Each *ball* frame carries `LaunchMonitorIsReady: true`. **The device was
  armed immediately before every shot it reported.** It does re-arm.
- Each *club* frame carries `false`, and that is the normal post-strike state:
  the ball has been hit away, so `LaunchMonitorBallDetected` is false too.
- No paste contains the recovery, so nothing measures how long it takes or what
  provokes it.

The unmeasured question is the gap: seven and eleven minutes between shots.
Either the golfer was doing other things and the device armed promptly, or the
golfer was swinging and only one in twenty registered. **Those two are opposite
faults and the logs cannot tell them apart.** Everything from D18 onward was
built on the second reading without checking.

Two changes came out of admitting that. `armed again after Ns and N re-arm
attempt(s)` is logged on recovery, so the answer survives a log trimmed to the
shot; and re-arm attempts now back off (2s doubling to 15s) rather than
repeating every second. The backoff is not politeness: a re-arm *changes the
club*, and a device handed a fresh selection every second may never be left
alone long enough to act on one. Retrying harder is the obvious response to
"it did not arm" and it was making things worse.

**What to capture next, before changing any more code:** the untrimmed log
between one shot's club frame and the next shot's ball frame, and whether the
golfer swung during it.

### D21 — Re-arming inside the Square's post-shot cycle freezes it — FIXED

The face lights on the first arm and never again; the unit never goes green
after the first shot. Four fixes on 7 September did not touch it, because all
four re-armed within a quarter of a second of the club frame.

Two sources settled it, both read for behaviour and neither copied:

**GolfForge's Open Connect server driver** — validated with the Square through
a connector — documents the device's protocol as arm / fire / re-arm:
connect-time 201 arms the first shot; *"after club-data arrives (end-of-shot),
the driver waits ~3 seconds then sends exactly one re-arm {Code:201}.
Re-arming too early freezes the loop."* The C++ comment gives the reason:
*"the connector fires one shot per arm then resets (~2-3s)"*. The trigger is
the club-data frame specifically; the 201 is the two-field literal
`{"Code":201,"Message":"GSPro Player Information","Player":{"Handed":"RH","Club":"DR"}}`;
no retry.

**A surviving fork of the taken-down Square connector** shows the other half.
It arms ball detection (BLE club command, then BLE detect-ball) on receipt of
a simulator message whose `Message` is the exact literal
`"GSPro Player Information"` — or the undocumented `"GSPro ready"`, which real
GSPro evidently sends when the next shot is set up. And it sends a frame to the
simulator **only when its ready state changes**. That is why the bay log goes
silent after every shot: not-ready, nothing changing, nothing sent. A re-arm
driven by incoming frames — every version this backend shipped — fires once,
too early, and then has nothing to fire on.

The re-arm is: **club-data frame → wait 3 s → exactly one 201.** Nothing else
schedules one, and nothing repeats it.

Both halves of that cost a bay session before they were read properly. The
first attempt at this entry armed on any transition into not-ready *and*
retried six times, and the reference forbids both in one sentence — *"Re-arming
on ball-data / immediately / on a timer lands mid-reset and freezes the loop"*.
The C++ is unambiguous where the prose can be skimmed:

```cpp
if (Profile.bArmModel && MessageHasClubData(Msg))
    RearmDueTime = FPlatformTime::Seconds() + Profile.RearmSettleSeconds;
...
if (RearmDueTime > 0.0 && FPlatformTime::Seconds() >= RearmDueTime)
{
    RearmDueTime = 0.0;   // cleared: one arm per club frame, never retried
    SendPlayer();
}
```

`ContainsClubData` is the only trigger. `LaunchMonitorIsReady` never arms
anything — in the reference it feeds a player-facing ball-ready light, and in
the connector source it is set from *ball* ready, meaning "a ball is on the mat
and being watched". It goes false whenever the mat is empty, which includes the
moment a monitor first connects. Arming on it fired 3 s into a session that had
had no shot at all, landed in the connector's reset, and froze the device
before the first ball: 19:30 on 7 September, six re-arms, face dark throughout.

Two further deviations from the reference removed while here, neither
diagnosed as harmful but both pointless: replies were framed `\r\n` where the
reference uses `\n`, and the Code 200 ack carried a `Player` block the
reference does not send.

Also fixed by the same reading: the app's club picker broadcast
`"Message": "Player Information"`, a paraphrase the connector's literal match
ignores. It now sends the real one.

Corrections to the record while here: `LaunchMonitorIsReady` is not "not
implemented" by GSPro in any sense that matters — a connector uses it to say
whether the device is armed, and this backend reads it for exactly that. And
the OpenShotGolf sequence in §3c (club config, then `DetectBall`, re-sent after
every shot) is precisely what the bridge does on receipt of the 201; §3c's
guess that SQG-GSPRO-Connect might expose an auto-re-arm *setting* is moot —
the re-arm is the simulator's job, and this backend is the simulator.

### D22 — A frozen device does not recover on its own — OPEN

Once the connector's arm loop is frozen, nothing this backend can send revives
it: the 19:30 session sent six 201s over a minute to a device that never lit.
No software recovery has been found. The bay procedure is to power-cycle the
Square and restart the connector, which is now in the runbook.

This matters for interpreting any future test: **a session that starts against
an already-frozen device will fail however correct the code is.** Power-cycle
first, then judge.

### D25 — SOLVED: the Square arms and re-arms continuously — 8 September

```
07:51:14  sent player info on connect (club DR) -- this arms the first strike
07:51:38  monitor reports READY after 12.4s -- ball seen, armed for the next strike
07:51:46  monitor reports NOT READY -- no ball on the mat
07:51:54  monitor reports READY after 8.8s -- ball seen
07:51:58  monitor reports NOT READY
07:52:07  monitor reports READY after 8.9s -- ball seen
```

Ball on, ball off, ball on -- the device detecting and re-detecting without a
single re-arm being sent. **The connect-time 201 puts it into continuous
detection.** Nothing has to be done per shot.

What fixed it was D23: restoring the CRLF framing and the `DistanceToTarget` +
`Surface` fields, both of which had been removed to match GolfForge, whose
Square profile was validated against a different connector than this bay runs.
Every session here that ever detected a ball had used them. The lesson is
cheap to state and was expensive to learn: **when a reference and the hardware
in front of you disagree, the hardware is right.**

Standing corrections to the entries above:

- **D18 is overstated.** The Square does not need re-arming after every shot;
  it re-arms itself. The connect-time arm is what it was ever waiting for.
- **D21's settle timer is unproven on this connector.** No shot was taken in
  the 8 September log, so the post-shot path has not run against a working
  device. It is kept because it is harmless — one message, three seconds after
  club data — and because it may still matter for the reported once-a-round
  stall. If a session ever shows a shot followed by a clean re-arm without it,
  delete it.
- **D19 (club change) and the D24 probe never fired.** The connect-time arm
  was already enough. The probe stays for the once-a-round stall, unarmed by
  default now that `full` is known to work.

Two log defects the same session exposed, both fixed. A resting Square sends a
non-shot frame every two seconds forever, and logging each one buried the lines
that matter; repeats are now counted, not printed. And its resting frame sets
`ContainsBallData` with `Speed: 0.0`, which the rejection message described as
"ContainsBallData not set" — sending a reader hunting a flag that was there all
along. It now reads `ball on the mat, not yet struck`.

### D26 — The probe was the default, and that is likely what froze it

8 September, afternoon. The device armed on connect and cycled READY /
NOT READY correctly for three and a half minutes with **no message sent**.
A shot was then struck (7.9 mph, recorded and merged correctly). Three seconds
later the probe fired five arm messages over 75 seconds, and the device never
reported ready again.

`gspro_arm_variant` defaulted to `""`, and `""` meant *probe*. So five arm
messages after every shot was the shipped behaviour — the exact pattern the
reference implementation names as freezing the connector's arm loop — while
`RUNBOOK.md` and the run sheet both said unset meant "the message that works".
The documentation described the intent; the code did the opposite.

Default is now `full`: one message, once. `""` means `full` too, so an empty
`.env` line cannot re-enable probing. `probe` must be asked for by name.

**The open question, stated honestly.** Two sessions, one pattern:

| Session | Messages sent after a shot | Device afterwards |
|---|---|---|
| 8 Sep morning | none — no shot was taken | armed and re-armed itself for minutes |
| 8 Sep afternoon | five, over 75 s | never armed again |

That is consistent with the probe freezing it. It is equally consistent with
the device simply not re-arming after a shot, which is the symptom this whole
week began with. **One session cannot separate them, and the difference decides
whether we send one message or none.**

`gspro_arm_variant=none` is the discriminator, and it is the setting to try
first: it is the only value that cannot itself be the cause. If the device
re-arms with `none`, the answer is that this connector needs nothing from us
and every arm message after connect has been damage. If it does not, the
re-arm is genuinely required and `full` is the next candidate.

### D23 — The reference profile was validated against a different connector

The single most useful fact found all evening, and it invalidates part of D21.

GolfForge's `squaregolf` profile — the source of the 3 s settle, the "exactly
one re-arm", and the two-field 201 — is validated against
**`brentyates/squaregolf-connector`**, whose frames carry
`DeviceID: "CustomLaunchMonitor"`. This bay runs the **official** SQG connector,
whose frames carry `DeviceID: "SquareGolf"`. Different program, different state
machine, and its quirks were never in scope for that profile.

So D21's rules are a good prior and nothing more. Where local evidence
disagrees, local evidence wins — and it does on two points, both now restored:
CRLF framing and a 201 carrying `DistanceToTarget` and `Surface`. Every session
in this bay that detected a ball used both; the commit that dropped them is the
one where no ball was seen at all.

The other half is the hopeful part. Forum reports are consistent that the
official connector **re-arms fine against real GSPro** — 18 holes on Square's
native course clean, and at most "a couple times per round if any" on GSPro,
with K (club up) as the fix when it sticks. **A message that re-arms this
device therefore exists.** The open question is only which one, and that is a
search, not a design problem.

Note the shape of the reported failure: it bites on the *driving range* and
rarely on a course. On a course GSPro sends a fresh 201 after every shot
because the situation genuinely changed — new lie, new distance. On a range
nothing changes. That is why `distance_change` is a probe candidate and not a
superstition.

### D24 — Probe the arm message, one session instead of one per hypothesis

Six bay sessions went on testing one hypothesis each, and each cost an evening
because the answer only arrives when a golfer swings. `gspro_arm_variant`
unset now makes the backend try each candidate in turn after a shot and report
which one the device answers:

| variant | message | why |
|---|---|---|
| `full` | 201 + `DistanceToTarget` + `Surface` | what GSPro sends on a course; the shape live when the first ball was detected |
| `distance_change` | as above, distance never repeated | if the *change* is the signal, a repeat is not one |
| `club_change` | as `full`, different club | the K-key equivalent |
| `minimal` | 201, `Handed` + `Club` only | GolfForge's validated form |
| `ready` | `{"Code":201,"Message":"GSPro ready"}` | the connector family's other arm message, undocumented |

This deliberately accepts the freeze risk D21 warns about. The trade is sound:
a device that has not armed is *already* in the failed state, so a further
attempt costs nothing that has not already been lost, while a session that
tests one message and fails costs an entire evening.

The success signal needs the golfer. `LaunchMonitorIsReady` is the connector's
*ball-ready* flag, so it can only go true once a ball is physically on the mat
— hence `PUT A BALL ON THE MAT NOW` in the log and a 15 s window per candidate.

On success it logs `ARMED by '<variant>'` and the value to pin in `.env`. Pinned,
it sends that one message and stops, which is the whole protocol.

**D12 is closed by these two.** "The monitor is not registering the ball" was
never true. It registered the ball; the backend discarded the frame, and then
failed to re-arm the device for the next one.

---

## 3b. External advice, reviewed

A multi-camera engineering brief came in from Gemini on 6 September. Much of it
is good and some of it is acted on below. Three of its directives would undo
decisions made here for measured reasons, so they are recorded as rejected
rather than left to be rediscovered.

| Directive | Verdict |
|---|---|
| Use `cv2.stereoCalibrate` for extrinsics | **Rejected.** It assumes a narrow baseline; at 90° one view is always near edge-on and it converges to nonsense. This is why each camera is placed independently against a shared board — see the `calibration.py` docstring. |
| Make camera 1 the world origin | **Rejected.** The board on the floor is the origin precisely so the world is gravity-aligned. Anchored to a camera, every angle inherits that camera's tilt and "vertical" stops meaning vertical. |
| Desync makes rays fail to intersect, producing an obvious ghost joint | **False, and dangerously so.** The opposite is true at 90°: face-on fixes one axis, down-the-line the other, so mistimed frames intersect *cleanly*. Measured in D15 — a 200 ms skew reprojects at 0.21 px while costing 82° of shoulder turn. Nothing announces itself. |
| Three rays "drastically reduce" positional uncertainty via bundle adjustment | **Overstated, and the wrong algorithm.** Bundle adjustment jointly solves structure and camera parameters; triangulating against a known calibration is DLT plus optional point-only refinement. Measured gain from a third camera: 13%, not "drastic". |
| Four cameras guarantee 100% joint visibility | **No.** 97.3% at 80% per-camera visibility, under an independence assumption that flatters it. |
| Cubic spline interpolation of 2D coordinates | **Use with care.** Splines overshoot at sharp reversals, and a golf swing has two — the top and impact. A shape-preserving interpolant (PCHIP) is the safe upgrade; plain linear is what ships today. |

What it gets right and is worth acting on: MediaPipe resizes to a fixed small
tensor so resolution is largely wasted on pose (with a caveat — it crops to the
subject first, so a golfer small in frame *does* benefit from more pixels);
frame rate is the real constraint and 30 Hz cannot support derivatives; shutter
speed matters more than either; and N-view DLT with per-ray confidence gating
is exactly the right target, which is what `blocked_reason` and the occlusion
work are building toward.

Its sharpest point — that triangulating a *guessed* landmark against a real one
produces a wildly wrong 3D point — is already defended: `MIN_VISIBILITY = 0.5`
drops low-confidence landmarks rather than solving them, so the failure mode
here is missing data, not wrong data. That is the whole reason the occlusion
argument for a third camera is about *coverage*.

---

## 3c. Prior art, reviewed 7 September

Three references the user pointed at. None had informed anything built here
before this.

### GolfForge — a GSPro replacement, not a rival to this app

`github.com/GolfForge/GolfForge`. An AGPL-3.0, Unreal Engine 5 **course
simulator** with AI-assisted course building from LIDAR and walking/treadmill
integration. It is the half of the stack GSPro occupies, not the half this app
occupies — it plays courses, it does not analyse swings. So there is little to
borrow: the novel ideas below came from SwingNerds instead.

What matters here is that it speaks **GSPro Open Connect on port 921**, the
same protocol the pass-through relay already forwards. GolfForge would drop
into the place GSPro sits with no backend change at all, which makes the
subscription optional rather than necessary.

Its Square support, though, is **not a solution to the bay's problem**: it
delegates to `brentyates/squaregolf-connector`, the repo that was taken down.
Its table reads "Square Omni / Square Golf ✅ validated", and the README
specifies the *Omni* — which is not the unit in this bay.

One operational detail worth having: its quick-start says to **select the
monitor in GolfForge first, then launch the connector**. If the connector does
not retry a refused connection, starting it before its destination is
listening would leave it looking connected to the device and silent toward the
PC. Worth ruling out before anything harder.

A licence note, since this build may be shared: AGPL-3.0 is strongly copyleft.
Borrowing GolfForge code into this app would oblige releasing this app's source
under AGPL too, network use included. Running it alongside as a separate
program carries no such obligation.

### The Square must be armed, and re-armed after every shot

The one finding that acts on the bay's actual blocker.
`jhauck2/OpenShotGolf` carries a working Square implementation in
`addons/launch_monitors/square/`. Its connection session establishes this
sequence, which explains a monitor that pairs and then never reports:

1. Heartbeat, immediately on connect.
2. Club configuration, after a short delay — the device is told which club and
   which handedness before it will detect anything sensibly.
3. **`DetectBall` — this arms shot detection.** Until it is sent the device sits
   connected and idle.
4. Heartbeat on a timer thereafter.
5. **After every reported shot, `DetectBall` is sent again to re-arm.**

Step 5 is the one that will bite twice: a connector that arms once but never
re-arms yields exactly one shot per session and then silence, which reads like
a flaky monitor rather than a protocol gap.

**Confirmed on the hardware the same evening — that is exactly what happened.**
See D18 for what the arming message turned out to be (Code 201, not a `Player`
block on a Code 200) and where the re-arm has to fire from.

**Nothing here should be copied into this repo.** It is someone else's
implementation, and this corner of the ecosystem has already seen one takedown.
The finding is a fact about how the user's own hardware behaves, and the action
is to check whether SQG-GSPRO-Connect exposes club selection, a detection or
spin mode, and an auto-re-arm setting — not to reimplement the protocol.

Incidental: OpenShotGolf listens for GSPro Open Connect on port 49152, which
confirms the port is a convention rather than a requirement. Useful to know for
the pass-through arrangement, where the listener already moves to 922.

### SwingNerds — two ideas worth taking

A commercial product covering much the same ground (and supporting Square).
Most of what it does this build already has or has planned. Two do not:

**Automatic data-quality flagging.** It marks partial swings, practice swings,
shots played with the wrong club, and outliers, and excludes them from
analytics. This matters more than it sounds: a range session is full of
half-swings and mishits, and dispersion built on unfiltered shots is a lie.
This build is unusually well placed to do it — a practice swing is video with
no telemetry, a mishit is a flight the model can flag against the club's own
distribution, and a wrong club shows as a carry far outside its group. It fits
the existing schema as a status on the shot rather than a new subsystem, and it
belongs alongside `depth_reason` as another thing the app says plainly.

**A nominated standard swing per club.** Rather than comparing arbitrary pairs,
one shot per club is marked the reference, and every new shot plays against it
in sync. Better than the generic comparison in `DESIGN_BRIEF.md` §6, and it
needs the same missing piece.

### brentyates/golf-cam and brentyates/swing-cam — the phone question

Same author as the Square connector. Two capture rigs, neither adopted, but
one changes how the unbuilt Android app should be judged.

**golf-cam** is a Raspberry Pi 5 with a Global Shutter camera (IMX296),
120 fps and configurable higher, triggered from a web page or a GPIO button.
Hardware this bay does not have. Its transferable point is global versus
rolling shutter: a phone reads its sensor line by line, so a clubhead at
impact is *sheared* rather than blurred. That would matter if anything were
measured from the impact clip — but pose runs on the two Kinovea cameras and
the impact clip is viewed, never measured. So it is a cosmetic artifact here,
not an error, and not a reason to buy a Pi.

**swing-cam** is the interesting one: a Kotlin Android app that runs an HTTP
server on the phone and records on `POST /api/record`. That is the opposite
architecture to `android/impact-watcher/` in this repo, which watches
MediaStore and uploads whatever the stock camera produced.

| | swing-cam | impact-watcher (here) |
|---|---|---|
| Direction | PC commands the phone | Phone records, app observes |
| Workflow | Arm, then swing | Swing whenever; it is caught |
| Complexity | Much lower — no MediaStore, no dedupe | ~1000 lines, never built or run |
| Slow motion | Delegates to the device's own mode | Stock camera, so Super Slow-mo |
| Knows when recording began | **No** — see below | Via `trigger_ts` |

The obvious hope was that commanding the phone would finally pin down
`impact_ms` for the impact clip. It does not: swing-cam's record response is
`{"success": true, "message": "Recording started", "duration": 5}` with no
timestamp, so the caller knows when it *asked*, not when the camera actually
began. App latency and camera warm-up sit in between. On that specific axis
the design already in this repo is the better one, because `trigger_ts` plus
`GOLFSIM_IMPACT_TRUST_TRIGGER_TS` at least carries a capture-time hint.

It is still worth knowing about, for one reason: **it is a working app and
ours is a thousand untested lines.** If the phone path is wanted quickly, an
arm-then-swing workflow driven from a dashboard button is far less risk than
finishing and debugging the watcher. The cost is the workflow change, and one
real caveat — swing-cam targets a Pixel 9 and leans on that device's
slow-motion mode. CameraX high-speed support is device-specific, so it may not
behave the same on an S23+.

### Reading HackMotion and Blast Motion off a screen — tested, viable

Neither device exposes an API, but both display their numbers on a tablet.
Capturing that display and reading the numbers is a real option, and it was
worth measuring rather than assuming. Six values on a synthetic readout, with
RapidOCR (pip-only, ONNX, no system dependencies, runs offline in ~200 ms):

| Input | Result |
|---|---|
| Clean screen capture | 5/6 correct, 6th **rejected** rather than guessed |
| Camera + glare + 9° skew + blur | 5/6 correct, 6th rejected |
| Camera, 16° skew + heavy blur | nothing read — fails loudly, not quietly |

Three findings that decide the design.

**Do not crop fixed regions.** The obvious approach — define a box per field
and OCR each — scored *worse* (3/6) than reading the whole image, because
slightly wrong boxes clip digits: "3.1" read as "3", "82" as "32", "0.24" as
"24". Read the whole frame, then bind each number to its nearest label using
the OCR bounding boxes. No hand-tuned boxes to drift.

**Confidence scores are worthless here.** Every one of those clipped misreads
came back at 0.94–1.00 confidence. A confidently wrong number is precisely the
failure this build exists to avoid, and OCR confidence will not catch it.

**Plausibility ranges are what work.** A per-field range — tempo 1.5–5.0, club
speed 40–140 mph, time to impact 0.10–0.45 s — caught the one bad pairing in
every run and turned it into a missing value instead of a false one. Same
principle as `_implausible` for the skeleton and `shot_rejection_reason` for
GSPro frames, and it should be built the same way.

**Capture the screen, do not photograph it.** For an Android tablet `scrcpy`
mirrors over USB and gives a pixel-perfect frame — no glare, no moiré, no
perspective, no auto-brightness. For an iPad, HDMI out into a capture card.
A camera works, as the table shows, but it is the harder path for no gain.

Correlation is the easy part: the tablet updates seconds after the swing, so
this is just another late-arriving source and the existing pairing window plus
late-attach grace already handle it. Watch for the displayed values to change,
stamp that moment, submit.

One thing to build in from the start: **keep the cropped image beside the
number.** It costs a few KB and makes any suspicious reading auditable by eye,
which no confidence score can offer.

Not started. Needs a real screenshot of each app's readout before the label
list and ranges can be written against the actual UI rather than a guess.

### Both converge on club tagging

Dispersion, gapping, per-club standard swings, and wrong-club detection all
require knowing which club was used. It is one field on the shot and one
control in the UI, and it is the keystone for everything above.

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
- Still open from before: Kinovea's audio trigger has not been located.
  The Square itself is no longer open — it registers the ball and reports a
  full strike; see D17/D18.

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
