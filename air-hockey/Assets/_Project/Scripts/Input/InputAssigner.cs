using AirHockey.Core;
using UnityEngine;

namespace AirHockey.Input
{
    /// <summary>
    /// Owns the IPaddleInput for each player and ticks them once per frame, before anything reads them.
    ///
    /// Phase 1: keyboard only (P1 = WASD + Space, P2 = arrows + Enter).
    /// Phase 2 adds gamepads: first two pads in connection order become P1 / P2, keyboard as fallback.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public sealed class InputAssigner : MonoBehaviour
    {
        readonly IPaddleInput[] _inputs = new IPaddleInput[2];

        public void Init(GameConfig config, RinkGeometry geometry)
        {
            _inputs[0] = new KeyboardMouseInput(Player.One, KeyboardMouseInput.KeyScheme.Wasd, geometry, config);
            _inputs[1] = new KeyboardMouseInput(Player.Two, KeyboardMouseInput.KeyScheme.Arrows, geometry, config);
        }

        /// <summary>The input currently driving the player, or null if they have no device.</summary>
        public IPaddleInput Get(Player p)
        {
            var input = _inputs[p.Index()];
            return input is ITickableInput t && !t.IsConnected ? null : input;
        }

        public bool HasDevice(Player p) => Get(p) != null;

        public string ConfirmLabel(Player p) =>
            _inputs[p.Index()] is ITickableInput t ? t.ConfirmLabel : "CONFIRM";

        public bool ConfirmPressed(Player p)
        {
            var input = Get(p);
            return input != null && input.ConfirmPressed;
        }

        public bool AnyConfirmPressed => ConfirmPressed(Player.One) || ConfirmPressed(Player.Two);

        public void ResetTargets()
        {
            foreach (var input in _inputs)
                if (input is ITickableInput t) t.ResetTarget(RinkGeometry.PaddleHomeNormalised);
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            foreach (var input in _inputs)
                if (input is ITickableInput t) t.Tick(dt);
        }
    }
}
