using AirHockey.Core;
using UnityEngine;

namespace AirHockey.UI
{
    /// <summary>3-2-1-GO shown to both players, in the banner position.</summary>
    public sealed class Countdown : MonoBehaviour
    {
        GameManager _game;
        PlayerFacingText _text;

        public void Init(GameConfig config, RinkGeometry geometry, GameManager game)
        {
            _game = game;
            _text = new PlayerFacingText("Countdown", transform, geometry, config.bannerDistanceFromCentre,
                config.scoreTextHeight * 1.5f);
        }

        public void RefreshLayout() => _text.RefreshLayout();

        void Update()
        {
            if (_game == null) return;
            bool show = _game.State == GameState.Countdown;
            _text.SetVisible(show);
            if (!show) return;

            int n = Mathf.CeilToInt(_game.CountdownRemaining);
            _text.SetBoth(n > 0 ? n.ToString() : "GO!", Color.white);
        }
    }
}
