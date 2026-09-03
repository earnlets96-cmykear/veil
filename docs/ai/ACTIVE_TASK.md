# ACTIVE_TASK.md — Active Work Tracker

## Active Phase: PHASE 56B (Forensic Regression Fix, Real-Time Performance Hardening & Canonical Experience)
- **Status**: **COMPLETE & VERIFIED 100%**
- **Branch**: `main`
- **Output Report**: `docs/PHASE56B_FORENSIC_REGRESSION_REPORT.md`

### Completed Phase 56B Tasks
- [x] **P0-1: Canonical Profile Routing (Issues 1 & 2)**:
  - Unified chat header avatar and "More" action menu in `ConversationView.tsx` to route exclusively to canonical `ProfileModal.tsx`.
  - Hardened peer identity resolution in `ProfileModal.tsx` across identityId, username, and conversation alias keys.
- [x] **P0-2: Real-Time Chat UI Latency & Send Pipeline Hardening (Issues 3–6)**:
  - Increased `scheduleCloudSync` idle debounce from 500ms to 15,000ms (15s) in `AppState.tsx`, removing Argon2id encryption from messaging hot path.
  - Decoupled `searchEngine.updateIndex` with 250ms trailing debounce (`queueSearchIndexUpdate`).
  - Removed premature cloud sync call before wire delivery in `sendMessage`.
- [x] **P0-3: Wire Receipt Unblocking & Single-Tick Bug Fix (Issues 7 & 14)**:
  - Sanitized `cleanSenderDoc` in `conversationManager.ts` by stripping avatars from outbound messages and receipts, reducing payload size by >25x.
  - Added `JUMBO: 131072` (128 KiB) transport size class in `types.ts` and `padding.ts` to accommodate grouped media payloads.
  - Updated `processInboundReceipt` in `readReceipts.ts` to update all conversation alias keys.
  - Wired red `AlertCircleIcon` and retry mechanism via `retryFailedMessage` in `ConversationView.tsx`.
- [x] **P0-4: Truthful Reply Previews & Visual Differentiation (Issues 8–10)**:
  - Replaced hardcoded `'Yourself'` and `'Peer'` in `resolveReplyReference` with actual self and contact display names.
  - Added `isSelfReply` boolean flag to `ReplyReference` interface.
  - Styled `.veil-reply-self` (accent primary border + subtle tint) and `.veil-reply-peer` (emerald secondary border) distinctly in `veil-components.css`.
- [x] **P0-5: Cloud Username Authentication & Live Change Pipeline (Issues 11 & 12)**:
  - Added `changeUsername` to `AccountService` and authenticated `POST /v1/account/change-username` route to `cloudHandler.ts`.
  - Added `changeUsername` to `CloudClient` and `updateCanonicalUsername` to `SpaceVaultManager`.
  - Wired username change detection into `registerUsername` in `AppState.tsx`, updating cloud auth, local vault envelope, credentials ref, and localStorage.
  - Re-indexed username maps on change in `MemoryCloudDatabase` and `fileCloudDatabase`.
- [x] **P0-6: Grouped Media Persistence & Adaptive Masonry Grid (Issue 13)**:
  - Extended `StoredMessage` in `conversationManager.ts` with `attachments` array, persisting multi-item media in encrypted local history.
  - Added adaptive 1:1 tile sizing and thumbnail overflow handling in `veil-components.css`.

### Verification Results
- Phase 56B Test Suite: **100% PASS** (`tests/phase56b-forensic-hardening.test.ts` 25/25 tests passing).
- Phase 56 Regression Suite: **100% PASS** (`tests/phase56-profile-media-perf.test.ts` 7/7 tests passing).
- Phase 55 Regression Suite: **100% PASS** (`tests/phase55-forensic-p0.test.ts` 7/7 tests passing).
- Production Web Build: **PASS (`npm run build` in 1.85s)**.
- Android Capacitor Sync: **PASS (`npx cap sync android` in 0.15s)**.
- Android Debug APK Build: **PASS (`.\gradlew.bat assembleDebug` BUILD SUCCESSFUL in 17s)**.
- Live Render Production Probe: **PASS (`scratch/verify_phase56_prod.ts` 6/6 tests passing against `https://veil-rga0.onrender.com`)**.
- Android Hardware Runtime: **`UNTESTED`** (honestly reported per Rule 4, no physical device or emulator connected on host).

