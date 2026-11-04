using UnityEngine;

namespace AirHockey.Core
{
    /// <summary>
    /// Runtime-generated sprites, fonts and materials so the game needs no art assets to run.
    /// </summary>
    public static class ProceduralVisuals
    {
        const int TextureSize = 128;

        static Sprite _disc, _ring;
        static Font _font;
        static Material _defaultSpriteMaterial;

        /// <summary>Filled circle, 1 world unit in diameter at scale 1.</summary>
        public static Sprite Disc => _disc != null ? _disc : (_disc = MakeCircle(0f));

        /// <summary>Mallet look: thick outer ring plus a centre knob, 1 world unit across.</summary>
        public static Sprite Ring => _ring != null ? _ring : (_ring = MakeCircle(0.55f, 0.28f));

        public static Font Font => _font != null ? _font : (_font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));

        /// <summary>The material URP assigns to a new SpriteRenderer; used when the config has none.</summary>
        public static Material DefaultSpriteMaterial
        {
            get
            {
                if (_defaultSpriteMaterial == null)
                {
                    var probe = new GameObject("MaterialProbe");
                    _defaultSpriteMaterial = probe.AddComponent<SpriteRenderer>().sharedMaterial;
                    Object.Destroy(probe);
                }
                return _defaultSpriteMaterial;
            }
        }

        /// <param name="holeFraction">Inner radius of the ring as a fraction of the outer radius (0 = filled disc).</param>
        /// <param name="knobFraction">Radius of a filled centre knob as a fraction of the outer radius (0 = none).</param>
        static Sprite MakeCircle(float holeFraction, float knobFraction = 0f)
        {
            var tex = new Texture2D(TextureSize, TextureSize, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
                name = holeFraction > 0f ? "RingTex" : "DiscTex"
            };

            float r = TextureSize * 0.5f;
            float edge = 1.5f; // anti-alias width in pixels
            var pixels = new Color32[TextureSize * TextureSize];
            for (int y = 0; y < TextureSize; y++)
            for (int x = 0; x < TextureSize; x++)
            {
                float dx = x + 0.5f - r, dy = y + 0.5f - r;
                float d = Mathf.Sqrt(dx * dx + dy * dy);
                float outer = Mathf.Clamp01((r - d) / edge);
                float a = outer;
                if (holeFraction > 0f)
                {
                    float ring = Mathf.Clamp01((d - r * holeFraction) / edge);
                    float knob = knobFraction > 0f ? Mathf.Clamp01((r * knobFraction - d) / edge) : 0f;
                    a = outer * Mathf.Max(ring, knob);
                }
                pixels[y * TextureSize + x] = new Color32(255, 255, 255, (byte)(a * 255f));
            }
            tex.SetPixels32(pixels);
            tex.Apply(false, true);

            return Sprite.Create(tex, new Rect(0, 0, TextureSize, TextureSize), new Vector2(0.5f, 0.5f), TextureSize);
        }

        public static SpriteRenderer AddSprite(GameObject go, Sprite sprite, Color color, int sortingOrder, Material material)
        {
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.color = color;
            sr.sortingOrder = sortingOrder;
            if (material != null) sr.sharedMaterial = material;
            return sr;
        }

        public static LineRenderer AddLine(GameObject go, Vector3[] points, bool loop, Color color, float width,
            int sortingOrder, Material material)
        {
            var lr = go.AddComponent<LineRenderer>();
            lr.useWorldSpace = false;
            lr.loop = loop;
            lr.positionCount = points.Length;
            lr.SetPositions(points);
            lr.startWidth = lr.endWidth = width;
            lr.startColor = lr.endColor = color;
            lr.numCornerVertices = 4;
            lr.numCapVertices = 4;
            lr.sortingOrder = sortingOrder;
            lr.sharedMaterial = material != null ? material : DefaultSpriteMaterial;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
            return lr;
        }

        public static Vector3[] CirclePoints(float radius, int segments)
        {
            var pts = new Vector3[segments];
            for (int i = 0; i < segments; i++)
            {
                float a = i * Mathf.PI * 2f / segments;
                pts[i] = new Vector3(Mathf.Cos(a) * radius, Mathf.Sin(a) * radius, 0f);
            }
            return pts;
        }
    }

    /// <summary>Sorting orders, back to front.</summary>
    public static class SortOrder
    {
        public const int RinkLines = 0;
        public const int Goals = 5;
        public const int Puck = 10;
        public const int Paddles = 20;
        public const int Text = 100;
    }
}
