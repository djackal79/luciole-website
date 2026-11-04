using System.IO;
using AirHockey.Core;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace AirHockey.Editor
{
    /// <summary>
    /// One-click project setup so nothing has to be hand-edited in scene YAML or clicked through menus:
    /// creates the GameConfig asset, the bootstrap-only Main scene, build settings and player settings.
    /// Safe to run repeatedly.
    /// </summary>
    public static class ProjectSetup
    {
        const string Root = "Assets/_Project";
        const string ConfigPath = Root + "/Config/GameConfig.asset";
        const string ScenePath = Root + "/Scenes/Main.unity";
        const string UrpUnlitSprite = "Packages/com.unity.render-pipelines.universal/Runtime/Materials/Sprite-Unlit-Default.mat";

        [MenuItem("Air Hockey/Setup Project", priority = 0)]
        public static void Run()
        {
            var config = EnsureConfig();
            EnsureScene(config);
            ApplyProjectSettings();
            bool restartNeeded = EnsureNewInputSystemOnly();

            AssetDatabase.SaveAssets();
            Debug.Log("[Air Hockey] Setup complete. Open " + ScenePath + " and press Play.");
            if (restartNeeded)
                EditorUtility.DisplayDialog("Air Hockey",
                    "Active Input Handling was switched to 'Input System Package (New)'. Restart the editor to apply.", "OK");
        }

        [MenuItem("Air Hockey/Open Main Scene", priority = 1)]
        public static void OpenMainScene()
        {
            if (File.Exists(ScenePath) && EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                EditorSceneManager.OpenScene(ScenePath);
        }

        static GameConfig EnsureConfig()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath));
            var config = AssetDatabase.LoadAssetAtPath<GameConfig>(ConfigPath);
            if (config == null)
            {
                config = ScriptableObject.CreateInstance<GameConfig>();
                AssetDatabase.CreateAsset(config, ConfigPath);
            }

            var unlit = AssetDatabase.LoadAssetAtPath<Material>(UrpUnlitSprite);
            if (unlit != null)
            {
                if (config.spriteMaterial == null) config.spriteMaterial = unlit;
                if (config.lineMaterial == null) config.lineMaterial = unlit;
            }
            else
            {
                Debug.LogWarning("[Air Hockey] URP Sprite-Unlit-Default material not found. Is this a URP 2D project?");
            }
            EditorUtility.SetDirty(config);
            return config;
        }

        static void EnsureScene(GameConfig config)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;

            Scene scene = File.Exists(ScenePath)
                ? EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single)
                : EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var bootstrap = Object.FindFirstObjectByType<GameBootstrap>();
            if (bootstrap == null)
                bootstrap = new GameObject("GameBootstrap").AddComponent<GameBootstrap>();

            var so = new SerializedObject(bootstrap);
            so.FindProperty("config").objectReferenceValue = config;
            so.ApplyModifiedPropertiesWithoutUndo();

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }

        static void ApplyProjectSettings()
        {
            // Writing these in edit mode updates ProjectSettings (they are also applied at runtime by GameBootstrap).
            Time.fixedDeltaTime = 1f / 120f;
            Physics2D.gravity = Vector2.zero;

            PlayerSettings.productName = "Air Hockey Table";
            PlayerSettings.defaultIsNativeResolution = false;
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.fullScreenMode = FullScreenMode.ExclusiveFullScreen;
            PlayerSettings.resizableWindow = false;
            PlayerSettings.runInBackground = true;
            PlayerSettings.visibleInBackground = false;
            PlayerSettings.usePlayerLog = true;
        }

        /// <returns>True if the setting changed and the editor needs a restart.</returns>
        static bool EnsureNewInputSystemOnly()
        {
            const int newInputSystemOnly = 1; // 0 = legacy, 1 = Input System package, 2 = both
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (assets == null || assets.Length == 0) return false;
            var so = new SerializedObject(assets[0]);
            var prop = so.FindProperty("activeInputHandler");
            if (prop == null || prop.intValue == newInputSystemOnly) return false;
            prop.intValue = newInputSystemOnly;
            so.ApplyModifiedPropertiesWithoutUndo();
            return true;
        }
    }
}
