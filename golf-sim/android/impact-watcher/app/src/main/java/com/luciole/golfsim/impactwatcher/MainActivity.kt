package com.luciole.golfsim.impactwatcher

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val settings = Settings(this)
        WatcherState.setArmed(settings.armed)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    WatcherScreen(settings)
                }
            }
        }
    }
}

/** Permissions the watcher cannot work without, for this Android version. */
private fun requiredPermissions(): Array<String> = buildList {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        add(Manifest.permission.READ_MEDIA_VIDEO)
        add(Manifest.permission.POST_NOTIFICATIONS)
    } else {
        add(Manifest.permission.READ_EXTERNAL_STORAGE)
    }
}.toTypedArray()

@Composable
private fun WatcherScreen(settings: Settings) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val status by WatcherState.status.collectAsState()

    var host by remember { mutableStateOf(settings.host) }
    var port by remember { mutableStateOf(settings.port.toString()) }
    var token by remember { mutableStateOf(settings.token) }
    var captureFps by remember { mutableStateOf(settings.fallbackCaptureFps.toInt().toString()) }
    var health by remember { mutableStateOf<String?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        // READ_MEDIA_VIDEO is the one that matters; without notifications the
        // service still runs, it just cannot show its status.
        val canRead = granted.entries.any { it.key != Manifest.permission.POST_NOTIFICATIONS && it.value }
        if (canRead) WatcherService.arm(context)
        else WatcherState.record("Media permission denied - cannot see clips", ok = false)
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Impact Watcher", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Records with the stock Camera app; this uploads each new clip to the golf sim PC.",
            style = MaterialTheme.typography.bodySmall,
        )

        OutlinedTextField(
            value = host,
            onValueChange = { host = it; settings.host = it },
            label = { Text("PC address") },
            placeholder = { Text("192.168.1.50") },
            singleLine = true,
            enabled = !status.armed,
            modifier = Modifier.fillMaxWidth(),
        )

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(
                value = port,
                onValueChange = { port = it; it.toIntOrNull()?.let { p -> settings.port = p } },
                label = { Text("Port") },
                singleLine = true,
                enabled = !status.armed,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    keyboardType = KeyboardType.Number
                ),
                modifier = Modifier.weight(1f),
            )
            OutlinedTextField(
                value = captureFps,
                onValueChange = {
                    captureFps = it
                    it.toFloatOrNull()?.let { f -> settings.fallbackCaptureFps = f }
                },
                label = { Text("Capture fps") },
                supportingText = { Text("fallback only") },
                singleLine = true,
                enabled = !status.armed,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    keyboardType = KeyboardType.Number
                ),
                modifier = Modifier.weight(1f),
            )
        }

        OutlinedTextField(
            value = token,
            onValueChange = { token = it; settings.token = it },
            label = { Text("Ingest token (optional)") },
            singleLine = true,
            enabled = !status.armed,
            modifier = Modifier.fillMaxWidth(),
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(
                onClick = {
                    if (status.armed) {
                        WatcherService.disarm(context)
                    } else if (hasPermissions(context)) {
                        WatcherService.arm(context)
                    } else {
                        permissionLauncher.launch(requiredPermissions())
                    }
                },
                enabled = host.isNotBlank(),
                modifier = Modifier.weight(1f),
            ) {
                Text(if (status.armed) "Disarm" else "Arm")
            }

            OutlinedButton(
                onClick = {
                    health = "checking..."
                    thread {
                        val body = Uploader(context, settings).checkHealth()
                        health = if (body == null) "unreachable" else "backend OK"
                    }
                },
                modifier = Modifier.weight(1f),
            ) {
                Text("Test connection")
            }
        }

        health?.let { Text(it, style = MaterialTheme.typography.bodySmall) }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    if (status.armed) "ARMED" else "DISARMED",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(status.lastMessage, style = MaterialTheme.typography.bodyMedium)
                Text(
                    "${status.clipsUploaded} uploaded" +
                        if (status.pending > 0) " · ${status.pending} queued for retry" else "",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        Text("Activity", style = MaterialTheme.typography.titleSmall)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            items(status.log) { entry ->
                Text(
                    "${clockOf(entry.atMillis)}  ${if (entry.ok) "·" else "!"} ${entry.message}",
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }
    }
}

private fun hasPermissions(context: android.content.Context): Boolean =
    requiredPermissions()
        .filter { it != Manifest.permission.POST_NOTIFICATIONS }
        .all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

private fun clockOf(millis: Long): String =
    SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(millis))
