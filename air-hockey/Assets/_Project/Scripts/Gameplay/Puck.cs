using System;
using AirHockey.Core;
using UnityEngine;

namespace AirHockey.Gameplay
{
    public enum PuckHitKind { Wall, Paddle }

    /// <summary>
    /// Dynamic, continuous-collision puck. Speed is clamped every physics step. Includes the stuck-puck
    /// rule and an escape guard that pulls the puck back (and logs) if it ever ends up outside the rink.
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D), typeof(CircleCollider2D))]
    public sealed class Puck : MonoBehaviour
    {
        GameConfig _config;
        Rigidbody2D _rb;
        float _slowTimer;
        int _slowHalf; // -1 left, +1 right, 0 none

        public bool IsLive { get; private set; }
        public Vector2 Position => _rb.position;
        public Vector2 Velocity => _rb.linearVelocity;
        public float Speed => _rb.linearVelocity.magnitude;

        /// <summary>How many times the escape guard had to rescue the puck. Should stay 0.</summary>
        public int EscapeCount { get; private set; }

        /// <summary>Fired on every collision: kind, contact point, relative impact speed.</summary>
        public event Action<PuckHitKind, Vector2, float> Hit;

        public static Puck Create(GameConfig c, Transform parent)
        {
            var go = new GameObject("Puck");
            go.transform.SetParent(parent, false);

            var rb = go.AddComponent<Rigidbody2D>();
            rb.bodyType = RigidbodyType2D.Dynamic;
            rb.gravityScale = 0f;
            rb.mass = c.puckMass;
            rb.linearDamping = c.puckLinearDamping;
            rb.angularDamping = 0f;
            rb.freezeRotation = true;
            rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
            rb.interpolation = RigidbodyInterpolation2D.Interpolate;
            rb.sleepMode = RigidbodySleepMode2D.NeverSleep;

            var col = go.AddComponent<CircleCollider2D>();
            col.radius = c.puckRadius;
            col.sharedMaterial = new PhysicsMaterial2D("Puck") { bounciness = c.puckBounciness, friction = 0f };

            var visual = new GameObject("Visual");
            visual.transform.SetParent(go.transform, false);
            visual.transform.localScale = Vector3.one * (c.puckRadius * 2f);
            ProceduralVisuals.AddSprite(visual, ProceduralVisuals.Disc, c.puckColor, SortOrder.Puck, c.spriteMaterial);

            var puck = go.AddComponent<Puck>();
            puck._config = c;
            puck._rb = rb;
            puck.Freeze();
            return puck;
        }

        /// <summary>Stops the puck and removes it from the simulation.</summary>
        public void Freeze()
        {
            IsLive = false;
            _rb.linearVelocity = Vector2.zero;
            _rb.simulated = false;
        }

        /// <summary>Teleports the (frozen) puck.</summary>
        public void PlaceAt(Vector2 position)
        {
            _rb.position = position;
            transform.position = position;
            _slowTimer = 0f;
        }

        public void Release(Vector2 initialVelocity = default)
        {
            _rb.simulated = true;
            _rb.linearVelocity = initialVelocity;
            _slowTimer = 0f;
            IsLive = true;
        }

        void FixedUpdate()
        {
            if (!_rb.simulated) return;

            // 1. Speed cap.
            Vector2 v = _rb.linearVelocity;
            float speed = v.magnitude;
            if (speed > _config.maxPuckSpeed)
                _rb.linearVelocity = v * (_config.maxPuckSpeed / speed);

            GuardAgainstEscape();
            ApplyStuckRule(Time.fixedDeltaTime);
        }

        void ApplyStuckRule(float dt)
        {
            if (!IsLive) return;

            Vector2 p = _rb.position;
            int half = p.x < 0f ? -1 : 1;
            bool slow = _rb.linearVelocity.magnitude < _config.stuckSpeedThreshold;
            bool offCentre = Mathf.Abs(p.x) > _config.puckRadius;

            if (slow && offCentre && half == _slowHalf)
            {
                _slowTimer += dt;
                if (_slowTimer >= _config.stuckSeconds)
                {
                    Vector2 toCentre = new Vector2(-p.x, -p.y * 0.25f).normalized;
                    _rb.linearVelocity = toCentre * _config.stuckNudgeSpeed;
                    _slowTimer = 0f;
                }
            }
            else
            {
                _slowTimer = 0f;
                _slowHalf = slow ? half : 0;
            }
        }

        void GuardAgainstEscape()
        {
            float w = _config.HalfWidth, h = _config.HalfHeight, r = _config.puckRadius, tol = _config.escapeTolerance;
            Vector2 p = _rb.position;
            Vector2 v = _rb.linearVelocity;
            bool escaped = false;

            float maxY = h - r + tol;
            if (Mathf.Abs(p.y) > maxY)
            {
                p.y = Mathf.Sign(p.y) * (h - r);
                if (Mathf.Sign(v.y) == Mathf.Sign(p.y)) v.y = -v.y;
                escaped = true;
            }

            float maxX = w - r + tol;
            bool inMouth = Mathf.Abs(p.y) < _config.GoalHalfWidth + tol;
            if (Mathf.Abs(p.x) > maxX && !inMouth)
            {
                p.x = Mathf.Sign(p.x) * (w - r);
                if (Mathf.Sign(v.x) == Mathf.Sign(p.x)) v.x = -v.x;
                escaped = true;
            }

            if (Mathf.Abs(p.x) > w + _config.goalDepth + tol)
            {
                // Out through the back of a goal pocket: drop it back on the centre line.
                p = Vector2.zero;
                v = Vector2.zero;
                escaped = true;
            }

            if (!escaped) return;
            EscapeCount++;
            Debug.LogWarning($"[Puck] Escape guard fired (#{EscapeCount}) at {_rb.position} v={_rb.linearVelocity}. " +
                             "This indicates tunnelling or a squeeze; investigate.");
            _rb.position = p;
            _rb.linearVelocity = v;
        }

        void OnCollisionEnter2D(Collision2D collision)
        {
            if (Hit == null) return;
            var kind = collision.rigidbody != null && collision.rigidbody.GetComponent<Paddle>() != null
                ? PuckHitKind.Paddle
                : PuckHitKind.Wall;
            Vector2 point = collision.contactCount > 0 ? collision.GetContact(0).point : _rb.position;
            Hit(kind, point, collision.relativeVelocity.magnitude);
        }
    }
}
