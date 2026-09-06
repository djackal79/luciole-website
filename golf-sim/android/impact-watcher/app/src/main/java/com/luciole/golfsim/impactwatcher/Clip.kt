package com.luciole.golfsim.impactwatcher

import android.net.Uri

/**
 * One camera clip, as MediaStore describes it plus what we could read out of
 * the file itself.
 *
 * [captureFps] and [containerFps] are deliberately separate. The stock Camera
 * app writes 240 fps footage into a 30 fps container, so the container rate
 * drives playback while the capture rate drives real elapsed time. The backend
 * schema carries both for exactly this reason.
 */
data class Clip(
    val id: Long,
    val uri: Uri,
    val displayName: String,
    val sizeBytes: Long,
    /** Wall-clock capture time in epoch millis -- when the ball was struck. */
    val capturedAtMillis: Long,
    val durationMs: Long?,
    val width: Int?,
    val height: Int?,
    val captureFps: Float?,
    val containerFps: Float?,
) {
    /** True when this looks like slow motion rather than a normal recording. */
    val isSlowMotion: Boolean
        get() {
            val capture = captureFps ?: return false
            val container = containerFps ?: return false
            return capture > container * 1.5f
        }

    /** Real elapsed time the clip covers, as opposed to its playback length. */
    val realDurationMs: Long?
        get() {
            val duration = durationMs ?: return null
            val capture = captureFps ?: return duration
            val container = containerFps ?: return duration
            if (capture <= 0f || container <= 0f) return duration
            return (duration * container / capture).toLong()
        }

    /**
     * One-line summary for the activity log. Worth showing because it is how
     * you confirm the slow-motion mode actually engaged: a clip that reports
     * 30/30 fps was recorded in normal video, whatever the camera UI said.
     */
    fun captureSummary(): String {
        val capture = captureFps?.toInt() ?: return ""
        val container = containerFps?.toInt() ?: return "  ${capture}fps"
        val real = realDurationMs?.let { "  ${it}ms real" } ?: ""
        return "  ${capture}/${container}fps$real"
    }
}
