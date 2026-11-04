using System.Collections;
using AirHockey.Core;
using AirHockey.Gameplay;
using AirHockey.Input;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace AirHockey.Tests
{
    /// <summary>
    /// Phase 1 acceptance aids: the puck must never escape the rink and never tunnel through a paddle at
    /// max speed. These run the real Puck / Paddle / RinkBuilder code at the real timestep.
    /// </summary>
    public class PuckPhysicsTests
    {
        sealed class StubInput : IPaddleInput
        {
            public Vector2 TargetNormalised { get; set; } = RinkGeometry.PaddleHomeNormalised;
            public bool HasTarget { get; set; } = true;
            public bool ConfirmPressed => false;
        }

        GameConfig _config;
        RinkGeometry _geo;
        GameObject _root;
        Puck _puck;
        Paddle _paddle;
        StubInput _input;
        float _oldFixed;

        [SetUp]
        public void SetUp()
        {
            _config = ScriptableObject.CreateInstance<GameConfig>();
            _geo = new RinkGeometry(_config);
            _oldFixed = Time.fixedDeltaTime;
            Time.fixedDeltaTime = _config.fixedTimestep;
            Physics2D.gravity = Vector2.zero;

            _root = new GameObject("TestRoot");
            RinkBuilder.Build(_config, _root.transform);
            _puck = Puck.Create(_config, _root.transform);
            _input = new StubInput();
            _paddle = Paddle.Create(_config, _geo, Player.One, () => _input, _root.transform);
        }

        [TearDown]
        public void TearDown()
        {
            Object.Destroy(_root);
            Object.Destroy(_config);
            Time.fixedDeltaTime = _oldFixed;
        }

        [UnityTest]
        public IEnumerator PuckAtMaxSpeed_BouncesOffStationaryPaddle()
        {
            _input.TargetNormalised = new Vector2(0.5f, 0.5f);
            yield return new WaitForSeconds(0.5f); // let the paddle settle on target

            var rng = new System.Random(1234);
            float contact = _config.paddleRadius + _config.puckRadius;
            for (int i = 0; i < 20; i++)
            {
                Vector2 paddlePos = _paddle.Position;
                float offset = ((float)rng.NextDouble() * 2f - 1f) * contact * 0.5f;
                _puck.Freeze();
                _puck.PlaceAt(new Vector2(paddlePos.x + 4f, paddlePos.y + offset));
                _puck.Release(Vector2.left * _config.maxPuckSpeed);

                yield return new WaitForSeconds(0.45f);
                Assert.Greater(_puck.Position.x, paddlePos.x, $"Shot {i}: puck tunnelled through the paddle");
                Assert.Greater(_puck.Velocity.x, 0f, $"Shot {i}: puck should be heading back toward centre");
            }
            Assert.AreEqual(0, _puck.EscapeCount);
        }

        [UnityTest]
        public IEnumerator PaddleSwipeAtMaxSpeed_DoesNotPassThroughPuck()
        {
            for (int i = 0; i < 10; i++)
            {
                _input.TargetNormalised = new Vector2(0f, 0.5f);
                yield return new WaitForSeconds(0.5f);

                Vector2 start = _paddle.Position;
                _puck.Freeze();
                _puck.PlaceAt(new Vector2(start.x + 3f, start.y + (i - 5) * 0.05f));
                _puck.Release();

                // Full-speed swipe from goal line to centre line, straight through the puck.
                _input.TargetNormalised = new Vector2(1f, 0.5f);
                float peak = 0f;
                for (float t = 0f; t < 0.3f; t += Time.fixedDeltaTime)
                {
                    yield return new WaitForFixedUpdate();
                    peak = Mathf.Max(peak, _puck.Speed);
                }

                Assert.Greater(_puck.Position.x, _paddle.Position.x, $"Swipe {i}: paddle passed through the puck");
                Assert.Greater(peak, _config.maxPaddleSpeed * 0.3f, $"Swipe {i}: a fast swipe should hit hard");
            }
            Assert.AreEqual(0, _puck.EscapeCount);
        }

        [UnityTest]
        public IEnumerator PuckAtMaxSpeed_NeverEscapesRink()
        {
            _input.HasTarget = false; // paddle parked at home
            var rng = new System.Random(42);
            float w = _config.HalfWidth, h = _config.HalfHeight, r = _config.puckRadius;

            for (int shot = 0; shot < 15; shot++)
            {
                float a = (float)(rng.NextDouble() * Mathf.PI * 2.0);
                _puck.Freeze();
                _puck.PlaceAt(new Vector2(2f, 0.5f));
                _puck.Release(new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * _config.maxPuckSpeed);

                float t = 0f;
                while (t < 0.6f)
                {
                    yield return new WaitForFixedUpdate();
                    t += Time.fixedDeltaTime;
                    Vector2 p = _puck.Position;
                    bool inPocket = Mathf.Abs(p.x) > w - r && Mathf.Abs(p.y) < _config.GoalHalfWidth;
                    Assert.LessOrEqual(Mathf.Abs(p.y), h - r + 0.02f, $"Shot {shot}: puck left through a long wall");
                    if (!inPocket)
                        Assert.LessOrEqual(Mathf.Abs(p.x), w - r + 0.02f, $"Shot {shot}: puck left through a short wall");
                    Assert.LessOrEqual(Mathf.Abs(p.x), w + _config.goalDepth, $"Shot {shot}: puck left through a goal");
                }
            }
            Assert.AreEqual(0, _puck.EscapeCount, "Escape guard had to intervene");
        }
    }
}
