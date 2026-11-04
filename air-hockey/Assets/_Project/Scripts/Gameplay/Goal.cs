using System;
using AirHockey.Core;
using UnityEngine;

namespace AirHockey.Gameplay
{
    /// <summary>
    /// Trigger in the pocket behind a goal mouth. Fires once the puck's centre is properly over the line,
    /// so a puck that only clips the mouth and bounces back out doesn't count.
    /// </summary>
    public sealed class Goal : MonoBehaviour
    {
        GameConfig _config;

        /// <summary>-1 = left end, +1 = right end.</summary>
        public int EndSign { get; private set; }

        public event Action<Goal> PuckEntered;

        public void Init(GameConfig config, int endSign)
        {
            _config = config;
            EndSign = endSign;
        }

        void OnTriggerStay2D(Collider2D other)
        {
            var puck = other.attachedRigidbody != null ? other.attachedRigidbody.GetComponent<Puck>() : null;
            if (puck == null || !puck.IsLive) return;

            float depthPastLine = EndSign * puck.Position.x - _config.HalfWidth;
            if (depthPastLine >= _config.puckRadius * 0.5f)
                PuckEntered?.Invoke(this);
        }
    }
}
