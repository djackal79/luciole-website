# Running this on the golf sim PC

## The short version

**The backend runs on the golf sim PC itself.** Not in the cloud, not on
another machine on the LAN. Clone the repo there and run it. Everything else —
the Build 2 UI on a laptop or tablet, the phone uploading clips — points at
that PC over your LAN.

There is **no Cloudflare deployment for the golf sim**, and there shouldn't be
one as the primary path. (The `cloudflare/workers-autoconfig` branch in this
repo is an unrelated "Coming Soon" page for the Luciole website.) Remote access
is possible as an *addition* — see the last section — but it needs auth work
first.

## Why it has to be the sim PC

Three hard dependencies on the local machine:

1. **The GSPro socket binds `127.0.0.1:921`.** The launch monitor connects to
   localhost. Move the backend and the monitor has nothing to talk to.
2. **Kinovea's Automation hook hands over a local filesystem path.** That path
   only means anything on the machine Kinovea is running on.
3. **Media is written to and served from that PC's disk.** Video does not want
   to make an extra network hop before it's even stored.

---

## First-time setup

Requires **Python 3.10+** (tested on 3.11) and Git.

```powershell
cd C:\
git clone https://github.com/djackal79/luciole-website.git
cd luciole-website
git checkout claude/golf-simulator-backend-9a46d5
cd golf-sim

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt

copy .env.example .env
notepad .env
```

`ffmpeg`/`ffprobe` are optional but worth installing (`winget install
Gyan.FFmpeg`) — with them, clip duration and resolution are filled in
automatically when a client doesn't supply them.

Nothing needs migrating from the dev environment: `data/` is git-ignored, so
this is a clean install that starts collecting shots on your first swing.

### Verify before touching any hardware

```powershell
pytest -q                                    # expect 54 passed
python scripts\mock_provider.py --seed data\shots
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Then in a second terminal:

```powershell
python scripts\simulate_session.py --shots 3 --check
```

That drives all three sources — telemetry over the real GSPro socket, both
clips over HTTP — and exits non-zero if the pairing is wrong. If it says
`OK: every simulated shot produced exactly one fully paired package`, the
backend is healthy and any later problem is hardware or configuration.

---

## Wiring up the hardware

### Launch monitor

The Square app connects to GSPro Open Connect on `127.0.0.1:921`. Point it
there while the backend is running. `GET /api/health` shows
`gspro_socket.clients: 1` once it connects.

Because GSPro binds the same port, only one can listen at a time:

```powershell
# Course play: release 921 so GSPro can take it. The service stays up.
curl.exe -X POST "http://127.0.0.1:8000/api/listeners/gspro?enabled=false"

# Back to practice
curl.exe -X POST "http://127.0.0.1:8000/api/listeners/gspro?enabled=true"
```

### Kinovea

Options → Preferences → Capture → **Automation**, "command after capture".
Point it at `golf-sim\scripts\kinovea_hook.bat` and pass the recorded filename.
The macro name for the filename differs between Kinovea versions — check the
hint text beside the field. Edit the `CAPTURE_FPS` / `CAMERA` values at the top
of the .bat to match your camera.

Test it without swinging by running the batch file by hand against any mp4:

```powershell
scripts\kinovea_hook.bat C:\path\to\any.mp4
```

A shot should appear in `GET /api/shots` immediately.

If the Automation hook can't be made to work, set
`GOLFSIM_KINOVEA_WATCH_ENABLED=true` and `GOLFSIM_KINOVEA_EXPORT_DIR` to fall
back to the filesystem watcher. It's later and less precise; calibrate
`GOLFSIM_KINOVEA_LAG_MS` upward until swings pair reliably.

### Phone

Two options.

**USB (recommended).** `adb reverse tcp:8000 tcp:8000`, then the phone posts to
`http://127.0.0.1:8000/api/ingest/impact` over the cable. No Wi-Fi dependency,
no firewall rule, sub-millisecond round trip.

**Wi-Fi.** Post to `http://<sim-pc-ip>:8000/api/ingest/impact`. Find the IP with
`ipconfig`; use 5 GHz.

---

## LAN access for the Build 2 UI

uvicorn already binds `0.0.0.0`, and CORS is open, so once the firewall allows
it any device on the LAN can reach the backend at `http://<sim-pc-ip>:8000`.

One-time firewall rule (run PowerShell as Administrator):

```powershell
New-NetFirewallRule -DisplayName "Golf Sim Ingest" -Direction Inbound `
  -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```

Keep `-Profile Private` — you do not want this open on a public network
profile.

Reserve a **static IP or DHCP reservation** for the sim PC on your router.
Otherwise the address moves and every client config breaks.

### Running it as a service

For hands-off starting, either add a Task Scheduler task ("At log on", running
`.venv\Scripts\uvicorn.exe backend.main:app --host 0.0.0.0 --port 8000` with
`golf-sim` as the working directory), or install [NSSM](https://nssm.cc/) and
register it as a Windows service so it survives logout.

---

## Remote access, if you want it

You do not need this for a session in the garage. Only add it if you want to
review shots away from the sim.

**Before exposing anything, understand what's currently unprotected.**
`GOLFSIM_INGEST_TOKEN` guards the two ingest endpoints only. These are wide
open:

- `GET /api/shots` and `/shots/.../*.mp4` — your swing videos
- `PATCH /api/shots/{id}` — anyone can rewrite tags and notes
- `POST /api/session` — anyone can reset your session
- `POST /api/listeners/gspro` — anyone can stop your launch monitor listener
- `WS /ws/shots` — a live feed of everything

**Tailscale is the better answer.** Install it on the sim PC and your phone or
laptop; you get a private encrypted network with no public exposure, no port
forwarding, and no new auth code. The backend stays reachable at its Tailscale
IP from anywhere. This is the recommended option.

**Cloudflare Tunnel** also works with no port forwarding:

```powershell
cloudflared tunnel --url http://localhost:8000
```

But that puts the list above on the public internet. If you go this route, put
**Cloudflare Access** (Zero Trust) in front of the hostname so only your
authenticated identity can reach it, and set `GOLFSIM_INGEST_TOKEN` as well.
A tunnel without Access in front of it is not an acceptable configuration for
this service as built.

Either way, keep the phone uploading over USB or LAN — pushing 6 MB clips
through a tunnel adds latency for nothing.
