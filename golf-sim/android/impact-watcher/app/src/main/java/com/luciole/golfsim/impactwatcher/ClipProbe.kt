package com.luciole.golfsim.impactwatcher

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log

/**
 * Finds new camera clips and reads their properties.
 *
 * Two things make this less trivial than "query MediaStore":
 *
 *  1. A row can appear while the file is still being written. Samsung's
 *     Super Slow-mo in particular inserts, then processes, then finalises.
 *     Uploading at first sight yields a truncated clip.
 *  2. The capture frame rate is not a MediaStore column. It lives in the
 *     file's own metadata, so the file has to be opened to find it.
 */
object ClipProbe {

    private const val TAG = "ClipProbe"

    /** DCIM sub-folder the stock Camera app writes to. */
    private const val CAMERA_BUCKET = "Camera"

    private val PROJECTION = arrayOf(
        MediaStore.Video.Media._ID,
        MediaStore.Video.Media.DISPLAY_NAME,
        MediaStore.Video.Media.SIZE,
        MediaStore.Video.Media.DATE_ADDED,
        MediaStore.Video.Media.DATE_TAKEN,
        MediaStore.Video.Media.DURATION,
        MediaStore.Video.Media.WIDTH,
        MediaStore.Video.Media.HEIGHT,
        MediaStore.Video.Media.BUCKET_DISPLAY_NAME,
        MediaStore.MediaColumns.IS_PENDING,
    )

    /**
     * Camera clips added at or after [sinceSeconds], newest first.
     *
     * Rows still marked pending are skipped -- they will come back on the next
     * MediaStore change once the writer commits them.
     */
    fun findClipsSince(context: Context, sinceSeconds: Long, limit: Int = 10): List<Clip> {
        val selection =
            "${MediaStore.Video.Media.DATE_ADDED} >= ? AND " +
                "${MediaStore.MediaColumns.IS_PENDING} = 0"
        val args = arrayOf(sinceSeconds.toString())
        val order = "${MediaStore.Video.Media.DATE_ADDED} DESC"

        val found = mutableListOf<Clip>()
        context.contentResolver.query(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI, PROJECTION, selection, args, order
        )?.use { cursor ->
            while (cursor.moveToNext() && found.size < limit) {
                readRow(cursor)?.let(found::add)
            }
        }
        return found
    }

    private fun readRow(cursor: Cursor): Clip? {
        val bucket = cursor.getStringOrNull(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)
        if (!bucket.equals(CAMERA_BUCKET, ignoreCase = true)) return null

        val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID))
        val dateTaken = cursor.getLongOrNull(MediaStore.Video.Media.DATE_TAKEN)
        val dateAdded = cursor.getLongOrNull(MediaStore.Video.Media.DATE_ADDED)

        return Clip(
            id = id,
            uri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id),
            displayName = cursor.getStringOrNull(MediaStore.Video.Media.DISPLAY_NAME)
                ?: "impact_strike.mp4",
            sizeBytes = cursor.getLongOrNull(MediaStore.Video.Media.SIZE) ?: 0L,
            // DATE_TAKEN is millis and is what we want -- it is when the
            // shutter fired. DATE_ADDED is seconds and is when the row was
            // written, which for Super Slow-mo is already seconds late.
            capturedAtMillis = when {
                dateTaken != null && dateTaken > 0 -> dateTaken
                dateAdded != null -> dateAdded * 1000
                else -> System.currentTimeMillis()
            },
            durationMs = cursor.getLongOrNull(MediaStore.Video.Media.DURATION),
            width = cursor.getIntOrNull(MediaStore.Video.Media.WIDTH),
            height = cursor.getIntOrNull(MediaStore.Video.Media.HEIGHT),
            captureFps = null,
            containerFps = null,
        )
    }

    /**
     * Waits for the file to stop growing, then reads its frame rates.
     *
     * Returns null if the clip never settles, which means something else is
     * still writing it and it is not ours to take.
     */
    fun awaitStableAndProbe(
        context: Context,
        clip: Clip,
        stableChecks: Int = 3,
        intervalMs: Long = 400,
        timeoutMs: Long = 30_000,
    ): Clip? {
        val settled = awaitStableSize(context.contentResolver, clip, stableChecks, intervalMs, timeoutMs)
            ?: return null
        return probeFrameRates(context, settled)
    }

    private fun awaitStableSize(
        resolver: ContentResolver,
        clip: Clip,
        stableChecks: Int,
        intervalMs: Long,
        timeoutMs: Long,
    ): Clip? {
        val deadline = System.currentTimeMillis() + timeoutMs
        var lastSize = -1L
        var stableFor = 0

        while (System.currentTimeMillis() < deadline) {
            val size = currentSize(resolver, clip.uri) ?: return null
            if (size > 0 && size == lastSize) {
                stableFor++
                if (stableFor >= stableChecks) return clip.copy(sizeBytes = size)
            } else {
                stableFor = 0
            }
            lastSize = size
            Thread.sleep(intervalMs)
        }
        Log.w(TAG, "clip ${clip.displayName} never stopped growing")
        return null
    }

    private fun currentSize(resolver: ContentResolver, uri: Uri): Long? = try {
        resolver.openFileDescriptor(uri, "r")?.use { it.statSize }
    } catch (e: Exception) {
        Log.w(TAG, "cannot stat $uri: ${e.message}")
        null
    }

    /**
     * Reads the capture and container frame rates out of the file.
     *
     * `METADATA_KEY_CAPTURE_FRAMERATE` is the `com.android.capture.fps` field
     * that camera apps write for slow-motion clips -- the real sensor rate.
     * The container rate has to be derived from frame count over duration,
     * because that is the rate the file actually plays at.
     */
    private fun probeFrameRates(context: Context, clip: Clip): Clip {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, clip.uri)

            val captureFps = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)
                ?.toFloatOrNull()

            val durationMs = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: clip.durationMs

            val frameCount = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                retriever
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)
                    ?.toIntOrNull()
            } else null

            val containerFps = if (frameCount != null && durationMs != null && durationMs > 0) {
                frameCount * 1000f / durationMs
            } else null

            clip.copy(
                durationMs = durationMs,
                width = retriever
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                    ?.toIntOrNull() ?: clip.width,
                height = retriever
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                    ?.toIntOrNull() ?: clip.height,
                captureFps = captureFps,
                containerFps = containerFps,
            )
        } catch (e: Exception) {
            Log.w(TAG, "probe failed for ${clip.displayName}: ${e.message}")
            clip
        } finally {
            runCatching { retriever.release() }
        }
    }

    private fun Cursor.getStringOrNull(column: String): String? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getString(index)
    }

    private fun Cursor.getLongOrNull(column: String): Long? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getLong(index)
    }

    private fun Cursor.getIntOrNull(column: String): Int? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getInt(index)
    }
}
