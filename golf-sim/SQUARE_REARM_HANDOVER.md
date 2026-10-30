# Square re-arm: handover

Written 30/10/2026 for whichever agent picks this up next. It stands alone: you do not need the chat
history. Where it disagrees with an older doc, this file is the later word. The full reasoning behind
each finding is in `SSOT.md` entries D12 to D29.

---

## 1. The problem

**The Square launch monitor reports one shot per session, and then never re-arms.**

After connecting, the Square detects a ball (the face lights, the unit is ready) and reports the
strike correctly. After that first strike the face never lights again and the unit never goes green.
No second shot is detected until the session is restarted: backend, connector, and sometimes a
power-cycle of the Square.

The goal is many shots in one session, as the Square does when it is paired with real GSPro.

---

## 2. The setup

```
Square LM ──BLE──► SQG-GSPRO-Connect ──TCP 127.0.0.1:921──► this backend (pretends to be GSPro)
(original,         (official Square Golf      GSPro Open Connect v1, JSON      golf-sim/backend/gspro.py
 not the Omni)      connector, Windows,        frames both ways
                    CLOSED SOURCE)
```

- The connector believes it is talking to GSPro. The backend impersonates GSPro's side of the
  Open Connect protocol: it acknowledges frames and sends player info.
- Frames from the connector carry `DeviceID: "SquareGolf"`. That is the official connector, **not**
  the open-source `brentyates/squaregolf-connector` (its frames say `CustomLaunchMonitor`). This
  distinction matters (see section 7).
- Sim PC: Windows, repo at `C:\luciole-website\golf-sim`, backend started with
  `uvicorn backend.main:app --host 0.0.0.0 --port 8000`. Settings are `GOLFSIM_*` in
  `golf-sim/.env`.
- Code: repo `djackal79/luciole-website`, branch `claude/golf-simulator-backend-9a46d5`, folder
  `golf-sim/`. That folder exists only on this branch, not on `main`.
- Startup order matters. Start the backend first, then the connector, because the connector
  connects once and never retries.

---

## 3. What is solved and what is not

| Part | State | Evidence |
|---|---|---|
| Connector reaches the backend | **Solved** | `launch monitor connected from ('127.0.0.1', ...)` |
| Square arms on connect | **Solved** (D25) | One Code 201 on connect with the full player block, CRLF framed (see §5). Before this the device sat at `LaunchMonitorIsReady: false` forever. |
| Square re-detects a ball before any shot | **Solved** | 08/09/2026 morning: READY and NOT READY tracked a ball being placed and lifted, repeatedly, for minutes, with nothing sent. |
| The strike is recorded | **Solved** (D17) | Every frame is flagged `IsHeartBeat: true`, strikes included, so frames are judged by content. Example strikes: 94.9, 78.1, 92.7, 84.4, 71.7 mph. |
| One swing becomes one shot | **Solved** | Ball frame then club frame about 700 ms later, same `ShotNumber`, merged into one shot. |
| **Device re-arms after a strike** | **UNSOLVED** | After the club frame the device reports NOT READY and never returns to READY in that session. |

Only the last row is open. Everything before it works and is covered by tests.

---

## 4. What the Square sends (real frames)

Frames captured on 07/09/2026, pinned verbatim in `tests/test_gspro.py` as `SQUARE_BALL` and
`SQUARE_CLUB`. Abridged:

```jsonc
// 1. Ball frame: the strike
{"DeviceID":"SquareGolf","Units":"Yards","ShotNumber":3,"APIversion":"1",
 "BallData":{"Speed":94.89,"SpinAxis":-6.91,"TotalSpin":5232,"BackSpin":5194,"SideSpin":-629,"HLA":-3.77,"VLA":17.19,"CarryDistance":0},
 "ClubData":{ all zeros },
 "ShotDataOptions":{"ContainsBallData":true,"ContainsClubData":false,
                    "LaunchMonitorIsReady":true,"LaunchMonitorBallDetected":true,"IsHeartBeat":true}}

// 2. Club frame, ~700 ms later: same ShotNumber, BallData repeated, end of shot
{ ...same BallData...,
 "ClubData":{"AngleOfAttack":-3.05,"FaceToTarget":-4.3,"Loft":23.71,"Path":-0.49, ...},
 "ShotDataOptions":{"ContainsBallData":false,"ContainsClubData":true,
                    "LaunchMonitorIsReady":false,"LaunchMonitorBallDetected":false,"IsHeartBeat":true}}

// 3. Resting frame, every ~2 s while idle
{ ...BallData all zeros...,
 "ShotDataOptions":{"ContainsBallData":false,"ContainsClubData":false,
                    "LaunchMonitorIsReady":false|true,"LaunchMonitorBallDetected":false|true,"IsHeartBeat":false}}
```

Observed quirks:

- `LaunchMonitorIsReady` behaves like **"a ball is on the mat and being watched"**. It goes false
  whenever the mat is empty, including right after connect, before any shot. It is not a request to
  re-arm.
- `IsHeartBeat` is true on strike frames. Do not use it to classify.
- `ShotNumber` is not a pure shot counter. It has stayed at 3 across sessions, and it has also
  stepped from 1 to 2 with no strike.

---

## 5. What the backend sends now

| When | Bytes on the wire (each object ends with `\r\n`) |
|---|---|
| On connect | `{"Code":201,"Message":"GSPro Player Information","Player":{"Handed":"RH","Club":"DR","DistanceToTarget":200,"Surface":"tee"}}` |
| Every frame received | A 200 ack carrying `"Player":{"Handed":"RH","Club":"DR","DistanceToTarget":0}`. The `Message` is "Heartbeat received" or "Status received" for non-shots. For shots it is "Ball Data received" or "Club & Ball Data received" (from 10/09). |
| After the club frame (end of shot) | Set by `GOLFSIM_GSPRO_ARM_VARIANT`, see below |
| 30 s after that | Nothing is sent. The log says `still not armed 30s after ...` if READY never came back. |

`GOLFSIM_GSPRO_ARM_VARIANT` modes (`backend/gspro.py`, `_rearm_later`, `_arm_message`):

| Value | Sends after the shot | Bay-tested? |
|---|---|---|
| `full` (default) | One 201 (same shape as on connect), 3 s after the club frame | **Yes, failed** on 10/09 |
| `none` | Nothing | **No** |
| `gspro` | The 200 ack and the 201 in one write, immediately on the club frame | **No** |
| `ready` | `{"Code":202,"Message":"GSPro ready"}`, 3 s after | **No** (it was only ever sent as Code 201, which was wrong) |
| `distance_change`, `club_change`, `minimal` | Variants of the 201 | Only inside `probe`; confounded |
| `probe` | Five candidates, 15 s apart | **Yes, failed** on 08/09 |

Pass-through (`GOLFSIM_GSPRO_FORWARD_ENABLED=true`) relays every frame to a real GSPro and sends
nothing of its own. With `GOLFSIM_GSPRO_LOG_FRAMES=true` it logs GSPro's replies verbatim as bytes
(`gspro reply <- GSPro: b'...'`). Built 19/09/2026 and **never run in the bay**.

---

## 6. What was tried, in order

Times are local, from Carl's pasted logs. Commits are on the branch.

| # | Date / time | Change (commit) | Result in the bay |
|---|---|---|---|
| 1 | 07/09 | Log every frame (`7eb4161`) | Connected, but `LaunchMonitorIsReady: false` forever. No ball ever detected. |
| 2 | 07/09 | **201 Player Information on connect** (`c7a511d`). Previously Player info only rode inside 200 acks. | **Device armed. 94.9 mph ball detected.** But the shot was discarded. |
| 3 | 07/09 | Judge frames by content, not `IsHeartBeat` (`3129a78`) | Shot recorded. The club frame then crashed the connection. |
| 4 | 07/09 | Fixed the merge crash (`0cb7f0e`) | One shot, cleanly. "Still can't hit a second shot." |
| 5 | 07/09 | Re-arm 201 on any not-ready frame (`b4f8e1f`) | 78.1 mph shot, 201 sent at once, no READY |
| 6 | 07/09 | Log tidy plus health fields (`7767376`) | 92.7 mph shot, 201 sent, no READY |
| 7 | 07/09 | **Club-change nudge**: 201 with 7I then DR (`7d3588d`). Based on a forum report that pressing K (club up) in GSPro fixes a stuck Square. | 84.4 mph shot, nudge sent, no READY |
| 8 | 07/09 | Back off retries (`ae69769`) | 5.6 mph club frame, nudge sent, no READY. Carl: the face lights only the first time. |
| 9 | 07/09 | **3 s settle timer, then 201 with retries.** Dropped `DistanceToTarget`/`Surface` and changed framing to `\n` to match GolfForge (`0c61669`). | **Regression: no ball seen at all.** It also re-armed on the first not-ready report after connect, six times. |
| 10 | 07/09 | Re-arm on club frame only, exactly one 201 (`989a0f3`) | Not tested on its own |
| 11 | 07/09 | **Restored** `DistanceToTarget`/`Surface` and CRLF, plus the probe mode (`cb52faf`). Probing was accidentally the default. | **08/09 morning: arms on connect, re-detects balls for minutes.** No strike taken. |
| 12 | 08/09 afternoon | Same code | One strike (7.9 mph). Probe sent five variants over 75 s. Never READY again. Carl: "3rd shot then failed". |
| 13 | 08/09 | Default changed to `full`; added `none` (`5abd70c`) | n/a |
| 14 | 10/09 | Same code, `full` | **71.7 mph strike recorded. One 201 sent 3 s later. Never READY.** One message fails just as five did. |
| 15 | 10/09 | Shot acks use the connector's recognised words (`dfc6047`) | **Not tested** |
| 16 | 19/09 | `gspro` mode, `ready` changed to Code 202, pass-through capture logging (`5a61f90`) | **Not tested** |

From 18/09 onwards Carl paused the Square work.

---

## 7. What outside sources say, and how reliable each is

| Source | How it was read | What it says |
|---|---|---|
| Golf Simulator Forum, "Square not re-arming" | **Search-result summary only**: the site blocks automated fetches | With real GSPro the Square sometimes fails to re-arm, and pressing K (club up) re-arms it. People report this as an official-connector issue that happens a few times a round, not every shot. Read the thread yourself. |
| `GolfForge/GolfForge`, `engine/Golfsim/Source/Golfsim/Drivers/` | Cloned; README and C++ read directly | Its Square profile: the connect-time 201 arms shot one; on the club frame it waits a ~3 s settle, then sends exactly one 201, with no retry. Re-arming early or on a timer "freezes the loop". **Validated against `brentyates/squaregolf-connector`, not the official connector.** |
| `griff12/squaregolf-connector` (a fork of the taken-down brentyates connector) | Cloned; Go source read directly | It arms the Square (BLE club command, then detect-ball) when it receives a message whose text is exactly "GSPro Player Information" or "GSPro ready". It only sends frames when its ready state changes. It recognises three ack texts: "Ball Data received", "Club & Ball Data received", "Shot received successfully". **This is a different program from the official connector.** |
| `PinPoint-Golf/libgspro` docs (`protocol.md`, `conformance.md`) | Cloned; read directly | A survey of 17 Open Connect clients. After a shot, real GSPro sends `{200}{201}` in one segment, with a non-zero `DistanceToTarget`. "GSPro ready" is **Code 202**. Some clients arm only after a 202. A zero-speed shot makes GSPro reset the club. **The Square's official connector is closed and nobody has read it.** |

The bottom line: **every rule applied so far comes from other people's connectors.** Nobody,
including this project, has observed what the official connector needs after a shot.

---

## 8. Mistakes not to repeat

1. **Inferring from logs that end too soon.** Most pasted logs stopped within seconds of the shot,
   before the outcome. The backend now logs a line 30 s later, so ask for the log past that point.
2. **Trusting a reference built for different hardware.** GolfForge's rules were tuned on
   brentyates' connector. Applying them (attempt 9) broke even first-ball detection.
3. **Building on a fetched summary instead of the source.** Attempt 9 came from a model-written
   summary of GolfForge. When the C++ was read directly, the rule turned out to be stricter.
4. **Changing several variables at once.** Attempt 9 changed framing, fields, timing and the
   trigger together, so nothing could be attributed.
5. **Defaults that contradict the docs.** An empty setting meant "probe five messages" while the
   runbook said it meant "the message that works".
6. **Testing on a frozen device.** Once frozen, the Square needs a power-cycle plus a connector
   restart. A test that starts frozen tells you nothing (D22).

---

## 9. What to try next, in order

Each step either finds the answer or removes a whole class of explanation. They are cheapest and
most decisive first.

### Step 0: establish the baseline (no backend at all)

Run **real GSPro** with the Square through SQG-GSPRO-Connect as normal, on the practice range, and
hit ten shots. Does the face relight after each shot? Is K ever needed?

- **If GSPro also stalls after one shot in this bay**, the fault is upstream (connector version,
  Square firmware, Bluetooth), and no change to this backend can fix it. Check for connector and
  firmware updates, or contact Square Golf.
- **If GSPro re-arms reliably**, a message or timing that works exists. Go to step 1.

This baseline has never been established in this bay.

### Step 1: capture what real GSPro sends

Either option below records the exact bytes and timing GSPro sends to the connector after a shot.

**Option A, the backend's pass-through (already built):**

```ini
GOLFSIM_GSPRO_PORT=922
GOLFSIM_GSPRO_FORWARD_ENABLED=true
GOLFSIM_GSPRO_FORWARD_PORT=921
GOLFSIM_GSPRO_LOG_FRAMES=true
```

Start GSPro (it takes 921), then the backend (922), then the connector set to `127.0.0.1:922`
(tick "Use custom IP/Port"). Hit three shots. Every GSPro reply is logged as
`gspro reply <- GSPro: b'...'`. In this mode the backend sends nothing of its own.

**Option B, a loopback packet capture:** use Wireshark with the Npcap loopback adapter, or RawCap,
on `127.0.0.1:921`, with GSPro and the connector talking directly. Nothing of ours is in the path,
so it cannot be our bug.

Look for what arrives after the club frame. Note the Code, the Message text, the Player fields
(does `DistanceToTarget` change?), whether it is concatenated with the 200, and the delay after the
club frame.

### Step 2: replay it

Make the backend send exactly the captured bytes at the captured delay. This needs a small change
in `_rearm_later` or a new arm variant, and a test that pins the captured bytes. If the device
re-arms, it's solved: record it as a D-entry in `SSOT.md`.

### Step 3: if no capture is possible, test the untested modes, one per session

Test in this order: `GOLFSIM_GSPRO_ARM_VARIANT=none`, then `gspro`, then `ready`. Note that 
`full` already includes the new acks from `dfc6047`, which were never bay-tested, so a
re-run of `full` is also a valid test. Ideas not yet built: a longer delay (8 to 10 s, roughly a
real ball flight), and a 201 whose `DistanceToTarget` and `Surface` both change after every shot,
as GSPro does on a real course.

### Also worth a look

- **The connector's own window and settings.** No settings beyond IP and port have ever been
  checked by eye in this bay. Look for anything like auto-ready, practice mode or a log pane, and
  for "Unknown message" lines. A screenshot of the connector after a stall could answer a lot.
- **Square's own app.** Does the Square re-arm shot after shot there? That separates device
  behaviour from connector behaviour.

---

## 10. Protocol for any bay test

1. **Power-cycle the Square** and close the connector.
2. Start the backend with `GOLFSIM_GSPRO_LOG_FRAMES=true`.
3. Start the connector, and confirm `sent player info on connect` appears.
4. Place a ball and confirm `monitor reports READY`. Hit one shot.
5. **Put a ball straight back down** and wait at least 30 s. READY only fires when a ball is on the
   mat.
6. Save the **whole** log from start-up to at least 30 s after the shot, plus a note of what the
   device's face did.

Change **one** variable per session.

---

## 11. Files

| File | What it is |
|---|---|
| `backend/gspro.py` | Listener: arming, re-arm modes, pass-through, logging |
| `backend/models.py` | `shot_rejection_reason`, `is_heartbeat`: how frames are classified |
| `backend/config.py` | Every `GOLFSIM_GSPRO_*` setting, with comments |
| `tests/test_gspro.py` | 40+ tests, including the real Square frames and the regression guards |
| `SSOT.md` D12 to D29 | Every finding with full reasoning, including retractions |
| `RUNBOOK.md` stage 5a | How to read each log line |

Run the tests with `cd golf-sim && pytest -q`. Expect no failures; 5 skips are normal without the
pose extras.
