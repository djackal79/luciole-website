# Impact Watcher — S23 stock camera → golf sim backend

Records with the **stock Samsung Camera app** and uploads each new clip to the
golf sim PC. No custom camera code, so you keep Samsung's tuned encoder and
Super Slow-mo, including its built-in motion auto-trigger.

The app is a foreground service that watches MediaStore for new clips in
`DCIM/Camera`, waits for each file to finish writing, reads its real capture
frame rate out of the file, and POSTs it to `/api/ingest/impact`.

---

## Why the backend needs one setting changed

This is a **store-and-forward** capture path. The realistic timeline is:

```
t=0.0   strike
t=0.05  telemetry reaches the PC → shot opens
t≈2-5   Samsung finishes processing; the MediaStore row appears
t≈3-6   watcher confirms the file stopped growing
t≈4-9   upload completes
```

Build 1 normally stamps a clip on **receipt**, which is correct for any
live-trigger capture. Here it is wrong twice over: the clip misses its own
shot, and once you are hitting steadily it is *nearer* to the following swing
than to its own — so it pairs to the wrong swing.

So set this on the PC, in `golf-sim/.env`:

```ini
GOLFSIM_IMPACT_TRUST_TRIGGER_TS=true
GOLFSIM_LATE_ATTACH_MS=30000
```

The first makes the backend pair impact clips on the **capture time** this app
sends in `trigger_ts`. The second keeps the shot reachable after its ±3 s
pairing window closed, which it will have, long before the clip lands.

Both are needed. Capture-time pairing decides *which* shot is right;
late-attach is what keeps that shot available to join. A clock more than
`GOLFSIM_TRIGGER_TS_MAX_SKEW_MS` (default 30 s) from the PC's is treated as
broken rather than late, and that clip falls back to receipt stamping.

`tests/test_api.py` pins both the correct behaviour and the wrong-swing
failure it prevents.

---

## Camera setup on the S23

Open the stock Camera app → **More** → **Super Slow-mo**, and switch the mode
selector to **Auto** (the icon with the detection box). Frame the box on the
ball. The phone now records a burst by itself whenever something moves through
that box — that is your hardware trigger, and why this path needs no audio
listener.

If Auto proves too trigger-happy on the mat, **Slow motion** at 1080p/240 with
a manual tap works too; you lose hands-free operation but gain a longer clip.

Two things to check on the first clip, in the app's activity log:

- It should report something like `240/30fps  1500ms real`. If it says
  `30/30fps`, the slow-motion mode did not actually engage.
- `capture_fps` is read from the file's own `com.android.capture.fps`
  metadata. If Samsung doesn't write it for your mode, the log shows only one
  number and the app falls back to the **Capture fps** value in the UI — set
  that to whatever the camera is really shooting, or every duration Build 2
  displays will be wrong.

---

## Building and installing

No Android SDK is needed on the PC — build on any machine with Android Studio.

1. Open `golf-sim/android/impact-watcher` in Android Studio (Giraffe or newer).
   Let it sync; it will fetch the Gradle wrapper and dependencies.
2. `Run` with the S23 connected over USB with developer mode on, or
   `./gradlew assembleDebug` and sideload `app/build/outputs/apk/debug/app-debug.apk`.

Grant **Photos and videos** access when asked. Notifications are optional but
without them you lose the ongoing status and the Disarm shortcut.

### Settings in the app

| Field | Notes |
|---|---|
| PC address | The sim PC's LAN IP, e.g. `192.168.1.50`. Give it a DHCP reservation. |
| Port | `8000` unless you changed `GOLFSIM_PORT`. |
| Capture fps | **Fallback only**, used when the clip carries no rate metadata. |
| Ingest token | Only if you set `GOLFSIM_INGEST_TOKEN` on the backend. |

**Test connection** hits `/api/health` and tells you whether the PC is
reachable before you start swinging. **Arm** starts the watcher.

Arming records the current time and ignores everything older, so it will never
upload your existing camera roll.

---

## Behaviour worth knowing

- **Only `DCIM/Camera` is watched**, and clips longer than 30 s are skipped —
  otherwise a video you shot of something else would be posted to the pairing
  engine as a golf shot.
- **Duplicate protection** is by MediaStore id, remembered for the last 500
  clips, and claimed *before* the upload starts. A repeat MediaStore
  notification during a slow upload cannot post the same clip twice.
- **Failed uploads are queued and retried** every 10 s while armed, and go to
  the back of the queue so one unreachable clip cannot block the rest. A clip
  recorded while the PC was asleep is not lost, but the queue is in memory —
  disarming or killing the app drops it.
- **The file is streamed** from MediaStore rather than copied into memory, so
  a 40 MB Super Slow-mo clip does not need 40 MB of heap.
- Originals stay in your camera roll. The app only reads.

## Limits

- **Android 14 caps `dataSync` foreground services at ~6 hours a day.** Longer
  than any range session, but the service will be stopped if you leave it armed
  all day.
- **Battery optimisation will eventually kill it.** Settings → Apps → Impact
  Watcher → Battery → **Unrestricted**.
- **The retry queue does not survive a restart.** Persisting it is the obvious
  next improvement if you ever hit it in practice.
- **Cleartext HTTP is allowed app-wide**, because the PC's address is set at
  runtime and `network-security-config` cannot express an IP range. See the
  comment in `res/xml/network_security_config.xml` for how to pin it to one
  address instead.
- **Untested on hardware.** This was written without an Android SDK or a
  device; it compiles-by-inspection only. Expect to fix something on the first
  build, most likely in the MediaStore column handling, which varies by OEM.
