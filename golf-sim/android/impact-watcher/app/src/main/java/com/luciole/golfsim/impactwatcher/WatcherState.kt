package com.luciole.golfsim.impactwatcher

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** One line in the app's activity log. */
data class LogEntry(
    val atMillis: Long,
    val message: String,
    val ok: Boolean,
)

data class WatcherStatus(
    val armed: Boolean = false,
    val clipsUploaded: Int = 0,
    val pending: Int = 0,
    val lastMessage: String = "Idle",
    val log: List<LogEntry> = emptyList(),
)

/**
 * Shared between the service (which does the work) and the UI (which shows
 * it). A single process-wide object, because the service outlives the
 * activity and the activity has to re-attach to whatever is already running.
 */
object WatcherState {

    private val _status = MutableStateFlow(WatcherStatus())
    val status: StateFlow<WatcherStatus> = _status

    private const val MAX_LOG = 60

    fun setArmed(armed: Boolean) {
        _status.value = _status.value.copy(
            armed = armed,
            lastMessage = if (armed) "Armed - waiting for clips" else "Disarmed",
        )
    }

    fun setPending(count: Int) {
        _status.value = _status.value.copy(pending = count)
    }

    fun record(message: String, ok: Boolean = true, countsAsUpload: Boolean = false) {
        val current = _status.value
        val entry = LogEntry(System.currentTimeMillis(), message, ok)
        _status.value = current.copy(
            clipsUploaded = current.clipsUploaded + if (countsAsUpload) 1 else 0,
            lastMessage = message,
            log = (listOf(entry) + current.log).take(MAX_LOG),
        )
    }
}
