# Motion and visual brief — for Antigravity

Written 6 September 2026, against contract **v1.5**. This supersedes the
"not wanted: more theming, more animation, more panels" line in `SSOT.md`,
which was written while the contract work was still landing. That work has
landed. Polish is now in scope.

Fix `FRONTEND_BRIEF.md` first — particularly the `Pose3DCanvas` hooks crash.
None of this matters if the panel throws.

---

## The rule to design against

The app's centre of gravity is a golf ball being struck at 240 fps. Anything
decorative competes with that and loses.

So every animation here is either **the data moving** or a **marker on a moment
that really happened**. A ball travelling its own computed trajectory over its
own flight time is the first. The playhead crossing impact is the second. A
card fading in on scroll is neither.

---

## 1. Draw the shot that was actually hit — biggest win, unblocked today

`TrajectoryCard.tsx` draws `d="M 30 120 Q 140 15 245 120"` — a fixed parabola,
identical for a driver, a seven iron and a wedge, with only the labels
changing. The apex marker sits at a hard-coded `cx="138" cy="42"`.

That was not a styling choice. The backend integrated the real trajectory and
threw every intermediate position away, so three summary numbers were all you
ever had, and every shot drawn from them is the same curve.

**`telemetry.flight.path` now carries the real thing** (contract v1.5): up to
48 points of `[downrange_m, height_m, offline_m]`, tee to landing, about 1 KB.

- **Side view** — `x = downrange`, `y = height`. Modelled 7-iron peaks at 21 m
  over 154 m; a wedge peaks at 23 m over 122 m. Near-identical apex, entirely
  different flight — exactly what summary numbers cannot express.
- **Top-down view** — `x = offline`, `y = downrange`. This is where shape
  lives. A 10 m draw leaves almost straight and bends late; drawn from
  `offline_m` alone it is a diagonal line, which is the wrong shape.
- **Animate along it** on arrival and on demand — never on a loop. Set the
  duration from `flight_time_s`, so a 6.7 s driver hangs and a 4.9 s wedge
  drops. The duration is data.
- Scale both views from the actual path bounds, not fixed coordinates, and
  keep the "est" labelling — it is a model, not a measurement.
- `path` is an empty list whenever `flight` could not be modelled. Fall back to
  drawing nothing rather than to the old parabola.

## 2. Choreograph the arrival — high value, low cost

A shot lands in waves, always in the same order: telemetry within ~0.1 s, the
two Kinovea clips ~2 s, the phone clip ~7 s, pose some seconds later. Today
that reads as things popping in.

Reveal each part as it genuinely arrives, in that order. The sequence is true,
so the user learns the system's rhythm without being told it.

- Numbers first, ~150 ms fade. **No counting up** — it delays reading and fakes
  a precision the monitor did not give you.
- Video panels as each clip attaches; a panel still waiting should look like it
  is waiting, not like it is empty.
- The flight animation once.
- Pose last. While it computes, draw the skeleton assembling itself — joints,
  then bones — settling into the real figure when the data lands. It is the one
  loading state where the thing being waited for is inherently visual.

## 3. Make the timeline the instrument — most-touched control

`PlaybackControls.tsx` is a plain track with an impact tick.

- **Phase bands from the pose track**: address, takeaway, top, downswing,
  finish. Derivable from landmarks already in `pose.json` — the top of the
  backswing is where shoulder rotation peaks, which the backend already locates
  to compute shoulder turn. This makes scrubbing to "the top" a gesture rather
  than a hunt, and a hurried transition looks different from a smooth one
  before you play a frame.
- **Impact as a full-height anchor**, not a small mark, with a short eased
  settle when `I` is pressed. A snap you can feel is a snap.

## 4. Themes with different behaviour, not just different paint

The two themes differ in colour, typeface and radius. Give them character:

| | Cyber HUD — instrument | Boutique Studio — room |
|---|---|---|
| Transitions | ~120 ms, snappy | ~400 ms, eased |
| Density | everything at once | fewer things, video larger |
| Numbers | mono, precise, always on | fewer, larger, more space |
| Flight | fast, hard trail | real time, fading trail |
| Idle | diagnostics ticking | rests on the last shot |

A single motion-duration multiplier in the theme store carries most of it.

**Fix first:** `App.tsx` loads the Boutique background from
`images.unsplash.com`. The sim PC is often offline — the status bar has a
`LOCAL OFFLINE` state — and the theme then silently loses the image that is its
whole identity. Bundle it locally, or better, use a photo of the actual bay.

## 5. Restraint list

- Numbers counting up.
- Chrome that animates — cards sliding, scroll reveals, hover lifts on
  non-buttons.
- Anything moving while the user is studying a paused frame. Once the video is
  stopped on impact the screen should be still.
- Looping animations, the flight path included.
- Particles, glows, scan lines beyond a trace in Cyber HUD. The measurements
  must stay the brightest thing on screen.

**The constraint that shapes all of it:** this runs on a PC simultaneously
capturing two Kinovea streams and possibly running GSPro. Continuous WebGL or
per-frame canvas work competes for the GPU encoding the swing being recorded.
Prefer CSS transforms and SVG to per-frame redraws, stop animation when the tab
is hidden, and keep the `Pose3DCanvas` render loop paused unless it is on
screen and moving. A dropped capture frame costs more than any animation.

## 6. Panels worth adding, in build order

**Dispersion.** Top-down with every shot in the session: current bright, the
rest as ghosts, landing points as a scatter. Section 1 builds its geometry.
Needs club tagging — one field on the shot, one control in the UI — which is
the smallest missing piece in the whole system.

**Shot comparison.** Two swings scrubbed together, locked on impact. The hard
part, aligning clips of different frame rates and durations on the strike, is
already built and currently only used within a single shot. "Best drive of the
day against the one that just leaked right" is the most useful thing this app
could show a golfer.

**Body against ball.** Commercial monitors know the ball; coaching apps know
the body; this rig has both on the same strike and the same clock. X-factor
against carry, spine angle against strike quality, across a session. Waits on
calibration and a few shots, but it is what all of this is for.
