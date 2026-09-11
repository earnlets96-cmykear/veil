package chat.veil.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.MessageDigest

@CapacitorPlugin(name = "VeilNativeMedia")
class VeilNativeMediaPlugin : Plugin() {

    private var exoPlayer: ExoPlayer? = null
    private var currentMessageId: String? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    private var pendingSeekCall: PluginCall? = null
    private var pendingSeekTargetMs: Long = 0L
    private var pendingSeekFallbackRunnable: Runnable? = null
    private var isReleased = false

    private fun emitDiagnostic(
        event: String,
        msgId: String,
        requestedMs: Long,
        beforeMs: Long,
        afterMs: Long,
        durationMs: Long,
        state: Int
    ) {
        val opaqueId = if (msgId.isNotEmpty()) {
            try {
                val digest = MessageDigest.getInstance("SHA-256").digest(msgId.toByteArray())
                digest.take(4).joinToString("") { "%02x".format(it) }
            } catch (_e: Exception) {
                msgId.takeLast(6)
            }
        } else "none"

        val diag = JSObject().apply {
            put("event", event)
            put("opaqueMessageId", opaqueId)
            put("requestedMs", requestedMs)
            put("beforeMs", beforeMs)
            put("afterMs", afterMs)
            put("durationMs", durationMs)
            put("playbackState", state)
        }
        notifyListeners("onPlaybackDiagnostic", diag)
    }

    private fun getOrCreatePlayer(): ExoPlayer {
        if (exoPlayer != null && !isReleased) {
            return exoPlayer!!
        }

        val context: Context = activity.applicationContext
        val player = ExoPlayer.Builder(context).build()

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
            .build()

        player.setAudioAttributes(audioAttributes, true)
        player.setHandleAudioBecomingNoisy(true)

        player.addListener(object : Player.Listener {
            override fun onPositionDiscontinuity(
                oldPosition: Player.PositionInfo,
                newPosition: Player.PositionInfo,
                reason: Int
            ) {
                val dur = if (player.duration > 0) player.duration else 0L
                val confirmedPos = newPosition.positionMs
                val msgId = currentMessageId ?: ""

                if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                    pendingSeekFallbackRunnable?.let { mainHandler.removeCallbacks(it) }
                    pendingSeekFallbackRunnable = null

                    val target = pendingSeekTargetMs
                    val call = pendingSeekCall
                    pendingSeekCall = null

                    if (call != null) {
                        val ret = JSObject().apply {
                            put("success", true)
                            put("currentPositionMs", confirmedPos)
                            put("durationMs", dur)
                            put("messageId", msgId)
                        }
                        call.resolve(ret)
                    }

                    val progressData = JSObject().apply {
                        put("currentPositionMs", confirmedPos)
                        put("durationMs", dur)
                        put("messageId", msgId)
                    }
                    notifyListeners("onPlaybackProgress", progressData)

                    emitDiagnostic(
                        event = "seekDiscontinuityConfirmed",
                        msgId = msgId,
                        requestedMs = target,
                        beforeMs = oldPosition.positionMs,
                        afterMs = confirmedPos,
                        durationMs = dur,
                        state = player.playbackState
                    )
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                val stateString = when (playbackState) {
                    Player.STATE_IDLE -> "idle"
                    Player.STATE_BUFFERING -> "buffering"
                    Player.STATE_READY -> if (player.isPlaying) "playing" else "ready"
                    Player.STATE_ENDED -> "ended"
                    else -> "idle"
                }

                val currentPos = player.currentPosition
                val duration = if (player.duration > 0) player.duration else 0L

                val data = JSObject().apply {
                    put("state", stateString)
                    put("isPlaying", player.isPlaying)
                    put("currentPositionMs", currentPos)
                    put("durationMs", duration)
                    put("messageId", currentMessageId ?: "")
                }
                notifyListeners("onPlaybackStateChange", data)

                if (playbackState == Player.STATE_ENDED) {
                    stopProgressUpdates()
                    val endedData = JSObject().apply {
                        put("state", "ended")
                        put("messageId", currentMessageId ?: "")
                        put("durationMs", duration)
                        put("currentPositionMs", duration)
                    }
                    notifyListeners("onPlaybackEnded", endedData)
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                val duration = if (player.duration > 0) player.duration else 0L
                val currentPos = player.currentPosition

                val data = JSObject().apply {
                    put("state", if (isPlaying) "playing" else "paused")
                    put("isPlaying", isPlaying)
                    put("currentPositionMs", currentPos)
                    put("durationMs", duration)
                    put("messageId", currentMessageId ?: "")
                }
                notifyListeners("onPlaybackStateChange", data)

                if (isPlaying) {
                    startProgressUpdates()
                } else {
                    stopProgressUpdates()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                stopProgressUpdates()
                val causeMsg = error.cause?.localizedMessage ?: error.cause?.message ?: ""
                val fullMsg = if (causeMsg.isNotEmpty() && causeMsg != error.localizedMessage) {
                    "${error.localizedMessage ?: "Playback error"}: $causeMsg"
                } else {
                    error.localizedMessage ?: "Playback error"
                }
                val data = JSObject().apply {
                    put("state", "error")
                    put("errorCode", error.errorCodeName)
                    put("message", fullMsg)
                    put("cause", error.cause?.javaClass?.simpleName ?: "")
                    put("messageId", currentMessageId ?: "")
                }
                notifyListeners("onPlaybackError", data)
            }
        })

        exoPlayer = player
        isReleased = false
        return player
    }

    private fun startProgressUpdates() {
        stopProgressUpdates()
        progressRunnable = object : Runnable {
            override fun run() {
                exoPlayer?.let { player ->
                    if (player.isPlaying) {
                        val cur = player.currentPosition
                        val dur = if (player.duration > 0) player.duration else 0L
                        val data = JSObject().apply {
                            put("currentPositionMs", cur)
                            put("durationMs", dur)
                            put("messageId", currentMessageId ?: "")
                        }
                        notifyListeners("onPlaybackProgress", data)
                        mainHandler.postDelayed(this, 100L)
                    }
                }
            }
        }
        mainHandler.post(progressRunnable!!)
    }

    private fun stopProgressUpdates() {
        progressRunnable?.let { mainHandler.removeCallbacks(it) }
        progressRunnable = null
    }

    @PluginMethod
    fun playAudio(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrEmpty()) {
            call.reject("url is required")
            return
        }

        val authToken = call.getString("authToken")
        val messageId = call.getString("messageId")
        val startPositionMs = call.getDouble("startPositionMs")?.toLong() ?: call.getLong("startPositionMs") ?: 0L
        val clampedStartMs = if (startPositionMs > 0L) startPositionMs else 0L

        mainHandler.post {
            try {
                // Clear any pending seek from previous playback
                pendingSeekFallbackRunnable?.let { mainHandler.removeCallbacks(it) }
                pendingSeekFallbackRunnable = null
                pendingSeekCall?.let { prevCall ->
                    prevCall.resolve(JSObject().apply {
                        put("success", false)
                        put("superseded", true)
                        put("currentPositionMs", clampedStartMs)
                        put("durationMs", 0L)
                        put("messageId", messageId ?: "")
                    })
                }
                pendingSeekCall = null

                val player = getOrCreatePlayer()
                currentMessageId = messageId

                val context = activity.applicationContext
                val httpFactory = DefaultHttpDataSource.Factory()
                    .setAllowCrossProtocolRedirects(true)
                if (!authToken.isNullOrEmpty()) {
                    httpFactory.setDefaultRequestProperties(mapOf("Authorization" to "Bearer $authToken"))
                }
                val dataSourceFactory = DefaultDataSource.Factory(context, httpFactory)
                val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory)

                val mediaItem = MediaItem.fromUri(url)
                val mediaSource = mediaSourceFactory.createMediaSource(mediaItem)

                // Atomic initial position attachment - avoids race where prepare() starts at 0 before seekTo()
                player.setMediaSource(mediaSource, clampedStartMs)
                player.prepare()
                player.playWhenReady = true

                emitDiagnostic(
                    event = "playbackConfigured",
                    msgId = messageId ?: "",
                    requestedMs = clampedStartMs,
                    beforeMs = 0L,
                    afterMs = clampedStartMs,
                    durationMs = 0L,
                    state = player.playbackState
                )

                val ret = JSObject().apply {
                    put("success", true)
                    put("messageId", messageId ?: "")
                    put("startPositionMs", clampedStartMs)
                }
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Failed to play audio: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun pauseAudio(call: PluginCall) {
        mainHandler.post {
            exoPlayer?.pause()
            stopProgressUpdates()
            call.resolve(JSObject().put("success", true))
        }
    }

    @PluginMethod
    fun resumeAudio(call: PluginCall) {
        mainHandler.post {
            exoPlayer?.let { player ->
                player.play()
                startProgressUpdates()
                call.resolve(JSObject().put("success", true))
            } ?: call.reject("Player not initialized")
        }
    }

    @PluginMethod
    fun seekAudio(call: PluginCall) {
        val positionMs = call.getDouble("positionMs")?.toLong() ?: call.getLong("positionMs")
        if (positionMs == null) {
            call.reject("positionMs is required")
            return
        }

        mainHandler.post {
            val player = exoPlayer
            if (player == null) {
                call.reject("Player not initialized")
                return@post
            }

            if (player.playbackState == Player.STATE_IDLE) {
                player.prepare()
            }

            val rawDuration = player.duration
            val maxValidPos = if (rawDuration > 250L) rawDuration - 250L else if (rawDuration > 0L) rawDuration else Long.MAX_VALUE
            val clampedPositionMs = Math.max(0L, Math.min(positionMs, maxValidPos))
            val msgId = currentMessageId ?: ""
            val beforePos = player.currentPosition

            // Cancel and supersede existing pending seek if active
            pendingSeekFallbackRunnable?.let { mainHandler.removeCallbacks(it) }
            pendingSeekFallbackRunnable = null
            pendingSeekCall?.let { prevCall ->
                val fallbackRet = JSObject().apply {
                    put("success", false)
                    put("superseded", true)
                    put("currentPositionMs", player.currentPosition)
                    put("durationMs", if (rawDuration > 0) rawDuration else 0L)
                    put("messageId", msgId)
                }
                prevCall.resolve(fallbackRet)
            }

            pendingSeekCall = call
            pendingSeekTargetMs = clampedPositionMs

            // Fallback watchdog: if onPositionDiscontinuity doesn't fire within 350ms, resolve authoritatively
            pendingSeekFallbackRunnable = Runnable {
                pendingSeekCall?.let { pendingCall ->
                    val curPos = player.currentPosition
                    val dur = if (player.duration > 0) player.duration else 0L
                    val ret = JSObject().apply {
                        put("success", true)
                        put("currentPositionMs", curPos)
                        put("durationMs", dur)
                        put("messageId", msgId)
                    }
                    pendingCall.resolve(ret)
                    pendingSeekCall = null

                    val progressData = JSObject().apply {
                        put("currentPositionMs", curPos)
                        put("durationMs", dur)
                        put("messageId", msgId)
                    }
                    notifyListeners("onPlaybackProgress", progressData)

                    emitDiagnostic(
                        event = "seekWatchdogResolved",
                        msgId = msgId,
                        requestedMs = clampedPositionMs,
                        beforeMs = beforePos,
                        afterMs = curPos,
                        durationMs = dur,
                        state = player.playbackState
                    )
                }
            }
            mainHandler.postDelayed(pendingSeekFallbackRunnable!!, 350L)

            player.seekTo(clampedPositionMs)
        }
    }

    @PluginMethod
    fun stopAudio(call: PluginCall) {
        mainHandler.post {
            pendingSeekFallbackRunnable?.let { mainHandler.removeCallbacks(it) }
            pendingSeekFallbackRunnable = null
            pendingSeekCall = null
            pendingSeekTargetMs = 0L

            stopProgressUpdates()
            exoPlayer?.stop()
            currentMessageId = null
            call.resolve(JSObject().put("success", true))
        }
    }

    @PluginMethod
    fun getPlaybackStatus(call: PluginCall) {
        mainHandler.post {
            val player = exoPlayer
            val ret = JSObject().apply {
                put("isPlaying", player?.isPlaying ?: false)
                put("currentPositionMs", player?.currentPosition ?: 0L)
                put("durationMs", if (player != null && player.duration > 0) player.duration else 0L)
                put("messageId", currentMessageId ?: "")
            }
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun releaseAudio(call: PluginCall) {
        mainHandler.post {
            pendingSeekFallbackRunnable?.let { mainHandler.removeCallbacks(it) }
            pendingSeekFallbackRunnable = null
            pendingSeekCall = null
            pendingSeekTargetMs = 0L

            stopProgressUpdates()
            exoPlayer?.release()
            exoPlayer = null
            isReleased = true
            currentMessageId = null
            call.resolve(JSObject().put("success", true))
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        mainHandler.post {
            pendingSeekFallbackRunnable?.let { mainHandler.removeCallbacks(it) }
            pendingSeekFallbackRunnable = null
            pendingSeekCall = null

            stopProgressUpdates()
            exoPlayer?.release()
            exoPlayer = null
            isReleased = true
        }
    }
}
