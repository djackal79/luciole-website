using AirHockey.Core;
using UnityEngine;
using UnityEngine.InputSystem;

namespace AirHockey.Input
{
    /// <summary>
    /// Dev-only input. Keys are screen-relative (W / Up arrow = up on the monitor) and move a target
    /// point exactly like a stick would. Optionally the mouse drives one player with absolute positioning
    /// while the left button is held, for testing the absolute path that Leap will use.
    /// </summary>
    public sealed class KeyboardMouseInput : IPaddleInput, ITickableInput
    {
        public struct KeyScheme
        {
            public Key Up, Down, Left, Right, Confirm;
            public string ConfirmName;

            public static KeyScheme Wasd => new KeyScheme
                { Up = Key.W, Down = Key.S, Left = Key.A, Right = Key.D, Confirm = Key.Space, ConfirmName = "SPACE" };

            public static KeyScheme Arrows => new KeyScheme
            {
                Up = Key.UpArrow, Down = Key.DownArrow, Left = Key.LeftArrow, Right = Key.RightArrow,
                Confirm = Key.Enter, ConfirmName = "ENTER"
            };
        }

        readonly Player _player;
        readonly KeyScheme _keys;
        readonly RinkGeometry _geometry;
        readonly GameConfig _config;
        Vector2 _target = RinkGeometry.PaddleHomeNormalised;
        bool _confirm;

        public KeyboardMouseInput(Player player, KeyScheme keys, RinkGeometry geometry, GameConfig config)
        {
            _player = player;
            _keys = keys;
            _geometry = geometry;
            _config = config;
        }

        public Vector2 TargetNormalised => _target;
        public bool HasTarget => IsConnected;
        public bool ConfirmPressed => _confirm;
        public string ConfirmLabel => _keys.ConfirmName;
        public bool IsConnected => Keyboard.current != null;

        public void ResetTarget(Vector2 normalised) => _target = normalised;

        public void Tick(float dt)
        {
            var kb = Keyboard.current;
            if (kb == null) { _confirm = false; return; }

            _confirm = kb[_keys.Confirm].wasPressedThisFrame;

            if (TryMouse()) return;

            Vector2 screenDir = Vector2.zero;
            if (kb[_keys.Up].isPressed) screenDir.y += 1f;
            if (kb[_keys.Down].isPressed) screenDir.y -= 1f;
            if (kb[_keys.Right].isPressed) screenDir.x += 1f;
            if (kb[_keys.Left].isPressed) screenDir.x -= 1f;
            if (screenDir == Vector2.zero) return;

            // Same feel as a stick: stickSpeed normalised units/s, converted via the larger span so
            // diagonal and axis moves feel equally fast in world space.
            Vector2 span = _geometry.NormalisedSpan;
            float worldSpeed = _config.stickSpeed * Mathf.Max(span.x, span.y);
            Vector2 worldDelta = screenDir.normalized * (worldSpeed * dt);
            _target += _geometry.WorldDeltaToNormalised(_player, worldDelta);
            _target.x = Mathf.Clamp01(_target.x);
            _target.y = Mathf.Clamp01(_target.y);
        }

        bool TryMouse()
        {
            if (_config.mouseDrivesPlayer != _player.Index() + 1) return false;
            var mouse = Mouse.current;
            var cam = Camera.main;
            if (mouse == null || cam == null || !mouse.leftButton.isPressed) return false;

            Vector3 world = cam.ScreenToWorldPoint(mouse.position.ReadValue());
            _target = _geometry.WorldToNormalised(_player, world);
            return true;
        }
    }
}
