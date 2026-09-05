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

@CapacitorPlugin(name = "VeilNativeMedia")
class VeilNativeMediaPlugin : Plugin() {

    private var exoPlayer: ExoPlayer? = null
    private var currentMessageId: String? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    private var pendingSeekRunnable: Runnable? = null
    private var isReleased = false

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
                val data = JSObject().apply {
                    put("state", "error")
                    put("errorCode", error.errorCodeName)
                    put("message", error.localizedMessage ?: "Playback error")
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
        val startPositionMs = call.getLong("startPositionMs") ?: 0L

        mainHandler.post {
            try {
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

                player.setMediaSource(mediaSource)
                player.prepare()
                if (startPositionMs > 0L) {
                    player.seekTo(startPositionMs)
                }
                player.play()

                val ret = JSObject().apply {
                    put("success", true)
                    put("messageId", messageId ?: "")
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
        val positionMs = call.getLong("positionMs")
        if (positionMs == null) {
            call.reject("positionMs is required")
            return
        }

        pendingSeekRunnable?.let { mainHandler.removeCallbacks(it) }
        pendingSeekRunnable = Runnable {
            exoPlayer?.let { player ->
                player.seekTo(positionMs)
                val ret = JSObject().apply {
                    put("success", true)
                    put("currentPositionMs", player.currentPosition)
                    put("durationMs", if (player.duration > 0) player.duration else 0L)
                }
                call.resolve(ret)
            } ?: call.reject("Player not initialized")
        }
        mainHandler.post(pendingSeekRunnable!!)
    }

    @PluginMethod
    fun stopAudio(call: PluginCall) {
        mainHandler.post {
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
            stopProgressUpdates()
            exoPlayer?.release()
            exoPlayer = null
            isReleased = true
        }
    }
}
