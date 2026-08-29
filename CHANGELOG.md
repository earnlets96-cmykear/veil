# CHANGELOG — VEIL Secure Messenger

All notable changes to the VEIL project are documented in this file.

## [1.0.0-phase44] - 2026-08-30

### Added
- **Dedicated Phase 44 Forensic Test Suites (`tests/phase44-*.test.ts`, `tests/phase44-*.test.tsx`)**:
  - `phase44-account-persistence-e2e.test.ts`: Proves remote persistence and full reinstall recovery from empty local storage.
  - `phase44-recovery-errors.test.ts`: Validates distinguishable error reporting for 401, network unreachable, missing vault, and idempotent recovery.
  - `phase44-config-production.test.ts`: Proves mobile production relay defaulting to `PRODUCTION_RELAY_URL` (`https://veil-rga0.onrender.com`).
  - `phase44-spinner-audit.test.tsx`: Validates clean CSS spinner rendering without SVG stroke artifacts.

### Changed
- **Mobile Environment Production Relay Resolution (`src/config/appConfig.ts`)**:
  - Configured `ConfigManager.getConfig()` to default mobile/Capacitor/WebView environments to `https://veil-rga0.onrender.com` rather than localhost `127.0.0.1`, resolving Android "Failed to fetch" errors.
- **Fail-Closed Space Registration & Remote Vault Persistence (`src/ui/app/AppState.tsx`, `src/ui/components/CreateSpaceModal.tsx`)**:
  - Added explicit username selection on space creation and enforced fail-closed account registration with remote encrypted recovery vault upload.
- **Network & Timeout Error Classification (`src/network/cloudClient.ts`)**:
  - Intercepted fetch errors and abort signals to produce clean, actionable user-facing messages.
- **Ugly SVG Spinner Removal & Minimal Premium Loading UI (`Spinner.tsx`, `LoadingSpinner.tsx`, `veil-components.css`)**:
  - Replaced SVG stroke circle animations with GPU-accelerated CSS spinner; updated button loading states ("Recovering…", "Creating Space…").

### Verification
- 308 / 308 test files passing (798 / 798 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk` in 22s).

## [1.0.0-phase43] - 2026-08-30

### Added
- **Dedicated Phase 43 Forensic Test Suites (`tests/phase43-*.test.ts`)**:
  - `phase43-audio-seeking-exhaustive.test.ts`: Proves exact seek calculations for 0%, 25%, 50%, 75%, 100%, out-of-bounds clamping, and duration=NaN/0 handling.
  - `phase43-grouped-media-combinations.test.ts`: Validates single-message multi-attachment combinations (1-5+ images, img+video, video+img+video, order preservation, failure isolation).
  - `phase43-video-lifecycle-exhaustive.test.tsx`: Validates play/pause state transitions, seek calculations, duration accuracy, mute/unmute, and unmount decoder cleanup.
  - `phase43-reply-and-picker-lifecycle.test.tsx`: Validates swipe-to-reply gesture sensitivity, vertical scroll cancellation, quote preservation, and picker state reset.
  - `phase43-account-recovery-exhaustive.test.ts`: Proves full fresh install recovery of Master Key, Ed25519 identity, spaces, contacts, and conversations with negative attack tests.

### Changed
- **Resource Lifecycle & Video Cleanup (`src/ui/components/media/MediaViewer.tsx`)**:
  - Added unmount lifecycle hook for `<video>` decoders, releasing video frame buffers and removing `src` attributes.
- **Touch Gesture Cancellation Resiliency (`src/ui/components/ui/MessageBubble.tsx`)**:
  - Added `onTouchCancel` handler ensuring swipe-to-reply offsets and long-press timers immediately reset if Android OS interrupts touch gestures.

### Verification
- 304 / 304 test files passing (788 / 788 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`).

## [1.0.0-phase42] - 2026-08-30

### Added
- **Runtime Forensic Diagnostics Subsystem (`src/debug/runtimeDiagnostics.ts`)**:
  - Structured, categorized telemetry across all critical data pipelines: `[VEIL MEDIA]`, `[VEIL UPLOAD]`, `[VEIL WIRE]`, `[VEIL RECEIVE]`, `[VEIL DOWNLOAD]`, `[VEIL DECRYPT]`, `[VEIL VIDEO]`, `[VEIL AUDIO]`, `[VEIL RECOVERY]`, `[VEIL TIMEOUT]`.
  - Automated security redaction engine guaranteeing zero leakage of passwords, private keys, symmetric keys, plaintext messages, or recovery secrets.
- **Dedicated Phase 42 Forensic Test Suites (`tests/phase42-*.test.ts`)**:
  - `phase42-runtime-diagnostics.test.ts`: Proves telemetry recording and secret redaction.
  - `phase42-audio-seek-runtime.test.ts`: Proves `HTMLAudioElement.currentTime` updates and touch scrubbing.
  - `phase42-video-player-runtime.test.tsx`: Validates video player lifecycle, seeking, and diagnostic events.
  - `phase42-account-recovery-runtime.test.ts`: Proves full memory wipe $\rightarrow$ account recovery $\rightarrow$ identical Master Key and `identityId`.
  - `phase42-media-delivery-runtime.test.ts`: Proves real 2-account media delivery for image, video, 3 images, and mixed media with all 15 audit invariants.
  - `phase42-state-machine-timeout.test.ts`: Validates fail-closed state transitions on network/R2 failures.

### Changed
- **Video Player Architecture (`src/ui/components/media/MediaViewer.tsx`)**:
  - Decoupled chat bubble thumbnail presentation from HTML5 video playback engine.
  - Interactive Fullscreen Viewer with video frame decoding, `loadedmetadata`, `canplay`, seek bar (`videoRef.current.currentTime = targetSeconds`), time duration formatting, mute/fullscreen toggles, and error recovery.
- **Account Recovery Trace & Sanitization (`src/account/accountManager.ts`)**:
  - Instrumented `restoreAccount` with step-by-step diagnostic logging and username case-insensitivity normalization.
- **State Machine Fail-Closed Timeouts (`src/ui/utils/mediaCache.ts`, `src/ui/app/AppState.tsx`)**:
  - Enforced 30s timeout guards on media upload and download operations to prevent hanging pending states.

### Verification
- 299 / 299 test files passing (774 / 774 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`).

## [1.0.0-phase41] - 2026-08-30

### Added
- **Strict Wire Serialization Boundary (`src/attachments/types.ts`)**:
  - Added `toWireAttachment()` and `toWireAttachments()` allowlist constructors that explicitly omit local UI state (`previewUrl`, `localPreviewUrl`, `state`, `progressPercent`, `error`, `blob:`, `Blob`, `File`, DOM elements, MediaCache state, upload promises).
  - Added recursive safety assertion `assertWireSafe()` to fail closed on any attempted transmission of ephemeral local URLs or DOM nodes over the wire.
- **Bounded Concurrency Upload Engine (`src/ui/app/AppState.tsx`)**:
  - Implemented `sendAttachments()` with bounded worker pool (`MAX_CONCURRENT_ATTACHMENT_UPLOADS = 2`).
  - Added non-blocking immediate UI staging (`[A: UPLOADING, B: UPLOADING, C: QUEUED, D: QUEUED]`) with zero composer freezing.
  - Per-item state tracking (`QUEUED | UPLOADING | SENT | FAILED`) with independent retry triggers.
- **Dedicated Phase 41 Test Suites (`tests/phase41-*.test.ts`)**:
  - `phase41-wire-payload-isolation.test.ts`: Validates protocol serialization allowlist and defensive recursion checks.
  - `phase41-multi-attachments.test.ts`: Validates bounded upload concurrency (max 2) and grouping.
  - `phase41-codec-audit.test.ts`: Scans all TypeScript files under `src/` to guarantee zero `atob()` / `btoa()` browser primitives.
  - `phase41-audio-seek.test.ts`: Validates `VoicePlaybackManager.seek()` physical control and `currentTime` synchronization.
  - `phase41-media-delivery-e2e.test.ts`: Validates 2-account real E2E media delivery over HTTP relay with local decryption.

### Changed
- **Codec Hardening in KDF (`src/crypto/kdf.ts`)**:
  - Replaced legacy `btoa(String.fromCharCode(...salt))` with constant-time UTF-8 safe `bytesToBase64(salt)`.
- **Message Composer Multi-File Dispatch (`src/ui/components/MessageComposer.tsx`)**:
  - Dispatches multiple selected files via `sendAttachments()` for single-message grouping.

### Verification
- 293 / 293 test files passing (762 / 762 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`).


### Added
- **5-Theme Design System (`src/styles/themes.css`, `veil-design-system.css`, `SettingsModal.tsx`)**:
  - Implemented 5 complete tokenized production themes: **Obsidian** (warm dark neutral #0c0c0e), **Slate** (cool dark blue-gray #0f1219), **Light** (clean minimal light #f5f5f7), **Midnight** (deep blue-black #0a0e18), and **Graphite** (neutral charcoal #121212).
  - Implemented 3 message density presets: **Compact**, **Comfortable**, and **Spacious**.
  - Dynamic cascading via `data-theme` and `data-density` attributes with instant apply (no restart) and persistent storage.
- **Web Worker Async Argon2id Unlock (`src/crypto/kdfWorker.ts`, `src/crypto/kdf.ts`, `src/spaces/vault.ts`, `sessionController.ts`)**:
  - Offloaded expensive 64 MiB Argon2id key derivation to a background Web Worker (`deriveKeyArgon2idAsync` / `unlockSpaceAsync`), eliminating main thread UI freezes during Space unlock.
  - Rebuilt Lock Screen with sub-100ms visual response, clean typography, progressive loading transitions ("Unlocking..." -> "Preparing secure space..."), and zero AI clutter/radial gradients.
- **True End-to-End Read Receipts (`src/messaging/readReceipts.ts`, `AppState.tsx`, `MessageStatus.tsx`)**:
  - Implemented `ReadReceiptManager` with debounced batch wire dispatching and inbound payload handling.
  - Extended `DeliveryStatus` to include `READ` and `UPLOADING` states.
  - Updated `MessageStatus.tsx` to provide clear 3-tier delivery ticks: Single Gray Check (Sent to Relay), Double Gray Checks (Delivered to Recipient), and Double Accent Checks (Read by Recipient).
- **Non-Blocking File & Media Pipeline (`AppState.tsx`, `MessageComposer.tsx`, `ConversationView.tsx`)**:
  - Instant preliminary message creation with local ephemeral preview URL and `UPLOADING` state.
  - Background asynchronous chunking, XChaCha20-Poly1305 encryption, and Cloudflare R2 upload without freezing the composer or conversation.
  - Non-blocking composer allowing uninterrupted text typing and multi-file queueing.
- **Interactive Voice Note Scrubbing & Timing (`VoiceNoteCard.tsx`, `ConversationView.tsx`)**:
  - Added pointer click & drag scrubbing across the waveform with real-time `seek()` execution without re-downloading audio.
  - Added live `currentTime / totalDuration` timing display (e.g. `0:07 / 0:24`).
- **Privacy-Preserving Presence Subsystem (`src/presence/presenceManager.ts`, `types.ts`, `SettingsModal.tsx`)**:
  - Local-first activity tracking with 60s inactivity decay and browser lifecycle listeners.
  - Fine-grained privacy controls: `nobody`, `contacts`, `everyone` with clean formatted status ("online", "last seen Xm ago", "last seen recently").
- **Dedicated Phase 38 Test Suites (`tests/phase38-*.test.ts`)**:
  - `phase38-unlock-performance.test.ts`: Validates async Argon2id derivation and multi-space unlock.
  - `phase38-read-receipts.test.ts`: Validates delivery status progression and inbound receipt updating.
  - `phase38-theme-and-presence.test.ts`: Validates presence privacy rules, activity decay, and subtitle formatting.
  - `phase38-voice-seek-and-media.test.ts`: Validates voice player seeking and media cache operations.

### Verification
- 100% test pass rate across all test suites.
- Native Android debug APK assembled cleanly via Gradle (`app-debug.apk`).
- SHA-256 release manifest verified and updated.

## [1.0.0-phase37] - 2026-08-28

### Added
- **Voice Message Player Engine (`src/attachments/voicePlayer.ts`)**:
  - Implemented `VoicePlaybackManager` and singleton `VoicePlayer` providing local XChaCha20-Poly1305 AEAD decryption, `HTMLAudioElement` playback, real-time waveform progress callbacks, and automatic object URL revocation on ended/stop.
  - Resolved `TypeError: ml.playvoicenote is not a function` by wiring robust static and instance methods on `VoiceRecorder` and `VoicePlayer`.
  - Connected `ConversationView.tsx` with `<VoiceNoteCard />` for real-time waveform progress, duration formatting, and seeking.
- **Dedicated Phase 37 Regression Suites (`tests/phase37-*.ts/tsx`)**:
  - `tests/phase37-voice-playback.test.ts`: Validates VoicePlayer download, AEAD decryption, playback, progress callbacks, seeking, and stop cleanup.
  - `tests/phase37-mobile-layout.test.tsx`: Validates VoiceNoteCard and MessageComposer component layout.

### Changed
- **Mobile Layout Geometry & Header Rebuild (`src/styles/veil-design-system.css`, `ConversationView.tsx`)**:
  - Rebuilt `.veil-conversation-header`, `.veil-header-profile-trigger`, `.veil-header-text`, `.veil-header-title`, and `.veil-header-subtitle` with flex alignment, `min-width: 0`, and single-line text ellipsis.
  - Eliminated vertical wrapping and character-by-character breakage on conversation titles and group headers.
- **Message Bubble & Timestamp Wrapping Fix (`src/styles/veil-design-system.css`, `MessageBubble.tsx`)**:
  - Eliminated unconstrained double wrapper around message bubbles; styled `.veil-msg-row`, `.veil-bubble-wrapper`, and `.veil-message-bubble` with natural flex dimensions.
  - Enforced `white-space: nowrap; flex-shrink: 0;` on `.veil-message-meta` preventing vertical timestamp wrapping (e.g. `0 8 : 3 5`).
- **Media & Photo Bubble Sizing (`src/styles/veil-components.css`)**:
  - Styled `.veil-media-bubble-container` with `max-width: min(82vw, 360px); width: 100%; min-width: 180px;`, preventing collapse into narrow columns.
- **Message Composer Mobile Overhaul (`src/styles/veil-design-system.css`, `MessageComposer.tsx`)**:
  - Compacted composer padding and replaced bulky send button with sleek circular `.veil-btn-composer-send` with minimum 40px touch target.
- **Subtle Desktop Empty State**:
  - Redesigned unselected conversation state with minimal branding ("Your conversations are encrypted by default" / "Select a conversation to begin").

### Verification
- 258 / 258 test suites passed (657 / 657 automated tests, 100% pass rate).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`, 4.52 MB, `BUILD SUCCESSFUL in 18s`).

## [1.0.0-phase36] - 2026-08-28

### Added
- **Android Microphone Runtime Permissions (`android/app/src/main/AndroidManifest.xml`)**:
  - Declared `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` permissions in Android manifest.
  - Authored `<PermissionsModal />` providing human-centered, privacy-first permission explanation before invoking runtime microphone prompt, with settings link on permanent denial.
- **Persistent Ephemeral Media Rehydration (`src/ui/utils/mediaCache.ts`, `src/ui/components/media/MediaImage.tsx`)**:
  - Hardened in-memory cache against stale/dead session Blob URLs (`blob:...`).
  - Implemented automatic authenticated download from Cloudflare R2 on app restart, RAM-based AEAD reassembly, and ephemeral blob URL generation with automatic `onError` recovery.
- **Dedicated Phase 36 Regression Suites (`tests/phase36-*.ts/tsx`)**:
  - `phase36-media-persistence.test.ts`: Validates dead blob URL rejection and cloud ciphertext rehydration.
  - `phase36-search-robustness.test.ts`: Validates relationship state resolution, same-device account search, and undefined array safety.
  - `phase36-permissions-mobile.test.tsx`: Validates microphone permission flow and zero emoji UI controls.

### Changed
- **Mobile-First Layout Architecture (`src/styles/veil-design-system.css`)**:
  - Rebuilt responsive media query targeting `.veil-conversation` and `.veil-conversation-empty`.
  - Enforced single-view mobile navigation (Chat List when no active chat; Conversation with `100dvh` and back button when active chat selected).
  - Excised desktop split-pane leaks and empty-state bleeds on mobile viewports.
- **Message Composer & Conversation Viewport (`src/ui/components/MessageComposer.tsx`, `ConversationView.tsx`)**:
  - Rebuilt message composer anchored to bottom respecting safe-area insets (`env(safe-area-inset-bottom)`), $\ge 44\text{px}$ touch targets, auto-expanding input, and 100% SVG iconography.
  - Constrained photo message bubble geometry (`max-width: min(82%, 360px)`) with integrated floating timestamp/status ticks.
  - Streamlined conversation header subtitle to compact status ("Encrypted", "Verified (Ed25519)", "Key Changed").
- **Search Robustness Fix (`src/ui/components/Sidebar.tsx`, `src/contacts/relationshipHelper.ts`)**:
  - Fixed `getRelationshipState` invocation to pass structured context object `{ myIdentityId, myUsername, contacts, contactRequests }`.
  - Added safe defaults `(contacts || [])`, `(contactRequests || [])`, `(conversations || [])` preventing `undefined.find` exceptions during startup and search.
- **100% SVG Vector Iconography**:
  - Eliminated all residual Unicode emojis from UI controls in `ErrorBoundary.tsx`, `MessageBubble.tsx`, `NewChatModal.tsx`, `Sidebar.tsx`, `AppState.tsx`, and fallback HTML in `main.ts`.

### Verification
- 256 / 256 test suites passed (651 / 651 automated tests, 100% pass rate).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`, 4.52 MB).

## [1.0.0-phase33] - 2026-08-28

### Added
- **In-Memory Decrypted Media Cache (`src/ui/utils/mediaCache.ts`)**:
  - Singleton `MediaCache` managing decrypted image/video buffers and ephemeral Blob URLs.
  - Zero-leakage memory lifecycle: automatically zeroizes and revokes all object URLs on Space Lock or Emergency Panic Lock.
- **Inline Decrypted Media Component (`src/ui/components/media/MediaImage.tsx`)**:
  - Automatic cloud ciphertext retrieval, cryptographic reassembly, and inline thumbnail rendering with smooth shimmer placeholder while decrypting.
  - Aspect ratio preservation, centered play badge for video attachments, and tap-to-fullscreen in `MediaViewer`.

### Changed
- **Settings Modal Visual Transformation (`src/ui/components/SettingsModal.tsx`)**:
  - Connected `{activeModal?.type === 'settings' && <SettingsModal />}` in `App.tsx` modal router.
  - Redesigned to match Telegram-inspired information architecture: Top Profile Header Card + clean grouped iOS/Telegram list rows with colored SVG icon badges (`badge-blue`, `badge-indigo`, `badge-emerald`, `badge-amber`, `badge-purple`, `badge-cyan`, `badge-rose`), subtitle value previews, and navigation chevrons.
- **Chat List & Sidebar Modernization (`src/ui/components/Sidebar.tsx`)**:
  - Added formatted relative timestamps (`14:22`, `Yesterday`, `Aug 26`).
  - Added SVG snippet indicators (`Photo`, `Video`, `File`, `Voice message`).
  - Glowing unread pill badge counter.
- **Conversation View & Bubbles (`src/ui/components/ConversationView.tsx`)**:
  - Embedded `<MediaImage />` inside message bubbles with floating bottom-right timestamps and delivery status checkmarks.
  - Connected `handleOpenMedia` directly to decrypted media items and byte buffers in `MediaViewer`.
- **Shared Media Gallery (`src/ui/components/media/MediaGalleryModal.tsx`)**:
  - Linked to real conversation media with `<MediaImage />` thumbnails and full `MediaViewer` playback.

### Verification
- 250 / 250 test suites passed (635 / 635 automated tests).
- Clean `npm run build:release` with verified SHA-256 release manifest.
- Clean Gradle debug APK build (`BUILD SUCCESSFUL in 17s`).
