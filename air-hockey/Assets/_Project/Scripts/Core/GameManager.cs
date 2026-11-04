using System;
using AirHockey.Gameplay;
using AirHockey.Input;
using UnityEngine;

namespace AirHockey.Core
{
    public enum GameState { Attract, Join, Countdown, Playing, GoalScored, GameOver }

    /// <summary>
    /// Game flow:
    /// Attract → Join → Countdown → Playing ⇄ GoalScored → GameOver → (rematch → Countdown) / (idle → Attract)
    ///
    /// Knows nothing about devices (reads InputAssigner) or presentation (UI/audio subscribe to events and
    /// read the public properties).
    /// </summary>
    public sealed class GameManager : MonoBehaviour
    {
        GameConfig _config;
        RinkGeometry _geometry;
        InputAssigner _inputs;
        Puck _puck;
        Paddle[] _paddles;

        readonly int[] _scores = new int[2];
        readonly bool[] _ready = new bool[2];
        readonly Vector2[] _lastTargets = new Vector2[2];
        float _stateTimer;
        float _idleTimer;
        Player _nextServer;

        public GameState State { get; private set; } = GameState.Attract;
        /// <summary>Seconds spent in the current state.</summary>
        public float StateTime => _stateTimer;
        public float CountdownRemaining => Mathf.Max(0f, _config.countdownSeconds - _stateTimer);
        public Player LastScorer { get; private set; }
        public Player? Winner { get; private set; }
        public Puck Puck => _puck;

        public int Score(Player p) => _scores[p.Index()];
        public bool IsReady(Player p) => _ready[p.Index()];
        public bool CanRematch => State == GameState.GameOver && _stateTimer >= _config.gameOverInputLockSeconds;

        public event Action<GameState, GameState> StateChanged; // (from, to)
        public event Action<Player> GoalScored;                 // scorer
        public event Action ScoresChanged;

        public void Init(GameConfig config, RinkGeometry geometry, InputAssigner inputs, Puck puck, Paddle[] paddles,
            Goal[] goals)
        {
            _config = config;
            _geometry = geometry;
            _inputs = inputs;
            _puck = puck;
            _paddles = paddles;
            foreach (var g in goals) g.PuckEntered += OnPuckEnteredGoal;

            _nextServer = UnityEngine.Random.value < 0.5f ? Player.One : Player.Two;
            EnterState(GameState.Attract);
        }

        void Update()
        {
            if (_config == null) return;
            float dt = Time.deltaTime;
            _stateTimer += dt;
            TrackIdle(dt);

            switch (State)
            {
                case GameState.Attract:
                    if (_inputs.ConfirmPressed(Player.One)) _ready[0] = true;
                    if (_inputs.ConfirmPressed(Player.Two)) _ready[1] = true;
                    if (_ready[0] || _ready[1]) EnterState(GameState.Join, keepReady: true);
                    break;

                case GameState.Join:
                    if (_inputs.ConfirmPressed(Player.One)) _ready[0] = true;
                    if (_inputs.ConfirmPressed(Player.Two)) _ready[1] = true;
                    if (_ready[0] && _ready[1]) StartNewGame();
                    else if (_idleTimer >= _config.idleSecondsToAttract) EnterState(GameState.Attract);
                    break;

                case GameState.Countdown:
                    if (_stateTimer >= _config.countdownSeconds)
                    {
                        _puck.Release();
                        EnterState(GameState.Playing);
                    }
                    break;

                case GameState.Playing:
                    break;

                case GameState.GoalScored:
                    if (_stateTimer >= _config.goalPauseSeconds)
                    {
                        if (Winner.HasValue)
                        {
                            EnterState(GameState.GameOver);
                        }
                        else
                        {
                            _puck.Release();
                            EnterState(GameState.Playing);
                        }
                    }
                    break;

                case GameState.GameOver:
                    if (CanRematch && _inputs.AnyConfirmPressed) StartNewGame();
                    else if (_idleTimer >= _config.idleSecondsToAttract) EnterState(GameState.Attract);
                    break;
            }
        }

        void StartNewGame()
        {
            _scores[0] = _scores[1] = 0;
            Winner = null;
            ScoresChanged?.Invoke();

            foreach (var p in _paddles) p.SnapHome();
            _inputs.ResetTargets();

            _puck.Freeze();
            _puck.PlaceAt(_geometry.ServePosition(_nextServer));
            EnterState(GameState.Countdown);
        }

        void OnPuckEnteredGoal(Goal goal)
        {
            if (State != GameState.Playing) return;

            Player defender = _geometry.PlayerAtEnd(goal.EndSign);
            Player scorer = defender.Opponent();

            _puck.Freeze();
            _scores[scorer.Index()]++;
            LastScorer = scorer;
            if (_scores[scorer.Index()] >= _config.scoreToWin)
            {
                Winner = scorer;
                _nextServer = defender; // loser serves the rematch
            }

            // Puck goes back on the conceding player's side, frozen until the pause ends.
            _puck.PlaceAt(_geometry.ServePosition(defender));

            ScoresChanged?.Invoke();
            GoalScored?.Invoke(scorer);
            EnterState(GameState.GoalScored);
        }

        void EnterState(GameState next, bool keepReady = false)
        {
            GameState prev = State;
            State = next;
            _stateTimer = 0f;
            _idleTimer = 0f;

            if (next == GameState.Attract || (next == GameState.Join && !keepReady))
                _ready[0] = _ready[1] = false;

            if (next == GameState.Attract)
            {
                // Phase 3 will make the puck roam on its own here; for now park it on the centre spot.
                _puck.Freeze();
                _puck.PlaceAt(Vector2.zero);
            }

            StateChanged?.Invoke(prev, next);
        }

        void TrackIdle(float dt)
        {
            bool active = false;
            for (int i = 0; i < 2; i++)
            {
                var input = _inputs.Get((Player)i);
                if (input == null) continue;
                if (input.ConfirmPressed) active = true;
                if (input.HasTarget && (input.TargetNormalised - _lastTargets[i]).sqrMagnitude > 1e-6f) active = true;
                _lastTargets[i] = input.TargetNormalised;
            }
            _idleTimer = active ? 0f : _idleTimer + dt;
        }
    }
}
