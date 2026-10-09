package chat.veil.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "VeilAppLock")
class VeilAppLockPlugin : Plugin() {
    private val markerLock = Any()
    private var screenOffReceiver: BroadcastReceiver? = null

    override fun load() {
        super.load()
        if (screenOffReceiver != null) return

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != Intent.ACTION_SCREEN_OFF) return
                context?.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                    ?.edit()
                    ?.putLong(PENDING_SCREEN_OFF_AT, SystemClock.elapsedRealtime())
                    ?.commit()
            }
        }
        screenOffReceiver = receiver
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(Intent.ACTION_SCREEN_OFF),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    @PluginMethod
    fun consumePendingScreenOffElapsedMs(call: PluginCall) {
        synchronized(markerLock) {
            val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            val recordedAt = preferences.getLong(PENDING_SCREEN_OFF_AT, NO_PENDING_MARKER)
            if (recordedAt == NO_PENDING_MARKER) {
                call.resolve(JSObject().put("elapsedMs", null))
                return
            }

            if (!preferences.edit().remove(PENDING_SCREEN_OFF_AT).commit()) {
                call.reject("Unable to consume screen-off state")
                return
            }

            val now = SystemClock.elapsedRealtime()
            // A value from before reboot is greater than the current monotonic clock.
            val elapsedMs = if (recordedAt in 0..now) now - recordedAt else null
            call.resolve(JSObject().put("elapsedMs", elapsedMs))
        }
    }

    override fun handleOnDestroy() {
        screenOffReceiver?.let { receiver ->
            try {
                context.unregisterReceiver(receiver)
            } catch (_: IllegalArgumentException) {
                // Receiver was already unregistered by Android during teardown.
            }
        }
        screenOffReceiver = null
        super.handleOnDestroy()
    }

    private companion object {
        const val PREFERENCES = "veil_app_lock"
        const val PENDING_SCREEN_OFF_AT = "pending_screen_off_elapsed_ms"
        const val NO_PENDING_MARKER = -1L
    }
}
