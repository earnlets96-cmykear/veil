# CHANGELOG — VEIL Secure Messenger

All notable changes to the VEIL project are documented in this file.

## [1.0.0-phase38] - 2026-08-29

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
