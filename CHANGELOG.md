# CHANGELOG — VEIL Secure Messenger

All notable changes to the VEIL project are documented in this file.

## [1.0.0-ui-applock-overhaul] - 2026-09-05

### Added & Overhauled (Complete UI/UX Redesign, Multi-Space App Lock & Centralized Theme Engine)
- **Multi-Space App Lock & Silent Space Resolution (`src/privacy/pinManager.ts`, `src/ui/components/PinLockScreen.tsx`, `src/ui/components/AppLockSetupModal.tsx`, `src/ui/components/AppLockSettingsView.tsx`, `src/ui/components/AccountsAndSpacesModal.tsx`)**:
  - Argon2id KDF derivation with device-unique salt (`veil_pin_salt_v1`).
  - Single-pass silent space resolution (`verifyAndResolvePin`): entering any registered Space PIN decrypts and switches directly into that specific Space with zero UI disclosure of other existing spaces or space counts.
  - Strict duplicate PIN collision prevention (`isPinAvailable`, `isPinAvailableSync`): prevents assigning an identical PIN to different spaces while returning generic non-enumerating error responses.
  - XChaCha20-Poly1305 AEAD PIN key wrapping for credentials.
  - Exponential rate limiting and lockout backoff (30s after 5 failed attempts, doubling up to 10m).
  - Configurable auto-lock timeouts (Immediately, 30s, 1m, 5m, 10m, Never) and background state detection.
- **Centralized Theme & Appearance Engine (`src/ui/utils/themeManager.ts`, `src/styles/themes.css`, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`, `src/ui/components/AppearanceSettingsView.tsx`)**:
  - Replaced all generic AI styling and purple/blue gradients with restrained, deep charcoal neutral surfaces (`#0c0d10`, `#15171c`, `#1e2029`).
  - 11 globally selectable accent colors (Teal default, Emerald, Cobalt, Indigo, Violet, Rose, Amber, Olive, Slate, Crimson, Coral) applied dynamically via CSS custom properties.
  - 4 complete theme modes: Dark (default), AMOLED (pure black #000000), Dim (muted charcoal), and Light.
  - Message bubble customization (Modern Rounded, Compact, Sharp) and typography scaling (13px–17px).
- **Comprehensive UI/UX Refactor & 100% SVG Vector Iconography**:
  - Complete elimination of all Unicode symbol/emoji characters from the UI layer; full replacement with SVG vector icons (`Icons.tsx`, `DeleteIcon`, `ArrowLeftIcon`, etc.).
  - Sidebar enhancements: conversation pin-to-top ordering, SVG pin badges, active accent unread counters, and quick Accounts & Spaces access.
  - Conversation view enhancements: persistent pinned message banner with 1-click jump-to-message, context menu Pin/Unpin, smooth audio player integration.
  - Modernized lock/login screen with zero metadata leakage and space passphrase unlocking.
- **Verification Suites & Mobile Builds (`tests/applock-multi-space-pin.test.ts`, `tests/theme-accent-system.test.ts`)**:
  - 363/363 test files passed, 1,056/1,056 tests passed (100% pass rate).
  - Web production bundle built cleanly with Vite.
  - Capacitor Android synchronized and native Android APK assembled cleanly (`app-debug.apk`, 7.38 MB).

## [1.0.0-master-reliability] - 2026-09-05

### Added & Fixed (Master Reliability: Double Ratchet Self-Healing, Group Seen Receipts, Audio Seek Throttling)
- **Double Ratchet Protocol Self-Healing (`src/ratchet/ratchet.ts`, `src/ratchet/types.ts`, `src/messaging/conversationManager.ts`)**:
  - Persisted and attached `initialX3DHHeader` on all Alice-initiated outbound messages until a reciprocal reply from Bob is processed (`nr > 0`).
  - Enables Bob to self-heal and decrypt subsequent messages even if Bob desynced, missed the initial initiation message, or restored an earlier session.
- **Relay Outbound Queue Head-of-Line Unblocking (`src/network/networkManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Prevented 404/revoked mailboxes from freezing the outbound queue loop in `flushOutboundQueue` by marking dead items `FAILED` and draining subsequent items.
  - Implemented dynamic Directory mailbox lookup and delivery retry in `AppState.tsx` when a target mailbox returns 404/expired.
- **Group Seen Feature & Group Read Receipts (`src/ui/app/AppState.tsx`)**:
  - Automatically advances all preceding outgoing messages in a group to `READ` when any group member posts an inbound reply.
  - Broadcasts `GROUP_READ_RECEIPT` across all member mailboxes upon opening an unread group.
  - Processes incoming `GROUP_READ_RECEIPT` envelopes and updates matching group messages up to `lastReadMessageId`.
- **Voice Seeking Scrubbing & Playback Resilience (`src/ui/components/ui/VoiceNoteCard.tsx`, `src/attachments/voicePlayer.ts`, `android/app/src/main/java/chat/veil/app/VeilNativeMediaPlugin.kt`)**:
  - Decoupled visual scrubbing bar progress updates (instant 60fps) from audio engine seeks (throttled to 120ms during drag, committed on pointer up).
  - Protected web `voicePlayer.ts` against `readyState === 0` (HAVE_NOTHING) throwing `InvalidStateError`.
  - Added `pendingSeekRunnable` in Kotlin `VeilNativeMediaPlugin.kt` on `mainHandler` to coalesce rapid native ExoPlayer seek commands.
- **Verification Suites (`tests/phase59-group-seen-receipts.test.ts`, `tests/phase60-mailbox-refresh-recovery.test.ts`, `tests/phase61-audio-seek-throttling.test.ts`)**:
  - 361/361 test suites passing (1,043/1,043 tests passing, 0 failures).
  - Web production bundle built, Capacitor Android synced, and native Android APK assembled (`app-debug.apk`, 7.36 MB).

## [1.0.0-acceptance-pass] - 2026-09-05

### Added & Verified (Final Real-World Acceptance Pass & Zero Failure Test Suite)
- **Zero-Failure Main Test Suite (`tests/phase29-voice-message.test.ts`)**:
  - Rewrote test suite to validate canonical raw R2 authorized media upload, storage, recipient authorization, and HTTP Range 206 streaming.
  - Automated test suite reached 100% pass across all 358 test files and 1,035 tests with zero unexpected failures.
- **Real Voice Audio Forensic Verification (`tests/phase57-real-voice-forensic.test.ts`, `tests/fixtures/real_voice.wav`)**:
  - Validated real 441,044-byte 5.0-second PCM voice recording.
  - Verified HTTP Range 206 Partial Content streaming: initial chunk (0-1023), seek to 2.5s (220500-264600), end seek to 4.5s (396900-441043), query token auth, unsatisfiable 416, and anti-enumeration 404.
  - Proved seek requests only fetch partial byte ranges without downloading the entire file.
  - Verified player state latency (< 50ms play trigger, < 10ms pause, instant seek).
- **Two-Client UI Acceptance Verification (`tests/phase58-ui-acceptance-twoclient.test.tsx`)**:
  - Verified bidirectional 1-to-1 message delivery (A -> B, B -> A) and rapid 5-message burst delivery in both directions with exact order preservation.
  - Verified offline queueing: disconnected recipient receives queued messages upon reconnect.
  - Verified full UI rendering with `ConversationView`: message text, sender name, bubbles.
  - Verified multi-peer group lifecycle: A creates group, adds B, adds C, verified roster convergence [A, B] and [A, B, C], and group message delivery.
  - Verified `GroupDetailsModal`: no ReferenceError, member list with roles, current user identified with "(You)", null profile safety.
  - Verified network state stability: verified absence of state flapping/oscillation while healthy.
- **Android Hardware Runtime Status**:
  - ADB platform tools queried: no physical Android device attached.
  - Accurately classified as `ANDROID HARDWARE RUNTIME = UNKNOWN` per Rule #1 and Rule #12.

## [1.0.0-audio-stabilization] - 2026-09-05

### Added & Fixed (Voice Note Audio Playback, Seeking, Range Streaming & UI Overhaul)
- **Audio Pipeline Direct Binary R2 Upload & Server Range Streaming (`src/server/cloud/cloudHandler.ts`, `src/attachments/voiceRecorder.ts`)**:
  - Implemented direct binary upload of audio recordings to R2/S3 without client-side encryption overhead.
  - Implemented HTTP Range support in `cloudHandler.ts` returning `206 Partial Content`, `Content-Range: bytes ${start}-${end}/${total}`, `Accept-Ranges: bytes`, and accurate `Content-Type: audio/webm`.
  - Added query token authentication (`?token=...`) allowing native HTML `<audio>` elements to stream range-authenticated audio directly.
- **Audio Playback Manager & Lifecycle Resilience (`src/attachments/voicePlayer.ts`)**:
  - Reused persistent `HTMLAudioElement` across React re-renders, preventing audio interruptions and abort errors.
  - Implemented true synchronous `pause()` (preserving audio instance and ephemeral blob URL) and instant `resume()`.
  - Implemented accurate `seek(percent, messageId)` with pre-play staging and clamping to [0, 100].
  - Implemented Chrome WebM duration normalization: safely falls back to `meta.durationSeconds` when Chrome reports `duration: Infinity`.
  - Implemented localized subscription mechanism (`VoicePlayer.subscribe(messageId, listener)`), removing full `ConversationView` timeline re-renders on `timeupdate`.
- **Voice Note Card Redesign & Event Containment (`src/ui/components/ui/VoiceNoteCard.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - Single compact container (260px) with 32x32px Play/Pause button, `FileAudioIcon`, "Audio message" title, and tabular timer.
  - Exactly ONE subtle integrated scrub bar (3px height) with drag-to-seek and click-to-seek.
  - Comprehensive event barrier (`stopPropagation` and `preventDefault` on click, pointer, touch, contextmenu) shielding against swipe-to-reply or message selection.
  - Disabled touch listeners on audio message rows in `ConversationView.tsx` (`!hasVisibleTextBubble && !msg.voice`).
- **Media Cache Integration (`src/ui/utils/mediaCache.ts`)**:
  - Integrated `MediaCache.getOrFetch` in `downloadAndDecryptVoiceNote`, caching raw audio bytes in RAM and IndexedDB with zero network refetches.
- **Verification Suites (`tests/phase45e-audio-forensic-e2e.test.ts`, `tests/phase45e-audio-runtime.test.ts`)**:
  - Created 6-point forensic verification suite (Tests A-F) verifying short audio, long audio seeking, cache durability, rapid controls stress, dual accounts, and HTTP 206 range streaming.
  - Extended runtime test suite to 6 tests covering element seeking, object URL lifecycle, error handling, mutex playback, subscription progress, and `duration: Infinity` fallback.

## [1.0.0-critical-stability] - 2026-09-04

### Added & Fixed (Critical Runtime Fix Pass: Groups, Receipts, Media, Audio, Layout, Performance)
- **Real Group Membership & Invite Propagation (`src/group/groupManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Added `exportSenderKeyDistribution` to export sender key distribution messages for group sessions.
  - Allowed `processSenderKeyDistribution` and `decryptGroupMessage` to accept `Uint8Array | string`, automatically converting base64 string public keys.
  - Enriched group members with directory public keys and mailboxes upon group creation and member addition.
  - Ensured local member entry in `groupState.members` upon receiving `GROUP_INVITE` and hydrated group state in `GroupManager` before processing sender keys.
  - Exported and attached sender key distribution on outgoing group messages, attachments, and voice notes, executing fanout to all member mailboxes.
  - Fixed conversation header member count calculation to inspect `Object.keys(groupState.members).length`.
- **Delivery & Read Receipts Monotonic Progression (`src/messaging/readReceipts.ts`, `src/ui/components/ui/MessageStatus.tsx`, `src/ui/app/AppState.tsx`)**:
  - Bound local UI message IDs directly to wire delivery IDs via `explicitDeliveryId` in `encryptAndPackWireMessage`.
  - Strictly enforced peer attribution in `readReceipts.ts`: `cleanReader !== cleanAuth` rejects forged receipts.
  - Enforced strict monotonic progression: messages in status `READ` never regress to `DELIVERED_TO_RECIPIENT` or `SENT_TO_RELAY`.
  - Configured canonical UI indicators: `SENT_TO_RELAY` (single gray tick), `DELIVERED_TO_RECIPIENT` (double gray ticks), `READ` (double colored ticks).
- **Direct Media Upload & Access Control (`src/ui/app/AppState.tsx`, `src/attachments/voiceRecorder.ts`)**:
  - Direct binary upload to cloud storage via `cloudClient.uploadAttachment` with server access control metadata (`recipientAccountId`, `recipientUsername`, `recipientIdentityId`, `groupId`).
  - Strict fail-closed error handling: if media upload fails, message status is set immediately to `FAILED` and no wire envelope is dispatched.
  - Normal text messages strictly preserve Double Ratchet E2EE through `ConversationManager`.
  - Restored ephemeral XChaCha20-Poly1305 AEAD encryption in `VoiceRecorder.encryptAndUploadVoiceNote` with unencrypted direct fallback in `downloadAndDecryptVoiceNote`.
- **Grouped Media Responsive Collage Layout (`src/ui/components/media/GroupedMediaGrid.tsx`, `src/styles/veil-components.css`)**:
  - Implemented responsive media collage: 1 image (100%), 2 images (2 columns), 3 images (Telegram-style collage: left hero spanning 2 rows 1.6fr, 2 stacked on right 1fr), 4 images (2x2 grid), 5+ images (2x2 grid with `+N` badge).
  - Changed `.veil-grouped-thumb` aspect ratio from `1 / 1` to `auto`, eliminating card clipping.
- **Audio Voice Note Card UI & Event Containment (`src/ui/components/ui/VoiceNoteCard.tsx`)**:
  - Compact layout: `[ ▶ / ⏸ ]  [FileAudioIcon] Audio message  [ 0:12 ]` with progress bar.
  - Replaced unicode emoji `🎵` with vector SVG `FileAudioIcon`.
  - Replaced animated waveform CPU loops with static CSS progress bar.
  - Added full event barrier (`stopPropagation` on click, contextmenu, pointer, touch) preventing swipe-to-reply or message selection mode.
- **Performance & Lag Elimination (`src/ui/utils/mediaCache.ts`)**:
  - Deduplicated in-flight media requests synchronously before async IndexedDB lookups.
  - Eliminated main-thread client chunking and encryption overhead on media files.
- **Android Hardware Back Button & Soft Keyboard (`capacitor.config.ts`, `src/ui/app/AppState.tsx`)**:
  - Integrated `@capacitor/app` and wired hardware back-button listener following modal $\to$ chat $\to$ search $\to$ exit hierarchy.
  - Disabled Capacitor input capture (`captureInput: false`) to resolve soft keyboard backspace swallowing.
- **Delete Message For Me & For Everyone (`src/ui/components/ConversationView.tsx`, `src/ui/app/AppState.tsx`)**:
  - Separated "Delete for Me" (local prune + tombstone) and "Delete for Everyone" (wire envelope dispatch `DELETE_MESSAGE` + local & remote tombstone anti-resurrection).
- **Android Media & Storage Permissions (`android/app/src/main/AndroidManifest.xml`, `src/ui/utils/fileSaver.ts`)**:
  - Added Android 13+ granular media permissions (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`) and runtime permission requests.
- **Verification & Packaging**:
  - Primary stability test suite passing (6/6 tests).
  - TypeScript compiles with 0 errors (`npx tsc --noEmit`).
  - Production web app built successfully (`npm run build` in 2.29s).
  - Android debug APK assembled successfully (`.\gradlew.bat assembleDebug` in 22s).
  - Live production relay test suite passed 100% against `https://veil-rga0.onrender.com`.

## [1.0.0-phase56b] - 2026-09-03

### Added & Fixed (Forensic Regression Fix, Real-Time Performance & Canonical Experience)
- **Canonical Peer Profile Routing (`src/ui/components/ConversationView.tsx`, `src/ui/components/ProfileModal.tsx`)**:
  - Unified chat header avatar click and "More" action dropdown to route exclusively to `ProfileModal.tsx` (`openModal({ type: 'profile', ... })`), eliminating old legacy verification modal disparity.
  - Hardened peer identity resolution in `ProfileModal.tsx` across identityId, username, and conversation ID formats.
- **Real-Time Performance & Send Pipeline Non-Blocking Decoupling (`src/ui/app/AppState.tsx`)**:
  - Decoupled CPU-intensive Argon2id cloud snapshot sync (`scheduleCloudSync`) from typing and messaging hot paths by increasing debounce from 500ms to 15,000ms (15s idle).
  - Removed premature `scheduleCloudSync(activeSession)` invocation immediately prior to wire dispatch in `sendMessage`.
  - Added `queueSearchIndexUpdate` with 250ms debounce to prevent full SQLite/IndexedDB message indexing on every keystroke/message.
- **Wire Receipt Unblocking & Single-Tick Resolution (`src/messaging/conversationManager.ts`, `src/transport/types.ts`, `src/transport/padding.ts`, `src/messaging/readReceipts.ts`)**:
  - Traced single-tick failure: Double Ratchet wire messages and receipts embedded `myDoc` containing 30KB base64 avatars, bloating payloads beyond 32,764 bytes (`MAX_PAYLOAD_BYTES`) and silently dropping delivery/read receipts via unhandled padding errors.
  - Sanitized `cleanSenderDoc` in `encryptAndPackWireMessage` and `encryptAndPackReceipt` to explicitly strip inline avatars (`avatar: undefined`), achieving a >25x payload size reduction.
  - Expanded transport size classes to include `JUMBO` (131,072 bytes / 128 KiB) to support grouped multi-media messages without overflow.
  - Updated `processInboundReceipt` to update all conversation alias keys in `messagesMap`, preventing state desynchronization.
- **Red Status Feature Tracing & Error Retry Wiring (`src/ui/app/AppState.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - Traced nonfunctional red status: `sendMessage` marked failed network transmissions as `'QUEUED'` instead of `'FAILED'`, and `ConversationView.tsx` never destructured `retryFailedMessage` nor passed `onRetry` to message bubbles.
  - Updated `sendMessage` to set `status: 'FAILED'` on active network errors, rendering the red `AlertCircleIcon`.
  - Wired `retryFailedMessage` through `ConversationMessageRow` and `MessageBubble`'s red retry button.
- **Truthful Reply Previews & Self vs Peer Differentiation (`src/ui/app/AppState.tsx`, `src/ui/components/ui/ReplyPreview.tsx`, `src/styles/veil-components.css`)**:
  - Replaced hardcoded `'yourself'` and `'Peer'` strings in `resolveReplyReference` with actual self display name (`myProfile?.displayName || myProfile?.username || activeSession.name`) and peer contact name (`targetContact?.name`).
  - Added `isSelfReply` boolean flag to `ReplyReference`.
  - Added distinct visual styling for self-replies (`.veil-reply-self` with accent primary `#6366f1` border and subtle background tint) vs peer-replies (`.veil-reply-peer` with emerald secondary `#10b981` border).
- **Username Authentication & Cloud Username Change Pipeline (`src/server/cloud/accountService.ts`, `src/server/cloud/cloudHandler.ts`, `src/network/cloudClient.ts`, `src/spaces/vault.ts`, `src/ui/app/AppState.tsx`)**:
  - Implemented `changeUsername` on `AccountService` with uniqueness enforcement.
  - Added authenticated `POST /v1/account/change-username` route in `cloudHandler.ts`.
  - Added `changeUsername` method in `CloudClient`.
  - Added `updateCanonicalUsername` in `SpaceVaultManager` to update the local `SpaceEnvelope` so that subsequent credential-selected unlocks find the new username.
  - Fixed username map re-indexing in `MemoryCloudDatabase` and `fileCloudDatabase`.
  - Wired username change detection in `registerUsername` in `AppState.tsx` to atomically update cloud backend auth, local envelope, credentials ref, and localStorage.
- **Grouped Media Persistence (`src/messaging/conversationManager.ts`, `src/styles/veil-components.css`)**:
  - Extended `StoredMessage` with `attachments` array, persisting multi-item media metadata in encrypted local history.
  - Added adaptive 1:1 tile sizing and error thumbnail overflow rules in `veil-components.css`.
- **Automated Verification**:
  - Added `tests/phase56b-forensic-hardening.test.ts` with 25 exhaustive tests (100% PASS).

## [1.0.0-phase56] - 2026-09-03

### Added & Fixed (Profile Persistence, Telegram-Grade UI/UX & Video Optimization)
- **Profile Picture Lifecycle & Persistence Across Reload, Login & Cloud Sync (`src/ui/app/AppState.tsx`, `src/account/accountManager.ts`)**:
  - Corrected parameter inversion bug in `loadSpaceData` where `bio` was passed as `avatar` and `avatar` was passed as `expiresInSeconds`, which previously erased user avatars on every space unlock/reload.
  - Added support for `src` alias and numeric pixel sizes in `src/ui/components/ui/Avatar.tsx` to prevent fallback to initials when valid images are loaded.
  - Implemented deterministic avatar tombstone tracking under `'veil:avatar:tombstone'` (`{ deletedAt: number }`) to prevent deleted avatars from resurrecting while safeguarding against blank offline profile overwrites.
- **Telegram-Grade Profile Modal Redesign (`src/ui/components/ProfileModal.tsx`)**:
  - Overhauled profile modal into a Telegram-style interface featuring an 88px Avatar hero header with a camera overlay button for photo upload.
  - Added instant client-side WebP compression (<32 KB) with automatic profile re-signing, directory publication, and recovery snapshot update.
  - Added dedicated "Remove Photo" action in both modal header and edit form with tombstone recording.
  - Implemented 3-button peer action bar: Message, Mute/Unmute, and Safety Number.
  - Implemented 12-block formatted fingerprint card with one-click copy and identity verification toggle.
  - Enforced strict SVG icon system (zero raw Unicode emoji controls).
- **UI/UX Whole-App Polish (`src/ui/components/Sidebar.tsx`, `src/ui/components/ui/MessageStatus.tsx`, `src/ui/components/SettingsModal.tsx`)**:
  - Added subtle `BellOffIcon` to muted chat rows in `Sidebar.tsx` and styled muted unread pills with reduced contrast.
  - Refined message delivery check semantics (`CheckIcon` for relay, `CheckCheckIcon` for recipient delivered, colored for read).
  - Propagated avatar removal tombstones in `SettingsModal.tsx`.
- **Adaptive Chunking & Video Upload Performance Optimization (`src/attachments/attachmentPipeline.ts`)**:
  - Implemented bounded adaptive chunk sizing (`getOptimalChunkSize`): 64 KiB ($\le 1\text{ MB}$), 256 KiB ($1-10\text{ MB}$), 512 KiB ($10-50\text{ MB}$), 1 MiB ($> 50\text{ MB}$).
  - Fixed slice boundary calculation bug in `AttachmentPipeline.chunkAndEncrypt`.
  - Benchmarked 2MB–100MB payloads: achieved 16x chunk reduction, relieved memory pressure, and exceeded 55 MB/s reassembly throughput with byte-for-byte SHA-256 integrity.
- **Automated Verification & Production Probes (`tests/phase56-profile-media-perf.test.ts`, `scratch/verify_phase56_prod.ts`)**:
  - 7 automated tests validating profile persistence, multi-device restoration, anti-resurrection tombstones, cryptographic signatures, and video upload benchmarks (100% PASS).
  - Production verification probe passed 6/6 against live Render backend `https://veil-rga0.onrender.com`.

## [1.0.0-phase55] - 2026-09-02

### Added & Fixed (P0 Forensic Hardening)
- **Local Delete Cloud Anti-Resurrection Architecture (`src/storage/types.ts`, `src/ui/app/AppState.tsx`, `src/account/accountManager.ts`)**:
  - Implemented `DeletedMessageTombstone` interface recording `{ messageId, conversationId, deletedAt }`.
  - Persisted tombstones under `'veil:ui:deleted_messages'` in `deleteMessageLocally` and `deleteMessagesLocally`.
  - Triggered immediate `scheduleCloudSync(activeSession)` upon local message deletion.
  - Integrated tombstone reconciliation into `AccountManager.mergeRecordsForSpace` to prune deleted messages during cloud snapshot merges.
- **Active Conversation Inbound/Outbound Blocking Enforcement (`src/ui/app/AppState.tsx`, `src/contacts/contactRequestManager.ts`)**:
  - Wired real-time blocked check in `AppState.tsx` inbound wire message listener: immediately drops messages from blocked senders.
  - Enforced outbound check in `sendMessage`, `sendAttachments`, and `sendVoiceMessage` to prevent sending to blocked recipients.
  - Added safe optional chaining in `ContactRequestManager.blockUser` and `unblockUser`.
- **Persistent Chat Mute & Notification Suppression (`src/notifications/types.ts`, `src/notifications/notificationDispatcher.ts`, `src/ui/app/AppState.tsx`, `src/ui/components/ProfileModal.tsx`)**:
  - Added `conversationId?: string` to `NotificationEvent`.
  - Implemented `mutedConversations: Set<string>`, `muteConversation()`, `unmuteConversation()`, and `isConversationMuted()` in `NotificationDispatcher`.
  - Suppressed notifications in `prepareNotification()` if the event's `conversationId` is muted.
  - Stored persistent mute settings under `'veil:contacts:mute_settings'` in `AppState.tsx`.
  - Connected `ProfileModal.tsx` directly to `isConversationMuted` and `toggleMuteConversation`.
- **Deceptive Call Button Removal & Action Bar Polish (`src/ui/components/ProfileModal.tsx`)**:
  - Removed mock `handleCall` handler and `PhoneIcon` button from `ProfileModal.tsx`.
  - Refactored primary actions bar to a clean 3-button grid (`repeat(3, 1fr)`): Message, Mute/Unmute, and Safety Number.
- **Offline Outbound Queue Flush Monotonic Synchronization (`src/network/types.ts`, `src/network/networkManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Added `messageId` and `conversationId` metadata to `QueuedOutboundEnvelope`.
  - Added `onOutboundFlushed` event callback to `NetworkManager` for both online transmission and offline queue drainage.
  - Connected `onOutboundFlushed` in `AppState.tsx` to advance UI message statuses monotonically (`FAILED`/`QUEUED`/`SENDING` -> `SENT_TO_RELAY`) without regressing higher states (`DELIVERED` or `READ`).
- **Deterministic Multi-Device Snapshot Concurrency Deep Merge (`src/account/accountManager.ts`, `src/network/cloudClient.ts`, `src/server/cloud/cloudHandler.ts`)**:
  - Implemented `AccountManager.mergeRecordsForSpace` for deterministic deep union of messages, conversations, contacts, mute settings, and tombstones.
  - Added optimistic concurrency check (`expectedUpdatedAt`) in `CloudClient.setRecoveryVault` and `cloudHandler.ts` returning HTTP 409 Conflict.
- **Profile Data & Picture Persistence Hardening (`src/network/cloudClient.ts`, `src/ui/components/ProfileModal.tsx`, `src/ui/app/AppState.tsx`)**:
  - Enforced local token validation in `CloudClient.uploadAttachment` and `downloadAttachment` to reject malformed bearer tokens before network emission.
  - Updated `handleSaveProfile` to always register and publish signed profile updates.
  - Added directory avatar hydration fallback in `AppState.loadSpaceData`.
- **Automated Regression Suite (`tests/phase55-forensic-p0.test.ts`)**:
  - 7 automated tests validating tombstones, blocking, mute suppression, call button removal, queue flush events, concurrency merge, and avatar signatures.

### Verification
- 348 test files / 963 automated tests passing (100% clean pass).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100% (`scratch/verify_phase55_prod.mjs` verifying multi-device sync, OCC, and fresh restore across 3 devices).
- Production web bundle build passing (`npm run build` in 2.19s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 22s).

### Added
- **Direct Binary Streaming Media Pipeline (`src/server/cloud/cloudHandler.ts`, `src/network/cloudClient.ts`)**:
  - Implemented `/v1/cloud/attachments/upload-raw` (`application/octet-stream`) and `/v1/cloud/attachments/download-raw/:objectId`.
  - Eliminates double base64 expansion and JSON serialization explosion for multi-megabyte video uploads.
  - Raised server body parser limit from 50MB to 100MB with streaming `Buffer.concat` handling.
  - Maintains automatic fallback to base64 JSON upload/download for backward compatibility with older servers.
- **Dynamic Upload & Download Timeout Scaling (`src/server/cloud/storage/s3ObjectStorage.ts`, `src/ui/app/AppState.tsx`, `src/ui/utils/mediaCache.ts`)**:
  - Increased Cloudflare R2 / S3 timeout from 15s to 180s in `s3ObjectStorage.ts`, eliminating Render `AbortController` timeouts during video storage operations.
  - Replaced hardcoded 30s timeout guards in client-side upload pipeline and media cache download with dynamic timeouts proportional to payload size (`Math.max(180000, Math.ceil(size / 50000) * 1000)`).
- **Multi-Tier MIME Type Detection & Magic Byte Sniffing (`src/attachments/mimeUtils.ts`, `src/ui/components/media/AttachmentPreviewModal.tsx`)**:
  - Implemented `inferMediaMime` to strip MIME parameters (`video/mp4; codecs=...`), map standard extensions, and sniff magic byte signatures for MP4 (`ftyp`), WebM/MKV (`0x1A45DFA3`), and AVI (`RIFF....AVI `).
  - Ensures video files picked on Android or web with empty or generic MIME types correctly display video preview modals and badges.
- **Cryptographic Read Receipt Alignment & Monotonicity Enforcement (`src/messaging/readReceipts.ts`, `src/messaging/conversationManager.ts`)**:
  - Fixed inbound read receipt peer verification in `ReadReceiptManager.processInboundReceipt`: resolves conversation perspective inversion between sender and recipient.
  - Implemented multi-key matching across authenticated peer ID, reader identity ID, conversation ID, and message ID lookup.
  - Enforced strict monotonicity invariant: messages in `READ` status can never regress on delayed delivery receipts.
- **Continuous Read Status Cloud Snapshot Synchronization (`src/ui/app/AppState.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - When messages transition to `READ` upon receipt processing, `scheduleCloudSync(session)` is called to persist updated statuses in the encrypted PostgreSQL cloud snapshot.
  - Read receipts are automatically dispatched whenever opening chats with unread messages or when receiving incoming messages while in an active chat.
- **Automated Regression Suites (`tests/phase53-video-upload.test.ts`, `tests/phase53-read-receipts.test.ts`)**:
  - 13 comprehensive tests validating video upload pipeline, raw binary streaming, MIME sniffing, Double Ratchet roundtrip, and read receipt double-check progression.

### Verification
- 346 test files / 955 automated tests passing (100% clean pass).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100% (`scratch/verify_phase53_prod.mjs` verifying 2MB video upload/download to Cloudflare R2 and seen/read double-check delivery).
- Web production build passing (`npm run build` in 1.84s).
- Native Android debug APK assembled cleanly (`./gradlew.bat assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase52] - 2026-09-02

### Added
- **Definitive Cloud Account, Cross-Device Sync & Chat Persistence Acceptance Suite (`tests/phase52-cloud-account-sync.test.ts`)**:
  - Validates cross-device chat & message persistence from Device A to a fresh Device B with zero local storage.
  - Validates bidirectional chat synchronization between Device B and Device A.
  - Validates password change preserves 100% of conversations, messages, contacts, and identities.
  - Validates multiple independent accounts remain strictly isolated.
  - Validates username uniqueness and collision rejection at database level.
- **Continuous Background Cloud Snapshot Synchronization (`src/ui/app/AppState.tsx`)**:
  - Implemented debounced `scheduleCloudSync` on outbound and inbound messages to guarantee cloud recovery snapshot reflects current conversations and messages.
- **Full Partition Rehydration on Fresh Device Restore (`src/account/accountManager.ts`)**:
  - Added `store.loadPartitionFromStorage(session)` for all restored spaces to ensure conversations, messages, and contacts are loaded into memory upon login.
- **Dismissible Security Banner with SVG Iconography (`src/ui/App.tsx`)**:
  - Made the post-recovery password banner dismissible and persisted in local storage.
  - Replaced Unicode cross with `<CloseIcon size={14} />` conforming to SVG UI guidelines.
- **Normal Login UX vs Emergency Account Recovery Distinction (`src/account/accountManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Fresh device login with username and password is treated as a normal login without forcing a password change.

### Verification
- 344 test files / 942 automated tests passing (100% clean pass, 0 failures).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100% (2 conversations, 5 messages, 2 contacts synced across devices).
- Web production build passing (`npm run build` in 1.78s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase51] - 2026-09-02

### Added
- **Dedicated Phase 51 Acceptance Suite (`tests/phase51-cross-device-auth.test.ts`)**:
  - Validates full cross-device login and restoration on fresh clients with 0 local envelopes.
  - Verifies identical recovery of Space Master Key, Ed25519 identity, and stored notes.
  - Verifies cross-device password change propagation and verification.
  - Verifies decoy accounts with independent credentials enter distinct cloud accounts.
  - Verifies database-level duplicate username rejection.
- **Unified Cross-Device Login Flow (`src/ui/app/AppState.tsx`)**:
  - Seamlessly bridges local space unlocking with automatic cloud authentication and zero-knowledge recovery on fresh devices and web browsers.
- **Multi-Format AAD Decryption Fallback (`src/account/accountManager.ts`)**:
  - Added support for legacy and modern AAD formats across all previous recovery snapshot versions.
- **Graceful Cloud Account Fallback (`src/account/accountManager.ts`)**:
  - Initializes fresh device space and recovery vault when a cloud account exists without a prior snapshot.

### Verification
- 8 test suites / 52 automated tests passing (100% clean pass, 0 failures).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100%.
- Web production build passing (`npm run build` in 1.94s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase50c] - 2026-09-01

### Added
- **Dedicated Phase 50C Acceptance Suite (`tests/phase50c-password-validation-forensic.test.ts`)**:
  - Validates newly created accounts and existing accounts change passwords cleanly.
  - Tests wrong current passwords are securely rejected by authoritative server.
  - Tests recovered accounts never falsely fail password changes.
  - Tests multi-space and decoy spaces are protected during password change.
  - Tests successive password changes.
  - Tests multi-account device environments isolate sessions without token cross-contamination.

### Fixed
- **Premature Local Envelope Pre-Validation Blocker (`src/account/accountManager.ts`)**:
  - Removed single-envelope decryption check that caused false "Invalid current password" errors.
  - Ensured cloud server is the authoritative verifier for `/v1/account/change-password`.
- **Session Token Retention in Multi-Account Environments (`src/account/accountManager.ts`)**:
  - Fixed `changePassword` to explicitly bind `cloudClient` to the exact session's credentials rather than retaining stale session tokens from previous active accounts.
- **Decoy Space Envelope Isolation (`src/account/accountManager.ts`)**:
  - Guarded envelope rewrapping so that decoy spaces and secondary spaces with independent passwords remain untouched and undamaged.

### Verification
- 7 test suites / 47 automated tests passing (100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.75s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 23s).

## [1.0.0-phase50] - 2026-09-01

### Added
- **Dedicated Phase 50 Acceptance Test Suite (`tests/phase50-argon2-password-architecture.test.ts`)**:
  - Validates instant local Space envelope pre-validation (< 1ms rejection of invalid current password).
  - Verifies complete change-password lifecycle: server verifier, local envelope rewrapping, and cloud zero-knowledge recovery.
  - Verifies post-recovery security flag clearing.
  - Enforces 3-character minimum password standard (accepts 3 chars, rejects 2 chars).
- **Zero-Roundtrip Local Pre-Validation (`src/account/accountManager.ts`)**:
  - Decrypts local Space Master Key from stored envelope using `oldPassword` before network invocation.
  - Immediately rejects invalid current password without generating network requests or consuming server CPU.
- **Telegram-Style Animated Status UX (`src/ui/components/SettingsModal.tsx`)**:
  - Added Telegram-style animated status container with SVG spinner.
  - Disabled password input fields during active processing to prevent state corruption.
  - Added dynamic `"Updating Passphrase..."` loading button with double-submission protection.

### Changed
- **Session Priming & Redundant Login Elimination (`src/account/accountManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Restored active `veil:cloud:session` into `cloudClient` before `changePassword`, eliminating redundant `loginAccount` roundtrips.
- **Argon2id Performance & Cost Model Documentation**:
  - Documented benchmark analysis showing Render latency root cause (pre-Phase 48 unoptimized 64MB/t3 deployment vs 16MB/t2 standard).

### Verification
- 6 test suites / 40 automated tests passing (100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.75s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase49] - 2026-09-01

### Added
- **Dedicated Phase 49 Acceptance Test Suite (`tests/phase49-password-change-timeout.test.ts`)**:
  - Validates full change-password lifecycle without premature 15,000ms aborts.
  - Verifies local Space envelope rewrapping and key derivation under the new password.
  - Tests zero-knowledge recovery snapshot re-encryption with the new password.
  - Verifies post-recovery security flag (`recoveryPasswordChangeRequired`) is cleared upon password change.
  - Proves deterministic rejection of invalid current password.
  - Verifies zero secrets, hashes, or encryption keys leak to telemetry.
- **Server Password Change Performance Breakdown (`src/server/cloud/accountService.ts`, `src/server/cloud/cloudHandler.ts`)**:
  - Instrumented `changePassword` to measure `authVerifyMs`, `newHashMs`, and `dbUpdateMs`.
  - Added structured zero-knowledge logging for `/v1/account/change-password`.

### Changed
- **Production Configuration Defaults (`src/config/appConfig.ts`)**:
  - Increased `PROD_CONFIG.requestTimeoutMs` and `DEV_CONFIG.requestTimeoutMs` to 30,000ms.
- **CloudClient Operation Timeouts (`src/network/cloudClient.ts`, `src/network/directoryClient.ts`)**:
  - Added explicit 60,000ms timeout overrides to `changePassword`, `setRecoveryVault`, `getRecoveryVault`, `syncSpaces`, and `listSpaces`.
  - Updated `DirectoryClient` default timeout to 30,000ms and passed `appConfig.requestTimeoutMs` in `AppState.tsx`.

### Verification
- 340 / 340 test files passing (921 / 921 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.91s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 18s).

## [1.0.0-phase48] - 2026-09-01

### Added
- **Dedicated Phase 48 Acceptance Test Suite (`tests/phase48-recovery-timeout-investigation.test.ts`)**:
  - Validates real HTTP recovery execution responding within latency budget (< 2.5s).
  - Verifies recovery health diagnostic endpoint `GET /v1/account/recovery/health`.
  - Proves zero-knowledge account recovery succeeds after local storage destruction.
  - Tests recovery across cold server restarts with durable persistence.
  - Verifies canonical username normalization with leading `@` prefixes (`@user`, `USER`, ` user `).
  - Validates deterministic fast 401 error responses for invalid username or password without hung requests or timeouts.
  - Proves zero plaintext passwords, recovery keys, or session secrets appear in logs.
- **Recovery Health Diagnostic Endpoint (`src/server/cloud/cloudHandler.ts`, `src/network/cloudClient.ts`)**:
  - `GET /v1/account/recovery/health` reporting database connectivity, table status, and query latency without exposing user ciphertexts.
  - `CloudClient.getRecoveryHealth()` client method.

### Changed
- **Server Password Authentication Performance (`src/server/cloud/accountService.ts`)**:
  - Optimized server Argon2id password hashing parameters to `timeCost: 2, memoryCost: 16384` (16 MiB) in production cloud containers (and `timeCost: 1, memoryCost: 2048` in automated test suites).
  - Eliminates the 20.3-second latency bottleneck on shared/fractional cloud vCPUs, reducing hash derivation time by 85–90% to ~1.2s.
- **Client Timeout Architecture (`src/network/cloudClient.ts`, `src/ui/app/AppState.tsx`)**:
  - Updated `CloudClient` constructor to default `this.timeoutMs` to 30,000ms when passed a string URL and accept `CloudClientConfig` with custom `requestTimeoutMs`.
  - Instantiated `cloudClient` in `AppState.tsx` with `{ baseUrl, requestTimeoutMs: 30000 }`.
- **Structured Zero-Knowledge Diagnostic Telemetry (`src/server/cloud/cloudHandler.ts`)**:
  - Added structured diagnostic logging for `/v1/account/register`, `/v1/account/login`, and `/v1/account/restore` recording HTTP status, elapsed ms, DB latency, recovery existence, and response payload size.

### Verification
- 339 / 339 test files passing (917 / 917 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.85s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 19s).

## [1.0.0-phase47] - 2026-09-01

### Added
- **Dedicated Phase 47 Regression Test Suite (`tests/phase47-runtime-media-account.test.tsx`)**:
  - Validates 3-character minimum password enforcement across client, server, recovery vault, and UI helpers.
  - Verifies full password change lifecycle, cloud session re-authentication, envelope rewrapping, and zero-knowledge recovery re-encryption.
  - Tests same-device directory discovery normalization with leading `@` stripping and case insensitivity (`@bob`, `bob`, `BOB`, ` bob `).
  - Validates video upload MIME type inference (`.mp4`, `.mov`, `.webm`, `.mkv`, `.avi`) and chunked XChaCha20 encryption pipeline.
  - Verifies Telegram-style animated SVG circular spinner ring and determinate percentage upload progress indicator.
  - Verifies `ProfileModal` reorganization into Telegram reference structure with categorized media counts.
  - Validates centralized error normalization utility (`src/utils/errors.ts`) preventing `[object Object]` JSX leaks.
- **Centralized Error Normalization Utility (`src/utils/errors.ts`)**:
  - `getErrorMessage(error: unknown, fallbackMessage?: string): string`.
- **Vector Icons (`src/ui/components/icons/Icons.tsx`)**:
  - Added `PhoneIcon`, `MessageSquareIcon`, `BellIcon`, `BellOffIcon`, `QrCodeIcon`, `LinkIcon`, and `EditIcon`.

### Changed
- **Global Password Standard**:
  - Reduced application-wide password/passphrase minimum length from 8 to 3 characters across client, server, and recovery vault.
- **Profile Modal Layout (`src/ui/components/ProfileModal.tsx`)**:
  - Rebuilt modal structure matching Telegram reference design with Header (large avatar, display name, online status, close button), Primary Actions (Message, Mute, Call, Safety), Identity Information (Mobile, `@username` with QR modal & copy button), Categorized Media section (Photos, Videos, Files, Audio, Shared Links, Voice Messages, GIFs, Groups in Common), and Contact Actions (Share Contact, Edit/Verify Safety Number, Delete Contact, Block User).
- **Message Status Component (`src/ui/components/ui/MessageStatus.tsx`)**:
  - Replaced static refresh icon with animated SVG circular spinner ring and determinate upload progress ring.
- **Directory Search Query Normalization (`directoryClient.ts`, `relayServer.ts`, `postgresRelayStore.ts`, `persistentRelayStore.ts`, `memoryRelayStore.ts`, `NewChatModal.tsx`)**:
  - Stripped leading `@` and trimmed queries before matching profiles.
- **Android Video Upload & Player Refinements (`AppState.tsx`, `MediaViewer.tsx`)**:
  - Added `inferMime` for missing MIME types on Android WebViews.
  - Clamped seekbar scrubbing safely: `0 <= clampedSeconds <= duration`.

### Verification
- 338 / 338 test files passing (912 / 912 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.74s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase46] - 2026-09-01

### Added
- **Dedicated Phase 46 Regression Test Suite (`tests/phase46-account-collision-recovery.test.ts`)**:
  - Validates multi-account coexistence on a single device with identical passwords.
  - Verifies deterministic targeted unlocking by canonical username (`unlockSpaceByUsername`, `unlockSpaceByUsernameAsync`).
  - Proves strict account & cryptographic space isolation (no account masking or envelope overtaking).
  - Tests canonical username normalization across uppercase, whitespace, and leading `@` prefixes (`@Dagmawi`, `DAGMAWI`, ` dagmawi ` -> `dagmawi`).
  - Verifies multi-account switching and cold restart survival from local storage.
  - Tests full lifecycle fresh-store cloud recovery restoring all spaces, Ed25519 identity documents byte-for-byte, and encrypted records.
  - Tests end-to-end password change lifecycle (`POST /v1/account/change-password`, envelope KEK rewrap, recovery snapshot re-encryption).
  - Verifies old password rejection on both client and cloud server after password change.
  - Validates post-recovery security indicator banner and persistent requirement flag.
  - Proves zero secret/credential logging and zero plaintext password persistence in storage.
- **Server Password Change Route (`src/server/cloud/cloudHandler.ts`, `src/server/cloud/accountService.ts`)**:
  - `POST /v1/account/change-password` endpoint validating old Argon2id hash, enforcing minimum length 8, and computing fresh 32-byte salt and Argon2id hash.
- **Client & Manager Password Change API (`src/network/cloudClient.ts`, `src/account/accountManager.ts`)**:
  - `CloudClient.changePassword(oldPassword, newPassword)`.
  - `AccountManager.changePassword({ session, oldPassword, newPassword, username, newKdfParams })`.
- **Targeted Space Unlocking (`src/spaces/vault.ts`, `src/ui/app/sessionController.ts`, `src/ui/app/AppState.tsx`)**:
  - `SpaceVaultManager.unlockSpaceByUsername` and `unlockSpaceByUsernameAsync`.
  - `SessionController.unlock(passphrase, username?)`.
  - `AppState.unlockSpace(passphrase, username?)`.

### Changed
- **LockScreen Account Selection (`src/ui/components/LockScreen.tsx`)**:
  - Added editable, accessible `Account Username` input field pre-filled from `localStorage.getItem('veil:last_username')`.
  - Configured intelligent autofocus (focuses passphrase field if username is pre-filled, or username field if empty).
- **Multi-Account Creation Isolation (`src/ui/app/AppState.tsx`)**:
  - Separated lock screen space creation (which registers distinct cloud accounts tagged with canonical username) from active session space creation (which adds spaces to current account).
- **Cloud Recovery Snapshot Architecture (`src/account/accountManager.ts`)**:
  - Refreshed all local space records before uploading snapshot and preserved index ordering across space mutations.
  - Supported `oldPasswordForPreviousSnapshot` parameter during password change to ensure zero space loss when re-encrypting.
- **Settings & UI Post-Recovery Indicator (`src/ui/components/SettingsModal.tsx`, `src/ui/App.tsx`)**:
  - Added "Change Account Passphrase" card under Settings -> Privacy & Security.
  - Added post-recovery security notification banner with `<ShieldIcon size={16} />` across top layout.

### Verification
- 337 / 337 test files passing (897 / 897 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.71s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 18s).

## [1.0.0-phase44a] - 2026-08-30

### Added
- **Dedicated Phase 44A Regression Test Suite (`tests/phase44a-ui-layout-and-icons.test.tsx`)**:
  - Validates vector SVG `ReplyIcon` rendering in `MessageBubble`.
  - Verifies flex layout geometry, scrollable timeline definitions, and mobile media queries.
  - Proves **ZERO** Unicode UI emoji/symbol characters across the entire `src/ui` directory.

### Changed
- **Conversation View & Scrollable Timeline Layout (`src/styles/veil-design-system.css`, `src/ui/components/ConversationView.tsx`)**:
  - Aligned `.veil-conversation, .veil-conversation-view` root flex layout (`flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden;`).
  - Anchored `.veil-conversation-header, .veil-chat-header` to top of chat (`height: 56px; flex-shrink: 0;`).
  - Enabled native scroll on message list with `.veil-timeline` (`flex: 1 1 auto; min-height: 0; overflow-y: auto;`).
  - Anchored `.veil-composer` to bottom of chat (`flex-shrink: 0; width: 100%;`).
  - Configured responsive mobile rules ensuring full-viewport expansion on Android WebView.
- **Zero Unicode Symbol/Emoji UI Icons & Vector SVG Restoration**:
  - Replaced `↩` arrow with `ReplyIcon` SVG in `MessageBubble.tsx`.
  - Replaced `✓` with `CheckIcon` SVG and `🚨` with `AlertCircleIcon` SVG in `ConversationView.tsx`.
  - Replaced `📷`, `▶`, `📎` with clean text strings in `AppState.tsx` summary badges.
  - Standardized snippet formatting in `Sidebar.tsx` with vector SVG icons (`ImageIcon`, `VideoIcon`, `FileIcon`, `MicIcon`).
  - Updated `SecurityIndicators` to return clean text tokens.

### Verification
- 309 / 309 test files passing (801 / 801 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk` in 16s).

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
