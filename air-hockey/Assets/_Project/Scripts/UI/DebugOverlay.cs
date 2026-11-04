using AirHockey.Core;
using UnityEngine;
using UnityEngine.InputSystem;

namespace AirHockey.UI
{
    /// <summary>
    /// Dev overlay, toggled with F1: fps, state, puck speed and the escape-guard counter
    /// (which must stay at 0 for Phase 1 acceptance).
    /// </summary>
    public sealed class DebugOverlay : MonoBehaviour
    {
        GameManager _game;
        bool _visible;
        float _fps;
        float _peakPuckSpeed;
        GUIStyle _style;

        public void Init(GameManager game) => _game = game;

        void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.f1Key.wasPressedThisFrame) _visible = !_visible;
            if (Time.unscaledDeltaTime > 0f) _fps = Mathf.Lerp(_fps, 1f / Time.unscaledDeltaTime, 0.05f);
            if (_game != null && _game.Puck != null) _peakPuckSpeed = Mathf.Max(_peakPuckSpeed, _game.Puck.Speed);
        }

        void OnGUI()
        {
            if (!_visible || _game == null) return;
            _style ??= new GUIStyle(GUI.skin.label) { fontSize = 18, normal = { textColor = Color.yellow } };
            var puck = _game.Puck;
            GUI.Label(new Rect(10, 10, 600, 140),
                $"FPS {_fps:0}\nState {_game.State}  ({_game.StateTime:0.0}s)\n" +
                $"Puck speed {puck.Speed:0.0}  peak {_peakPuckSpeed:0.0}\n" +
                $"Escape guard fired: {puck.EscapeCount}", _style);
        }
    }
}
