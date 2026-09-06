# Handover → Build 2 (frontend)

**Read `CONTRACT.md` first. It is the authority.** Where it disagrees with any
prompt, including this one, the contract wins.

---

## What this project is

A custom golf simulator that consolidates three capture streams into one
reviewable shot:

| Source | Device | Reaches the backend via |
|---|---|---|
| Body swing video | PC running Kinovea | Kinovea Automation hook → `POST /api/ingest/body_swing` |
| Impact video | Samsung phone, high-speed | `POST /api/ingest/impact` |
| Ball/club telemetry | Square launch monitor | GSPro Open Connect v1 socket on `127.0.0.1:921` |

Split into two builds. **Build 1 (backend) is done and verified. Build 2
(frontend) has not been started — that is your job.**

## Where things stand

Repo `djackal79/luciole-website`, branch `claude/golf-simulator-backend-9a46d5`,
everything under `golf-sim/`.

**Build 1, complete:**
- FastAPI service writing contract-v1.0 shot packages to `data/shots/shot_<id>/`
- GSPro Open Connect v1 socket listener (heartbeats, split/concatenated frames,
  201 club push, runtime start/stop for the port-921 mode switch)
- Trigger-based pairing on PC receipt time, ±3000 ms window, `pending` →
  `complete`/`partial`
- Every REST + WebSocket endpoint the contract lists, plus `POST /api/session`
  and `POST /api/listeners/gspro` (the contract implies both but doesn't list
  them)
- 54 passing tests, including one that asserts the metadata key order literally
- Five contract mock scenarios checked in at `golf-sim/mocks/shots.json`

**Not built, deliberately:** anything frontend. No React app, no player, no
HUD, no charts. Also no Cloudflare/cloud deployment — see `DEPLOY.md` for why
this runs on the sim PC.

## Your job: Build 2

A local web UI, served on the sim PC, that reads shot packages and lets the
user review swings.

1. **Unified dual-video player.** Body swing and impact clip side by side,
   synchronised playback, scrubbing, and frame-by-frame stepping.
2. **Telemetry HUD.** Ball and club numbers over/beside the video.
3. **Shot history drawer.** Session list, newest first, live-updating.
4. **Tagging + notes**, written back with `PATCH`.
5. **Impact offset calibration slider**, written back with `PATCH` so it
   survives reload.

## The traps — read these before writing player code

These are the specific ways this build goes wrong. Most are invisible until
you're deep in.

1. **`capture_fps` vs `container_fps` are both present and both needed.** The
   phone writes 240 fps footage into a 30 fps container. Frame stepping uses
   `container_fps` (`1/30` s per frame). Any *duration or speed readout* uses
   `capture_fps` (real elapsed time = frames / 240). Confusing them makes every
   time measurement wrong by 8×.
2. **Align on impact, not on file start.** Seek each video by
   `sync.impact_offset_ms`. Positive means the impact video lags the body
   swing. Aligning both videos to `t=0` looks plausible and is wrong.
3. **`carry_m` and `total_m` will be null.** GSPro Open Connect carries launch
   conditions only. Those two HUD tiles must render an em-dash, not `0` and not
   `NaN`. Same for `smash_factor` when the monitor sent no club data.
4. **Check `sources.*` before touching `media.*`.** An absent source omits its
   media key *entirely* — `metadata.media.impact_strike` will be `undefined`,
   not `null`. A `partial` shot is normal, not an error state; render what's
   there. Telemetry-only and video-only must both work.
5. **`telemetry` is `null` when absent**, not an empty object.
6. **WebSocket payloads are the complete object every time.** Replace your
   shot in state; never merge. `shot.updated` and `shot.patched` arrive for
   shots you already have, including changes another client made.
7. **`status: "pending"` shots appear before their video exists.** A shot lands
   ~50 ms after the strike (telemetry) but its clips arrive 1–2 s later. Render
   the card immediately with a placeholder; don't wait for `shot.completed`.
8. **Media needs range requests to scrub.** The backend serves them
   (`206` + `Content-Range`, verified by test). If you proxy media through a
   dev server, make sure the proxy preserves `Range` — Vite's default proxy
   does, but a hand-rolled one usually doesn't.

## Develop without the backend running

`golf-sim/mocks/shots.json` is an array of the five contract scenarios, with
fixed timestamps so it never churns. Import it directly as fixtures. It
deliberately includes the awkward cases: no impact video, no telemetry, null
smash factor, and a heavy draw.

For playable video, run the provider with `ffmpeg` installed:

```bash
cd golf-sim
python scripts/mock_provider.py --seed data/shots     # real clips if ffmpeg present
uvicorn backend.main:app --port 8000
```

Then `GET /api/shots` serves them and `/shots/shot_<id>/body_swing.mp4` plays.

To watch the live event flow arrive out of order the way it really does:

```bash
python scripts/simulate_session.py --shots 3 --check
```

## Suggested stack

Match what's already in this repo (`fashion-house/`): **Vite + React 18 +
TypeScript + Tailwind + zustand**, with `framer-motion` if you want transitions.
Put it in `golf-sim/frontend/`. Don't add a backend framework — Build 1 is the
backend.

Generate TypeScript types from the schema rather than hand-writing them; the
Pydantic models in `golf-sim/backend/models.py` are the definition, and
`GET /openapi.json` on a running backend gives you the REST surface.

## Definition of done

- Every one of the five mock scenarios renders without a crash or a `NaN`.
- Frame stepping advances exactly one container frame, and a displayed elapsed
  time is computed from `capture_fps`.
- The calibration slider persists across a page reload.
- A shot appearing over the WebSocket mid-session shows up without a refresh,
  and updates in place as its clips land.
- Tags and notes survive a reload.

## Do not

- **Change `metadata.json` without changing `CONTRACT.md` first**, and say so
  loudly — Build 1 has a test asserting the exact key order, which will fail.
- **Move the backend off the sim PC.** It binds `127.0.0.1:921` for the launch
  monitor and takes local filesystem paths from Kinovea. See `DEPLOY.md`.
- **Expose the backend publicly as-is.** Only the ingest endpoints can require a
  token; reads, `PATCH`, and the listener controls are unauthenticated.

## Open items on Build 1, if you want them

None of these block Build 2.

- `GET /api/shots` re-reads the shots directory on every call. Fine for a
  session; add a SQLite index past a few thousand shots.
- Correlator state is in memory. A crash leaves open shots `pending` on disk
  forever — they're not lost, just never closed. A startup reconciliation pass
  would fix it.
- `duration_ms`/`width`/`height` fall back to `ffprobe` and are `null` if the
  ingesting client didn't supply them and ffprobe is absent.
- The ffprobe fallback has not been exercised against real video — there was no
  ffmpeg in the environment Build 1 was written in.
- No auth on read endpoints (see above).
