using AirHockey.Core;
using UnityEngine;

namespace AirHockey.UI
{
    /// <summary>
    /// A pair of world-space labels, one in each half, each rotated to read upright for the player
    /// standing at that end. Nothing a player reads is drawn only for the long side of the table.
    /// </summary>
    public sealed class PlayerFacingText
    {
        const int FontSize = 96;

        readonly TextMesh[] _labels = new TextMesh[2];
        readonly RinkGeometry _geometry;
        readonly float _distanceFromCentre;

        public PlayerFacingText(string name, Transform parent, RinkGeometry geometry, float distanceFromCentre,
            float textHeight)
        {
            _geometry = geometry;
            _distanceFromCentre = distanceFromCentre;
            for (int i = 0; i < 2; i++)
            {
                var go = new GameObject($"{name}_P{i + 1}");
                go.transform.SetParent(parent, false);
                var tm = go.AddComponent<TextMesh>();
                tm.font = ProceduralVisuals.Font;
                tm.fontSize = FontSize;
                // TextMesh line height ≈ characterSize * fontSize / 10 world units.
                tm.characterSize = textHeight * 10f / FontSize;
                tm.anchor = TextAnchor.MiddleCenter;
                tm.alignment = TextAlignment.Center;
                tm.richText = true;
                var mr = go.GetComponent<MeshRenderer>();
                mr.sharedMaterial = tm.font.material;
                mr.sortingOrder = SortOrder.Text;
                _labels[i] = tm;
            }
            RefreshLayout();
        }

        /// <summary>Re-place both labels (call after a side swap).</summary>
        public void RefreshLayout()
        {
            for (int i = 0; i < 2; i++)
            {
                var p = (Player)i;
                var t = _labels[i].transform;
                t.localPosition = new Vector3(_geometry.EndSign(p) * _distanceFromCentre, 0f, 0f);
                t.localRotation = Quaternion.Euler(0f, 0f, _geometry.TextRotationFor(p));
            }
        }

        public void Set(Player p, string text, Color color)
        {
            var tm = _labels[p.Index()];
            if (tm.text != text) tm.text = text;
            tm.color = color;
        }

        public void SetBoth(string text, Color color)
        {
            Set(Player.One, text, color);
            Set(Player.Two, text, color);
        }

        public void SetVisible(bool visible)
        {
            foreach (var l in _labels) l.gameObject.SetActive(visible);
        }

        public static string Hex(Color c) => "#" + ColorUtility.ToHtmlStringRGB(c);
    }
}
