package com.luciole.golfsim.impactwatcher

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.provider.MediaStore
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Watches MediaStore for new stock-camera clips and posts them to the golf sim
 * backend.
 *
 * A foreground service because the phone sits on the mat with its screen off,
 * which is precisely when Android would otherwise stop us.
 */
class WatcherService : Service() {

    private lateinit var settings: Settings
    private lateinit var uploader: Uploader

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val scanLock = Mutex()
    private val retryQueue = ArrayDeque<Clip>()

    private var observerThread: HandlerThread? = null
    private var observer: ContentObserver? = null
    private var retryJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        settings = Settings(this)
        uploader = Uploader(this, settings)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_DISARM -> {
                disarm()
                return START_NOT_STICKY
            }
            else -> arm()
        }
        return START_STICKY
    }

    private fun arm() {
        startAsForeground("Armed - waiting for clips")

        // Only clips recorded from now on. Without this, arming would upload
        // everything already in the camera roll.
        settings.armed = true
        settings.armedAtSeconds = System.currentTimeMillis() / 1000
        WatcherState.setArmed(true)

        registerObserver()
        startRetryLoop()
        Log.i(TAG, "armed at ${settings.armedAtSeconds}")
    }

    private fun disarm() {
        settings.armed = false
        WatcherState.setArmed(false)
        unregisterObserver()
        scope.coroutineContext.cancelChildren()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.i(TAG, "disarmed")
    }

    override fun onDestroy() {
        unregisterObserver()
        scope.cancel()
        super.onDestroy()
    }

    // -- MediaStore watching -------------------------------------------------

    private fun registerObserver() {
        if (observer != null) return
        val thread = HandlerThread("media-observer").also { it.start() }
        observerThread = thread

        val handler = Handler(thread.looper)
        val watcher = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                // MediaStore fires on every insert and update, including the
                // ones made while a file is still being written, so this only
                // schedules a scan -- the scan itself waits for the file.
                scope.launch { scanForNewClips() }
            }
        }
        contentResolver.registerContentObserver(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true, watcher
        )
        observer = watcher
    }

    private fun unregisterObserver() {
        observer?.let { contentResolver.unregisterContentObserver(it) }
        observer = null
        observerThread?.quitSafely()
        observerThread = null
    }

    private suspend fun scanForNewClips() = scanLock.withLock {
        if (!settings.armed) return@withLock

        val candidates = ClipProbe.findClipsSince(this, settings.armedAtSeconds)
        for (candidate in candidates) {
            if (settings.hasUploaded(candidate.id)) continue

            val clip = ClipProbe.awaitStableAndProbe(this, candidate)
            if (clip == null) {
                WatcherState.record("${candidate.displayName}: never settled", ok = false)
                continue
            }

            val duration = clip.durationMs
            if (duration != null && duration > settings.maxClipDurationMs) {
                // Not an impact clip -- something else filmed on this phone.
                settings.markUploaded(clip.id)
                WatcherState.record(
                    "${clip.displayName}: skipped, ${duration / 1000}s is too long",
                    ok = false,
                )
                continue
            }

            // Claim it before uploading. A duplicate MediaStore notification
            // during a slow upload would otherwise post the clip twice, and
            // the backend would pair the second copy as a separate shot.
            settings.markUploaded(clip.id)
            send(clip)
        }
    }

    private fun send(clip: Clip) {
        when (val result = uploader.upload(clip)) {
            is UploadResult.Success -> WatcherState.record(
                "${clip.displayName} -> ${result.shotId} (${result.status})" +
                    clip.captureSummary(),
                countsAsUpload = true,
            )
            is UploadResult.Rejected -> WatcherState.record(
                "${clip.displayName} rejected: ${result.reason}", ok = false
            )
            is UploadResult.Retryable -> {
                retryQueue.addLast(clip)
                WatcherState.setPending(retryQueue.size)
                WatcherState.record(
                    "${clip.displayName} queued: ${result.reason}", ok = false
                )
            }
        }
        updateNotification()
    }

    /**
     * Drains the retry queue. A clip is never dropped because the PC happened
     * to be asleep when it was recorded.
     */
    private fun startRetryLoop() {
        // onStartCommand can fire more than once; one drain loop is enough.
        if (retryJob?.isActive == true) return
        retryJob = scope.launch { drainRetryQueue() }
    }

    private suspend fun drainRetryQueue() {
        while (settings.armed) {
            delay(RETRY_INTERVAL_MS)
            if (retryQueue.isEmpty()) continue

            val clip = retryQueue.removeFirst()
            when (val result = uploader.upload(clip)) {
                is UploadResult.Success -> WatcherState.record(
                    "retry ok: ${clip.displayName} -> ${result.shotId}", countsAsUpload = true
                )
                is UploadResult.Rejected -> WatcherState.record(
                    "retry dropped: ${clip.displayName}: ${result.reason}", ok = false
                )
                // Back of the queue, so one unreachable clip cannot block
                // the ones behind it.
                is UploadResult.Retryable -> retryQueue.addLast(clip)
            }
            WatcherState.setPending(retryQueue.size)
            updateNotification()
        }
    }

    // -- notification --------------------------------------------------------

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Impact Watcher", NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Shows whether the impact camera watcher is armed" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun startAsForeground(text: String) {
        val notification = buildNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification() {
        val status = WatcherState.status.value
        val queued = if (status.pending > 0) ", ${status.pending} queued" else ""
        getSystemService(NotificationManager::class.java).notify(
            NOTIFICATION_ID,
            buildNotification("${status.clipsUploaded} uploaded$queued"),
        )
    }

    private fun buildNotification(text: String): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val disarm = PendingIntent.getService(
            this,
            1,
            Intent(this, WatcherService::class.java).setAction(ACTION_DISARM),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Impact camera armed")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(open)
            .addAction(
                Notification.Action.Builder(null as Icon?, "Disarm", disarm).build()
            )
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "WatcherService"
        private const val CHANNEL_ID = "impact_watcher"
        private const val NOTIFICATION_ID = 1
        private const val RETRY_INTERVAL_MS = 10_000L
        const val ACTION_DISARM = "com.luciole.golfsim.impactwatcher.DISARM"

        fun arm(context: Context) {
            context.startForegroundService(Intent(context, WatcherService::class.java))
        }

        fun disarm(context: Context) {
            context.startService(
                Intent(context, WatcherService::class.java).setAction(ACTION_DISARM)
            )
        }
    }
}
