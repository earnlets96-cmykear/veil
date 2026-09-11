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
        Permission(alias = "camera", strings = [Manifest.permission.CAMERA]),
    ],
)
class VeilDeviceMediaPlugin : Plugin() {

    private var pendingCameraUri: Uri? = null
    private var pendingCameraFile: java.io.File? = null

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
    fun captureMedia(call: PluginCall) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback")
            return
        }
        launchCamera(call)
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            launchCamera(call)
        } else {
            call.reject("Camera permission was denied")
        }
    }

    private fun launchCamera(call: PluginCall) {
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        try {
            val photoFile = java.io.File.createTempFile("cam_", ".jpg", context.cacheDir)
            val photoUri = androidx.core.content.FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                photoFile
            )
            pendingCameraFile = photoFile
            pendingCameraUri = photoUri
            intent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startActivityForResult(call, intent, "captureMediaResult")
        } catch (_: Exception) {
            try {
                startActivityForResult(call, intent, "captureMediaResult")
            } catch (err: Exception) {
                call.reject("Unable to launch camera", err)
            }
        }
    }

    @ActivityCallback
    private fun captureMediaResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            pendingCameraFile?.delete()
            pendingCameraFile = null
            pendingCameraUri = null
            call.resolve(JSObject().put("items", JSArray()))
            return
        }

        val uri = pendingCameraUri
        val file = pendingCameraFile
        val items = JSArray()

        if (file != null && file.exists() && file.length() > 0 && uri != null) {
            val item = JSObject().apply {
                put("uri", uri.toString())
                put("name", file.name)
                put("mimeType", "image/jpeg")
                put("sizeBytes", file.length())
                thumbnailFor(uri)?.let { put("thumbnailDataUrl", it) }
            }
            items.put(item)
        } else {
            val bitmap = result.data?.extras?.get("data") as? Bitmap
            if (bitmap != null) {
                try {
                    val fallbackFile = java.io.File.createTempFile("cam_capture_", ".jpg", context.cacheDir)
                    val fos = java.io.FileOutputStream(fallbackFile)
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 90, fos)
                    fos.flush()
                    fos.close()
                    val fallbackUri = androidx.core.content.FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        fallbackFile
                    )
                    val item = JSObject().apply {
                        put("uri", fallbackUri.toString())
                        put("name", fallbackFile.name)
                        put("mimeType", "image/jpeg")
                        put("sizeBytes", fallbackFile.length())
                        val out = ByteArrayOutputStream()
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 65, out)
                        put("thumbnailDataUrl", "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
                    }
                    items.put(item)
                } catch (_: Exception) {}
            }
        }
        pendingCameraFile = null
        pendingCameraUri = null
        call.resolve(JSObject().put("items", items))
    }

    private data class MediaRow(
        val uri: String,
        val name: String,
        val mimeType: String,
        val sizeBytes: Long,
        val dateAdded: Long,
        val thumbnailDataUrl: String? = null
    )

    @PluginMethod
    fun listRecentMedia(call: PluginCall) {
        val limit = (call.getInt("limit") ?: 60).coerceIn(1, 60)
        val types = call.getArray("types")
        val typesStr = types?.toString() ?: ""
        val includeImage = types == null || typesStr.contains("image")
        val includeVideo = types == null || typesStr.contains("video")
        val includeFile = types != null && typesStr.contains("file")

        val rows = mutableListOf<MediaRow>()

        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.MIME_TYPE,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.DATE_ADDED,
        )

        fun queryUri(contentUri: Uri, mimePrefix: String? = null, maxCount: Int = limit) {
            try {
                val selection = if (mimePrefix != null) "${MediaStore.MediaColumns.MIME_TYPE} LIKE ?" else null
                val selectionArgs = if (mimePrefix != null) arrayOf("$mimePrefix%") else null
                val cursor = context.contentResolver.query(
                    contentUri,
                    projection,
                    selection,
                    selectionArgs,
                    "${MediaStore.MediaColumns.DATE_ADDED} DESC"
                )
                cursor?.use {
                    val idCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
                    val nameCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                    val mimeCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
                    val sizeCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
                    val dateCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
                    var c = 0
                    while (it.moveToNext() && c < maxCount) {
                        val id = it.getLong(idCol)
                        val name = it.getString(nameCol) ?: "media"
                        val mime = it.getString(mimeCol) ?: "application/octet-stream"
                        val size = it.getLong(sizeCol)
                        val dateAdded = it.getLong(dateCol)
                        val itemUri = Uri.withAppendedPath(contentUri, id.toString())
                        val thumb = if (mime.startsWith("image/") || mime.startsWith("video/")) thumbnailFor(itemUri) else null
                        rows.add(MediaRow(itemUri.toString(), name, mime, size, dateAdded, thumb))
                        c++
                    }
                }
            } catch (_: Exception) {}
        }

        if (includeImage) {
            queryUri(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image")
        }
        if (includeVideo) {
            queryUri(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, "video")
        }
        if (includeFile) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                queryUri(MediaStore.Downloads.EXTERNAL_CONTENT_URI)
            }
            try {
                val filesUri = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL)
                val cursor = context.contentResolver.query(
                    filesUri,
                    projection,
                    "${MediaStore.Files.FileColumns.MEDIA_TYPE} = ${MediaStore.Files.FileColumns.MEDIA_TYPE_NONE}",
                    null,
                    "${MediaStore.MediaColumns.DATE_ADDED} DESC"
                )
                cursor?.use {
                    val idCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
                    val nameCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                    val mimeCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
                    val sizeCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
                    val dateCol = it.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
                    var c = 0
                    while (it.moveToNext() && c < limit) {
                        val id = it.getLong(idCol)
                        val name = it.getString(nameCol) ?: "file"
                        val mime = it.getString(mimeCol) ?: "application/octet-stream"
                        val size = it.getLong(sizeCol)
                        val dateAdded = it.getLong(dateCol)
                        val itemUri = Uri.withAppendedPath(filesUri, id.toString())
                        rows.add(MediaRow(itemUri.toString(), name, mime, size, dateAdded, null))
                        c++
                    }
                }
            } catch (_: Exception) {}
        }

        // Sort descending by dateAdded and limit
        val sorted = rows.distinctBy { it.uri }.sortedByDescending { it.dateAdded }.take(limit)
        val items = JSArray()
        for (row in sorted) {
            val item = JSObject().apply {
                put("uri", row.uri)
                put("name", row.name)
                put("mimeType", row.mimeType)
                put("sizeBytes", row.sizeBytes)
                row.thumbnailDataUrl?.let { put("thumbnailDataUrl", it) }
            }
            items.put(item)
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
        try {
            startActivityForResult(call, intent, "documentPickerResult")
        } catch (_: Exception) {
            try {
                val fallback = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                startActivityForResult(call, fallback, "documentPickerResult")
            } catch (fallbackError: Exception) {
                call.reject("No document picker available on this device", fallbackError)
            }
        }
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
