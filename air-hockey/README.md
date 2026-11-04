# Air Hockey Table

A two-player air hockey game for a 48" 720p TV laid flat as a table. The players stand at the two short ends.
Unity 6 LTS, URP 2D, Input System package only, Windows x64 standalone.

The whole game is built at runtime by `GameBootstrap` from `GameConfig`, so the scene file only holds that one
object and everything else is C# you can diff.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Core game, keyboard | **Code complete, needs the editor playtest below** |
| 2 | Gamepads + join flow | Not started |
| 3 | Polish (neon/bloom, trails, sparks, SFX, attract mode) | Not started |
| 4 | Table build + settings overlay | Not started |
| 5 | Leap Motion | Not started |

Each phase is only finished once its acceptance criteria pass in a real Unity editor or build. The code was
written somewhere without Unity, so Phase 1 hasn't been compiled or played yet.

## First-time setup (once, on the Acer or a dev machine)

The repo holds only `Assets/_Project`, so Unity's generated project files (packages, ProjectSettings and the
URP 2D renderer asset) come from the official template:

1. In Unity Hub, create a **new project** with the **Universal 2D** template (Unity 6000.x LTS), anywhere,
   for example `C:\tmp\AirHockeyTemplate`.
2. Close Unity. Copy everything from that project **except `Library/`, `Temp/` and `Logs/`** into this
   `air-hockey/` folder. Merge folders and keep the existing `Assets/_Project`.
3. In Unity Hub, choose **Add → Add project from disk** and pick `air-hockey/`, then open it.
4. Check that the **Input System** package is installed (Window → Package Manager). The Universal 2D template
   includes it.
5. Run **Air Hockey → Setup Project** from the menu bar. This:
   - creates `Assets/_Project/Config/GameConfig.asset` and points it at URP's unlit sprite material
   - creates `Assets/_Project/Scenes/Main.unity` holding only `GameBootstrap`, and makes it the only build scene
   - sets the fixed timestep to 1/120, 2D gravity to 0, and 1280×720 exclusive fullscreen
   - switches Active Input Handling to *Input System Package (New)*. If it says to, restart the editor.
6. Commit the generated `ProjectSettings/`, `Packages/` and `.meta` files. After that, anyone can just clone and open.

## Controls (Phase 1, keyboard)

| | Player 1 (left end, cyan) | Player 2 (right end, magenta) |
|---|---|---|
| Move | W A S D | Arrow keys |
| Join / start / rematch | Space | Enter |

- Keys are **screen-relative** for dev work on a monitor (W = up on the screen). They move a target point the
  same way a stick will, so the gamepad and Leap inputs plug in without changing gameplay code.
- Set `GameConfig.mouseDrivesPlayer` to 1 or 2 to drive that player with absolute mouse positioning while the
  left mouse button is held. This tests the absolute-position path the Leap will use.
- **F1** opens the debug overlay: fps, state, puck speed, peak speed, and the escape-guard counter.

## Phase 1 acceptance checklist

Run these in the editor with the Game view set to 1280×720.

- [ ] **Air Hockey → Setup Project** runs cleanly and Play shows the rink, two paddles and the puck.
- [ ] Space, then Enter → both banners read READY → 3-2-1 countdown → puck goes live.
- [ ] Goals: the GOAL! / CONCEDED banner appears, the score goes up, and the puck reappears frozen on the
      conceding side for 1.5 s before going live.
- [ ] Score readout and banners read upright from **both short ends** (rotate the laptop to check).
- [ ] First to 7: YOU WIN / YOU LOSE, then after 1 s *press to rematch* → scores reset → countdown.
- [ ] A puck left still in one half for 4 s gets nudged toward centre.
- [ ] Play a full hard game. **F1 → "Escape guard fired" stays at 0**, and the puck never leaves the rink
      or passes through a paddle.
- [ ] Window → General → Test Runner: all **EditMode** tests (geometry / mirroring / text facing) and
      **PlayMode** tests (max-speed shots into a paddle, full-speed swipes, random max-speed barrage) pass.

If the escape guard ever fires, the console logs the position and velocity. The guard is a safety net that
pulls the puck back in, not the fix. The usual fixes are a lower `maxPuckSpeed` or `maxPaddleSpeed`, or a
larger `wallEdgeRadius`.

## Architecture

```
Assets/_Project/
  Scripts/
    Core/        GameBootstrap, GameManager (state machine), GameConfig (SO), RinkGeometry, ProceduralVisuals
    Gameplay/    Puck, Paddle, Goal, RinkBuilder
    Input/       IPaddleInput (+ ITickableInput), KeyboardMouseInput, InputAssigner
    UI/          PlayerFacingText, ScoreDisplay, MenuController, Countdown, DebugOverlay
    Audio/       (Phase 3)      Calibration/ (Phase 5)
    Editor/      ProjectSetup (menu: Air Hockey → Setup Project)
  Tests/EditMode, Tests/PlayMode
  Config/  Scenes/  Prefabs/  Audio/  Materials/
```

- **Input.** Gameplay only ever sees `IPaddleInput`: an absolute target in the player's own half, normalised.
  x = 0 is the own goal line and x = 1 the centre line. y = 0 is the wall on the player's right and y = 1 the wall
  on their left. The two halves are 180° rotations of each other, so "stick forward-left" means the same thing
  to both players. `RinkGeometry` handles all conversions, including sides being flipped.
- **Paddle.** A kinematic `Rigidbody2D` moved with `MovePosition` toward the target, capped at
  `maxPaddleSpeed`, and clamped to its own half with a centre-line margin. The puck reacts to the paddle's real
  velocity.
- **Puck.** A dynamic body with continuous collision detection and interpolation. Speed is clamped every
  `FixedUpdate`. It also handles the stuck-puck rule and the escape guard.
- **Rink.** One closed `EdgeCollider2D` loop with corner fillets and goal pockets behind each mouth. The pocket
  trigger only scores once the puck's centre is properly over the line.
- **State machine.** `Attract → Join → Countdown → Playing ⇄ GoalScored → GameOver → rematch / Attract`. It
  doesn't know about devices or presentation. UI and (later) audio subscribe to its events.
- **Text.** Everything a player reads is drawn twice by `PlayerFacingText`, once per half and rotated to face
  that end, with per-player wording (YOU WIN / YOU LOSE).

### Deliberate choices / deviations from the brief

- **No prefabs yet.** Objects are built by code factories (`Puck.Create`, `Paddle.Create`, `RinkBuilder`),
  with procedurally generated sprites. This keeps everything as text and needs no art to run. Prefabs can
  replace the factories later without touching other code.
- **Legacy `TextMesh` for now.** It needs no TMP Essentials import. Phase 3 can swap it for TextMeshPro inside
  `PlayerFacingText` alone.
- **Attract mode is a stub** in Phase 1: a parked puck with a prompt, entered after 60 s idle on Join or
  Game Over. The self-playing puck comes in Phase 3.
