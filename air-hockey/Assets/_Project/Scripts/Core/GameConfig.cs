using UnityEngine;

namespace AirHockey.Core
{
    /// <summary>
    /// Every tunable in the game lives here. Scripts read from this asset; no magic numbers elsewhere.
    /// Create via Assets > Create > Air Hockey > Game Config (or Air Hockey > Setup Project).
    /// </summary>
    [CreateAssetMenu(menuName = "Air Hockey/Game Config", fileName = "GameConfig")]
    public sealed class GameConfig : ScriptableObject
    {
        [Header("Display")]
        public int targetFrameRate = 60;
        public int screenWidth = 1280;
        public int screenHeight = 720;
        [Tooltip("Apply resolution / fullscreen in standalone builds (ignored in the editor).")]
        public bool applyScreenSettingsInBuild = true;
        [Tooltip("Extra world units shown around the rink so the outline survives TV overscan.")]
        public float cameraPadding = 0.25f;
        public Color backgroundColor = new Color(0.02f, 0.02f, 0.05f);

        [Header("Physics")]
        [Tooltip("Seconds per physics step. 1/120 for crisp collisions.")]
        public float fixedTimestep = 1f / 120f;

        [Header("Rink (world units)")]
        public float rinkWidth = 16f;
        public float rinkHeight = 9f;
        public float goalWidth = 3f;
        [Tooltip("How far the goal pocket extends behind the goal line (off-screen).")]
        public float goalDepth = 1.2f;
        [Tooltip("Length of the angled corner segments that stop the puck getting stuck.")]
        public float cornerFillet = 0.8f;
        public float wallEdgeRadius = 0.05f;
        public float wallBounciness = 0.9f;
        [Tooltip("Gap a paddle must keep from the centre line.")]
        public float centreLineMargin = 0.15f;

        [Header("Puck")]
        public float puckRadius = 0.35f;
        public float puckMass = 0.2f;
        public float puckBounciness = 0.9f;
        public float puckLinearDamping = 0.3f;
        public float maxPuckSpeed = 22f;
        [Tooltip("Distance from the centre line where the puck is placed for a serve.")]
        public float serveDistanceFromCentre = 3.5f;

        [Header("Stuck puck rule")]
        public float stuckSpeedThreshold = 0.6f;
        public float stuckSeconds = 4f;
        [Tooltip("Velocity (units/s) given to a stuck puck, aimed toward the centre line.")]
        public float stuckNudgeSpeed = 3f;

        [Header("Escape guard (debug safety net)")]
        [Tooltip("How far past a wall the puck may be before the guard pulls it back and logs a warning.")]
        public float escapeTolerance = 0.15f;

        [Header("Paddles")]
        public float paddleRadius = 0.5f;
        public float maxPaddleSpeed = 30f;
        public float paddleBounciness = 0.9f;

        [Header("Input")]
        [Tooltip("Normalised units per second a full stick / held key moves the target point.")]
        public float stickSpeed = 1.6f;
        [Tooltip("Ignore stick deflection below this.")]
        public float stickDeadzone = 0.15f;
        [Tooltip("Dev only: 0 = mouse off, 1 = mouse drives Player 1 while LMB held, 2 = Player 2.")]
        [Range(0, 2)] public int mouseDrivesPlayer = 0;

        [Header("Rules & timing")]
        public int scoreToWin = 7;
        public float countdownSeconds = 3f;
        public float goalPauseSeconds = 1.5f;
        [Tooltip("Ignore confirm for this long on the Game Over screen so a last-second button mash doesn't skip it.")]
        public float gameOverInputLockSeconds = 1f;
        public float idleSecondsToAttract = 60f;

        [Header("Colours")]
        public Color player1Color = new Color(0f, 1f, 1f);       // cyan
        public Color player2Color = new Color(1f, 0f, 1f);       // magenta
        public Color rinkLineColor = new Color(0.55f, 0.6f, 1f);
        public Color puckColor = Color.white;
        public float rinkLineWidth = 0.08f;
        public float centreCircleRadius = 1.5f;

        [Header("Text")]
        public float scoreTextHeight = 1.1f;
        [Tooltip("Distance from the centre line to each player's score readout.")]
        public float scoreDistanceFromCentre = 1.2f;
        public float bannerTextHeight = 0.7f;
        [Tooltip("Distance from the centre line to each player's banner text.")]
        public float bannerDistanceFromCentre = 4.2f;

        [Header("Materials (optional; Setup Project fills these with URP unlit sprite materials)")]
        public Material spriteMaterial;
        public Material lineMaterial;

        public float HalfWidth => rinkWidth * 0.5f;
        public float HalfHeight => rinkHeight * 0.5f;
        public float GoalHalfWidth => goalWidth * 0.5f;
    }
}
