package chat.veil.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.firebase.messaging.FirebaseMessaging

@CapacitorPlugin(
    name = "VeilNotifications",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class VeilNotificationsPlugin : Plugin() {
    companion object {
        private const val CHANNEL_ID = "veil_messages"
        private const val CHANNEL_NAME = "VEIL messages"
        private const val CHANNEL_DESCRIPTION = "Alerts for incoming messages. Lock screen content stays private."
        private const val REPLY_ACTION = "chat.veil.app.NOTIFICATION_REPLY"
        private const val REPLY_KEY = "veil_notification_reply"
        private const val CONVERSATION_ID_KEY = "veil_notification_conversation"
        private const val SPACE_ID_KEY = "veil_notification_space"
    }

    @PluginMethod
    fun checkPermission(call: PluginCall) {
        call.resolve(JSObject().put("status", currentPermissionStatus()))
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "notificationPermissionCallback")
        } else {
            call.resolve(JSObject().put("status", currentPermissionStatus()))
        }
    }

    @PermissionCallback
    private fun notificationPermissionCallback(call: PluginCall) {
        call.resolve(JSObject().put("status", currentPermissionStatus()))
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (error: Exception) {
            call.reject("Unable to open notification settings", error)
        }
    }

    @PluginMethod
    fun registerForPush(call: PluginCall) {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful || task.result.isNullOrBlank()) {
                    call.reject("Background push registration is unavailable")
                } else {
                    call.resolve(JSObject().put("token", task.result))
                }
            }
        } catch (error: Exception) {
            call.reject("Background push registration is unavailable")
        }
    }

    @PluginMethod
    fun deletePushToken(call: PluginCall) {
        try {
            FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener { task ->
                if (task.isSuccessful) call.resolve() else call.reject("Unable to disable background push")
            }
        } catch (error: Exception) {
            call.reject("Unable to disable background push")
        }
    }

    @PluginMethod
    fun show(call: PluginCall) {
        if (currentPermissionStatus() != "granted") {
            call.reject("Notification permission is not granted")
            return
        }

        val title = call.getString("title")?.take(80)?.ifBlank { "VEIL" } ?: "VEIL"
        val body = call.getString("body")?.take(240)?.ifBlank { "New encrypted message received" }
            ?: "New encrypted message received"
        val messageId = call.getString("id") ?: System.currentTimeMillis().toString()
        val conversationId = call.getString("conversationId")?.take(160)
        val spaceId = call.getString("spaceId")?.take(160)
        val allowReply = call.getBoolean("allowReply", false) &&
            !conversationId.isNullOrBlank() && !spaceId.isNullOrBlank()

        try {
            createNotificationChannel()
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pendingIntent = launchIntent?.let {
                PendingIntent.getActivity(
                    context,
                    messageId.hashCode(),
                    it,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            }
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_veil)
                .setContentTitle(title)
                .setContentText(body)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .apply { if (pendingIntent != null) setContentIntent(pendingIntent) }
                .apply {
                    if (allowReply) {
                        val replyIntent = Intent(context, MainActivity::class.java)
                            .setAction(REPLY_ACTION)
                            .putExtra(CONVERSATION_ID_KEY, conversationId)
                            .putExtra(SPACE_ID_KEY, spaceId)
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        val replyPendingIntent = PendingIntent.getActivity(
                            context,
                            messageId.hashCode(),
                            replyIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
                        )
                        val remoteInput = RemoteInput.Builder(REPLY_KEY)
                            .setLabel("Reply privately")
                            .build()
                        val replyAction = NotificationCompat.Action.Builder(
                            R.drawable.ic_stat_veil,
                            "Reply",
                            replyPendingIntent,
                        ).addRemoteInput(remoteInput).setAllowGeneratedReplies(false).build()
                        addAction(replyAction)
                    }
                }
                .build()

            NotificationManagerCompat.from(context).notify(messageId.hashCode(), notification)
            call.resolve()
        } catch (error: SecurityException) {
            call.reject("Android denied notification delivery", error)
        } catch (error: Exception) {
            call.reject("Unable to show notification", error)
        }
    }

    @PluginMethod
    fun clearAll(call: PluginCall) {
        try {
            NotificationManagerCompat.from(context).cancelAll()
            call.resolve()
        } catch (error: Exception) {
            call.reject("Unable to clear notifications", error)
        }
    }

    override fun handleOnNewIntent(intent: Intent) {
        if (intent.action != REPLY_ACTION) return
        val remoteInput = RemoteInput.Builder(REPLY_KEY).build()
        val replyText = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(REPLY_KEY)
            ?.toString()
            ?.take(10_000)
            ?.trim()
        val conversationId = intent.getStringExtra(CONVERSATION_ID_KEY)
        val spaceId = intent.getStringExtra(SPACE_ID_KEY)

        // Clear the one-shot intent payload before passing the in-memory reply to JS.
        RemoteInput.addResultsToIntent(remoteInput, intent, Bundle())
        intent.removeExtra(CONVERSATION_ID_KEY)
        intent.removeExtra(SPACE_ID_KEY)
        intent.clipData = null
        intent.action = null

        if (!replyText.isNullOrBlank() && !conversationId.isNullOrBlank() && !spaceId.isNullOrBlank()) {
            notifyListeners(
                "reply",
                JSObject()
                    .put("conversationId", conversationId)
                    .put("spaceId", spaceId)
                    .put("text", replyText),
                true,
            )
        }
    }

    private fun currentPermissionStatus(): String {
        val runtimeGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        val appNotificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        return if (runtimeGranted && appNotificationsEnabled) "granted" else "denied"
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = CHANNEL_DESCRIPTION
            lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
