# CHANGELOG.md — VEIL Project Changelog

All notable changes, architectural decisions, and security milestones across the VEIL project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Runtime Forensic Fix Pass] - 2026-09-04

### Fixed & Production-Verified
- **Authoritative Dual-Account Group State Synchronization (`src/group/`, `src/ui/app/AppState.tsx`, `src/account/accountManager.ts`)**:
  - Enriched `GroupMember` model with `username`, `displayName`, `joinedAt`, and `mailboxId`.
  - Reloaded authoritative `groupState` in `AppState.createGroup` after adding initial members; passed full roster in `GROUP_INVITE` payload.
  - Hydrated `conv.groupState` from `groupManager.loadGroupState(session, conv.id)` during startup/space switch in `loadSpaceData`.
  - Implemented non-destructive member set union in `accountManager.ts` for both `veil:ui:conversations` and `veil:group:state:`, preventing multi-device sync from overwriting or losing members.
  - Verified member count = 2 on both Alice and Bob through reloads, logouts, and restarts.
- **Attachment Authorization & Group Sharing ("Attachment not found or access denied" Fix) (`src/ui/app/AppState.tsx`, `src/attachments/voiceRecorder.ts`, `src/server/cloud/cloudHandler.ts`)**:
  - Attached `groupId: conversationId` on all group media and voice note uploads (`sendAttachments`, `sendVoiceMessage`).
  - Stored `groupId` directly on cloud attachment records and in `encryptedMetadata`.
  - Updated server-side authorization in `cloudHandler.ts` (`handleAttachmentDownloadRaw` and `handleAttachmentDownload`) to authorize group member downloads matching `attRecord.groupId` or `conversationId?.startsWith('grp_')`.
  - Verified Alice sending 3 photos in group "team" and Bob downloading all 3 without 404 access denied errors.
- **WebSocket Reconnect Oscillation & Connection Stability (`src/network/websocketTransport.ts`, `src/network/networkManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Guarded `reconnectNow()` and `networkManager.reconnect()` against tearing down already connected sockets (`readyState === 1` and `state === 'connected'`).
  - Unhooked event listeners from previous socket instances upon reconnect to prevent leak loops.
  - Reduced default heartbeat interval to 15s to keep connections alive through mobile proxy gateways.
  - Cleaned up `visibilitychange` window event listeners on component unmount.
  - Verified zero state oscillation across rapid window focus/blur events.
- **Chat Overview Outgoing Message Status Indicators (`src/ui/components/Sidebar.tsx`)**:
  - Rendered `<MessageStatus status={latestMsg.status} size={14} />` directly beside conversation snippets for outgoing messages.
  - Strictly suppressed ticks on incoming messages to match privacy invariants.
- **Human-Readable Member Roster in Group Details (`src/ui/components/GroupDetailsModal.tsx`)**:
  - Displayed `displayName` and `@username` directly from member metadata; eliminated raw internal UUID display.
- **Live Verification**:
  - `scripts/runtime-forensic-verification.ts` executed with 15/15 steps passing against `https://veil-rga0.onrender.com`.

## [Phase 54] - 2026-09-02

### Audited & Documented (Zero-Code Forensic Inventory)
- **Definitive Feature Inventory & Gap Analysis (`docs/PHASE54_FEATURE_AUDIT.md`)**:
  - Inspected 68 capabilities across 12 domains: 24 GREEN (35.3%), 13 YELLOW (19.1%), 7 RED (10.3%), 20 MISSING (29.4%), 4 UNKNOWN (5.9%).
  - Genuinely verified: Double Ratchet E2EE 1-to-1 messaging, Seen/Read double-check status progression, swipe-to-reply gesture, Cloudflare R2 direct binary streaming (100MB videos, photos, voice notes), MIME sniffing, in-chat local search, username+password cloud restore, multi-space isolation, and panic lock.
  - Flagged critical broken stubs (RED): Mute toggle (never persisted), Voice Call (mock toast with 0 calling code), Local message deletion cloud resurrection bug, Group chat UI disconnect, Inbound active message bypass on blocked contacts, Offline queue drain UI stall, and Cloud snapshot Last-Write-Wins overwrite risk.
  - Documented missing features (MISSING): Emoji reactions, Message editing, Delete for everyone, Message forwarding, Pin message/chat, In-chat unread separator line, Disappearing messages, Background push notifications (FCM), Typing indicators & Presence, and Cover traffic.
  - Defined strict Prioritization Matrix (P0 to P4) and scoped Phase 55 for immediate integrity hardening.

## [Phase 45E] - 2026-08-30

### Fixed & Verified
- **Persistent Reply Quote Rendering & Closure Synchronization (`src/ui/app/AppState.tsx`)**:
  - Implemented `replyTargetRef` synchronized with `replyTarget` React state to eliminate stale closure bugs during message sends.
  - Ensured `sendMessage`, `sendAttachments`, and `sendVoiceMessage` always capture the real-time active reply quote without dropping metadata on send.
  - Enhanced `src/styles/veil-components.css` with high-contrast Telegram-style quote bubble styling for outgoing (`rgba(0,0,0,0.16)` backdrop, white accent border, white bold sender) and incoming message bubbles.
- **Attachment & Voice Note Recipient Authorization ("Not Found" Fix) (`src/ui/app/AppState.tsx`, `src/server/cloud/cloudHandler.ts`)**:
  - Resolved `targetUsername` across `@`-trimmed handles, canonical identity IDs, and fallback display names.
  - Populated `recipientUsername`, `recipientAccountId`, and `recipientIdentityId` in `createAttachment` and `VoiceRecorder.encryptAndUploadVoiceNote`.
  - Updated `handleAttachmentDownload` in `cloudHandler.ts` to authorize downloads by matching `recipientUsername` (case-insensitive, `@`-trimmed), `recipientAccountId`, or `recipientIdentityId`.
- **Audio Playback & Physical Seeking State Machine (`src/attachments/voicePlayer.ts`, `src/ui/components/ui/VoiceNoteCard.tsx`)**:
  - Validated physical seeking setting `audio.currentTime = targetSeconds` with safe duration bounds.
  - Managed ephemeral Object URL lifecycle (retained during active playback, revoked strictly on `stop()` or when new audio starts).
  - Ensured single-audio mutex playback state.
- **Video Upload Pipeline & Player State Machine (`src/attachments/types.ts`, `src/ui/components/media/MediaViewer.tsx`)**:
  - Enforced zero-leak wire serialization via `toWireAttachment`, `toWireReplyReference`, and `assertWireSafe`.
  - Implemented custom video playback controls, scrubbing slider, volume/mute, and fullscreen in `MediaViewer.tsx`.
- **Diagnostic Telemetry Redaction & Safety (`src/debug/runtimeDiagnostics.ts`)**:
  - Added `clear()` and `getEntries()` convenience methods.
  - Verified telemetry contains zero plaintext passwords, master keys, private keys, or symmetric keys.
- **Test Coverage & Verification**:
  - Authored 7 focused Phase 45E test suites (19 tests, 100% passing):
    - `tests/phase45e-audio-runtime.test.ts`
    - `tests/phase45e-video-upload-runtime.test.ts`
    - `tests/phase45e-video-player.test.tsx`
    - `tests/phase45e-reply-end-to-end.test.ts`
    - `tests/phase45e-reply-rendering.test.tsx`
    - `tests/phase45e-attachment-integrity.test.ts`
    - `tests/phase45e-runtime-redaction.test.ts`
  - Regression verified full workspace: **334 test files / 881 tests passing cleanly (100%)**.
  - Production builds verified: `npm run build` (1.95s), `scripts/release-build.mjs` (6 artifacts), `npx cap sync android` (0.20s), and `gradlew assembleDebug` (20s).

---

## [Track 4] - 2026-08-30

### Fixed & Verified
- **Design Specification & Formal Blueprint**:
  - Published `docs/superpowers/specs/2026-08-30-track4-replies-thumbnails-design.md` covering root causes, invariants, wire safety, and acceptance criteria.
- **Persistent Quoted Reply System (`src/ui/app/AppState.tsx`, `src/ui/app/types.ts`)**:
  - Exported `ReplyReference` type with complete union (`'image' | 'video' | 'file' | 'voice' | 'grouped' | string`).
  - Authored `resolveReplyReference` helper handling text, single media (photo/video), voice notes, file attachments, and grouped media without dropping metadata or falling back to raw placeholders.
  - Wired `resolveReplyReference` across `sendMessage`, `sendAttachments`, and `sendVoiceMessage` to ensure replies never disappear after send.
  - Declared explicit `const msgId` in `sendAttachments`.
  - Verified wire serialization strictly preserves `{ messageId, senderName, text, attachmentType }` without leaking DOM nodes, Blobs, or local blob URLs.
- **Universal Swipe-to-Reply Gesture & Media Message Interactions (`ConversationView.tsx`)**:
  - Implemented `ConversationMessageRow` component wrapping every message row in the timeline with unified touch gesture tracking (`onTouchStart`, `onTouchMove`, `onTouchEnd`, `onTouchCancel`).
  - Added horizontal threshold (`deltaX < -35px`) for reply triggering, vertical scroll cancellation (`Math.abs(deltaY) > Math.abs(deltaX)`), and clean touch cancel reset.
  - Rendered visual circular SVG `<ReplyIcon />` indicator on left swipe for non-text messages.
  - Supported quote rendering and tap-to-jump navigation for all message types.
- **Media Thumbnail Lifecycle & Memory Cleanup (`MediaImage.tsx`)**:
  - Implemented `createdThumbUrlRef` and `URL.revokeObjectURL` cleanup on component unmount and thumbnail update, preventing memory leaks while keeping video poster generation decoupled from video playback.
- **CloudClient & Receipt Compatibility Fixes**:
  - Supported `onUnauthorized` auto-healing in `CloudClient` attachment requests and updated error strings to include `(Unauthorized)`.
  - Updated `ReadReceiptManager.processInboundReceipt` to resolve conversation keys from peer reader identity.
- **Verification & Test Coverage**:
  - Authored 7 focused Track 4 test suites with 28 passing tests:
    - `tests/phase45d-reply-persistence.test.ts` (5 tests)
    - `tests/phase45d-reply-media-e2e.test.ts` (1 test)
    - `tests/phase45d-thumbnail-pipeline.test.ts` (4 tests)
    - `tests/phase45d-reply-gesture.test.tsx` (5 tests)
    - `tests/phase45d-media-reply.test.tsx` (6 tests)
    - `tests/phase45d-media-rendering.test.tsx` (3 tests)
    - `tests/phase45d-runtime-acceptance.test.tsx` (4 tests)
  - Regression verified all Track 1 (`phase45a`), Track 2 (`phase45b`), Track 3 (`phase45c`), Phase 40, Phase 44A, and Phase 45 suites.
  - Full suite verified: **327 test files / 862 tests passing cleanly**.
  - Web production build (`npm run build`), release manifest (`scripts/release-build.mjs`), Capacitor sync (`npx cap sync android`), and Android Gradle build (`gradlew assembleDebug` in 52s) all pass cleanly.

---

## [Track 3] - 2026-08-30

### Fixed & Verified
- **Contact Avatar Propagation & Direct Conversation Hydration**:
  - Ensured every direct conversation creation/update path (`startDirectChat`, `addContactFromInvitation`, `acceptContactRequest`, `handleInboundResponse`, `processInboundWirePayload`) copies the canonical `contact.avatar` into `UIConversation`.
  - In `loadState`, backfilled `avatar` from the canonical contact record if missing in stored conversations.
- **Conversation Header Avatar Rendering (`ConversationView.tsx`)**:
  - Updated conversation header to pass `imageUrl={activeConversation?.avatar || activeContact?.avatar}` with existing deterministic initials/gradient fallback when avatar is absent.
- **Per-Contact Chat Privacy Controls in Contact Details (`ContactDetailsModal.tsx`)**:
  - Added dedicated "Chat Privacy & Media Permissions" section in `ContactDetailsModal` with save and forward toggles.
  - Bound toggles strictly to canonical `Contact.identityId` via existing `updateContactMediaPermissions`.
  - Added clear non-DRM client-side advisory notice.
- **Symmetry & Identity Isolation**:
  - Validated that A-to-B and B-to-A media privacy policies remain completely independent across encrypted space stores.
  - Validated that display-name collisions cannot mutate another canonical contact's privacy policy.
- **Verification**:
  - All 9 Track 3 tests pass (`tests/phase45c-contact-avatar-privacy.test.tsx`).
  - Track 1 and Track 2 focused test suites continue to pass 100%.
  - Web production build, release manifest generation, and Capacitor Android sync pass cleanly.

---

## [Track 2] - 2026-08-30

### Fixed & Verified
- Added authenticated, encrypted `DELIVERY_RECEIPT` and `READ_RECEIPT` controls on the existing Double Ratchet session; receipt controls never create a message-history item.
- Recipient delivery acknowledgement is emitted only after inbound ratchet decryption and encrypted history persistence.
- Sender status transitions now strictly target the acknowledged message (`sent → delivered`) or acknowledged ordered range (`delivered → read`), and are persisted in encrypted UI state.
- Receipt state is bound to the canonical authenticated peer identity; mismatched identities do not mutate the timeline.
- Removed the pre-decryption raw-JSON receipt path. Attachment download paths have no read-marker call; only entering an active conversation triggers a read receipt.
- Focused receipt/lifecycle/media regression tests and the web production build pass. Physical Android verification remains user-owned.

---

## [Phase 37] - 2026-08-28

### Added, Fixed & Validated
- **Real Android UI Repair, Voice Playback Fix, Media Reliability & Production-Grade Mobile Layout**:
  - **Voice Message Playback Engine (`VoicePlayer`)**: Authored dedicated `VoicePlayer` / `VoicePlaybackManager` (`src/attachments/voicePlayer.ts`) with authenticated S3/R2 ciphertext retrieval, local XChaCha20-Poly1305 AEAD decryption, `HTMLAudioElement` playback, real-time waveform progress callbacks, and automatic object URL revocation on ended/stop.
  - **Mobile Layout & Conversation Header Rebuild**: Rebuilt `.veil-conversation-header`, `.veil-header-profile-trigger`, `.veil-header-text`, `.veil-header-title`, and `.veil-header-subtitle` with flex alignment, `min-width: 0`, and single-line text ellipsis, eliminating vertical wrapping and character-by-character title breakage.
  - **Message Bubble & Timestamp Geometry**: Rebuilt `.veil-msg-row`, `.veil-bubble-wrapper`, `.veil-message-row`, and `.veil-message-bubble`. Added `white-space: nowrap; flex-shrink: 0;` on timestamps and delivery ticks in `.veil-message-meta`, preventing timestamps from wrapping into vertical columns.
  - **Media & Photo Bubble Sizing**: Styled `.veil-media-bubble-container` with `width: min(80vw, 360px); min-width: 180px; max-width: 100%;`, ensuring photos and videos maintain natural Telegram-like proportions without collapsing in shrink-wrap flex layouts.
  - **Mobile Message Composer**: Compacted composer padding (`padding: 0.45rem 0.6rem; padding-bottom: calc(0.45rem + env(safe-area-inset-bottom, 0px));`) and added sleek circular send button (`.veil-btn-composer-send`) with minimum 40px touch targets, preventing viewport overflow on small Android screens.
  - **Subtle Desktop Empty State**: Replaced oversized empty screen with minimal branding ("Your conversations are encrypted by default" / "Select a conversation to begin"), strictly hidden on mobile viewports.
  - **AccountManager KDF Normalization**: Supported both `kdfParams` and `customKdfParams` in `registerAccount`, accelerating test execution across all account recovery suites from 24.5s down to 236ms.
  - **Regression Test Coverage**: Added 7 dedicated Phase 37 test suites (`tests/phase37-voice-playback.test.ts`, `tests/phase37-mobile-layout.test.tsx`, `tests/phase37-android-layout.test.ts`, `tests/phase37-avatar-persistence.test.ts`, `tests/phase37-media-restart.test.ts`, `tests/phase37-recovery-e2e.test.ts`, `tests/phase37-request-delivery.test.ts`).
  - **All 263 Test Suites Passing**: 681 / 681 tests passing 100% cleanly across all suites.
  - **Native Android APK Build**: Clean Gradle build (`app-debug.apk`, 4.37 MB, `BUILD SUCCESSFUL in 22s`).

---

## [Phase 34] - 2026-08-28

### Added, Fixed & Validated
- **Real UI Rebuild, Telegram-Style Media, Authorization, Recovery & Network Reliability**:
  - **Group Attachment Authorization Repair (No 401)**: Solved group attachment upload failures by ensuring authenticated bearer session tokens are passed in both direct and group flows, allowing group attachments without single-recipient restrictions, and implementing automatic 401 token auto-healing in `CloudClient`.
  - **Zero-Knowledge Account Recovery on Clean Device**: Implemented `createOrUpdateRecoveryVault` in `AccountManager` to push Argon2id-encrypted recovery vaults to the cloud. Restored identical `spaceId`, `masterKey`, and Ed25519 `identityId` on fresh devices and wired full space hydration in `AppState.tsx`.
  - **Avatar & Profile Picture Propagation**: Propagated avatar data URLs through invitation payloads, contact requests, address books, chat lists, conversation headers, and profile modals.
  - **Real In-App Inline Media & Fullscreen Viewer**: Built `MediaCache` and `<MediaImage />` for automatic cloud ciphertext retrieval, authenticated AEAD decryption, lazy loading, and tap-to-fullscreen pan/zoom viewer.
  - **Physical File Downloads on Android**: Integrated `@capacitor/filesystem` into `Documents/VEIL` with system share sheet fallback and explicit user toast confirmation.
  - **100% SVG Vector Iconography**: Eliminated Unicode emojis from interface controls.
  - **All 253 Test Suites Passing**: 642 / 642 tests passing 100% cleanly across all suites.
  - **Native Android APK Build**: Clean Gradle build (`BUILD SUCCESSFUL in 22s`).

---

## [Phase 31] - 2026-08-27

### Added, Fixed & Validated
- **Production Connectivity Repair, Render/R2/Supabase Integration Verification & Mobile Reliability**:
  - **DNS Resolution & Canonical Endpoints**: Root caused the mobile `"Failed to fetch"` error to an unconfigured DNS record on `relay.veil.chat`. Set canonical production relay URLs to `https://veil-rga0.onrender.com` / `wss://veil-rga0.onrender.com/v1/ws` with `VITE_RELAY_URL` override support.
  - **Live Cloud Verification (16/16 Smoke Test Checks Passed)**: Built `scripts/phase31-production-connectivity.mjs` verifying live Render `/health`, `/readyz`, CORS OPTIONS preflight, Supabase PostgreSQL persistence, Cloudflare R2 encrypted attachment upload/download, unauthorized access rejection, zero-knowledge account registration, and WebSocket `/v1/ws` ping/pong connectivity.
  - **Android Black-Screen & Startup Recovery**: Diagnosed and resolved unhandled TDZ hook order in `AppState.tsx`. Wrapped root application in top-level `ErrorBoundary` with secret-sanitizing regex diagnostics and recovery options (`Retry Loading`, `Return to Lock Screen`). Added clean loading skeleton during storage partition initialization.
  - **LockScreen Privacy & Metadata Minimization**: Completely removed `{knownSpacesCount} encrypted vault envelope(s) at rest` and all space/envelope enumeration from `LockScreen.tsx`.
  - **Connection Resilience & Degraded Polling**: Implemented bounded exponential backoff with uniform random jitter (1s-30s) and automatic immediate reconnection on native online events in `WebSocketTransport` and `NetworkManager`.
  - **Offline-First Profile Editing & Cloud Sync**: Enhanced `registerUsername()` to sign and persist profiles locally in encrypted store first, queueing `veil:pending:profile_sync` for automatic background sync upon network recovery. Updated `ProfileModal` to display `"Saved locally. Cloud sync pending."`
  - **Deterministic Identity Recovery**: Validated byte-for-byte `identityId` equality across zero-knowledge clean-device restores without secondary identity creation.
  - **Zero Secret Leakage**: Verified that production database credentials (`DATABASE_URL`) and storage secrets (`R2_*`) never exist in frontend code or client bundles.
  - **Test Suite Expansion**: Added dedicated test suites bringing the total test suite to **250 test files (635 tests) passing 100%**.
  - **Production Acceptance & Smoke Testing**: Verified 10/10 mobile acceptance checks and 16/16 production connectivity checks.
  - **Android Native Compilation**: Verified `assembleDebug` with Gradle wrapper (`BUILD SUCCESSFUL in 28s`).

---

## [Phase 30] - 2026-08-21

### Added & Enhanced
- **Render + Supabase PostgreSQL + Cloudflare R2 Production Persistence & E2EE Attachments**:
  - Cloud Session Persistence: Securely stored Bearer session credentials encrypted under `veil:cloud:session` in `EncryptedSpaceStore` with auto-restoration upon Space unlock and memory purge on lock.
  - Inbound Voice Preservation: Fixed wire payload reception in `AppState.tsx` to preserve `voice` and `replyTo` metadata, rendering voice messages as active `VoiceNotePlayer` cards.
  - Multi-Tenant Voice & Attachment Authorization: Supported `recipientUsername`, `recipientAccountId`, and `allowedAccounts` in `cloudHandler.ts` and `VoiceRecorder.encryptAndUploadVoiceNote()`. Enforced strict 404 Access Denied rejection for unauthorized accounts.
  - Complete Normal File Attachment Pipeline: Implemented client-side authenticated chunking via `AttachmentPipeline.chunkAndEncrypt()`, R2 upload via `cloudClient.uploadAttachment()`, Double Ratchet wire packaging via `convManager.encryptAndPackWireMessage()`, and recipient download/reassembly/decryption via `AttachmentPipeline.decryptAndReassemble()`.
  - Added dedicated test suites: `tests/phase30-cloud-session-persistence.test.ts`, `tests/phase30-inbound-voice-preservation.test.ts`, `tests/phase30-voice-authorization.test.ts`, `tests/phase30-file-attachment.test.ts`.
  - Total test count expanded to 226 test files (466 tests) passing 100% cleanly.
  - Verified Android native compilation with Gradle producing `app-debug.apk` (3.95 MB).

---

## [Phase 28] - 2026-08-19

### Added & Enhanced
- **Production Cloud Deployment & Real Infrastructure (PostgreSQL, S3 Storage, Caddy, Migrations, Backup/Restore)**:
  - Database Migration Engine (`MigrationRunner`): Deterministic, version-tracked SQL migrations for fresh databases and existing production data without data loss.
  - SQL Database Adapter (`SqlCloudDatabase`): Production SQL database implementation with parameterized queries, ACID transactions, and foreign key integrity.
  - Reverse Proxy & TLS 1.3: Authored production `Caddyfile.production` enforcing TLS 1.3, HTTPS redirection, long-lived WebSocket proxying (`/v1/ws`), and security headers.
  - Multi-Container Docker Stack: Production `docker-compose.production.yml` deploying Caddy, VEIL Backend, PostgreSQL 16, and MinIO S3 Object Storage on private internal networks.
  - Automated Backup & Disaster Recovery: Implemented `src/server/cloud/backup.ts` and `scripts/production-backup.mjs` for backup and byte-for-byte disaster recovery.
  - Production Operations Manual: Created `docs/PRODUCTION_DEPLOYMENT.md` detailing architecture, runbooks, DNS/TLS setups, and health probes.
  - Health & Readiness Probes: Enhanced `/readyz` endpoint to verify database and object storage readiness.
  - Added dedicated test suite `tests/phase28-production-deployment.test.ts` (7 comprehensive test scenarios).
  - Total test count expanded to 207 test files (426 tests) passing 100% cleanly.

---

## [Phase 27] - 2026-08-19

### Added & Enhanced
- **Cloud & Account Foundation (Persistent Account, Multi-Device, Sync Engine, Object Storage)**:
  - Persistent Account & Device Model: Unique opaque `accountId` and `deviceId` hierarchies separating device installation state from cloud account ownership.
  - Server Cloud Database Abstraction: Implemented `ICloudDatabase` schema entities (`AccountEntity`, `DeviceEntity`, `SessionEntity`, `CloudSpaceEntity`, `CloudMessageEntity`, `CloudAttachmentEntity`, `SyncStateEntity`, `RecoveryStateEntity`) with `FileCloudDatabase` and `MemoryCloudDatabase`.
  - Object Storage Abstraction: Implemented `IObjectStorage` interface supporting `LocalDiskObjectStorage` (path-sanitized local storage) and `S3ObjectStorage` (S3 REST API / Cloudflare R2 / MinIO / AWS S3).
  - Client-Side Encrypted Attachments: Encrypted chunking and full payload upload to object storage with SHA-256 integrity verification upon upload and download. Zero plaintexts stored on server.
  - Bidirectional Sync Engine (`SyncEngine`): Synchronizes messages and space states across multiple devices with monotonic versioning and deterministic tombstones for deletions.
  - Local-to-Cloud Storage Migration (`StorageMigrationManager`): Scans local IndexedDB / SpaceStore records, registers spaces to account, uploads encrypted history, verifies integrity, and preserves local cache for full offline capability.
  - Added 5 dedicated test suites (`tests/phase27-*.test.ts`) covering account auth, multi-device sync, encrypted attachments, local migration, and security isolation.
  - Total test count expanded to 206 test files (419 tests) passing 100% cleanly.

---

## [Phase 26] - 2026-08-19

### Validated & Released
- **Real-World Release Validation & Cross-Platform Integrity**:
  - Full real-world release validation report created (`docs/PHASE26_REAL_WORLD_VALIDATION.md`) covering all 18 validation dimensions.
  - Verified 40-message bidirectional exchanges and 50-message high-volume bursts over live relay transports.
  - Probed and verified live relay operations (`scripts/phase21-live-relay-check.mjs`).
  - Audited Android project configuration, security invariants, and runtime bundles (`scripts/android-build-check.mjs`, `scripts/android-runtime-config-check.mjs`).
  - Added dedicated release validation suite `tests/phase26-real-world-validation.test.ts`.
  - Total test count expanded to 201 test files (405 tests) passing 100% cleanly with zero failures and zero skips.

---

## [Phase 25] - 2026-08-19

### Fixed & Enhanced
- **Browser Double Ratchet Compatibility & Intermittent Delivery Fix**:
  - Replaced Node.js-specific `!Buffer.from(this.dhReceivingPub).equals(...)` with browser-compatible constant-time comparison `!constantTimeEquals(this.dhReceivingPub, remoteRatchetPub)` in `src/ratchet/ratchet.ts`.
  - Added dual-runtime WebSocket client support for standard `window.WebSocket` and Node `ws` in `src/network/websocketTransport.ts`.
  - Added privacy-safe structured diagnostics `[VEIL-NET]` and `[VEIL-UI]` across outbound and inbound pipelines with truncated hashes and zero secret leakage.
  - Implemented 2.5s centralized background mailbox polling fallback in `AppState.tsx` when WebSocket delivery is disrupted or unavailable.
  - Created dedicated regression suite `tests/phase25-intermittent-delivery.test.ts` (9 comprehensive test scenarios verifying 20+ sequential/burst message exchanges, bidirectional turns, polling fallback, offline reconnects, and zero-plaintext invariants).
  - Total test count expanded to 200 test files (402 tests) passing 100% cleanly.

---

## [Phase 22] - 2026-08-16

### Added
- **Real-Device Delivery Failure Diagnosis, Repair & Acceptance**:
  - Comprehensive root cause analysis document (`docs/PHASE22_ROOT_CAUSE.md`).
  - Contact & Invitation model expansion to package blind `mailboxId` and public `PrekeyBundle` under canonical Ed25519 signature checks (`src/contacts/types.ts`, `src/contacts/invitationManager.ts`, `src/contacts/contactManager.ts`).
  - Wire message packaging (`WirePayload`) in `ConversationManager` providing authenticated sender documents, size padding (`padPayload`), Double Ratchet encrypt/decrypt, and dynamic conversation timeline mapping.
  - Complete application state integration in `AppState.tsx` wiring `PrekeyManager`, `ConversationManager`, and dynamic recipient mailbox addressing.
  - 10 new regression test suites in `tests/`:
    - `tests/phase22-delivery-trace.test.ts` (12-stage Phone 1 <-> Phone 2 lifecycle trace)
    - `tests/phase22-mailbox-routing.test.ts` (Mailbox allocation, binding persistence, 404 queue safety)
    - `tests/phase22-identity-routing.test.ts` (Cryptographic invitation signing and tamper detection)
    - `tests/phase22-e2ee-recipient.test.ts` (Bidirectional Double Ratchet session establishment)
    - `tests/phase22-ack-semantics.test.ts` (Persistence-before-ACK invariant & deduplication)
    - `tests/phase22-multicontact-routing.test.ts` (3-party routing in normal and reversed contact order)
    - `tests/phase22-multispace-routing.test.ts` (5 isolated Spaces with zero cross-space message leakage)
    - `tests/phase22-reconnect-delivery.test.ts` (Offline queuing and reconnect catch-up delivery)
    - `tests/phase22-android-lifecycle-delivery.test.ts` (Cold process kill & restart recovery)
    - `tests/phase22-real-device-contract.test.ts` (20-message bidirectional real-device contract)
  - Documented `ADR-106` through `ADR-110` in `docs/ai/DECISIONS.md`.
  - Total test count expanded to 172 test files (358 tests) passing 100% cleanly.

---

## [Phase 21] - 2026-08-16

### Added
- **Real-Device & Live-Production Validation**:
  - Baseline assessment & inventory (`docs/PHASE21_BASELINE.md`).
  - Production build & configuration verification tools:
    - `scripts/android-build-check.mjs`: Android build & manifest auditor.
    - `scripts/android-runtime-config-check.mjs`: Production bundle endpoint scanner.
    - `scripts/phase21-live-relay-check.mjs`: Live relay HTTPS/WSS probe.
    - `scripts/android-log-audit.mjs`: Android logcat secret leak auditor.
    - `scripts/phase21-report.mjs`: Aggregated operational dashboard report generator.
  - Automated test suites:
    - `tests/phase21-build-validation.test.ts`
    - `tests/phase21-runtime-config.test.ts`
    - `tests/phase21-deeplink.test.ts`
    - `tests/phase21-storage-boundary.test.ts`
    - `tests/phase21-offline-recovery.test.ts`
    - `tests/phase21-cross-platform-live.test.ts`
  - Comprehensive runbooks & guides:
    - `docs/PHASE21_REAL_DEVICE_VALIDATION.md`
    - `docs/ANDROID_BUILD.md`
    - `docs/ANDROID_SECURITY_STORAGE.md`
    - `docs/LIVE_PRODUCTION_TESTING.md`
    - `docs/CROSS_PLATFORM_LIVE_TESTING.md`
    - `docs/ANDROID_TROUBLESHOOTING.md`
    - `docs/RELEASE_INSTALLATION.md`
  - Documented `ADR-101` through `ADR-105` in `docs/ai/DECISIONS.md`.
  - 162 total test files with 345 tests passed 100%.

---

## [Phase 20] - 2026-08-16


### Added
- **Live Production Deployment, Android Client & Cross-Platform Real-Device Validation**:
  - Android native packaging with Capacitor configuration (`capacitor.config.ts`).
  - Android application manifest (`android/app/src/main/AndroidManifest.xml`) with `allowBackup="false"`, `usesCleartextTraffic="false"`, and invitation deep links (`veil://invite/...`).
  - Network security config (`android/app/src/main/res/xml/network_security_config.xml`) enforcing TLS 1.3.
  - Live diagnostic tools:
    - `scripts/live-health-check.mjs`: Live HTTP & WSS connectivity probe.
    - `scripts/live-e2e-check.mjs`: Live 2-client E2EE messaging test.
    - `scripts/android-release-check.mjs`: Android APK & Manifest security scanner.
  - Operational & platform documentation:
    - `docs/ANDROID_ARCHITECTURE.md`
    - `docs/ANDROID_STORAGE.md`
    - `docs/ANDROID_NETWORKING.md`
    - `docs/ANDROID_LIFECYCLE.md`
    - `docs/ANDROID_RELEASE.md`
    - `docs/CROSS_PLATFORM_COMPATIBILITY.md`
    - `docs/LIVE_DEPLOYMENT.md`
    - `docs/REAL_DEVICE_TESTING.md`
    - `docs/PHASE20_VALIDATION.md`
  - Automated test suites:
    - `tests/phase20-android-adapter.test.ts`
    - `tests/phase20-cross-platform-protocol.test.ts`
    - `tests/phase20-live-relay-smoke.test.ts`
    - `tests/phase20-android-security.test.ts`
  - Documented `ADR-096` through `ADR-100` in `docs/ai/DECISIONS.md`.
  - 156 total test files with 338 tests passed 100%.

---

## [1.0.0] - 2026-08-16 - GENERAL AVAILABILITY (GA)


### Added
- **Final Release Engineering & General Availability (v1.0.0 GA)**:
  - Canonical `1.0.0` version alignment across repository and metadata.
  - Release manifest generator (`scripts/release-build.mjs`) creating `release/v1.0.0/manifest.json` and `release/v1.0.0/checksums.sha256`.
  - Added release test gates:
    - `tests/release-version.test.ts`
    - `tests/release-integrity.test.ts`
    - `tests/release-artifact-security.test.ts`
    - `tests/phase19-crypto-regression.test.ts`
    - `tests/phase19-multispace-final.test.ts` (20-Space simultaneous scale test)
    - `tests/phase19-ui-security-final.test.ts`
    - `tests/privacy-network-egress.test.ts`
    - `tests/upgrade-compatibility.test.ts`
  - Created operational & compliance documentation:
    - `THIRD_PARTY_NOTICES.md`
    - `docs/DEPENDENCY_SECURITY.md`
    - `docs/RELEASE_V1.0.0.md`
    - `docs/GA_RELEASE_CHECKLIST.md`
    - `docs/GA_RELEASE_SCORECARD.md`
    - `docs/BROWSER_COMPATIBILITY.md`
    - `docs/OPERATIONS_BACKUP_RESTORE.md`
    - `docs/SECURITY_CLAIMS.md`
  - Documented `ADR-091` through `ADR-095` in `docs/ai/DECISIONS.md`.
  - 152 total test files with 332 tests passed 100%.

---

## [Phase 18] - 2026-08-16


### Added
- **Final Production Release Candidate (RC2), Stress Testing & Release Sign-Off**:
  - `tests/phase18-stress-concurrency.test.ts`: High-concurrency message bursts (500+ parallel records), continuous symmetric ratchet throughput, and rapid multi-Space switching.
  - `tests/phase18-extreme-resilience.test.ts`: Simultaneous Panic Lock during active chunked attachment processing, and corrupted AEAD tag rejection.
  - `tests/phase18-formal-invariants.test.ts`: Nonce uniqueness verification across 10,000 CSPRNG samples, HKDF domain separation verification, and asymmetric signing keypair validity.
  - `docs/PHASE18_FINAL_RELEASE_NOTES.md`: Official Release Candidate 2 (`v1.0.0-rc.2`) release notes and comprehensive system scorecard.
  - `docs/FORMAL_SECURITY_PROOF.md`: Cryptographic security assurance and mathematical invariants guide.
  - Documented `ADR-086` through `ADR-090` in `docs/ai/DECISIONS.md`.
  - Added 3 new test suites (323 total tests across 144 test files, 100% clean pass).

---

## [Phase 17] - 2026-08-15


### Added
- **Real-World Deployment, Production Integration, Security Validation & Release Hardening**:
  - `deployment/Caddyfile.example`: Caddy reverse proxy template with automatic TLS 1.3 and WebSocket support.
  - `deployment/nginx/veil.conf.example`: Nginx configuration with TLS 1.3, rate-limiting, and WebSocket upgrade.
  - `deployment/systemd/veil-relay.service.example`: Sandboxed systemd service file with OS-level restrictions.
  - `deployment/docker/Dockerfile` & `deployment/docker/docker-compose.yml`: Reproducible containerized relay packaging.
  - `deployment/.env.example` & `deployment/README.md`: Exhaustive deployment variables and operations manual.
  - Architecture and Operations Documentation:
    - `docs/PHASE17_PRODUCTION_VALIDATION.md`
    - `docs/DEPLOYMENT.md`
    - `docs/SELF_HOSTING.md`
    - `docs/SECURITY_AUDIT.md`
    - `docs/FAILURE_MODES.md`
    - `docs/COMPATIBILITY.md`
    - `docs/PERFORMANCE.md`
    - `docs/BACKUP_RECOVERY.md`
    - `docs/PRIVACY_DATA_FLOW.md`
    - `docs/RELEASE.md`
  - Documented `ADR-081` through `ADR-085` in `docs/ai/DECISIONS.md`.
  - 10 new test suites (315 total tests across 141 test files, 100% clean pass):
    - `tests/phase17-production-config.test.ts`
    - `tests/phase17-real-relay-e2e.test.ts`
    - `tests/phase17-restart-recovery.test.ts`
    - `tests/phase17-failure-injection.test.ts`
    - `tests/phase17-multispace-adversarial.test.ts`
    - `tests/phase17-security-audit.test.ts`
    - `tests/phase17-dependency-audit.test.ts`
    - `tests/phase17-performance-realistic.test.ts`
    - `tests/phase17-privacy-regression.test.ts`
    - `tests/phase17-release-artifacts.test.ts`

---

## [Phase 16] - 2026-08-15


### Added
- **Final Production Validation, Performance Benchmarking & System Packaging**:
  - `src/server/cli.ts`: Standalone Relay Server CLI entrypoint supporting configurable port, host, storage directory, and graceful shutdown (`npm run relay`).
  - `tests/performance-benchmarks.test.ts`: Performance benchmarking suite measuring Argon2id latency, AEAD throughput (> 1,000 ops/sec), attachment throughput (> 10 MiB/sec), and in-memory search latency (< 10ms for 1,000 records).
  - `tests/system-e2e-orchestration.test.ts`: Full cross-subsystem orchestration test verifying multi-Space creation, credential-selected unlocking, signed invitation onboarding, Double Ratchet messaging, chunked attachment transfers, local search, and emergency Panic Lock.
  - `docs/SYSTEM_SUMMARY.md`: Comprehensive technical specification synthesizing all 16 phases.
  - `README.md`: Complete documentation rewrite with feature matrix, quickstart guide, self-hosting guide, cryptographic specifications table, and documentation links.
  - Documented `ADR-079` and `ADR-080` in `docs/ai/DECISIONS.md`.
  - Added 2 new automated test suites (299 total tests across 131 test files, 100% clean pass).

---

## [Phase 15] - 2026-08-15


### Added
- **Production Integration, Real-World Messaging & Application Hardening**:
  - `src/contacts/types.ts`: Defined Contact model, verification status, and signed `InvitationPayload`.
  - `src/contacts/invitationManager.ts`: Cryptographic invitation manager with Ed25519 signatures, timestamp validity, replay protection, and 7-day expiration.
  - `src/contacts/contactManager.ts`: Space-isolated contact storage in `EncryptedSpaceStore` with verification toggle.
  - `src/attachments/types.ts`: Attachment metadata and chunking descriptors.
  - `src/attachments/attachmentPipeline.ts`: 64 KiB chunking with XChaCha20-Poly1305, full-file SHA-256 integrity verification, on-demand decryption, and ephemeral Blob revocation.
  - `src/notifications/types.ts` & `notificationDispatcher.ts`: Privacy policies (`HIDDEN`, `SENDER_ONLY`, `FULL_OBFUSCATED`) and locked-state suppression.
  - `src/search/types.ts` & `searchEngine.ts`: High-speed volatile in-memory search engine strictly isolated per Space and wiped on lock/panic.
  - `src/config/types.ts` & `appConfig.ts`: Typed environment configurations (dev, test, prod) with fail-closed TLS enforcement.
  - `src/server/storage/persistentRelayStore.ts`: File-backed persistent relay store with atomic `.tmp` rename operations and TTL sweep garbage collection.
  - Extended React 19 UI with instant search overlay, contacts tab, file attachment picker, device management, and exportable invitation generator (`src/ui/`).
  - Architecture Documentation:
    - `docs/CONTACT_ARCHITECTURE.md`
    - `docs/INVITATION_PROTOCOL.md`
    - `docs/MESSAGE_LIFECYCLE.md`
    - `docs/ATTACHMENT_ARCHITECTURE.md`
    - `docs/DEVICE_LINKING.md`
    - `docs/DATABASE_ARCHITECTURE.md`
    - `docs/NOTIFICATION_PRIVACY.md`
    - `docs/PRODUCTION_CONFIGURATION.md`
    - `docs/PRODUCTION_DEPLOYMENT.md`
  - Documented `ADR-072` through `ADR-078` in `docs/ai/DECISIONS.md`.
  - 12 new automated test suites (295 total tests across 129 test files, 100% clean pass):
    - `tests/contact-onboarding.test.ts`
    - `tests/invitation-protocol.test.ts`
    - `tests/message-lifecycle-production.test.ts`
    - `tests/group-production-lifecycle.test.ts`
    - `tests/attachment-pipeline.test.ts`
    - `tests/device-production-lifecycle.test.ts`
    - `tests/notification-privacy-dispatcher.test.ts`
    - `tests/search-privacy.test.ts`
    - `tests/production-config.test.ts`
    - `tests/relay-persistence-file.test.ts`
    - `tests/e2e-realistic-flow.test.ts`
    - `tests/accessibility-ui.test.ts`

---

## [Phase 14] - 2026-08-15


### Added
- **Production Application Shell, Real Messaging UI & Client Integration**:
  - `src/ui/app/types.ts`: Defined UI view models, conversation models, message timeline models, and modal types.
  - `src/ui/app/sessionController.ts`: Application session coordinator managing credential-selected Space unlocking, Space switching total state purge, inactivity auto-lock timers, and instantaneous panic lock.
  - `src/ui/app/AppState.tsx`: React 19 Context provider integrating underlying services (`SpaceVaultManager`, `EncryptedSpaceStore`, `ConversationManager`, `GroupManager`, `NetworkManager`, `SpaceIdentityManager`).
  - `src/ui/components/LockScreen.tsx`: Neutral login interface with passphrase entry, persistent Space envelope count, and emergency panic lock trigger.
  - `src/ui/components/CreateSpaceModal.tsx`: Dialog to create an isolated Space with Argon2id parameters and automatic IndexedDB persistence.
  - `src/ui/components/Sidebar.tsx`: Multi-space selector, search bar, category filter, 1-to-1 conversation list, group list, and modal triggers.
  - `src/ui/components/ConversationView.tsx`: Main chat header, real-time message timeline with animated bubbles, timestamps, delivery status indicators (`QUEUED`, `SENDING`, `SENT_TO_RELAY`, `DELIVERED_TO_RECIPIENT`), and attachment previews.
  - `src/ui/components/MessageComposer.tsx`: Input area with Enter to send, Shift+Enter for multiline, and offline indicator.
  - `src/ui/components/NewChatModal.tsx`: Direct E2EE session initiation via peer Identity Document exchange.
  - `src/ui/components/NewGroupModal.tsx`: Group creation modal with initial member configuration.
  - `src/ui/components/GroupDetailsModal.tsx`: Group member management, member invitation, removal, and forward-secrecy epoch updates.
  - `src/ui/components/ContactDetailsModal.tsx`: Safety number verification (12-digit grouped fingerprint comparison).
  - `src/ui/components/SettingsModal.tsx`: Space settings, auto-lock interval selection, notification privacy levels, and emergency panic lock trigger.
  - `src/ui/App.tsx`: Root React application component.
  - `src/main.tsx`: React 19 entrypoint mounting `AppProvider` into DOM `#root`.
  - `src/styles/veil-design-system.css`: Complete tokenized styling for responsive desktop, tablet, and mobile layouts.
  - `docs/UI_ARCHITECTURE.md`: Component hierarchy, state flow, and security boundaries.
  - `docs/UX_SECURITY.md`: User experience privacy guidelines, neutral lock screen design, safety number workflows, and panic lock ergonomics.
  - Documented `ADR-067` through `ADR-071` in `docs/ai/DECISIONS.md`.
  - Added 5 new automated test suites (276 total tests across 117 test files, 100% clean pass):
    - `tests/ui-session-controller.test.ts`: Unlocking, Space switching state wipe, auto-lock, and panic lock.
    - `tests/ui-conversation-flow.test.ts`: E2EE message sending/receiving, status transitions, and timeline rendering.
    - `tests/ui-group-flow.test.ts`: Group creation, messaging, and epoch updates.
    - `tests/ui-privacy-security.test.ts`: Neutral credential rejection, zero-plaintext persistence protection.
    - `tests/ui-offline-network.test.ts`: Offline status indicator, outbound queue display, and reconnect sync.

---

## [Phase 13] - 2026-08-15


### Added
- **Client Networking & Relay Integration**:
  - `src/network/types.ts`: Defined `NetworkState`, `DeliveryStatus`, `NetworkConfig`, `QueuedOutboundEnvelope`, `QueuedInboundEnvelope`, and `SpaceMailboxBinding`.
  - `src/network/errors.ts`: Typed client network errors (`NetworkError`, `RelayUnavailableError`, `MailboxRevokedError`, `ProtocolVersionMismatchError`, `TlsRequiredError`, `EnvelopePayloadTooLargeError`, `UnauthorizedMailboxError`).
  - `src/network/httpTransport.ts`: Typed REST client interfacing with Phase 12 Relay Server endpoints with request timeouts, HTTP error mapping, and TLS enforcement.
  - `src/network/websocketTransport.ts`: Real-time WebSocket transport client with connection lifecycle states, mailbox capability authentication, ping/pong heartbeats, and exponential backoff with jitter.
  - `src/network/envelopeQueue.ts`: Persistent encrypted outbound and inbound queues backed by `EncryptedSpaceStore` (IndexedDB) with **ACK-after-persistence** semantics and duplicate delivery reconciliation.
  - `src/network/networkManager.ts`: Central client networking coordinator managing per-Space mailbox bindings, automatic queue draining, offline message persistence, and E2EE payload routing.
  - `docs/NETWORK_ARCHITECTURE.md`: Client networking architecture and subsystem design.
  - `docs/CLIENT_RELAY_INTEGRATION.md`: Integration guide connecting client E2EE engines to the relay server.
  - `docs/OFFLINE_DELIVERY.md`: Offline messaging, persistent queuing, restart recovery, and deduplication.
  - `docs/NETWORK_SECURITY.md`: Network threat model, per-Space isolation boundaries, and TLS fail-closed rules.
  - Documented `ADR-062` through `ADR-066` in `docs/ai/DECISIONS.md`.
  - Added 10 new automated test suites (268 total tests across 112 test files, 100% clean pass):
    - `tests/network-relay-client.test.ts`: HTTP transport and health/mailbox/envelope endpoints.
    - `tests/network-mailbox.test.ts`: Per-Space mailbox allocation and encrypted capability storage.
    - `tests/network-send-receive.test.ts`: Outbound and inbound pipeline over relay with ACK-after-persistence.
    - `tests/network-websocket.test.ts`: Real-time WebSocket envelope push and connection handling.
    - `tests/network-reconnect-backoff.test.ts`: Reconnection state transitions and exponential backoff.
    - `tests/network-offline-persistence.test.ts`: Offline queuing and application restart persistence recovery.
    - `tests/network-duplicates.test.ts`: Duplicate envelope suppression and deduplication registry.
    - `tests/network-multispace.test.ts`: 10-Space strict network, mailbox, and queue isolation.
    - `tests/network-security.test.ts`: TLS enforcement, locked session defense, and error handling.
    - `tests/network-integration-e2ee.test.ts`: Full end-to-end E2EE lifecycle over relay (Alice encrypts -> Relay transports -> Bob receives -> Bob decrypts -> Bob ACKs -> Bob replies).

---

## [Phase 12] - 2026-08-15


### Added
- **Standalone Production Relay Server & Blind Mailbox Transport Protocol v1**:
  - `src/server/types.ts`: Defined Relay Protocol v1 types, opaque `RelayEnvelope` ($\le 64$ KiB), `MailboxRecord` with one-way SHA-256 capability hashing, and standardized error codes.
  - `src/server/config.ts`: Centralized server limits, TTLs, and operational thresholds.
  - `src/server/logger.ts`: Structured `PrivacyLogger` with automatic redaction of capability tokens, passwords, keys, and payloads.
  - `src/server/rateLimiter.ts`: In-memory sliding-window rate limiter (120 req/min/IP) preventing request storms and mailbox flooding.
  - `src/server/storage/relayStore.ts`: `IRelayStore` abstraction decoupling transport logic from database drivers.
  - `src/server/storage/memoryRelayStore.ts`: In-memory transactional store with queue bounds and TTL sweep.
  - `src/server/wsHandler.ts`: Real-time WebSocket delivery handler supporting capability auth, instant envelope push, ping/pong heartbeats, and backpressure.
  - `src/server/relayServer.ts`: Standalone HTTP/WebSocket server implementing `/healthz`, `/readyz`, `/v1/mailboxes`, `/v1/envelopes`, `/v1/envelopes/fetch`, `/v1/envelopes/ack`, and `/v1/ws`.
  - `docs/RELAY_PROTOCOL.md`: Formal specification of VEIL Relay Transport Protocol v1.
  - `docs/RELAY_ARCHITECTURE.md`: Architecture guide, trust boundaries, and at-least-once delivery semantics.
  - `docs/RELAY_SECURITY.md`: Security analysis, threat model, abuse prevention, and production deployment boundaries.
  - `docs/RELAY_PRIVACY.md`: Metadata minimization, zero plaintext guarantee, and privacy logging rules.
  - Documented `ADR-057` through `ADR-061` in `docs/ai/DECISIONS.md`.
  - Added 8 new automated test suites (256 total tests across 102 test files, 100% clean pass):
    - `tests/relay-protocol.test.ts`: HTTP endpoints and schema tests.
    - `tests/relay-capabilities.test.ts`: Capability one-way SHA-256 verification and cross-mailbox isolation.
    - `tests/relay-delivery.test.ts`: At-least-once delivery, queue bounds, and ACK deletion.
    - `tests/relay-websocket.test.ts`: Real-time push, socket auth, and heartbeats.
    - `tests/relay-abuse.test.ts`: 64 KiB size bounds, rate limiting, and malformed request defense.
    - `tests/relay-privacy.test.ts`: Log sanitization and zero-decryption invariant.
    - `tests/relay-shutdown.test.ts`: Graceful server stop and socket draining.
    - `tests/relay-integration.test.ts`: 2-client end-to-end simulated transport lifecycle.

---

## [Phase 11] - 2026-08-15


### Added
- **Persistent Encrypted Local Storage (IndexedDB) & Required Storage Integration**:
  - `src/storage/types.ts`: Defined `IStorageAdapter`, `StoredRecord`, `StorageMetadata`, `MigrationDefinition`, and custom storage errors (`StorageUnavailableError`, `StorageQuotaError`, `StorageCorruptionError`, `StorageMigrationError`).
  - `src/storage/migrations.ts`: Transactional schema migration engine with Version 1 baseline establishing `envelopes`, `records` (index `by_spaceId`), and `meta` object stores.
  - `src/storage/indexedDbAdapter.ts`: Production IndexedDB storage driver with fail-closed behavior when IndexedDB is unavailable or fails initialization.
  - `src/storage/memoryAdapter.ts`: Test-only in-memory storage adapter for non-persistent environments.
  - `src/storage/spaceStore.ts`: Integrated `EncryptedSpaceStore` with `IStorageAdapter` for async persistent record writes and partition loading while preserving synchronous caching.
  - `src/spaces/vault.ts`: Added minimal persistence bridge methods (`loadEnvelopesFromStorage`, `saveEnvelopeToStorage`, `deleteSpaceWithStorage`).
  - `src/main.ts`: Updated production app initialization to initialize `IndexedDBStorageAdapter` and fail closed on error.
  - `docs/STORAGE_ARCHITECTURE.md`: Complete technical storage architecture guide with plaintext persistence protection framing and honest disk boundaries.
  - Documented `ADR-054` (Persistent IndexedDB Storage Adapter), `ADR-055` (Transactional Schema Migration Engine), `ADR-056` (Fail-Closed Storage Architecture).
  - Added 3 new test suites (236 total tests across 94 test files, 100% clean pass):
    - `tests/storage-indexeddb-restart.test.ts`: 7-step real application restart persistence, cross-space isolation, zero-plaintext audit, and tampering detection test.
    - `tests/storage-migrations.test.ts`: Baseline schema creation and migration execution tests.
    - `tests/storage-concurrency-quota.test.ts`: Fail-closed and quota error containment tests.

---

## [v1.0.0-rc.1] - 2026-08-15 (Phase 10)


### Added
- **Release Candidate Packaging, Production Hardening & Operational Readiness**:
  - `tests/e2e-release-lifecycle.test.ts`: Complete end-to-end full system lifecycle integration test covering space creation, credential-selected unlocking, blind mailboxes, 1-to-1 Double Ratchet, group SenderKey messaging, 64 KiB encrypted media, multi-device SAS enrollment, BIP-39 recovery, Panic Lock, and space deletion.
  - `SECURITY.md`: Security policy and responsible vulnerability disclosure SLAs.
  - `docs/SECURITY_GUIDE.md`: Comprehensive technical security architecture guide.
  - `docs/USER_PRIVACY_GUIDE.md`: Plain-language privacy guide for end users.
  - `docs/DEVELOPMENT.md`: Developer onboarding, build, and contribution standards.
  - `docs/DEPLOYMENT.md`: Production server hardening, reverse proxy TLS, and container security.
  - `docs/OPERATIONS.md`: Production operations, monitoring, health checks, and key rotation.
  - `docs/INCIDENT_RESPONSE.md`: 10-step incident response workflow and key compromise containment.
  - `docs/ABUSE_MODEL.md`: Abuse containment and resource defense model.
  - `docs/RELEASE_CHECKLIST.md`: Formal production readiness verification matrix.
  - `RELEASE_NOTES.md`: Official `v1.0.0-rc.1` release candidate notes.
  - `docs/RELEASE_CANDIDATE_REPORT.md`: Release candidate certification report.
  - `THIRD_PARTY_NOTICES.md`: Complete open source license attributions.
  - `.env.example`: Standardized environment variable template.
  - Enforced Post-RC Security Freeze governance rule in `AGENTS.md`.
  - Documented `ADR-049` (End-to-End Lifecycle Verification), `ADR-050` (Post-RC Freeze), `ADR-051` (Vulnerability Disclosure), `ADR-052` (Zero-Knowledge Deployment), `ADR-053` (v1.0.0-rc.1 Tagging).

---

## [Phase 9] - 2026-08-15


### Added
- **Adversarial Security Audit, Red-Team Review & Release Hardening**:
  - `docs/SECURITY_AUDIT.md`: Complete security asset inventory, trust boundaries, and threat actor matrix.
  - `docs/SECURITY_AUDIT_REPORT.md`: Comprehensive adversarial red-team audit report and release candidate classification.
  - `docs/SECURITY_PROPERTIES.md`: Cryptographic security property matrix mapping claims to tests and boundary limitations.
  - `docs/SECURITY_SCORECARD.md`: Subsystem-by-subsystem evaluation (`PASS` / `PASS WITH LIMITATIONS`).
  - `docs/RELEASE_BLOCKERS.md`: Mandatory release blocker resolution verification.
  - `docs/SECURITY_DEBT.md`: Transparent accepted risks and post-release technical hardening roadmap.
  - Documented `ADR-044` (Adversarial Verification), `ADR-045` (Hostile Parser Fuzzing), `ADR-046` (Cryptographic Invariants & Nonces), `ADR-047` (Real-Time Panic Lock Session Invalidation), `ADR-048` (Release Candidate Designation).
- **Adversarial Red-Team Test Suites (8 new suites, 15 new tests, 229 total across 90 test files)**:
  - `tests/audit-crypto-invariants.test.ts`: Nonce collision verification across 10,000 CSPRNG samples, HKDF subkey domain separation, and buffer zeroization.
  - `tests/audit-cross-space-attacks.test.ts`: In-memory and local storage cross-space partition injection attacks, credential oracle rejection.
  - `tests/audit-protocol-state-machine.test.ts`: Double Ratchet and Group SenderKey epoch rollback rejection.
  - `tests/audit-media-pipeline.test.ts`: Media chunk swapping attacks and corrupted chunk AAD validation.
  - `tests/audit-device-recovery.test.ts`: BIP-39 mnemonic checksum corruption detection and corrupted backup file rejection.
  - `tests/audit-transport-server-boundary.test.ts`: IDOR capability access attempts across blind mailboxes.
  - `tests/audit-panic-race-conditions.test.ts`: Instant session destruction and in-flight storage operation rejection during panic lock.
  - `tests/audit-fuzz-parsers.test.ts`: Hostile fuzz testing of padding unpadding, transport envelopes, and backup deserializers with 500+ random/malformed buffers.

---

## [Phase 8] - 2026-08-15


### Added
- **Metadata Minimization, Traffic Analysis Resistance & Privacy-Preserving Network Behavior**:
  - `src/privacy/padding.ts`: `MessagePadding` implementing discrete size bucket quantization (512B, 2KB, 8KB, 32KB, 64KB), length-prefixed CSPRNG random padding, and hard bounds (`MAX_MESSAGE_SIZE = 64KB`, `MAX_PADDED_SIZE = 128KB`).
  - `src/transport/trafficShaper.ts`: `TrafficShaper` providing bounded random delay jitter (20ms–400ms), envelope batching queues (up to 5 envelopes), and three traffic privacy levels (`Standard`, `Balanced`, `High`).
  - `src/transport/mailboxRotation.ts`: `MailboxRotationManager` with epoch-based capability rotation and overlapping grace periods.
  - `src/privacy/presencePrivacy.ts`: `PresencePrivacyManager` providing typing indicator rate-limiting (3s threshold), opt-in read receipts with opaque IDs, and configurable last-seen status.
- **Documentation & Audits**:
  - `docs/METADATA_AUDIT.md`: System-wide metadata vector catalog and classifications.
  - `docs/API_METADATA_AUDIT.md`: Endpoint-by-endpoint inspection and minimization analysis.
  - `docs/SERVER_PRIVACY.md`: Server logging, retention, and access control policies.
  - `docs/ANONYMITY_NETWORKS.md`: Architectural analysis of Tor, mixnets, VPNs, and proxies.
  - `docs/METADATA_REMAINING_LEAKAGE.md`: Transparent documentation of residual traffic signals.
  - Documented `ADR-039` (Size Bucket Quantization), `ADR-040` (Timing Jitter & Batching), `ADR-041` (Mailbox Capability Rotation), `ADR-042` (Rate-Limited Presence), `ADR-043` (Traffic Privacy Levels).
- **Test Suites (12 new suites, 15 new tests, 214 total across 82 files)**:
  - `tests/message-padding.test.ts`: Bucket quantization and unpadding exactness.
  - `tests/resource-limit.test.ts`: Payload size bounds and memory exhaustion defenses.
  - `tests/timing-privacy.test.ts`: Jitter scheduling and bounded random delays.
  - `tests/identifier-privacy.test.ts`: Cryptographically random, non-sequential IDs.
  - `tests/push-privacy.test.ts`: Opaque wakeups without content or Space leakage.
  - `tests/presence-privacy.test.ts`: Typing rate-limiting and receipt privacy controls.
  - `tests/transport-privacy.test.ts`: Batch queue thresholds and immediate dispatch.
  - `tests/media-metadata.test.ts`: 64 KiB chunk standardization and encrypted metadata.
  - `tests/server-metadata.test.ts`: Honest-but-curious server database audit.
  - `tests/cross-space-metadata.test.ts`: Indistinguishable traffic across Main, Private, and Decoy Spaces.
  - `tests/privacy-levels.test.ts`: Standard, Balanced, and High traffic privacy configuration.
  - `tests/metadata-analysis.test.ts`: Traffic analysis test harness and mailbox rotation grace periods.

---

## [Phase 7] - 2026-08-15


### Added
- **Privacy UX, Panic Lock, Decoy Spaces & Human-Centered Security**:
  - `src/privacy/types.ts`: Privacy levels (`high`, `balanced`, `convenient`), auto-lock intervals, notification privacy tiers, sensitive content types, and security indicator structures.
  - `src/privacy/privacyManager.ts`: Per-Space privacy settings manager with presets.
  - `src/privacy/lockManager.ts`: `LockManager` implementing Quick Lock (single-space), Panic Lock (multi-space instant wipe), and configurable Auto-Lock inactivity countdowns.
  - `src/privacy/notificationManager.ts`: `NotificationManager` implementing privacy-preserving notification tiers and locked-state notification purging.
  - `src/privacy/uiStateManager.ts`: `UIStateManager` for dynamic tracking and complete wiping of sensitive UI plaintexts, drafts, previews, and search caches upon lock.
  - `src/privacy/securityIndicators.ts`: `SecurityIndicators` providing human-readable status (`Verified ✓`, `Unverified`, `Security Changed ⚠`) and identity change alerts.
  - `src/privacy/decoyEnforcement.ts`: `DecoyEnforcement` validating authentic decoy space independence and strict anti-disclosure.
  - `src/privacy/disclosureGuard.ts`: `DisclosureGuard` enforcing generic `"Unable to unlock."` errors and filtering prohibited security marketing claims.
- **Documentation**:
  - `docs/PRIVACY_UX.md`: Comprehensive specification of VEIL's privacy UX model.
  - `docs/KNOWN_LIMITATIONS.md`: Concrete and honest security boundaries and limitation analysis.
  - Documented `ADR-034` (Two-Tier Lock Model), `ADR-035` (Granular Notification Privacy), `ADR-036` (Complete UI State Purge), `ADR-037` (Genuine Decoy Spaces), `ADR-038` (Human-Centered Security Indicators).
- **Test Suites (9 new suites, 15 new tests, 199 total across 70 files)**:
  - `tests/panic-lock.test.ts`: Instant multi-space session destruction and UI purge.
  - `tests/quick-lock.test.ts`: Single-space lock isolation.
  - `tests/decoy-space.test.ts`: Independent decoy SMK and zero cross-space disclosure.
  - `tests/notification-privacy.test.ts`: High/Balanced/Convenient tiers and locked-state fallback.
  - `tests/locked-state.test.ts`: UI element and search cache purging on lock.
  - `tests/privacy-settings.test.ts`: Per-Space privacy settings persistence and presets.
  - `tests/error-disclosure.test.ts`: Error sanitization and prohibited term enforcement.
  - `tests/security-indicators.test.ts`: Human-readable status badges and identity change warnings.
  - `tests/auto-lock.test.ts`: Inactivity timer countdowns, activity resets, background events.

---

## [Phase 6] - 2026-08-15


### Added
- **Multi-Device Synchronization & Zero-Knowledge Cryptographic Recovery**:
  - `src/device/types.ts`: `DeviceRecord`, `DeviceEnrollmentSession`, `EnrollmentTicket`, `EnrollmentPayload`, `SpaceSyncEnvelope`, `DeviceRevocationRecord`, `DeviceRegistry`.
  - `src/device/enrollment.ts`: `DeviceEnrollmentManager` implementing ephemeral X25519 Diffie-Hellman key agreement, 6-digit visual SAS confirmation code derivation via HKDF-SHA256, and XChaCha20-Poly1305 encrypted credential tunnels.
  - `src/device/deviceManager.ts`: `DeviceManager` with signed `DeviceRevocationRecord` tombstones, authorization verification, and active device enumeration.
  - `src/recovery/bip39.ts`: BIP-39 mnemonic encoder/decoder supporting 24-word standard English recovery phrases with 8-bit SHA-256 checksums.
  - `src/recovery/wordlist.ts`: Standard 2048-word BIP-39 English wordlist.
  - `src/recovery/recoveryVault.ts`: `RecoveryVault` handling zero-knowledge Space recovery from 24-word mnemonics and standalone encrypted `.veilbackup` emergency files.
  - `src/spaces/vault.ts`: Extended `createSpace` to support importing custom/recovered `masterKey`.
- **Documentation**:
  - `docs/MULTI_DEVICE.md`: Comprehensive multi-device enrollment and selective synchronization specification.
  - `docs/RECOVERY.md`: Comprehensive zero-knowledge recovery specification.
  - Documented `ADR-029` (Ephemeral QR Key Agreement with SAS), `ADR-030` (Selective Space Sync), `ADR-031` (Signed Device Revocation), `ADR-032` (BIP-39 Mnemonic Recovery), `ADR-033` (Anti-Escrow and Zero Server Password Reset).
- **Test Suites (7 new suites, 9 new tests, 184 total across 61 files)**:
  - `tests/device-enrollment.test.ts`: QR ticket generation, ephemeral key exchange, SAS calculation & confirmation.
  - `tests/device-sas-mitm.test.ts`: MITM attack detection via SAS code mismatch.
  - `tests/device-selective-sync.test.ts`: Selective Space sync and complete isolation of unselected Spaces.
  - `tests/device-revocation.test.ts`: Device revocation, signed tombstones, re-registration prevention.
  - `tests/bip39-recovery.test.ts`: 24-word BIP-39 mnemonic generation, checksum validation, deterministic identity restoration.
  - `tests/recovery-file.test.ts`: Encrypted emergency backup file export and import with wrong password rejection.
  - `tests/no-server-backdoor.test.ts`: Anti-backdoor and zero-knowledge enforcement tests.

---

## [Phase 5] - 2026-08-15


### Added
- **Encrypted Group Messaging & Encrypted Media Vault**:
  - `src/group/types.ts`: Group messaging types, roles (`CREATOR`, `ADMIN`, `MEMBER`), `GroupEpoch`, `GroupMember`, `GroupAction`, `GroupState`, `SenderKeyDistributionMessage`, `GroupMessagePayload`.
  - `src/group/groupKdf.ts`: Sender key symmetric chain stepping (`HMAC-SHA256`), epoch master derivation (`HKDF-SHA256`), metadata encryption keys, and canonical byte serializations for AAD authentication and Ed25519 signatures.
  - `src/group/senderKey.ts`: `SenderKeySession` state machine with $O(1)$ group message encryption, bounded skipped key buffer (`MAX_GROUP_SKIPPED_KEYS = 500`), Ed25519 sender signature verification, and single-use message key zeroization.
  - `src/group/groupState.ts`: `GroupStateManager` enforcing role hierarchy, Ed25519 signature checks, anti-rollback epoch validation, and encrypted group metadata.
  - `src/group/groupManager.ts`: `GroupManager` coordinating group creation, pairwise distribution over 1-to-1 Double Ratchet channels, epoch advancement, key rotation upon member departure, and encrypted Space store persistence.
  - `src/media/types.ts`: `MediaMetadata`, `EncryptedMediaChunk`, `EncryptedMediaPackage`, `EncryptedMediaAttachment`, `MediaUploadRequest`, `MediaDownloadResponse`.
  - `src/media/mediaEncryptor.ts`: Symmetric client-side chunked encryption with `XChaCha20-Poly1305`, random 32-byte keys per media file, canonical AAD binding (`mediaId`, `chunkIndex`, `totalChunks`, `isLastChunk`), and SHA-256 integrity digests.
  - `src/media/mediaStorage.ts`: `InMemoryMediaRelay` / `IMediaStorageAdapter` for untrusted blob transport with capability authorization and corruption testing.
  - `src/media/mediaVault.ts`: `MediaVault` managing local space-isolated encrypted media caching and gallery isolation.
- **Documentation**:
  - `docs/GROUP_PROTOCOL.md`: Comprehensive group protocol specification.
  - `docs/MEDIA_SECURITY.md`: Comprehensive media encryption and untrusted blob transport specification.
  - Documented `ADR-023` (Sender Keys with Epoch Ratcheting), `ADR-024` (Signed Group Actions and Anti-Rollback Epochs), `ADR-025` (Forward Secrecy on Member Departure), `ADR-026` (Single-Use Media Keys), `ADR-027` (Streaming Chunk Authenticated Encryption), `ADR-028` (Untrusted Media Relay and Local Gallery Isolation).
- **Test Suites (20 new suites, 28 new tests, 175 total across 54 files)**:
  - `tests/group-protocol.test.ts`: KDF determinism, key lengths, canonicalization.
  - `tests/group-creation.test.ts`: Random group IDs, creator role, initial epoch 1, signed genesis action.
  - `tests/group-membership.test.ts`: Role hierarchy (`CREATOR` > `ADMIN` > `MEMBER`), permission checks.
  - `tests/group-add-remove.test.ts`: Forward secrecy on member departure, epoch advancement, key rotation.
  - `tests/group-epochs.test.ts`: Monotonic epoch progression, stale action rejection, anti-rollback.
  - `tests/group-replay.test.ts`: Message replay detection and sequence tracking.
  - `tests/group-ordering.test.ts`: Out-of-order message decryption (1, 3, 2) via skipped message keys.
  - `tests/group-state.test.ts`: Signature validation on actions and anti-tampering.
  - `tests/group-rollback.test.ts`: Outbound sender key rollback rejection.
  - `tests/group-malicious-server.test.ts`: Bit-flipped ciphertext rejection, header sequence tampering rejection.
  - `tests/group-isolation.test.ts`: Cross-group and cross-space cryptographic isolation.
  - `tests/media-encryption.test.ts`: Image, audio, video, document encryption with unique keys.
  - `tests/media-integrity.test.ts`: Corrupted chunks, wrong keys, truncated chunks, tampered digests rejected.
  - `tests/media-chunking.test.ts`: Reordered, duplicated, and cross-file substituted chunks detected.
  - `tests/media-authorization.test.ts`: Capability token authorization for upload, download, delete.
  - `tests/media-replay.test.ts`: Duplicate upload idempotency.
  - `tests/media-corruption.test.ts`: Bit-flip, truncated byte stream, modified nonce detection.
  - `tests/group-media.test.ts`: Complete end-to-end flow: Alice, Bob, Charlie; media transfer; member removal blocks subsequent media.
  - `tests/group-crash-recovery.test.ts`: Group state and sender key recovery across lock/unlock cycles.
  - `tests/group-fuzz.test.ts`: Malformed payloads and descriptors fuzz testing.

---

## [Phase 4] - 2026-08-15


### Added
- **End-to-End Encrypted 1-to-1 Messaging (Double Ratchet & X3DH)**:
  - `src/ratchet/types.ts`: Protocol data structures, `PrekeyBundle`, `SignedPrekey`, `OneTimePrekey`, `RatchetMessage`, `PersistedRatchetState`.
  - `src/ratchet/kdf.ts`: Root key KDF (HKDF-SHA256), Symmetric chain KDF (HMAC-SHA256), and canonical header AAD serialization.
  - `src/ratchet/prekeys.ts`: `PrekeyManager` managing generation, signing, and consumption of Signed Prekeys and One-Time Prekey pools.
  - `src/ratchet/x3dh.ts`: Extended Triple Diffie-Hellman protocol (`initiateX3DH` and `receiveX3DH`).
  - `src/ratchet/ratchet.ts`: `DoubleRatchetSession` implementing full Signal-specification DH and symmetric ratcheting, bounded skipped message keys (`MAX_SKIPPED_KEYS = 500`), and single-use key zeroization.
  - `src/messaging/sessionStore.ts`: `RatchetSessionStore` providing encrypted persistence in `EncryptedSpaceStore`.
  - `src/messaging/conversationManager.ts`: `ConversationManager` orchestrating asynchronous handshakes, outbox/inbox queues, message sending/receiving, and local encrypted history.
- **Architecture Decisions**: Documented `ADR-019` (X3DH Key Agreement), `ADR-020` (Double Ratchet Protocol), `ADR-021` (Bounded Skipped Keys), `ADR-022` (Encrypted Session Persistence).
- **Test Suites (10 new suites, 15 new tests, 147 total)**:
  - `tests/prekey-management.test.ts`: SPK Ed25519 signing and OPK pool consumption.
  - `tests/x3dh-handshake.test.ts`: Asymmetric handshake equality and MITM signature rejection.
  - `tests/double-ratchet-core.test.ts`: Bidirectional ping-pong messaging with DH ratchet steps.
  - `tests/out-of-order-messages.test.ts`: Skipped messages (1, 3, 2) and immediate key erasure on use.
  - `tests/forward-secrecy.test.ts`: Current state compromise cannot decrypt past messages.
  - `tests/post-compromise-recovery.test.ts`: Break-in recovery after fresh DH ratchet step.
  - `tests/ratchet-tampering.test.ts`: Header sequenceNum tampering and bit-flipped ciphertext rejection.
  - `tests/session-persistence.test.ts`: Ratchet session restoration across lock/unlock cycles.
  - `tests/conversation-e2ee.test.ts`: Full integration (Alice -> X3DH -> Ratchet -> Mock Transport -> Ratchet -> Bob).
  - `tests/ratchet-isolation.test.ts`: Cross-space isolation (Private Space cannot decrypt Main Space messages).

---

## [Phase 3] - 2026-08-15

### Added
- **Privacy-Preserving Untrusted Transport Interface**:
  - `src/transport/types.ts`: Size classes (`SMALL`, `MEDIUM`, `LARGE`, `XLARGE`), `TransportEnvelope`, `MailboxCapability`, `ServerMailboxRecord`, `ITransportAdapter`.
  - `src/transport/padding.ts`: Length-prefixed deterministic padding and safe unpadding.
  - `src/transport/capability.ts`: Opaque `mailboxId` generation, 256-bit capability secrets, and `SHA-256(capability || tag)` verifier derivation.
  - `src/transport/protection.ts`: Temporary Phase 3 authenticated transport protection.
  - `src/transport/envelope.ts`: Version 1 transport envelope packaging, TTL calculation, and validation.
  - `src/transport/outbox.ts`: `EncryptedOutbox` partitioned per Space in `EncryptedSpaceStore` with retry state.
  - `src/transport/inbox.ts`: `EncryptedInbox` partitioned per Space with encrypted processed ID deduplication registry.
  - `src/transport/server.ts`: `MockTransportServer` with capability verifier checks, TTL auto-purge, failure simulation, and database dump inspection.
  - `src/transport/client.ts`: `TransportClient` coordinating outbox/inbox queues, retries, and offline mode.
- **Architecture Decisions**: Documented `ADR-015` (blind mailbox model), `ADR-016` (size classes and padding), `ADR-017` (encrypted outbox/inbox), `ADR-018` (transport adapter pattern).
- **Test Suites (10 new suites, 31 new tests, 132 total)**:
  - `tests/transport-mailbox.test.ts`: Mailbox lifecycle, status queries, deletion.
  - `tests/transport-authentication.test.ts`: Capability verification, wrong token rejection, verifier one-way hashing.
  - `tests/transport-isolation.test.ts`: Main vs Private vs Decoy space transport isolation.
  - `tests/transport-tampering.test.ts`: Payload ciphertext tampering, nonce tampering, malformed envelope rejection.
  - `tests/transport-replay.test.ts`: Envelope replay detection, duplicate retry rejection, lock/unlock persistence.
  - `tests/transport-padding.test.ts`: Size classes (512B, 2KB, 8KB, 32KB), boundary sizes, safe corruption handling.
  - `tests/transport-expiration.test.ts`: Envelope TTL expiration, fetch auto-purge, global purge.
  - `tests/transport-failure.test.ts`: Offline mode queueing, timeout resilience, recovery on reconnection.
  - `tests/malicious-server.test.ts`: Corrupted server payload handling, truncated response handling.
  - `tests/metadata-exposure.test.ts`: Server database dump audit (zero passwords, SMKs, private keys, or plaintexts).

---

## [Phase 2] - 2026-08-15

### Added
- **Cryptographic Identity Layer**:
  - `src/crypto/hkdf.ts`: Extended with two-tier HKDF identity derivation domains (`veil-v1-identity-seed`, `veil-v1-signing-key`, `veil-v1-key-agreement`).
  - `src/identity/signing.ts`: Ed25519 digital signature wrapper (`@noble/curves/ed25519.js`, v1.8.0).
  - `src/identity/keyAgreement.ts`: X25519 key agreement wrapper (`@noble/curves/ed25519.js`, exports `x25519`).
  - `src/identity/canonical.ts`: Deterministic canonical serialization with explicit field ordering.
  - `src/identity/fingerprint.ts`: SHA-256 fingerprint (12 × 5-digit groups) and identity ID computation.
  - `src/identity/document.ts`: Self-signed `IdentityDocument` with Ed25519 self-signature over canonical bytes.
  - `src/identity/manager.ts`: `SpaceIdentityManager` managing creation, encrypted persistence, loading, signing, verification, and DH key agreement.
- **SpaceSession Extension**: Added `getMasterKey()` for internal identity derivation within the Space boundary.
- **Architecture Decisions**: Documented `ADR-012` (two-tier HKDF identity derivation), `ADR-013` (self-signed identity binding), `ADR-014` (Space cloning produces same identity).
- **Test Suites (52 new tests, 101 total)**:
  - `tests/identity-generation.test.ts`: Identity creation, determinism, Space independence.
  - `tests/identity-signatures.test.ts`: Ed25519 sign/verify, tampered message, wrong key.
  - `tests/key-agreement.test.ts`: X25519 DH commutativity, isolation.
  - `tests/identity-isolation.test.ts`: Cross-Space identity independence, locked Space, signing attacks.
  - `tests/identity-document.test.ts`: Self-signature verification, field tampering, unknown version.
  - `tests/identity-fingerprint.test.ts`: Determinism, format, canonical round-trip.
  - `tests/identity-tampering.test.ts`: Key substitution, bit flips, Frankenstein documents.
  - `tests/identity-lifecycle.test.ts`: Persistence, lock/unlock, password change preserves identity, deletion.

---

## [Phase 1] - 2026-08-15

### Added
- **Cryptographic Space Vault Engine**:
  - `src/crypto/kdf.ts`: Argon2id password KDF (`@noble/hashes/argon2.js`, RFC 9106).
  - `src/crypto/aead.ts`: XChaCha20-Poly1305 authenticated encryption (`@noble/ciphers/chacha.js`).
  - `src/spaces/envelope.ts`: Versioned `SpaceHeaderEnvelope` with canonical AAD context binding.
  - `src/spaces/session.ts`: `SpaceSession` with volatile key management and `destroy()`.
  - `src/spaces/vault.ts`: `SpaceVaultManager` with AAD, targeted/discovery unlock, crash-safe password change.
  - `src/storage/spaceStore.ts`: `EncryptedSpaceStore` with partitioned AEAD storage.

### Fixed
- Enforced AAD envelope metadata binding (`VEIL-v1|version:1|spaceId:<id>|alg:...|salt:...`).
- Optimized credential-selected unlock with targeted `unlockSpace(password, spaceId)`.
- Crash-safe transactional password change with atomic commit.
- Corrected terminology to "selected established cryptographic primitives".

---

## [Phase 0] - 2026-08-15

### Added
- AI-Agent Continuity System, architecture documentation, phase prompts, baseline scaffolding.
