package chat.veil.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
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
        private const val CHANNEL_NAME = "Messages"
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
                .build()

            NotificationManagerCompat.from(context).notify(messageId.hashCode(), notification)
            call.resolve()
        } catch (error: SecurityException) {
            call.reject("Android denied notification delivery", error)
        } catch (error: Exception) {
            call.reject("Unable to show notification", error)
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
            description = "Notifications for incoming VEIL messages"
            lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
