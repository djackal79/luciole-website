using AirHockey.Core;
using UnityEngine;

namespace AirHockey.Gameplay
{
    /// <summary>
    /// Builds the rink walls (one closed EdgeCollider2D loop with goal pockets and corner fillets),
    /// the line markings and the two goals.
    /// </summary>
    public static class RinkBuilder
    {
        public sealed class Result
        {
            public GameObject Root;
            public Goal LeftGoal;
            public Goal RightGoal;
            public LineRenderer LeftGoalLine;
            public LineRenderer RightGoalLine;
        }

        public static Result Build(GameConfig c, Transform parent)
        {
            var root = new GameObject("Rink");
            root.transform.SetParent(parent, false);

            float w = c.HalfWidth, h = c.HalfHeight, g = c.GoalHalfWidth, d = c.goalDepth, f = c.cornerFillet;

            // --- Walls: a single closed loop, anticlockwise, starting at the bottom post of the left goal.
            Vector2[] loop =
            {
                new Vector2(-w, -g), new Vector2(-w - d, -g), new Vector2(-w - d, g), new Vector2(-w, g), // left pocket
                new Vector2(-w, h - f), new Vector2(-w + f, h),                                               // top-left fillet
                new Vector2(w - f, h), new Vector2(w, h - f),                                                 // top-right fillet
                new Vector2(w, g), new Vector2(w + d, g), new Vector2(w + d, -g), new Vector2(w, -g),         // right pocket
                new Vector2(w, -h + f), new Vector2(w - f, -h),                                               // bottom-right fillet
                new Vector2(-w + f, -h), new Vector2(-w, -h + f),                                             // bottom-left fillet
                new Vector2(-w, -g)                                                                           // close
            };

            var walls = new GameObject("Walls");
            walls.transform.SetParent(root.transform, false);
            var edge = walls.AddComponent<EdgeCollider2D>();
            edge.points = loop;
            edge.edgeRadius = c.wallEdgeRadius;
            edge.sharedMaterial = new PhysicsMaterial2D("Wall") { bounciness = c.wallBounciness, friction = 0f };

            // --- Markings (visible part only: the pockets sit off-screen behind the goal lines).
            Material lineMat = c.lineMaterial;
            var outline = new GameObject("Outline");
            outline.transform.SetParent(root.transform, false);
            Vector3[] visible =
            {
                new Vector3(-w, g), new Vector3(-w, h - f), new Vector3(-w + f, h), new Vector3(w - f, h),
                new Vector3(w, h - f), new Vector3(w, g)
            };
            ProceduralVisuals.AddLine(outline, visible, false, c.rinkLineColor, c.rinkLineWidth, SortOrder.RinkLines, lineMat);
            var outline2 = new GameObject("OutlineBottom");
            outline2.transform.SetParent(root.transform, false);
            Vector3[] visible2 =
            {
                new Vector3(-w, -g), new Vector3(-w, -h + f), new Vector3(-w + f, -h), new Vector3(w - f, -h),
                new Vector3(w, -h + f), new Vector3(w, -g)
            };
            ProceduralVisuals.AddLine(outline2, visible2, false, c.rinkLineColor, c.rinkLineWidth, SortOrder.RinkLines, lineMat);

            var centre = new GameObject("CentreLine");
            centre.transform.SetParent(root.transform, false);
            ProceduralVisuals.AddLine(centre, new[] { new Vector3(0, -h), new Vector3(0, h) }, false,
                c.rinkLineColor, c.rinkLineWidth, SortOrder.RinkLines, lineMat);

            var circle = new GameObject("CentreCircle");
            circle.transform.SetParent(root.transform, false);
            ProceduralVisuals.AddLine(circle, ProceduralVisuals.CirclePoints(c.centreCircleRadius, 64), true,
                c.rinkLineColor, c.rinkLineWidth, SortOrder.RinkLines, lineMat);

            var result = new Result { Root = root };
            result.LeftGoal = BuildGoal(c, root.transform, -1, out result.LeftGoalLine);
            result.RightGoal = BuildGoal(c, root.transform, +1, out result.RightGoalLine);
            return result;
        }

        static Goal BuildGoal(GameConfig c, Transform parent, int endSign, out LineRenderer goalLine)
        {
            var go = new GameObject(endSign < 0 ? "GoalLeft" : "GoalRight");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(endSign * (c.HalfWidth + c.goalDepth * 0.5f), 0f, 0f);

            var trigger = go.AddComponent<BoxCollider2D>();
            trigger.isTrigger = true;
            trigger.size = new Vector2(c.goalDepth, c.goalWidth);

            var goal = go.AddComponent<Goal>();
            goal.Init(c, endSign);

            // Goal line drawn across the mouth, coloured by the defending player at runtime.
            var lineGo = new GameObject("GoalLine");
            lineGo.transform.SetParent(parent, false);
            goalLine = ProceduralVisuals.AddLine(lineGo,
                new[] { new Vector3(endSign * c.HalfWidth, -c.GoalHalfWidth), new Vector3(endSign * c.HalfWidth, c.GoalHalfWidth) },
                false, Color.white, c.rinkLineWidth * 2f, SortOrder.Goals, c.lineMaterial);
            return goal;
        }
    }
}
