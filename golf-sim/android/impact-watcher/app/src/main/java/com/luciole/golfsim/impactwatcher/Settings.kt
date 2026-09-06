package com.luciole.golfsim.impactwatcher

import android.content.Context
import android.content.SharedPreferences

/**
 * Persisted configuration. Small enough that SharedPreferences is the right
 * tool; there is no relational shape here worth a database.
 */
class Settings(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("impact_watcher", Context.MODE_PRIVATE)

    var host: String
        get() = prefs.getString(KEY_HOST, "") ?: ""
        set(value) = prefs.edit().putString(KEY_HOST, value.trim()).apply()

    var port: Int
        get() = prefs.getInt(KEY_PORT, 8000)
        set(value) = prefs.edit().putInt(KEY_PORT, value).apply()

    /** Optional; matches GOLFSIM_INGEST_TOKEN on the backend. */
    var token: String
        get() = prefs.getString(KEY_TOKEN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_TOKEN, value.trim()).apply()

    /**
     * Used only when the clip carries no capture-rate metadata of its own.
     * Samsung writes `com.android.capture.fps` for slow-motion clips, which
     * [ClipProbe] reads; this is the fallback for when it does not.
     */
    var fallbackCaptureFps: Float
        get() = prefs.getFloat(KEY_CAPTURE_FPS, 240f)
        set(value) = prefs.edit().putFloat(KEY_CAPTURE_FPS, value).apply()

    /**
     * Clips longer than this are not impact clips -- they are whatever else
     * you filmed with the phone. Without this the watcher would happily
     * upload a ten-minute video to the shot pairing engine.
     */
    var maxClipDurationMs: Long
        get() = prefs.getLong(KEY_MAX_DURATION, 30_000L)
        set(value) = prefs.edit().putLong(KEY_MAX_DURATION, value).apply()

    var armed: Boolean
        get() = prefs.getBoolean(KEY_ARMED, false)
        set(value) = prefs.edit().putBoolean(KEY_ARMED, value).apply()

    /**
     * MediaStore DATE_ADDED (seconds) at the moment of arming. Clips older
     * than this are ignored, so arming does not upload your whole camera roll.
     */
    var armedAtSeconds: Long
        get() = prefs.getLong(KEY_ARMED_AT, 0L)
        set(value) = prefs.edit().putLong(KEY_ARMED_AT, value).apply()

    /**
     * MediaStore ids already uploaded, so a rescan cannot double-post.
     *
     * Stored as an ordered, delimited string rather than a StringSet: the set
     * has no defined iteration order, so trimming it to a bound could evict
     * the most recent id and let that clip upload a second time.
     */
    private var uploadedIds: List<String>
        get() = prefs.getString(KEY_UPLOADED, "")
            ?.split(',')
            ?.filter { it.isNotBlank() }
            ?: emptyList()
        set(value) = prefs.edit().putString(KEY_UPLOADED, value.joinToString(",")).apply()

    fun markUploaded(id: Long) {
        val key = id.toString()
        // Oldest first, so trimming drops the ids least likely to reappear.
        uploadedIds = (uploadedIds - key + key).takeLast(MAX_REMEMBERED_IDS)
    }

    fun hasUploaded(id: Long): Boolean = uploadedIds.contains(id.toString())

    val baseUrl: String
        get() = "http://$host:$port"

    val isConfigured: Boolean
        get() = host.isNotBlank()

    private companion object {
        const val KEY_HOST = "host"
        const val KEY_PORT = "port"
        const val KEY_TOKEN = "token"
        const val KEY_CAPTURE_FPS = "capture_fps"
        const val KEY_MAX_DURATION = "max_duration_ms"
        const val KEY_ARMED = "armed"
        const val KEY_ARMED_AT = "armed_at"
        const val KEY_UPLOADED = "uploaded_ids"
        const val MAX_REMEMBERED_IDS = 500
    }
}
