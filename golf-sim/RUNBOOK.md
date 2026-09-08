# Golf Studio — first run on the sim PC

Get it working in stages, each with a checkpoint. **Do not skip ahead**: if
stage 3 works and stage 5 does not, the problem is hardware, and you have
already proved the software is fine.

Everything runs on the golf sim PC. Nothing is deployed anywhere.

**State as of 8 September.** Stages 1-4 are proven. Stage 5a — the launch
monitor — now works: the Square arms on connect and re-arms itself, ball after
ball. Stages 5b, 5c and 6 have not been run against real hardware yet, so
treat their checkpoints as expectations rather than observations.

---

## Stage 0 — Prerequisites

| Need | Check | Get it |
|---|---|---|
| Git | `git --version` | <https://git-scm.com/download/win> |
| Python **3.10+** | `python --version` | <https://python.org> — tick **"Add Python to PATH"** |
| Node **18+** | `node --version` | <https://nodejs.org> (LTS) |

Optional but worth having: `winget install Gyan.FFmpeg` — lets the backend
read clip duration and resolution when a camera does not supply them.

---

## A note on shells

Either **cmd** (`C:\>`) or **PowerShell** (`PS C:\>`) works, but they differ in
two ways that will bite you:

| | cmd | PowerShell |
|---|---|---|
| Activate the venv | `.venv\Scripts\activate.bat` | `.venv\Scripts\Activate.ps1` |
| Chain commands on one line | `&&` | `;` |

**Paste commands one line at a time.** A `;` pasted into cmd is not a
separator — it becomes part of the argument, and you get "The system cannot
find the path specified" or an argument error from a command that never ran.

Only one step needs PowerShell specifically: the firewall rule in stage 5c,
which also needs Administrator.

---

## Stage 1 — Clone and install

```
cd C:\
git clone https://github.com/djackal79/luciole-website.git
cd luciole-website
git checkout claude/golf-simulator-backend-9a46d5
cd golf-sim

python -m venv .venv
```

Activate it — **cmd**:

```
.venv\Scripts\activate.bat
```

**PowerShell**:

```powershell
.venv\Scripts\Activate.ps1
```

Either way the prompt should now start with `(.venv)`. If PowerShell blocks
the script, run once:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

Then:

```
pip install -r requirements-dev.txt
```

Then create your config:

```
copy .env.example .env
notepad .env
```

Set these three — the rest can wait:

```ini
# Where Kinovea exports. Forward slashes work fine on Windows.
GOLFSIM_KINOVEA_EXPORT_DIR=C:/Users/YOU/Videos/Kinovea

# Required for the phone: Super Slow-mo reaches the PC 4-9s after the strike,
# so a clip has to pair on its capture time, not its arrival time.
GOLFSIM_IMPACT_TRUST_TRIGGER_TS=true
GOLFSIM_LATE_ATTACH_MS=30000
```

**Checkpoint:** `pip list` shows fastapi and uvicorn.

---

## Stage 2 — Prove the backend

```
pytest -q
```

**Checkpoint: `129 passed, 5 skipped` — and above all, zero failures.**

The skips are the pose tests: mediapipe and OpenCV are a ~200 MB optional
install you do not need until stage 6. The exact counts drift as tests are
added, so read the word `failed`, not the numbers. With the pose extras
installed it is 196 passed and no skips.

If anything fails, stop. Nothing downstream will work and the failure message
is the most useful thing you will get all night.

---

## Stage 3 — See it work, with no hardware at all

This is the moment of truth, and it needs no cameras, no launch monitor and no
phone.

**Terminal 1 — backend:**

```
cd C:\luciole-website\golf-sim
.venv\Scripts\activate.bat
python scripts\mock_provider.py --seed data\shots
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — frontend:**

```
cd C:\luciole-website\golf-sim\frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>.

**Checkpoint: seven shots in the history drawer**, and each of these renders
without a crash:

| Shot | What it proves |
|---|---|
| `…143052-478` | The baseline: ball 132.4, smash 1.44, face-to-path −3.5 |
| `…143134-478` | Partial — no impact clip. Video pane must degrade, not error |
| `…143227-478` | Partial — no telemetry. HUD must show "sensor absent" |
| `…143310-478` | Ball data only → **smash factor must be an em-dash**, not 0 |
| `…143353-478` | Heavy draw — spin axis −16.7° |
| `…143436-478` | Both cameras, pose and pressure ready |
| `…143520-478` | Pose still extracting — panel must show progress, not an empty skeleton |

Carry distance is an em-dash on every one. **That is correct**, not a bug: the
launch monitor measures launch conditions, not distance.

---

## Stage 4 — A simulated live session

With both terminals still running, open a third:

```
cd C:\luciole-website\golf-sim
.venv\Scripts\activate.bat
python scripts\simulate_session.py --shots 3 --dtl --check
```

This drives all four sources with realistic, deliberately out-of-order
latencies — telemetry over the real GSPro socket, both Kinovea cameras, and a
phone upload.

**Checkpoint:** `OK: every simulated shot produced exactly one fully paired
package`, and the shots appear in the browser **live, without refreshing**.

If the report says shots are missing sources, that is the pairing engine
telling you something real. Read it before moving on.

---

## Stage 5 — Real hardware, one source at a time

Add these **one at a time** and re-check after each. Everything above keeps
working; you are only replacing simulated sources with real ones.

### 5a — Launch monitor

GSPro must **not** be running: it binds the same port 921.

Point the bridge at GSPro Open Connect on `127.0.0.1:921`. With
SQG-GSPRO-Connect, leaving "Use custom IP/Port" unchecked is correct — the
default is already that address.

**Start the backend first, then the bridge.** The bridge connects once and
does not retry, so every backend restart needs the bridge restarted after it.
The backend prints `launch monitor connected from ...` when it happens; no
line means no connection.

**Then leave it alone.** The backend sends one Code 201 on connect — a full
player block (`Handed`, `Club`, `DistanceToTarget`, `Surface`) framed CRLF —
and the Square arms itself from it. Before any shot has been taken it will then
detect ball after ball for minutes with nothing further sent.

### What a working session looks like

Real log, 8 September, ball placed and lifted three times:

```
07:51:14  launch monitor connected from ('127.0.0.1', 59871)
07:51:14  gspro: sent player info on connect (club DR) -- this arms the first strike
07:51:38  gspro: monitor reports READY after 12.4s -- ball seen, armed for the next strike
07:51:46  gspro: monitor reports NOT READY -- no ball on the mat
07:51:54  gspro: monitor reports READY after 8.8s -- ball seen
07:51:58  gspro: monitor reports NOT READY -- no ball on the mat
07:52:07  gspro: monitor reports READY after 8.9s -- ball seen
```

READY / NOT READY tracking the ball on the mat, with no re-arm being sent, is
the system working. Then hit one:

```
gspro: ignoring frame -- ball on the mat, not yet struck (Speed 0.0, ContainsBallData set)
shot.created 20260908T...-026 via telemetry (created) sources=telemetry
gspro: shot 4 frame merged into 20260908T...-026 (club data arrives separately)
```

**`merged into` is correct, not a double.** One swing arrives as two frames —
ball data, then club data about 700 ms later, sharing a shot number. The second
is folded into the first.

### Reading the log

| Line | Meaning |
|---|---|
| `sent player info on connect` | The arm. Everything else depends on this one. |
| `monitor reports READY -- ball seen` | Armed, ball on the mat, swing away. |
| `monitor reports NOT READY -- no ball on the mat` | Normal. It is what the device says whenever the mat is empty — before your first ball, and after every shot. **Not** a fault and **not** a request for anything. |
| `ignoring frame -- ball on the mat, not yet struck` | The Square talking about a ball it is watching. Expected, once per resting frame. |
| `... and N more like that` | The same reason repeating. A resting Square sends one every two seconds; they are counted rather than printed. |
| `shot.created` then `merged into` | One swing, recorded once. |
| `re-arm sent (club DR) 3.0s after the shot` | Belt and braces. The device normally re-arms itself, so this line is harmless whether or not it was needed. |
| Nothing at all after `launch monitor connected` | Now suspect Bluetooth. The bridge's own window shows that half, and the ball-ready sound tests it without touching any config. |

Remember there are two links, and the backend can only see one:

```
Square LM ──(Bluetooth)──► bridge ──(TCP 921)──► backend
               invisible here          visible in the log
```

`clients: 1` with no shots means the TCP half is fine. It does **not** follow
that the Bluetooth half is broken — that assumption cost an evening on
7 September, when the monitor was reporting perfectly and this backend was
discarding the frames. Read the log before suspecting the hardware.

**If the face never lights at all, the device is frozen and waiting will not
fix it.** Power-cycle the Square, restart the connector, then start a fresh
session. Judge nothing until you have — a frozen device fails every test
regardless of what the backend does.

### The unsolved half: re-arming after a shot

Detection before a shot is solid. **What happens after one is still open.**

`GOLFSIM_GSPRO_ARM_VARIANT` chooses what is sent once the club-data frame
marks the end of a shot:

| Value | Behaviour |
|---|---|
| `full` *(default, and what unset means)* | One Code 201 with the full player block, three seconds after the shot. One only — a repeat is the documented way to freeze the connector's arm loop. |
| `none` | Send nothing. Let the device re-arm itself. |
| `probe` | Try each candidate in turn and report which one works. **Diagnostic only.** |

**If the device stops arming after a shot, try `none` before anything else.**
Both bay logs point the same way: with no message sent, the device armed and
re-armed itself indefinitely; the only session where it stopped is the one
where we sent something after the shot. That is correlation, not proof — but
`none` is the cheap experiment that settles it, and it is the only setting that
cannot be the cause.

`probe` is the last resort. It sends five messages over 75 seconds, which is
precisely the pattern that freezes the loop, so it is worth running only once
the device has already failed to arm and there is nothing left to protect. Set
`GOLFSIM_GSPRO_LOG_FRAMES=true` with it, **tee a ball up and leave it there**
— the device only reports ready when it can see one, so an empty mat tells the
probe nothing — and watch for `ARMED by '<variant>'`. Pin that value afterwards.

Without tailing the log at all:

```powershell
curl.exe http://127.0.0.1:8000/api/health
```

`gspro_socket.monitor_ready` is `true`, `false`, or `null` for "it has never
said" — which is a different fault from "it said no".

**Checkpoint:** `gspro_socket.clients` is `1`, and the log shows READY when a
ball is on the mat. Hit one — a shot appears with telemetry and no video.

**To play GSPro at the same time**, sit in the middle rather than taking
turns. *Not yet tested against the working monitor — expect to debug it.* Note
that in this mode the backend does **not** send the arming 201: GSPro sends its
own, and two would collide. So if the Square fails to arm while relaying, that
is GSPro's side, not this one. In `.env`:

```ini
GOLFSIM_GSPRO_PORT=922
GOLFSIM_GSPRO_FORWARD_ENABLED=true
GOLFSIM_GSPRO_FORWARD_PORT=921
```

Restart the backend, tick **"Use custom IP/Port"** in SQG-GSPRO-Connect and
set it to `127.0.0.1` port `922`, then start GSPro as normal. Every shot plays
the hole *and* gets recorded here. `/api/health` shows
`gspro_socket.pass_through.frames_forwarded` climbing.

Order still matters: GSPro first, then this backend, then the bridge.

If GSPro is not running the app records anyway and answers the monitor itself,
so you can leave the setting on permanently.

Alternatively, to hand port 921 back without pass-through:

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/listeners/gspro?enabled=false"
```

### 5b — Kinovea, both cameras

**Right-click the capture screen's viewport background → "Post-recording
command…"**. It is a per-capture-screen setting, not a global preference,
which suits two cameras exactly: each screen gets its own.

- Face-on screen → `C:\luciole-website\golf-sim\scripts\kinovea_hook.bat`
- Down-the-line screen → `C:\luciole-website\golf-sim\scripts\kinovea_hook_dtl.bat`

Pass the recorded file path as the argument, in quotes. The dialog lists the
variables Kinovea offers; use whichever names the output file.

**Every run appends to `data\kinovea_hook.log`.** Kinovea closes the console
instantly, so that file is the only way to see whether the hook fired, what
path it received, and what the backend said.

**Each camera must use its own .bat.** They differ by one line — `SOURCE`. If
both send the same source, the backend reads the second clip as a *second
swing* and silently doubles every shot.

Edit the fps values at the top of each file to match your cameras.

Test without swinging:

```powershell
scripts\kinovea_hook.bat C:\path\to\any.mp4
```

**Checkpoint:** a shot appears immediately in the browser.

### 5c — Phone

One-time firewall rule. **This one really does need PowerShell, as Administrator** — it will not run in cmd:

```powershell
New-NetFirewallRule -DisplayName "Golf Studio" -Direction Inbound `
  -Protocol TCP -LocalPort 8000,5173 -Action Allow -Profile Private
```

Keep `-Profile Private`. Find the PC's address with `ipconfig`, and give it a
DHCP reservation on your router so it stops moving.

Build and install the app in `android/impact-watcher/` (Android Studio; see its
README). In the app: enter the PC address, tap **Test connection**, then
**Arm**.

On the phone's stock Camera: **More → Super Slow-mo → Auto**, detection box
framed on the ball. That motion trigger *is* your impact trigger.

**Checkpoint:** hit a ball. Within about ten seconds the impact clip attaches
to the shot that is already on screen.

---

## Stage 6 — Pose (optional)

Until you do this, every backend start prints:

```
WARNING backend.pose.pipeline: pose extraction unavailable -- pose dependencies
missing: No module named 'cv2'
```

That is expected and harmless. Shots, telemetry and video all work without it;
only the 3D panel is affected.

```powershell
pip install -r requirements-pose.txt
python scripts\fetch_pose_model.py
```

Restart the backend. `GET /api/health` should show `pose_worker.live: true`
and `reason: null`.

Now each shot goes `pose: pending` and then `ready` a few seconds later. You
get swing plane and spine angle. Shoulder turn, pelvis rotation and X-factor
stay as em-dashes until the cameras are calibrated — one camera cannot measure
them, and a plausible guess would be worse than an honest blank.

---

## When something does not work

| Symptom | Cause |
|---|---|
| `gspro_socket.live: false`, `last_error` mentions address in use | GSPro is running. Close it. |
| Monitor was connected, then stopped after a backend restart | The bridge does not auto-reconnect. Restart the bridge **after** the backend is listening. |
| Bridge connected (`clients: 1`) but no shots | Read the log first. `monitor reports READY` when a ball is on the mat means the whole chain is fine and the problem is elsewhere. Only if nothing at all arrives is it worth checking the bridge's own window for the Bluetooth half. |
| The face lights once and never again | The device is frozen. Power-cycle the Square and restart the connector; nothing in software recovers it. |
| Log floods with `ignoring frame` | Expected — a resting Square sends one every two seconds. Repeats are counted, not printed, so you should see one line and then `... and N more like that`. |
| One swing appears as two shots | Only if both Kinovea hooks share a `SOURCE`. `merged into` in the log is the launch monitor's two frames being folded into one shot, which is correct. |
| Every swing produces **two** shots | Both Kinovea hooks send the same `SOURCE`. |
| Impact clips arrive but never join a shot | `GOLFSIM_IMPACT_TRUST_TRIGGER_TS` is not `true`. |
| Phone says "unreachable" | Firewall rule missing, or wrong IP, or phone on the guest network. |
| Videos do not play, everything else fine | Backend not running — the frontend proxies media through it. |
| Frontend blank, console shows proxy errors | Backend not on port 8000. |
| `pose_worker.live: false`, or `No module named 'cv2'` at startup | Stage 6 not done. Optional — everything else works without it. |
| Shots stop completing after ending a session | Fixed — make sure you are on the latest commit. |
| `pytest` errors on `import numpy` | An old checkout. The pose tests skip cleanly now; pull. |
| "The system cannot find the path specified" after pasting a line with `;` | You are in cmd, where `;` is not a separator. Paste one line at a time. |
| `venv: error: unrecognized arguments` | Same cause — several commands ran as one. |

Useful at any time:

```powershell
curl.exe http://127.0.0.1:8000/api/health     # what is live
curl.exe http://127.0.0.1:8000/api/shots      # what has been captured
```

Backend logs go to the terminal running uvicorn, and say what paired with what.

---

## Viewing from another device

Both servers already listen on all interfaces, so from a laptop or tablet on
the same network open `http://<PC-IP>:5173`. It needs the Stage 5c firewall
rule, since the page talks to port 8000 as well as 5173.
