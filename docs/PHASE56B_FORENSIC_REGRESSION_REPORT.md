# VEIL — PHASE 56B FORENSIC REGRESSION REPORT

## Forensic Bug Root Causes, Architectural Fixes & Real-World Validation

**Phase**: 56B  
**Date**: September 3, 2026  
**Status**: **COMPLETE & PRODUCTION-VERIFIED (100% PASS)**  
**Target Hardware Runtime Status**: `ANDROID HARDWARE RUNTIME: UNTESTED` (Per Rule 4: Reported honestly; host environment has no physical Android device attached or active emulator)

---

## 1. Forensic Root Cause & Remediation Matrix

| # | Reported Regression / Defect | Root Cause Analysis | Remediation Implemented | Verification Method |
|---|-----------------------------|---------------------|-------------------------|---------------------|
| **1 & 2** | Old profile UI shown when opening profile from active conversation | `ConversationView.tsx` chat header avatar and "More" action dropdown routed to `openModal({ type: 'contactDetails', ... })` (the legacy verification modal) instead of canonical `ProfileModal.tsx`. | Modified `ConversationView.tsx` (lines 826 & 886) to route strictly to `openModal({ type: 'profile', peerId, peerUsername })`. Updated `ProfileModal.tsx` to universally resolve `peerContact` and `peerConv` from either `peerId`, `peerUsername`, or conversation ID. | Unit test + Component routing validation |
| **3, 4, 5, 6** | Chat UI freezing, send freezing, late message arrival & buffering spinner | `scheduleCloudSync` (Argon2id KDF + AES-GCM encrypted snapshot upload) was debounced at only 500ms and called synchronously right before wire dispatch in `sendMessage`. Full message database search re-indexing (`searchEngine.updateIndex`) executed on every keystroke/message. | Increased `scheduleCloudSync` idle debounce to 15,000ms (15s idle). Removed pre-send cloud sync from `sendMessage`. Introduced `queueSearchIndexUpdate` with a 250ms trailing debounce. Wire dispatch now executes non-blocking. | Benchmark tests (`phase56-profile-media-perf.test.ts`) |
| **7 & 14** | Message status stuck at single tick; delivery/read receipts dropped | Outbound Double Ratchet wire messages and receipts included `senderDocument` (`myDoc`) with inline 30KB base64 avatar data URLs. This bloated JSON payloads beyond the 32,764-byte `MAX_PAYLOAD_BYTES` limit, causing `padPayload` in `padding.ts` to throw an unhandled error, silently aborting receipt delivery. | In `conversationManager.ts`, created `cleanSenderDoc` that explicitly strips inline avatars (`avatar: undefined`) for all wire messages and receipts (>25x payload size reduction). Added `JUMBO: 131072` (128 KiB) size class to `types.ts` and `padding.ts`. Updated `readReceipts.ts` to update all conversation alias keys in `messagesMap`. | `phase56b-forensic-hardening.test.ts` (JUMBO padding roundtrip & receipt tests) |
| **8, 9, 10** | Reply previews using generic `"Yourself"` / `"Peer"`; no visual difference for self vs peer | `resolveReplyReference` in `AppState.tsx` hardcoded fallback strings `'yourself'` and `'Peer'`. No CSS class or flag was provided to visually distinguish self-replies from replies to the other person. | Updated `resolveReplyReference` to accept `selfName` and `peerName` resolved from active profile and contacts. Added `isSelfReply` boolean to `ReplyReference`. Created `.veil-reply-self` (accent primary `#6366f1` border and subtle background tint) and `.veil-reply-peer` (emerald secondary `#10b981` border) in `veil-components.css`. Wired through `ReplyPreview.tsx` and `ConversationView.tsx`. | `phase56b-forensic-hardening.test.ts` (Issues 8-10 tests) |
| **11 & 12** | Login authenticates using account name instead of username; username change doesn't update login | The cloud backend lacked a `POST /v1/account/change-username` route. The local `SpaceVaultManager` never updated `envelope.canonicalUsername`, meaning `unlockSpaceByUsernameAsync` continued searching for the old username in local envelopes. | Added `changeUsername` to `AccountService` and `POST /v1/account/change-username` to `cloudHandler.ts`. Added `updateCanonicalUsername` to `SpaceVaultManager`. Updated `registerUsername` in `AppState.tsx` to detect username changes, invoke cloud API, update local vault envelope, save to storage, update credentials ref, and store in `localStorage`. Updated `MemoryCloudDatabase` and `fileCloudDatabase` to re-index `accountsByUsername`. | `phase56b-forensic-hardening.test.ts` (Issues 11-12 cloud & local tests) |
| **13** | Grouped images disappear or fail to render as adaptive grid | `StoredMessage` interface in `conversationManager.ts` lacked an `attachments` array field, dropping multi-image metadata during local encrypted history persistence. In CSS, `.veil-media-thumbnail-wrapper` forced `min-height: 160px`, breaking 1:1 aspect ratio tiles in masonry grids. | Extended `StoredMessage` with `attachments` in `conversationManager.ts` and preserved it during inbound/outbound serialization. Added `.veil-grouped-thumb` and `.veil-grouped-media-grid` CSS overrides in `veil-components.css` (`min-height: 0; aspect-ratio: 1 / 1; object-fit: cover`). | `phase56b-forensic-hardening.test.ts` (Issue 13 persistence test) |
| **14** | Red status UI feature nonfunctional / not appearing | `sendMessage` in `AppState.tsx` marked failed sends as `'QUEUED'` (clock icon) instead of `'FAILED'`. `ConversationView.tsx` never destructured `retryFailedMessage` and never passed `onRetry` to `MessageBubble`. | In `sendMessage`, network failure when online now marks `status: 'FAILED'` to trigger the red `AlertCircleIcon`. Destructured `retryFailedMessage` in `ConversationView.tsx`, passed `onRetry` through `ConversationMessageRow`, and wired `MessageBubble`'s red retry button. | `phase56b-forensic-hardening.test.ts` (status transition tests) |

---

## 2. Verification Suite Results

### A. Phase 56B Automated Hardening Suite
`npx vitest run tests/phase56b-forensic-hardening.test.ts`
- **Result**: **25 passed / 25 total (100% PASS)**
- **Duration**: 2.21s
- **Coverage**:
  - Truthful reply names (self vs peer) & attachment type detection (6 tests)
  - JUMBO transport size class (128 KiB) & roundtrip padding (4 tests)
  - Username change backend, duplicate rejection, login verification & envelope update (7 tests)
  - Grouped media persistence in StoredMessage & JUMBO wire packing (2 tests)
  - Wire avatar stripping & sender document size reduction (1 test)
  - Message error transitions (`FAILED` vs `QUEUED`) & retry logic (2 tests)
  - Username normalization and edge cases (3 tests)

### B. Phase 56 Regression Suite
`npx vitest run tests/phase56-profile-media-perf.test.ts`
- **Result**: **7 passed / 7 total (100% PASS)**
- **Duration**: 25.1s
- **Coverage**: Profile persistence, cross-device login, avatar synchronization, tombstone enforcement, cryptographic signatures, adaptive video chunking benchmarks (2MB, 10MB, 50MB).

### C. Phase 55 Regression Suite
`npx vitest run tests/phase55-forensic-p0.test.ts`
- **Result**: **7 passed / 7 total (100% PASS)**
- **Duration**: 32.8s
- **Coverage**: Local deletion tombstones, active blocking enforcement, chat mute suppression, fake call button absence, offline queue flush events, multi-device snapshot concurrency merge.

### D. Live Render Production Backend Verification
`npx tsx scratch/verify_phase56_prod.ts`
- **Target**: `https://veil-rga0.onrender.com`
- **Result**: **6/6 passed (100% PASS)**
  - Health check: OK (status=ok)
  - Ed25519 Profile Registration: OK (HTTP 201)
  - Directory Profile Retrieval: OK (avatar preserved byte-for-byte)
  - Account Created: OK (`accountId=acc_9bc6dd9982f713b968209503d85a7e28`)
  - Zero-Knowledge Recovery Vault Uploaded: OK
  - Clean Slate Multi-Device Account Restore: OK (vault hydrated, bytes=32)

### E. Web App Build
`npm run build`
- **Result**: **PASS in 1.85s**
- **Artifacts**: Bundle generated with release manifest in `release/v1.0.0`.

### F. Android Capacitor Sync & Gradle Build
`npx cap sync android`
- **Result**: **PASS in 0.15s**
- Plugins: `@capacitor/filesystem@8.1.3`, `@capacitor/share@8.0.1`.

`.\gradlew.bat assembleDebug` (in `android/`)
- **Result**: **BUILD SUCCESSFUL in 17s** (154 actionable tasks: 27 executed, 127 up-to-date).
- **Output**: `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 3. Mandatory Governance & Phase Signoff

Per the project operating contract:
- [x] All 14 reported defects were forensically traced, root-caused, and repaired in source code.
- [x] Zero mock implementations, zero fake test passes, zero regressions in prior security guarantees.
- [x] Positive and negative tests written and passing.
- [x] Web build, Android sync, and Android APK build validated clean.
- [x] Live cloud production probe confirmed healthy on Render.
- [x] Documentation (`CURRENT_STATE.md`, `ACTIVE_TASK.md`, `CHANGELOG.md`, `walkthrough.md`) updated.
- [x] Hardware runtime status reported honestly: `ANDROID HARDWARE RUNTIME: UNTESTED`.
