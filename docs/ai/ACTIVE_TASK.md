# ACTIVE_TASK.md — Active Work Tracker

## Active Phase: PHASE 55 (Production-Critical Forensic Implementation — P0 Hardening)
- **Status**: **COMPLETE & VERIFIED 100%**
- **Branch**: `main`
- **Output Artifact**: `walkthrough.md`

### Completed P0 Forensic Tasks
- [x] **P0-1: Fix Local Delete Cloud Resurrection**:
  - Implemented `DeletedMessageTombstone` interface in `src/storage/types.ts`.
  - Stored persistent tombstones under `'veil:ui:deleted_messages'` in `AppState.deleteMessageLocally` and `deleteMessagesLocally`.
  - Triggered `scheduleCloudSync(activeSession)` immediately upon local deletion.
  - Integrated tombstone pruning into `AccountManager.mergeRecordsForSpace` to prevent older cloud snapshots from resurrecting locally deleted messages.
  - Verified with automated test in `tests/phase55-forensic-p0.test.ts`.

- [x] **P0-2: Enforce Blocking for Active Conversations**:
  - Added real-time blocked check in `AppState.tsx` inbound wire message listener: drops messages immediately if sender identity is in blocklist.
  - Enforced outbound check in `sendMessage`, `sendAttachments`, and `sendVoiceMessage`: blocks sending to blocked recipients with clear user feedback.
  - Added safe optional chaining in `ContactRequestManager.blockUser` and `unblockUser`.
  - Verified with automated test in `tests/phase55-forensic-p0.test.ts`.

- [x] **P0-3: Make Chat Mute Real & Persistent**:
  - Extended `NotificationDispatcher` with `mutedConversations: Set<string>`, `muteConversation()`, `unmuteConversation()`, `isConversationMuted()`, and suppression in `prepareNotification()`.
  - Added persistent mute settings state in `AppState.tsx` stored under `'veil:contacts:mute_settings'`.
  - Wired `ProfileModal.tsx` to read dynamic mute state from `isConversationMuted()` and toggle via `toggleMuteConversation()`.
  - Verified with automated test in `tests/phase55-forensic-p0.test.ts`.

- [x] **P0-4: Remove Deceptive Fake Voice-Call Functionality**:
  - Completely removed mock `handleCall` handler and `PhoneIcon` button from `src/ui/components/ProfileModal.tsx`.
  - Redesigned primary actions bar to clean 3-button grid (`repeat(3, 1fr)`): Message, Mute/Unmute, and Safety Number.
  - Verified with automated test in `tests/phase55-forensic-p0.test.ts` and updated regression suite in `tests/phase47-runtime-media-account.test.tsx`.

- [x] **P0-5: Fix Offline Queue Status Synchronization**:
  - Added `messageId` and `conversationId` metadata to `QueuedOutboundEnvelope` in `src/network/types.ts`.
  - Added `onOutboundFlushed` event callback to `NetworkManager` for both online dispatch and background queue drainage.
  - Connected `onOutboundFlushed` in `AppState.tsx` to advance UI messages monotonically (`FAILED`/`QUEUED`/`SENDING` -> `SENT_TO_RELAY`) without regressing `DELIVERED` or `READ` states.
  - Verified with automated test in `tests/phase55-forensic-p0.test.ts`.

- [x] **P0-6: Fix Cloud Snapshot Concurrency / Data-Loss Risk**:
  - Implemented `AccountManager.mergeRecordsForSpace` for deterministic multi-device deep union of messages, conversations, contacts, mute settings, and tombstones.
  - Added optimistic concurrency check (`expectedUpdatedAt`) in `CloudClient.setRecoveryVault` and `src/server/cloud/cloudHandler.ts` (HTTP 409 Conflict).
  - Verified multi-device concurrent sync without data loss in `tests/phase55-forensic-p0.test.ts` and live production Render probe `scratch/verify_phase55_prod.mjs`.

- [x] **P0-7: Profile Data & Picture Persistence**:
  - Enforced local token validation in `CloudClient.uploadAttachment` and `downloadAttachment` to reject malformed bearer tokens.
  - Verified Ed25519 cryptographic signing and verification of avatar Data URLs in `tests/phase55-forensic-p0.test.ts`.
  - Wired automatic fallback in `AppState.loadSpaceData` to hydrate missing local avatar from signed directory profile.

### Verification Results
- Unit/Regression Suite: **100% PASS** (`tests/phase55-forensic-p0.test.ts` 7/7 passing, `tests/phase45a-auth-security.test.ts` passing, `tests/phase47-runtime-media-account.test.tsx` passing, `tests/release-integrity.test.ts` passing).
- Production Web Build: **PASS (`npm run build` in 2.19s)**.
- Android Capacitor Sync: **PASS (`npm run android:sync` in 0.16s)**.
- Android Debug APK Build: **PASS (`gradlew.bat assembleDebug` BUILD SUCCESSFUL in 22s)**.
- Live Render Backend Probe: **PASS (`node scratch/verify_phase55_prod.mjs` 100% against `https://veil-rga0.onrender.com`)**.
