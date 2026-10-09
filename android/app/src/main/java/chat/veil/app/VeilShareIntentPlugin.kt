package chat.veil.app

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "VeilShareIntent")
class VeilShareIntentPlugin : Plugin() {
    private var pendingSharedText: String? = null

    override fun load() {
        acceptShareIntent(activity.intent)
    }

    override fun handleOnNewIntent(intent: Intent) {
        acceptShareIntent(intent)
    }

    @PluginMethod
    fun getPendingSharedText(call: PluginCall) {
        call.resolve(JSObject().put("text", pendingSharedText))
    }

    @PluginMethod
    fun clearPendingSharedText(call: PluginCall) {
        pendingSharedText = null
        call.resolve()
    }

    private fun acceptShareIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        if (intent.type?.substringBefore(';')?.trim()?.lowercase() != "text/plain") return

        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
            ?.trim()
            ?.takeIf { it.isNotEmpty() && it.length <= MAX_SHARED_TEXT_LENGTH }
            ?: return

        pendingSharedText = sharedText
        notifyListeners("sharedText", JSObject().put("text", sharedText), true)
    }

    private companion object {
        const val MAX_SHARED_TEXT_LENGTH = 8192
    }
}
