using UnityEngine;

namespace AirHockey.Core
{
    public enum Player { One = 0, Two = 1 }

    public static class PlayerExtensions
    {
        public static Player Opponent(this Player p) => p == Player.One ? Player.Two : Player.One;
        public static int Index(this Player p) => (int)p;
    }

    /// <summary>
    /// Converts between world space and each player's normalised half.
    ///
    /// World: rink centred on origin, play along X. Player One defends the left end (x &lt; 0) unless
    /// sides are flipped.
    ///
    /// Normalised half (the player's own frame, as if standing at their end of the table):
    ///   x: 0 = own goal line, 1 = centre line (forward)
    ///   y: 0 = wall on the player's right, 1 = wall on the player's left
    /// For the left end that makes y = 1 the top wall (world +y); for the right end it is the bottom
    /// wall. The two halves are a 180° rotation of each other, so a stick pushed "forward and left"
    /// means the same thing to both players.
    /// </summary>
    public sealed class RinkGeometry
    {
        readonly GameConfig _c;

        public bool SidesFlipped { get; set; }

        public RinkGeometry(GameConfig config) { _c = config; }

        public float HalfWidth => _c.HalfWidth;
        public float HalfHeight => _c.HalfHeight;

        /// <summary>-1 if the player defends the left end, +1 for the right end.</summary>
        public int EndSign(Player p)
        {
            int s = p == Player.One ? -1 : 1;
            return SidesFlipped ? -s : s;
        }

        /// <summary>Which player defends the end with the given sign.</summary>
        public Player PlayerAtEnd(int endSign) => EndSign(Player.One) == endSign ? Player.One : Player.Two;

        // Reachable range for the paddle centre, as distance from the own goal line.
        float MinDepth => _c.paddleRadius;
        float MaxDepth => _c.HalfWidth - _c.centreLineMargin - _c.paddleRadius;
        float MinLateral => -_c.HalfHeight + _c.paddleRadius;
        float MaxLateral => _c.HalfHeight - _c.paddleRadius;

        /// <summary>World units covered by one normalised unit along each axis (for rate conversions).</summary>
        public Vector2 NormalisedSpan => new Vector2(MaxDepth - MinDepth, MaxLateral - MinLateral);

        public Vector2 NormalisedToWorld(Player p, Vector2 n)
        {
            int s = EndSign(p);
            float depth = Mathf.Lerp(MinDepth, MaxDepth, Mathf.Clamp01(n.x));
            float lateral = Mathf.Lerp(MinLateral, MaxLateral, Mathf.Clamp01(n.y));
            // depth is measured from the goal line at x = s * HalfWidth, toward the centre.
            return new Vector2(s * (_c.HalfWidth - depth), -s * lateral);
        }

        public Vector2 WorldToNormalised(Player p, Vector2 w)
        {
            int s = EndSign(p);
            float depth = _c.HalfWidth - s * w.x;
            float lateral = -s * w.y;
            return new Vector2(
                Mathf.InverseLerp(MinDepth, MaxDepth, depth),
                Mathf.InverseLerp(MinLateral, MaxLateral, lateral));
        }

        /// <summary>
        /// Converts a direction given in screen/world terms (dev keyboard: W = up on the monitor) into the
        /// the matching change in the player's normalised frame.
        /// </summary>
        public Vector2 WorldDeltaToNormalised(Player p, Vector2 worldDelta)
        {
            int s = EndSign(p);
            Vector2 span = NormalisedSpan;
            return new Vector2(-s * worldDelta.x / span.x, -s * worldDelta.y / span.y);
        }

        /// <summary>Where the paddle waits at the start of a game.</summary>
        public static readonly Vector2 PaddleHomeNormalised = new Vector2(0.2f, 0.5f);

        /// <summary>Serve position on the given player's side.</summary>
        public Vector2 ServePosition(Player p) => new Vector2(EndSign(p) * _c.serveDistanceFromCentre, 0f);

        /// <summary>Rotation (degrees about Z) that makes text read upright for someone standing at the player's end.</summary>
        public float TextRotationFor(Player p) => 90f * EndSign(p);
    }
}
