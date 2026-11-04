using AirHockey.Core;
using AirHockey.Input;
using UnityEngine;

namespace AirHockey.UI
{
    /// <summary>
    /// Per-player banner text for every non-playing state: attract prompt, join status, GOAL!, win/lose
    /// and rematch prompt. Each player gets their own wording (e.g. YOU WIN / YOU LOSE).
    /// </summary>
    public sealed class MenuController : MonoBehaviour
    {
        GameConfig _config;
        GameManager _game;
        InputAssigner _inputs;
        PlayerFacingText _banner;

        public void Init(GameConfig config, RinkGeometry geometry, GameManager game, InputAssigner inputs)
        {
            _config = config;
            _game = game;
            _inputs = inputs;
            _banner = new PlayerFacingText("Banner", transform, geometry, config.bannerDistanceFromCentre,
                config.bannerTextHeight);
        }

        public void RefreshLayout() => _banner.RefreshLayout();

        void Update()
        {
            if (_game == null) return;
            for (int i = 0; i < 2; i++)
            {
                var p = (Player)i;
                Color own = p == Player.One ? _config.player1Color : _config.player2Color;
                string text = TextFor(p, out Color color, own);
                _banner.Set(p, text, color);
            }
        }

        string TextFor(Player p, out Color color, Color own)
        {
            color = own;
            string confirm = _inputs.ConfirmLabel(p);
            switch (_game.State)
            {
                case GameState.Attract:
                    color = Blink(own);
                    return $"AIR HOCKEY\nPRESS {confirm} TO PLAY";

                case GameState.Join:
                    if (!_inputs.HasDevice(p)) return "NO CONTROLLER";
                    if (_game.IsReady(p)) return "READY\nWAITING FOR OPPONENT";
                    color = Blink(own);
                    return $"PRESS {confirm} TO JOIN";

                case GameState.GoalScored:
                    if (_game.Winner.HasValue) return _game.Winner.Value == p ? "YOU WIN!" : "YOU LOSE";
                    color = _game.LastScorer == Player.One ? _config.player1Color : _config.player2Color;
                    return _game.LastScorer == p ? "GOAL!" : "CONCEDED";

                case GameState.GameOver:
                    string result = _game.Winner == p ? "YOU WIN!" : "YOU LOSE";
                    return _game.CanRematch ? $"{result}\nPRESS {confirm} FOR REMATCH" : result;

                default:
                    return string.Empty;
            }
        }

        static Color Blink(Color c)
        {
            float a = 0.55f + 0.45f * Mathf.Sin(Time.unscaledTime * 4f);
            return new Color(c.r, c.g, c.b, a);
        }
    }
}
