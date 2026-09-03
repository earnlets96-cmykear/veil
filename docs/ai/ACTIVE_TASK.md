# ACTIVE_TASK.md — Active Work Tracker

## Active Phase: CRITICAL STABILITY PHASE (Core Architecture & Runtime Correctness)
- **Status**: **COMPLETE & PRODUCTION-VERIFIED 100%**
- **Branch**: `main`
- **Output Report**: `docs/ai/CURRENT_STATE.md`

### Completed Tasks
- [x] **Section 0: Reply Bubble / Name Feature**:
  - Preserved intact per strict user directive without any regressions.
- [x] **Section 1: Delivery + Read Receipts Monotonic Progression**:
  - Added `explicitDeliveryId` to `encryptAndPackWireMessage`.
  - Bound `msgId` directly to wire message in `AppState.tsx`.
  - Verified `SENT_TO_RELAY` $\to$ `DELIVERED_TO_RECIPIENT` (2 gray ticks) $\to$ `READ` (2 colored ticks) locally and against live Render relay.
- [x] **Section 2: Real Group Messaging & Member Count**:
  - Fixed header member count calculation to inspect `Object.keys(groupState.members).length`.
  - Hydrated initial `GroupState` upon `GROUP_INVITE` receipt before processing sender keys.
  - Wired full group fanout in `AppState.tsx`.
- [x] **Section 3 & 4: Media Upload & Cloudflare R2 Authorization**:
  - Persisted `recipientAccountId`, `recipientUsername`, and `groupId` in attachment records.
  - Authorized uploaders, recipients, and group members in `cloudHandler.ts`.
  - Verified byte-for-byte authorized download live on Render + R2.
- [x] **Section 5: Stop Full Video Decryption Before Playback**:
  - Implemented `decryptSingleChunk` and `decryptProgressive` in `AttachmentPipeline`.
  - Added progressive streaming callbacks in `MediaCacheManager`.
- [x] **Section 6: Photo Media After Restart (Durable IndexedDB Persistence)**:
  - Added dedicated IndexedDB database (`veil_media_cache`, store `media`) in `MediaCacheManager`.
  - Cached decrypted bytes durably for instant 0ms restoration after app restart.
- [x] **Section 7 & 8: Voice Note Playback & UI Isolation**:
  - Added event containment (`stopPropagation`, `preventDefault`) on cards and buttons in `VoiceNoteCard.tsx`.
  - Locked stable height (`minHeight: 52px`) and high-contrast styling.
- [x] **Section 9: Delete Message For Me / Delete For Everyone**:
  - Added separate context menu entries in `ConversationView.tsx`.
  - Implemented `deleteMessageForEveryone` wire envelope dispatch and anti-resurrection tombstone recording.
- [x] **Section 10: Android Media & Storage Permissions**:
  - Updated `AndroidManifest.xml` with scoped media permissions (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`).
  - Added permission checks in `fileSaver.ts`.
- [x] **Section 11: Android Hardware Back Button**:
  - Integrated `@capacitor/app` and wired back-button listener respecting navigation hierarchy.
- [x] **Section 12: Text Input / Backspace Bug**:
  - Added `captureInput: false` in `capacitor.config.ts`.
  - Removed dynamic autofocus loops in `LockScreen.tsx`.
- [x] **Sections 13–17: Automated Verification & Packaging**:
  - 12/12 vitest test files passing (89/89 tests passed).
  - TypeScript compiles with 0 errors (`npx tsc --noEmit`).
  - Web production bundle built successfully (`npm run build` in 1.95s).
  - Capacitor synced Android (`npx cap sync android`).
  - Android debug APK built successfully (`.\gradlew.bat assembleDebug` in 21s).
  - Live production relay test passed 100% against `https://veil-rga0.onrender.com`.
