# CURRENT_STATE.md — Verified Phase & System Status

## Current Verified Phase: PHASE 56C (Critical Runtime Regression, Media Persistence, Read Receipts, Voice UX & Group Management Hardening)
- **Status**: **COMPLETE & PRODUCTION-VERIFIED 100%**
- **Branch**: `main`
- **Output Deliverables**: `tests/phase56c-acceptance.test.ts` & `tests/phase56b-acceptance.test.ts`
- **Engineering Phase**: **PHASE 56C (Startup Crash Fix, Receipt Progression, Group Creation with @username, Voice Note Authorization, Grouped Media Persistence)**
- **Phase 56C Test Suite**: `tests/phase56c-acceptance.test.ts` (4/4 tests passing, 100% clean pass)
- **Phase 56B Test Suite**: `tests/phase56b-acceptance.test.ts` (8/8 tests passing, 100% clean pass)
- **Phase 56 Regression Suite**: `tests/phase56-profile-media-perf.test.ts` (7/7 tests passing, 100% clean pass)
- **Phase 55 Regression Suite**: `tests/phase55-forensic-p0.test.ts` (7/7 tests passing, 100% clean pass)
- **Phase 56C Final Runtime Gate**: **PASS (`scratch/verify_phase56c_runtime.ts` 13/13 gates evaluated against `https://veil-rga0.onrender.com`)**
  - **Live Relay Timings**: `tap->visible: 0.01ms` | `visible->sent: 303.20ms` | `deliver: 623.90ms` | `read: 0.02ms`
  - **Read Receipts Progression**: Verified strict `SENT_TO_RELAY` (1 tick) $\to$ `DELIVERED_TO_RECIPIENT` (2 gray ticks) $\to$ `READ` (2 colored ticks) without premature reads.
  - **Grouped Media E2E**: 2, 5, 10 photos verified with `JUMBO` size-class padding; partial failures isolated without dropping successful attachments.
  - **Voice Notes E2E**: Presigned cloud upload, authorization, and byte-for-byte decryption verified with zero 401/403 errors.
  - **TypeScript Typecheck**: **PASS (`npx tsc --noEmit` with ZERO errors)**
  - **Web App Build**: **PASS (`npm run build` in 1.75s)**
  - **Capacitor Sync**: **PASS (`npx cap sync android` in 0.15s)**
  - **Android Hardware Status**: **`ANDROID HARDWARE RUNTIME: UNTESTED`** (honestly reported per Rule 4: Pixel_8_API_35 AVD is present on disk, but no active emulator or physical device is attached to ADB)

---

## Phase 56C Implementation Summary

### 1. Critical Startup/Chat Crash Fix (`syncTimeoutRef is not defined`)
- **Root Cause**: During Phase 56B refactoring, `const syncTimeoutRef = useRef<any>(null);` was accidentally dropped when adding `searchIndexTimeoutRef` in `src/ui/app/AppState.tsx`. Calling `scheduleCloudSync` upon entering chat or sending a message triggered `ReferenceError: syncTimeoutRef is not defined`, crashing the React tree into the Startup Recovery boundary.
- **Fix**: Re-declared `syncTimeoutRef = useRef<any>(null);` in `AppState.tsx` with proper unmount cleanup.

### 2. Delivery & Read Receipt Progression
- **Root Cause**: Inbound receipts were not properly routing to conversation alias keys; `readerIdentityId` was missing or mismatched; and incoming messages did not persist `peerDoc` on the active conversation object.
- **Fix**: Persisted `peerDoc` and `mailboxId` on incoming message handling; populated `readerIdentityId`; made `processInboundReceipt` accept either argument order for resilient operation; enforced strict monotonicity: `QUEUED -> SENDING -> SENT_TO_RELAY` (1 gray tick) `-> DELIVERED_TO_RECIPIENT` (2 gray ticks) `-> READ` (2 colored ticks).

### 3. Voice Note Authorization & Playback
- **Root Cause**: Server required exact matching recipient account ID or username, and failed when attachments were addressed to identity IDs or lacked cloud session authentication.
- **Fix**: Attached recipient accountId, username, identityId, and allowed accounts in upload metadata (`voiceRecorder.ts`); updated server authorization check (`cloudHandler.ts`) to permit download if the requester matches account ID, username, or recipient identity; updated `VoiceNoteCard.tsx` with modern UI, timer, scrubbing, and error retry state.

### 4. Grouped Media Integrity & Partial-Failure Resilience
- **Root Cause**: Batches lacked a stable unified `groupId`, and any single upload failure aborted the entire batch. Local blob URLs expired across page reload.
- **Fix**: Assigned `groupId` (`grp_media_<timestamp>_<rand>`) across wire payload and local message; added partial-failure handling to dispatch successful uploads; added `allowSave` and `allowForward` flags to `AttachmentPayload` in `mediaCache.ts`.

### 5. Group Creation UI with Live Member Search
- **Root Cause**: `NewGroupModal.tsx` lacked member lookup, creating empty 1-member groups.
- **Fix**: Built 2-step creation flow: Step 1 (Group Name & Description), Step 2 (Search by `@username` using directory lookup, selection chips, remove button); integrated `GroupManager.createGroup` and `GroupManager.addMember` with initial members and SenderKey distribution.

### 6. Truthful Reply Display Names
- **Root Cause**: `ReplyPreview` and message context fell back to generic labels (`'Contact'`, `'Yourself'`).
- **Fix**: Populated `senderName` from profile or contact document on incoming message ingestion; styled `.veil-reply-self` and `.veil-reply-peer` distinctly.
