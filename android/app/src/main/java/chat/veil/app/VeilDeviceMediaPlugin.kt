package chat.veil.app

import android.Manifest
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Base64
import android.util.Size
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.ByteArrayOutputStream

@CapacitorPlugin(
    name = "VeilDeviceMedia",
    permissions = [
        Permission(alias = "recentMedia", strings = [Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO]),
        Permission(alias = "legacyRead", strings = [Manifest.permission.READ_EXTERNAL_STORAGE]),
        Permission(alias = "legacyWrite", strings = [Manifest.permission.WRITE_EXTERNAL_STORAGE]),
    ],
)
class VeilDeviceMediaPlugin : Plugin() {

    @PluginMethod
    fun requestRecentMediaPermission(call: PluginCall) {
        when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("recentMedia") != PermissionState.GRANTED ->
                requestPermissionForAlias("recentMedia", call, "recentMediaPermissionCallback")
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && getPermissionState("legacyRead") != PermissionState.GRANTED ->
                requestPermissionForAlias("legacyRead", call, "recentMediaPermissionCallback")
            else -> call.resolve(JSObject().put("status", "granted"))
        }
    }

    @PermissionCallback
    private fun recentMediaPermissionCallback(call: PluginCall) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getPermissionState("recentMedia") == PermissionState.GRANTED
        } else {
            getPermissionState("legacyRead") == PermissionState.GRANTED
        }
        call.resolve(JSObject().put("status", if (granted) "granted" else "denied"))
    }

    @PluginMethod
    fun listRecentMedia(call: PluginCall) {
        val limit = (call.getInt("limit") ?: 60).coerceIn(1, 60)
        val items = JSArray()
        val projection = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.SIZE,
            MediaStore.Files.FileColumns.MEDIA_TYPE,
            MediaStore.Files.FileColumns.DATE_ADDED,
        )
        val types = call.getArray("types")
        val includeImage = types == null || types.toString().contains("image")
        val includeVideo = types == null || types.toString().contains("video")
        val mediaTypes = buildList {
            if (includeImage) add(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString())
            if (includeVideo) add(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString())
        }
        if (mediaTypes.isEmpty()) {
            call.resolve(JSObject().put("items", items))
            return
        }

        val selection = "${MediaStore.Files.FileColumns.MEDIA_TYPE} IN (${mediaTypes.joinToString(",")})"
        val cursor = context.contentResolver.query(
            MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL),
            projection,
            selection,
            null,
            "${MediaStore.Files.FileColumns.DATE_ADDED} DESC",
        )
        cursor?.use {
            val idColumn = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val nameColumn = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
            val mimeColumn = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
            val sizeColumn = it.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
            var count = 0
            while (it.moveToNext() && count < limit) {
                val id = it.getLong(idColumn)
                val mime = it.getString(mimeColumn) ?: "application/octet-stream"
                val base = if (mime.startsWith("video/")) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                val item = JSObject()
                item.put("uri", Uri.withAppendedPath(base, id.toString()).toString())
                item.put("name", it.getString(nameColumn) ?: "media")
                item.put("mimeType", mime)
                item.put("sizeBytes", it.getLong(sizeColumn))
                thumbnailFor(Uri.withAppendedPath(base, id.toString()))?.let { thumbnail ->
                    item.put("thumbnailDataUrl", thumbnail)
                }
                items.put(item)
                count += 1
            }
        }
        call.resolve(JSObject().put("items", items))
    }

    @PluginMethod
    fun readMedia(call: PluginCall) {
        val rawUri = call.getString("uri")
        if (rawUri.isNullOrBlank()) {
            call.reject("uri is required")
            return
        }
        try {
            val uri = Uri.parse(rawUri)
            val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
                val output = ByteArrayOutputStream()
                input.copyTo(output)
                output.toByteArray()
            } ?: throw IllegalStateException("Selected media cannot be opened")
            val metadata = metadataFor(uri)
            call.resolve(JSObject().apply {
                put("name", metadata.name)
                put("mimeType", metadata.mimeType)
                put("sizeBytes", bytes.size)
                put("base64Data", Base64.encodeToString(bytes, Base64.NO_WRAP))
            })
        } catch (error: Exception) {
            call.reject("Unable to read selected media", error)
        }
    }

    @PluginMethod
    fun pickDocuments(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(call, intent, "documentPickerResult")
    }

    @ActivityCallback
    private fun documentPickerResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.resolve(JSObject().put("items", JSArray()))
            return
        }
        val intent = result.data!!
        val items = JSArray()
        val uris = mutableListOf<Uri>()
        intent.data?.let { uris.add(it) }
        intent.clipData?.let { clip -> for (index in 0 until clip.itemCount) uris.add(clip.getItemAt(index).uri) }
        for (uri in uris.distinct()) {
            try {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (_: SecurityException) {}
            val metadata = metadataFor(uri)
            items.put(JSObject().apply {
                put("uri", uri.toString())
                put("name", metadata.name)
                put("mimeType", metadata.mimeType)
                put("sizeBytes", metadata.sizeBytes)
            })
        }
        call.resolve(JSObject().put("items", items))
    }

    @PluginMethod
    fun saveToGallery(call: PluginCall) {
        val filename = call.getString("filename")
        val mimeType = call.getString("mimeType")
        val base64Data = call.getString("base64Data")
        if (filename.isNullOrBlank() || mimeType.isNullOrBlank() || base64Data.isNullOrBlank()) {
            call.reject("filename, mimeType, and base64Data are required")
            return
        }
        if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
            call.reject("Only images and videos can be saved to Gallery")
            return
        }

        try {
            val collection = if (mimeType.startsWith("video/")) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, if (mimeType.startsWith("video/")) "Movies/VEIL" else "Pictures/VEIL")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }
            val uri = context.contentResolver.insert(collection, values) ?: throw IllegalStateException("Unable to create gallery entry")
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    ?: throw IllegalStateException("Unable to write gallery entry")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    context.contentResolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
                }
            } catch (error: Exception) {
                context.contentResolver.delete(uri, null, null)
                throw error
            }
            call.resolve(JSObject().apply {
                put("uri", uri.toString())
                put("location", if (mimeType.startsWith("video/")) "Movies/VEIL" else "Pictures/VEIL")
            })
        } catch (error: Exception) {
            call.reject("Unable to save media to Gallery", error)
        }
    }

    private data class MediaMetadata(val name: String, val mimeType: String, val sizeBytes: Long)

    /** Keeps the attachment sheet fast: only a small preview crosses the bridge. */
    private fun thumbnailFor(uri: Uri): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        return try {
            val bitmap = context.contentResolver.loadThumbnail(uri, Size(160, 160), null)
            val output = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 65, output)
            bitmap.recycle()
            "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) {
            null
        }
    }

    private fun metadataFor(uri: Uri): MediaMetadata {
        var name = "attachment"
        var size = 0L
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                name = cursor.getString(0) ?: name
                size = cursor.getLong(1)
            }
        }
        return MediaMetadata(name, context.contentResolver.getType(uri) ?: "application/octet-stream", size)
    }
}
