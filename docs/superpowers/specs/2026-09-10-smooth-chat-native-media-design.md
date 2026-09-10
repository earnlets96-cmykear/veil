# Smooth Chat and Native Media Design

## Scope

Improve chat responsiveness, reshape the composer and attachment flow, expose a true in-app Recent photo/video view on Android, and save image/video attachments to the device gallery. This is a UI, performance, and Android integration slice; it does not alter VEIL encryption, spaces, authentication, relay payloads, or media authorization.

## User Experience

The chat composer remains anchored while typing, recording, selecting media, uploading, and receiving download progress. It has one compact input row with attachment, voice, text, and send controls. Opening attachment actions presents a Telegram-style bottom sheet rather than a conventional modal.

The sheet contains four primary actions: Recent, Camera, Files, and Voice. Recent shows a capped, thumbnail-first grid of device photos and videos, supports multi-select, and opens only after the user grants media access. Camera uses the platform capture flow. Files opens Android's scoped document picker; it never requests broad file-system access. The sheet retains a local encrypted-app list of recently selected documents so repeat sharing is possible without re-browsing.

Selected media is previewed and can be removed before Send. It remains local plaintext only inside the operating system picker and VEIL's staging memory. VEIL encrypts media only after Send, using the existing attachment pipeline.

## Permission Model

VEIL does not request storage or media access at launch.

Opening Recent requests Android's granular image/video access. A denial leaves Camera and Files available and gives an in-sheet explanation with a retry action. The app must support Android's selected-photos/limited access result and render only what the operating system grants.

Tapping Save to Gallery requests the required save permission only when the Android version requires it. Images and video are inserted through Android `MediaStore`, with `IS_PENDING` semantics so incomplete plaintext is not exposed to other apps. On Android 10 and newer, MediaStore insertion avoids legacy broad write-storage access. The UI reports success only after finalization and media-scanner visibility. Non-media files continue through the existing document/share save flow.

## Performance Architecture

1. **Chat render isolation:** Playback and transfer progress move to message-local subscriptions/state so a 10 Hz audio update cannot rerender the entire conversation tree. Conversation-level state remains for message data, navigation, and overlays only.
2. **Bounded timeline:** Preserve the current message-window strategy and stabilize row props/callbacks. Message rows remain memoized; opening a chat renders the visible window first and never waits for media work.
3. **Thumbnail pipeline:** Device-media and attachment thumbnails are generated or decoded in a bounded queue. Only visible cells receive decode work; scroll, close, selection change, and lock cancel queued work. Full-resolution bytes are never decoded merely to render a grid thumbnail.
4. **Heavy media work:** Base64/JSON chunk decoding, encryption, decryption, SHA-256 verification, and thumbnail generation must be moved off the UI thread where browser/native platform capabilities permit. The UI receives progress through throttled animation-frame updates, never one React state update per chunk.
5. **Memory lifecycle:** Object URLs and preview bytes are released after deselection, send completion/error, viewer close, cache eviction, and lock. Recent grid keeps only bounded thumbnail metadata and thumbnail data in memory.

## Android Bridge Boundary

Create a dedicated native Capacitor plugin separate from `VeilNativeMedia` because audio playback and device-library/file/gallery operations have different lifecycles and permissions.

The plugin exposes narrow APIs:

- `requestRecentMediaPermission(): { status }`
- `listRecentMedia({ cursor?, limit, types }): { items, nextCursor? }`
- `readSelectedMedia({ uri }): { name, mimeType, sizeBytes, data/base64 or stream handle }`
- `pickDocument(): { uri, name, mimeType, sizeBytes }[]`
- `captureMedia(): { uri, name, mimeType, sizeBytes }[]`
- `saveToGallery({ filename, mimeType, base64Data }): { uri, location }`

The TypeScript bridge converts an explicitly selected URI into a `File`-compatible staging object only for the existing send pipeline. It does not persist arbitrary URI grants, plaintext media, or gallery metadata in an unencrypted store. The plugin reads only selected/listed media and writes only files supplied by the user through Save.

## Failure Handling

- Permission denied: keep the sheet open, retain selected in-memory files, show a precise retry/settings action, and do not crash.
- Picker cancelled: preserve current staged selection and return to the sheet.
- Source media unreadable or exceeds attachment limits: mark only that item unavailable; retain the rest of the selection.
- Thumbnail/decode error: render a file-type fallback; never block scrolling or sending a different item.
- Gallery write failure: retain decrypted bytes only for the active operation, report the exact save failure, and offer a system share/save fallback for user choice.

## Testing and Acceptance Criteria

- Permission requests occur only when Recent or Save is explicitly tapped; no startup request.
- Recent grid supports image/video pagination, limited permission, denial, cancellation, multi-select, and failure fallback.
- Files use a scoped document picker and local VEIL recent-document history; no broad all-files permission is declared or requested.
- Gallery media save uses MediaStore and produces a Gallery-visible item only after finalization.
- Text, existing attachments, encryption, recipient authorization, and send behavior remain unchanged.
- Unit tests cover permission routing, media selection/staging, MediaStore request/failure mapping, progress throttling, and cancellation.
- Focused React/native-bridge tests, existing media/attachment regressions, web build, Capacitor sync, and Android unit/build verification run before completion. Physical Android verification remains user-owned.

## Files Expected to Change

- `src/ui/components/MessageComposer.tsx`
- `src/ui/components/media/MediaPickerModal.tsx`
- `src/ui/utils/fileSaver.ts`
- `src/attachments/attachmentPipeline.ts` and/or a dedicated worker adapter
- `src/ui/utils/mediaCache.ts`
- `src/media/NativeDeviceMediaBridge.ts` (new)
- `android/app/src/main/java/chat/veil/app/VeilDeviceMediaPlugin.kt` (new)
- `android/app/src/main/java/chat/veil/app/MainActivity.java`
- `android/app/src/main/AndroidManifest.xml`
- relevant CSS, tests, and AI continuity documents.
