using UnityEngine;

namespace AirHockey.Input
{
    /// <summary>
    /// The only thing gameplay knows about input. Absolute, position-based, in the player's own half.
    /// </summary>
    public interface IPaddleInput
    {
        /// Desired paddle position in the player's OWN half, normalised:
        /// x: 0 = own goal line, 1 = centre line; y: 0 = wall on the player's right, 1 = wall on their left
        /// (see RinkGeometry for the exact world mapping).
        Vector2 TargetNormalised { get; }

        /// <summary>False = no hand/stick input; the paddle holds position.</summary>
        bool HasTarget { get; }

        /// <summary>Menus: start / join / rematch. True for exactly one frame per press.</summary>
        bool ConfirmPressed { get; }
    }

    /// <summary>
    /// Optional companion for inputs that must be polled once per frame. InputAssigner ticks these
    /// before anything else reads them.
    /// </summary>
    public interface ITickableInput
    {
        void Tick(float deltaTime);

        /// <summary>Human-readable name of the confirm control, for "Press X to join" prompts.</summary>
        string ConfirmLabel { get; }

        /// <summary>True if the device behind this input is still present.</summary>
        bool IsConnected { get; }

        /// <summary>Jump the target point to a position (used when a new game starts).</summary>
        void ResetTarget(Vector2 normalised);
    }
}
