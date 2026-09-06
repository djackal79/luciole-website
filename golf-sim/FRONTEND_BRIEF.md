# Frontend brief — for Antigravity

Written 6 September 2026, against commit `bc0f622` (v1.3 world skeleton) and
backend contract **v1.4**.

Read `CONTRACT.md` §v1.3 and §v1.4 and `SSOT.md` D15/D16 first. Pull before
starting — the backend changed under you again, in ways that give you two new
things to display.

The 3D skeleton landed well. It reads `world.t_ms` as already relative to
impact, it draws gaps where a point is null, and it uses reprojection error as
confidence — all three of the things the contract warned about. What follows
is one crash, three places where a fixture value is standing in for real data,
and two new fields worth showing.

---

## 1. `Pose3DCanvas` will crash the first time a 3D shot loads

**This is the one to fix first.** `SkeletonRig` calls `useMemo` *after* two
early returns:

```tsx
if (!world || !world.frames || world.frames.length === 0) return null;   // ← returns
...
if (!pts) return null;                                                   // ← returns
const lines = useMemo(() => { ... }, [pts]);                             // ← hook
```

React counts hooks per render and requires the same number every time. While
`poseData.world` is absent — which is every 2D shot, and the first render of
every shot — the component runs one hook. The moment a 3D shot arrives it runs
two, and React throws *"Rendered more hooks than during the previous render"*,
taking the panel down with it.

Nothing currently catches this because there is no ESLint config in the
project. Fix the ordering — compute `lines` unconditionally from a possibly
empty frame, or lift the guard into the parent so `SkeletonRig` only mounts
with data — and please add `eslint-plugin-react-hooks`, which would have
flagged it as you typed it.

## 2. Landmark indices are hard-coded again

`POSE_CONNECTIONS` in `Pose3DCanvas.tsx` is a list of raw integers. Every
`pose.json` ships a `landmarks` array precisely so a model change cannot
silently rewire a skeleton — swap the pose model and those integers quietly
start connecting an elbow to a hip.

You already do this correctly in `MultiCameraPlayer`, where connections are
named pairs resolved through `lms.indexOf(name)`. Use the same approach here;
the connection list can be shared between the two.

(Minor, while you are in there: the comments have left and right swapped.
MediaPipe index 11 is `left_shoulder`, 12 is `right_shoulder`, so `[11, 13]`
is the *left* arm.)

## 3. The master timeline is anchored to the mock fixtures

`MultiCameraPlayer.tsx` has `const impactTime = 2.45;` and `playerStore` has
`duration: 4.0`. Both are the values in `scripts/_sidecars.py`, which ships
`impact_ms: 2450`.

As a *design choice* the master timeline can put impact wherever it likes —
each clip is mapped through its own `clipImpactSec`, so alignment stays
correct. The problem is the room either side. The Kinovea hook documentation
tells the user to run a pre-roll of around 3 seconds, so a real clip will
arrive with `impact_ms` near 3000. Master time 0 then maps to 0.55 s into that
clip, and **the first half-second of the swing cannot be scrubbed to at all**
— the takeaway is off the front of the timeline.

Derive both from the clips actually present: the anchor from the largest
`media.*.impact_ms`, and the duration from the longest clip. Keep the
fixture numbers only as the fallback when nothing is loaded.

`Biomechanical3DModel.tsx` also computes `currentTime - 2.45` with its own
copy of the constant. Whatever you replace it with, both should read it from
one place — the player store is the natural home.

## 4. The nearest-frame search has no distance limit

Both the 2D overlay and `Pose3DCanvas` scan for the frame closest to the
current time and draw it however far away that turns out to be. Scrub past the
end of a short pose track and the last frame stays painted over a video that
has moved on — a frozen skeleton that looks live.

A cap of roughly one frame interval, drawing nothing beyond it, is enough.

---

## 5. New: the shot now says *why* 3D is off — `pose.depth_reason`

Contract v1.4. Most shots will be 2D for a while and every reason is an
ordinary state, not a fault. Instead of showing blank metrics, show the
sentence:

```json
"dimensions": "2d",
"depth_reason": "no impact frame on body_swing_dtl — set IMPACT_MS in the Kinovea hook for each camera"
```

`null` means the depth metrics arrived. The five values are listed in the
contract; four of them mean "not set up yet", so phrase the presentation as
information rather than as an error state.

**One trap.** `dimensions: "3d"` does not by itself mean the angles are there.
A triangulated skeleton that is not anatomically possible — the signature of a
mis-measured calibration board — is still written and still worth drawing,
while its angles are withheld. So gate the *skeleton* on `dimensions`, and gate
the *numbers* on `depth_reason === null`. That case deserves a real warning:
it means the rig is producing wrong measurements.

## 6. New: the rig's calibration state — `/api/health`

Contract v1.4 adds `listeners.pose_worker.calibration`:

```json
{ "ready": true,
  "cameras": { "body_swing": { "placed": true, "position_m": [0.02, -3.48, 1.41], ... } },
  "detail": null }
```

Two suggestions. Gate a "3D" indicator in the status bar on `ready`, showing
`detail` when it is false — that is what tells the user the rig still needs
calibrating rather than leaving them to guess from empty panels.

More interesting: `position_m` is where each camera solved to, in metres. It is
the one number a human can independently check with a tape measure, and if it
is wrong then every distance the 3D metrics rest on is wrong too. Showing the
two positions, and the distance between them, somewhere in the calibration UI
would turn an invisible failure into a five-second check. This is worth more
than it looks.

---

## Order I would take these

1. The hooks crash — it breaks the panel outright.
2. `depth_reason` — it turns the most common state from a mystery into a
   sentence, and the user is about to spend a weekend in exactly that state.
3. The timeline anchor — it will bite the moment a real Kinovea clip arrives.
4. Landmark indices, the frame-distance cap, calibration state in the status
   bar.

That line about theming, animation and panels not being wanted is now
withdrawn — see `DESIGN_BRIEF.md`, written the same day. Do the correctness
work above first, then that.
