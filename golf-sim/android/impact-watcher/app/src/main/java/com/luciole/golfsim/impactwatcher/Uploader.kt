package com.luciole.golfsim.impactwatcher

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source

/** Result of one upload attempt. */
sealed interface UploadResult {
    data class Success(val shotId: String, val status: String) : UploadResult
    /** Worth retrying: the PC is off, asleep, or the Wi-Fi dropped. */
    data class Retryable(val reason: String) : UploadResult
    /** Not worth retrying: the backend rejected the clip itself. */
    data class Rejected(val reason: String) : UploadResult
}

class Uploader(private val context: Context, private val settings: Settings) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /** Is the backend up? Used by the Test Connection button. */
    fun checkHealth(): String? {
        if (!settings.isConfigured) return null
        val request = Request.Builder().url("${settings.baseUrl}/api/health").build()
        return try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) response.body?.string() else null
            }
        } catch (e: Exception) {
            Log.w(TAG, "health check failed: ${e.message}")
            null
        }
    }

    /**
     * POSTs a clip to the backend's impact ingest endpoint.
     *
     * `trigger_ts` carries the clip's *capture* time, not now. The backend
     * pairs on it (when GOLFSIM_IMPACT_TRUST_TRIGGER_TS is set), which is what
     * makes store-and-forward capture land on the right shot despite arriving
     * several seconds after the strike.
     */
    fun upload(clip: Clip): UploadResult {
        if (!settings.isConfigured) return UploadResult.Retryable("no PC address set")

        val captureFps = clip.captureFps ?: settings.fallbackCaptureFps
        val containerFps = clip.containerFps

        val body = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart(
                "file",
                clip.displayName,
                clip.uri.asRequestBody(context.contentResolver, MP4, clip.sizeBytes),
            )
            .addFormDataPart("trigger_ts", isoLocal(clip.capturedAtMillis))
            .addFormDataPart("capture_fps", captureFps.toString())
            .addFormDataPart("camera", "impact")
            .apply {
                containerFps?.let { addFormDataPart("container_fps", it.toString()) }
                clip.durationMs?.let { addFormDataPart("duration_ms", it.toString()) }
                clip.width?.let { addFormDataPart("width", it.toString()) }
                clip.height?.let { addFormDataPart("height", it.toString()) }
            }
            .build()

        val request = Request.Builder()
            .url("${settings.baseUrl}/api/ingest/impact")
            .post(body)
            .apply {
                if (settings.token.isNotBlank()) header("X-Golfsim-Token", settings.token)
            }
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                when {
                    response.isSuccessful -> {
                        val shotId = text.extractJsonString("shot_id") ?: "?"
                        val status = text.extractJsonString("status") ?: "?"
                        Log.i(TAG, "uploaded ${clip.displayName} -> $shotId ($status)")
                        UploadResult.Success(shotId, status)
                    }
                    // The backend disliked the clip itself; retrying sends the
                    // same bytes to the same verdict.
                    response.code in 400..499 ->
                        UploadResult.Rejected("HTTP ${response.code}: ${text.take(200)}")
                    else -> UploadResult.Retryable("HTTP ${response.code}")
                }
            }
        } catch (e: Exception) {
            UploadResult.Retryable(e.message ?: e.javaClass.simpleName)
        }
    }

    /**
     * Streams the clip straight out of MediaStore. Copying a 40 MB Super
     * Slow-mo file into memory first would work but is needless.
     */
    private fun Uri.asRequestBody(
        resolver: ContentResolver,
        type: MediaType,
        size: Long,
    ): RequestBody = object : RequestBody() {
        override fun contentType() = type
        override fun contentLength() = if (size > 0) size else -1L
        override fun writeTo(sink: BufferedSink) {
            resolver.openInputStream(this@asRequestBody)?.use { input ->
                sink.writeAll(input.source())
            } ?: throw IllegalStateException("cannot open $this")
        }
    }

    private companion object {
        const val TAG = "Uploader"
        val MP4: MediaType = "video/mp4".toMediaType()

        /** ISO-8601 with offset, as the schema requires everywhere. */
        fun isoLocal(millis: Long): String =
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(Date(millis))

        /**
         * Pulls one string field out of a small, known JSON response. The app
         * reads two fields for the status line; a JSON parser would earn its
         * keep only if that grew.
         */
        fun String.extractJsonString(key: String): String? =
            Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"").find(this)?.groupValues?.get(1)
    }
}
