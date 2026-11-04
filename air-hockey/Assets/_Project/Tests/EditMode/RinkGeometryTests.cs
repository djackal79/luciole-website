using AirHockey.Core;
using NUnit.Framework;
using UnityEngine;

namespace AirHockey.Tests
{
    public class RinkGeometryTests
    {
        GameConfig _config;
        RinkGeometry _geo;

        [SetUp]
        public void SetUp()
        {
            _config = ScriptableObject.CreateInstance<GameConfig>();
            _geo = new RinkGeometry(_config);
        }

        [TearDown]
        public void TearDown() => Object.DestroyImmediate(_config);

        [Test]
        public void PlayerOne_DefendsLeft_PlayerTwo_DefendsRight()
        {
            Assert.AreEqual(-1, _geo.EndSign(Player.One));
            Assert.AreEqual(+1, _geo.EndSign(Player.Two));
            _geo.SidesFlipped = true;
            Assert.AreEqual(+1, _geo.EndSign(Player.One));
            Assert.AreEqual(Player.One, _geo.PlayerAtEnd(+1));
        }

        [Test]
        public void NormalisedX_ZeroIsOwnGoal_OneIsCentre()
        {
            Vector2 p1Goal = _geo.NormalisedToWorld(Player.One, new Vector2(0f, 0.5f));
            Vector2 p1Centre = _geo.NormalisedToWorld(Player.One, new Vector2(1f, 0.5f));
            Assert.Less(p1Goal.x, p1Centre.x);
            Assert.Less(p1Centre.x, 0f, "P1 must never cross the centre line");

            Vector2 p2Goal = _geo.NormalisedToWorld(Player.Two, new Vector2(0f, 0.5f));
            Vector2 p2Centre = _geo.NormalisedToWorld(Player.Two, new Vector2(1f, 0.5f));
            Assert.Greater(p2Goal.x, p2Centre.x);
            Assert.Greater(p2Centre.x, 0f, "P2 must never cross the centre line");
        }

        [Test]
        public void Halves_AreA180DegreeRotationOfEachOther()
        {
            var n = new Vector2(0.3f, 0.8f);
            Vector2 a = _geo.NormalisedToWorld(Player.One, n);
            Vector2 b = _geo.NormalisedToWorld(Player.Two, n);
            Assert.AreEqual(-a.x, b.x, 1e-5f);
            Assert.AreEqual(-a.y, b.y, 1e-5f);
        }

        [Test]
        public void PaddleStaysInsideWallsWithCentreMargin()
        {
            foreach (var p in new[] { Player.One, Player.Two })
            for (float x = -0.5f; x <= 1.5f; x += 0.25f)
            for (float y = -0.5f; y <= 1.5f; y += 0.25f)
            {
                Vector2 w = _geo.NormalisedToWorld(p, new Vector2(x, y));
                Assert.LessOrEqual(Mathf.Abs(w.y), _config.HalfHeight - _config.paddleRadius + 1e-4f);
                Assert.LessOrEqual(Mathf.Abs(w.x), _config.HalfWidth - _config.paddleRadius + 1e-4f);
                Assert.GreaterOrEqual(Mathf.Abs(w.x), _config.centreLineMargin + _config.paddleRadius - 1e-4f);
            }
        }

        [Test]
        public void WorldToNormalised_RoundTrips()
        {
            foreach (var p in new[] { Player.One, Player.Two })
            {
                var n = new Vector2(0.37f, 0.71f);
                Vector2 back = _geo.WorldToNormalised(p, _geo.NormalisedToWorld(p, n));
                Assert.AreEqual(n.x, back.x, 1e-4f);
                Assert.AreEqual(n.y, back.y, 1e-4f);
            }
        }

        [Test]
        public void ScreenRelativeDelta_MovesPaddleTheSameWayOnScreen()
        {
            var worldRight = new Vector2(1f, 0f);
            foreach (var p in new[] { Player.One, Player.Two })
            {
                var start = new Vector2(0.5f, 0.5f);
                Vector2 before = _geo.NormalisedToWorld(p, start);
                Vector2 after = _geo.NormalisedToWorld(p, start + _geo.WorldDeltaToNormalised(p, worldRight));
                Assert.AreEqual(1f, after.x - before.x, 1e-4f, $"{p}");
                Assert.AreEqual(0f, after.y - before.y, 1e-4f, $"{p}");
            }
        }

        [Test]
        public void TextFacesEachPlayersEnd()
        {
            // Rotated text's local up must point away from the reader's own end, toward the centre.
            foreach (var p in new[] { Player.One, Player.Two })
            {
                Vector3 up = Quaternion.Euler(0, 0, _geo.TextRotationFor(p)) * Vector3.up;
                Assert.AreEqual(-_geo.EndSign(p), up.x, 1e-4f, $"{p}");
            }
        }
    }
}
