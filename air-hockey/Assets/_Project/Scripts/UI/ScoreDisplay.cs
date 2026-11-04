using AirHockey.Core;
using UnityEngine;

namespace AirHockey.UI
{
    /// <summary>
    /// Score readout drawn once per player near the centre line, facing that player, own score first,
    /// each number in its player's colour.
    /// </summary>
    public sealed class ScoreDisplay : MonoBehaviour
    {
        GameConfig _config;
        GameManager _game;
        PlayerFacingText _text;

        public void Init(GameConfig config, RinkGeometry geometry, GameManager game)
        {
            _config = config;
            _game = game;
            _text = new PlayerFacingText("Score", transform, geometry, config.scoreDistanceFromCentre, config.scoreTextHeight);
            _game.ScoresChanged += Refresh;
            _game.StateChanged += (_, __) => Refresh();
            Refresh();
        }

        public void RefreshLayout() => _text.RefreshLayout();

        void Refresh()
        {
            bool show = _game.State != GameState.Attract && _game.State != GameState.Join;
            _text.SetVisible(show);
            if (!show) return;

            string c1 = PlayerFacingText.Hex(_config.player1Color);
            string c2 = PlayerFacingText.Hex(_config.player2Color);
            string s1 = $"<color={c1}>{_game.Score(Player.One)}</color>";
            string s2 = $"<color={c2}>{_game.Score(Player.Two)}</color>";
            _text.Set(Player.One, $"{s1}  -  {s2}", Color.white);
            _text.Set(Player.Two, $"{s2}  -  {s1}", Color.white);
        }
    }
}
