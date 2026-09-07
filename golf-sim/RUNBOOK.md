# Golf Studio — first run on the sim PC

Get it working in stages, each with a checkpoint. **Do not skip ahead**: if
stage 3 works and stage 5 does not, the problem is hardware, and you have
already proved the software is fine.

Everything runs on the golf sim PC. Nothing is deployed anywhere.

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

**Checkpoint: `92 passed, 1 skipped`.** The skip is the pose model, which you
have not downloaded yet — expected.

If this fails, stop. Nothing downstream will work and the failure message is
the most useful thing you will get all night.

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

Remember there are two links, and the backend can only see one:

```
Square LM ──(Bluetooth)──► bridge ──(TCP 921)──► backend
               invisible here          visible in the log
```

`clients: 1` with no shots means the TCP half is fine. It does **not** follow
that the Bluetooth half is broken — that assumption cost an evening on
7 September, when the monitor was reporting perfectly and this backend was
discarding the frames. Read the log before suspecting the hardware:

| In the log | What it means |
|---|---|
| `sent player info on connect` | The first arm. The face should light within a second or two. |
| `monitor reports READY -- armed for the next strike` | Bluetooth is fine and the device is armed. Any missing shot from here is a backend or bridge problem, not the monitor. |
| `monitor reports NOT READY -- re-arm in 3.0s` | Normal after every shot. The device has to finish its own cycle before it will take another arm signal; the backend is waiting it out on purpose. |
| `re-arm 1 sent (club DR) 3.0s after the shot` | The arm signal went. The face should light within a second or two. |
| `armed again after 4.2s and 1 re-arm attempt(s)` | It worked. This is the line to look for. |
| `still not ready ... giving up` | Six re-arms over a minute, ignored. Real fault — keep the log. Selecting a club in the app sends one more. |
| `ignoring frame -- <reason>` | A frame arrived and was not treated as a strike. The reason is printed in full; that is the thing to report. |
| Nothing at all after `launch monitor connected` | Now suspect Bluetooth. The bridge's own window shows that half, and the ball-ready sound tests it without touching any config. |

The same answer without tailing the log — `monitor_ready` is `true`, `false`,
or `null` for "it has never said", which is a different fault from "it said
no":

```powershell
curl.exe http://127.0.0.1:8000/api/health
```

**After a shot the monitor reports NOT READY, and that is normal.** The
device disarms itself after every strike and needs to be told to arm again —
but not for about three seconds, or it freezes for the rest of the session.
The backend waits that out and then sends the arm signal once. Watch for
`armed again after …`; that line, not the absence of an error, is what says
you can swing again. Do not change club in the app inside those three
seconds — that sends the same signal early.

Then:

```powershell
curl.exe http://127.0.0.1:8000/api/health
```

**Checkpoint:** `gspro_socket.clients` is `1`. Hit a ball — a shot appears with
telemetry and no video.

**To play GSPro at the same time**, sit in the middle rather than taking
turns. In `.env`:

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
| Bridge connected (`clients: 1`) but no shots | Two links in the chain. Check the bridge's own window for the launch monitor connection — the Bluetooth half is invisible to the backend. |
| Every swing produces **two** shots | Both Kinovea hooks send the same `SOURCE`. |
| Impact clips arrive but never join a shot | `GOLFSIM_IMPACT_TRUST_TRIGGER_TS` is not `true`. |
| Phone says "unreachable" | Firewall rule missing, or wrong IP, or phone on the guest network. |
| Videos do not play, everything else fine | Backend not running — the frontend proxies media through it. |
| Frontend blank, console shows proxy errors | Backend not on port 8000. |
| `pose_worker.live: false` | Read `reason` in `/api/health`; usually the model was not downloaded. |
| Shots stop completing after ending a session | Fixed — make sure you are on the latest commit. |
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
