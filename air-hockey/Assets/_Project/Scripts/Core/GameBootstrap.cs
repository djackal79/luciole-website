using AirHockey.Gameplay;
using AirHockey.Input;
using AirHockey.UI;
using UnityEngine;

namespace AirHockey.Core
{
    /// <summary>
    /// The only object in the scene. Builds camera, rink, goals, puck, paddles, input, game flow and UI
    /// at runtime from GameConfig, so everything is diffable as code.
    /// </summary>
    public sealed class GameBootstrap : MonoBehaviour
    {
        [SerializeField] GameConfig config;

        public GameConfig Config => config;
        public GameManager Game { get; private set; }
        public RinkGeometry Geometry { get; private set; }

        void Awake()
        {
            if (config == null)
            {
                Debug.LogWarning("[GameBootstrap] No GameConfig assigned; using defaults. Run Air Hockey > Setup Project.");
                config = ScriptableObject.CreateInstance<GameConfig>();
            }

            ApplyAppSettings();
            Geometry = new RinkGeometry(config);

            BuildCamera();

            var world = new GameObject("World").transform;
            world.SetParent(transform, false);

            var rink = RinkBuilder.Build(config, world);
            var puck = Puck.Create(config, world);

            var inputs = new GameObject("Input").AddComponent<InputAssigner>();
            inputs.transform.SetParent(transform, false);
            inputs.Init(config, Geometry);

            var paddles = new[]
            {
                Paddle.Create(config, Geometry, Player.One, () => inputs.Get(Player.One), world),
                Paddle.Create(config, Geometry, Player.Two, () => inputs.Get(Player.Two), world)
            };

            Game = new GameObject("GameManager").AddComponent<GameManager>();
            Game.transform.SetParent(transform, false);

            var ui = new GameObject("UI");
            ui.transform.SetParent(transform, false);
            ui.AddComponent<ScoreDisplay>().Init(config, Geometry, Game);
            ui.AddComponent<MenuController>().Init(config, Geometry, Game, inputs);
            ui.AddComponent<Countdown>().Init(config, Geometry, Game);
            ui.AddComponent<DebugOverlay>().Init(Game);

            ColourGoalLines(rink);

            Game.Init(config, Geometry, inputs, puck, paddles, new[] { rink.LeftGoal, rink.RightGoal });
        }

        void ApplyAppSettings()
        {
            Time.fixedDeltaTime = config.fixedTimestep;
            Physics2D.gravity = Vector2.zero;
            QualitySettings.vSyncCount = 1;
            Application.targetFrameRate = config.targetFrameRate;

            if (config.applyScreenSettingsInBuild && !Application.isEditor)
            {
                Screen.SetResolution(config.screenWidth, config.screenHeight, FullScreenMode.ExclusiveFullScreen);
                Cursor.visible = false;
            }
        }

        void BuildCamera()
        {
            var cam = Camera.main;
            if (cam == null)
            {
                var go = new GameObject("Main Camera") { tag = "MainCamera" };
                go.transform.SetParent(transform, false);
                cam = go.AddComponent<Camera>();
            }
            cam.orthographic = true;
            _camera = cam;
            FitCamera();
            cam.transform.position = new Vector3(0f, 0f, -10f);
            cam.transform.rotation = Quaternion.identity;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = config.backgroundColor;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 50f;
        }

        Camera _camera;

        void Update() => FitCamera();

        /// <summary>Show the whole rink plus padding whatever the window aspect (editor Game view, odd monitors).</summary>
        void FitCamera()
        {
            if (_camera == null) return;
            float aspect = Mathf.Max(0.1f, _camera.aspect);
            float byHeight = config.HalfHeight + config.cameraPadding;
            float byWidth = (config.HalfWidth + config.cameraPadding) / aspect;
            _camera.orthographicSize = Mathf.Max(byHeight, byWidth);
        }

        void ColourGoalLines(RinkBuilder.Result rink)
        {
            Color left = Geometry.PlayerAtEnd(-1) == Player.One ? config.player1Color : config.player2Color;
            Color right = Geometry.PlayerAtEnd(+1) == Player.One ? config.player1Color : config.player2Color;
            rink.LeftGoalLine.startColor = rink.LeftGoalLine.endColor = left;
            rink.RightGoalLine.startColor = rink.RightGoalLine.endColor = right;
        }
    }
}
