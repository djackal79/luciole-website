using System;
using AirHockey.Core;
using AirHockey.Input;
using UnityEngine;

namespace AirHockey.Gameplay
{
    /// <summary>
    /// Kinematic mallet. Reads an absolute target from IPaddleInput, converts it to world space for its
    /// end of the table and moves toward it with MovePosition, capped at maxPaddleSpeed. Because the body
    /// really moves, the puck reacts to the paddle's velocity: a fast swipe hits harder.
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D), typeof(CircleCollider2D))]
    public sealed class Paddle : MonoBehaviour
    {
        GameConfig _config;
        RinkGeometry _geometry;
        Rigidbody2D _rb;
        Func<IPaddleInput> _inputSource;
        SpriteRenderer _sprite;

        public Player Owner { get; private set; }
        public Vector2 Position => _rb.position;

        public static Paddle Create(GameConfig c, RinkGeometry geometry, Player owner, Func<IPaddleInput> inputSource,
            Transform parent)
        {
            var go = new GameObject(owner == Player.One ? "Paddle1" : "Paddle2");
            go.transform.SetParent(parent, false);

            var rb = go.AddComponent<Rigidbody2D>();
            rb.bodyType = RigidbodyType2D.Kinematic;
            rb.interpolation = RigidbodyInterpolation2D.Interpolate;
            rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
            rb.sleepMode = RigidbodySleepMode2D.NeverSleep;

            var col = go.AddComponent<CircleCollider2D>();
            col.radius = c.paddleRadius;
            col.sharedMaterial = new PhysicsMaterial2D("Paddle") { bounciness = c.paddleBounciness, friction = 0f };

            var visual = new GameObject("Visual");
            visual.transform.SetParent(go.transform, false);
            visual.transform.localScale = Vector3.one * (c.paddleRadius * 2f);

            var paddle = go.AddComponent<Paddle>();
            paddle._config = c;
            paddle._geometry = geometry;
            paddle._rb = rb;
            paddle._inputSource = inputSource;
            paddle.Owner = owner;
            paddle._sprite = ProceduralVisuals.AddSprite(visual, ProceduralVisuals.Ring, c.player1Color, SortOrder.Paddles,
                c.spriteMaterial);
            paddle.RefreshColour();
            paddle.SnapHome();
            return paddle;
        }

        public void RefreshColour()
        {
            _sprite.color = Owner == Player.One ? _config.player1Color : _config.player2Color;
        }

        /// <summary>Teleport to the home position (new game, side swap).</summary>
        public void SnapHome()
        {
            Vector2 home = _geometry.NormalisedToWorld(Owner, RinkGeometry.PaddleHomeNormalised);
            _rb.position = home;
            transform.position = home;
        }

        void FixedUpdate()
        {
            IPaddleInput input = _inputSource?.Invoke();
            if (input == null || !input.HasTarget) return; // hold position

            // NormalisedToWorld clamps to this paddle's half (with centre-line margin and wall clearance).
            Vector2 target = _geometry.NormalisedToWorld(Owner, input.TargetNormalised);
            Vector2 current = _rb.position;
            Vector2 step = Vector2.ClampMagnitude(target - current, _config.maxPaddleSpeed * Time.fixedDeltaTime);
            if (step.sqrMagnitude > 0f)
                _rb.MovePosition(current + step);
        }
    }
}
