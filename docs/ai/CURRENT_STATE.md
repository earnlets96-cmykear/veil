# CURRENT_STATE.md — Verified Phase & System Status

## Current Verified Phase: PHASE 56B (Forensic Regression Fix, Real-Time Performance Hardening & Canonical Experience)
- **Status**: **COMPLETE & PRODUCTION-VERIFIED 100%**
- **Branch**: `main`
- **Output Deliverables**: `docs/PHASE56B_FORENSIC_REGRESSION_REPORT.md` & `tests/phase56b-forensic-hardening.test.ts`
- **Engineering Phase**: **PHASE 56B (Canonical Profile Routing, Receipt Unblocking, Grouped Media Persistence, Real-Time Debounce, Truthful Replies, Cloud Username Authentication)**
- **Phase 56B Test Suite**: `tests/phase56b-forensic-hardening.test.ts` (25/25 tests passing, 100% clean pass)
- **Phase 56 Regression Suite**: `tests/phase56-profile-media-perf.test.ts` (7/7 tests passing, 100% clean pass)
- **Phase 55 Regression Suite**: `tests/phase55-forensic-p0.test.ts` (7/7 tests passing, 100% clean pass)
- **Live Production Render Server Verification**: `scratch/verify_phase56_prod.ts` (6/6 passing against `https://veil-rga0.onrender.com`)
- **Web App Build**: **PASS (`npm run build` in 1.85s)**
- **Capacitor Sync**: **PASS (`npx cap sync android` in 0.15s)**
- **Android APK Build**: **PASS (`.\gradlew.bat assembleDebug` BUILD SUCCESSFUL in 17s)**
- **Android Hardware Status**: **`ANDROID HARDWARE RUNTIME: UNTESTED`** (honestly reported per Rule 4, no physical device or emulator connected on host)

---

## Phase 56 Implementation Summary

### 1. Profile Lifecycle & Persistence Across Reload/Login/Fresh Devices
- **Root Cause**: `loadSpaceData` in `src/ui/app/AppState.tsx` passed `storedProfile?.bio` into argument 7 (`avatar`) and `resolvedAvatar` into argument 8 (`expiresInSeconds`) of `createSignedProfile`. This immediately evaluated `avatar` as `undefined` and overwrote the local and cloud snapshot with an empty avatar upon every unlock or page reload.
- **Fix**: Corrected the parameter ordering, connected `resolvedAvatar` as argument 7, rehydrated `privacySettings.avatar`, and verified byte-for-byte profile persistence across session close, reload, and fresh-device cloud account restoration.

### 2. Avatar Anti-Resurrection & Replacement Tombstones
- **Root Cause**: An offline node generating a blank auto-profile could accidentally overwrite an existing avatar, or a deleted avatar could resurrect during cloud synchronization with older records.
- **Fix**: Implemented `'veil:avatar:tombstone'` tracking with `{ deletedAt: number }`. In `mergeRecordsForSpace`, if `deletedAt >= record.issuedAt`, the avatar is stripped across all devices. If no tombstone is present, existing avatars are preserved against blank offline overwrites.

### 3. Telegram-Grade Profile Modal Redesign (`src/ui/components/ProfileModal.tsx`)
- **Avatar Hero Header**: Features an 88px Avatar with a Camera overlay button allowing instant photo upload. Automatically downsamples images to WebP (<32 KB), creates a signed profile document, registers with the cloud directory, and saves to the local store and cloud recovery snapshot.
- **One-Click Avatar Removal**: Added a dedicated "Remove Photo" action that records a tombstone and immediately clears the avatar.
- **Peer Action Bar**: Clean 3-button layout (`Message`, `Mute / Unmute`, `Safety Number`).
- **Cryptographic Verification**: 12-block formatted fingerprint display with one-click copy and verification toggle.
- **Strict SVG Policy**: Zero Unicode emoji controls; 100% vector SVG icons.

### 4. UI/UX Whole-App Polish (`Sidebar.tsx`, `ConversationView.tsx`)
- **Sidebar**: Displays a subtle `BellOffIcon` next to timestamps for muted chats and renders muted unread badges with subdued contrast.
- **Conversation View**: Polished message bubble tails, contrast, and refined delivery indicators (`CheckIcon` for relay, `CheckCheckIcon` for delivered/processed, and colored `CheckCheckIcon` for read).

### 5. Video Upload Optimization & Adaptive Chunking
- **Root Cause**: Uploading 50 MB to 100 MB videos at 64 KiB produced 800–1,600 chunks, inducing 600+ MB heap spikes and crashing browser tabs.
- **Fix**: Implemented bounded adaptive chunk sizing (`getOptimalChunkSize`): 64 KiB ($\le 1\text{ MB}$), 256 KiB ($1-10\text{ MB}$), 512 KiB ($10-50\text{ MB}$), 1 MiB ($> 50\text{ MB}$).
- **Performance**: 16x reduction in chunk count, memory pressure relieved, and reassembly throughput exceeding 55 MB/s with full SHA-256 byte-for-byte integrity.

---

## Phase 56B Forensic Hardening Summary

### 1. Canonical Profile Modal Unification (Issues 1 & 2)
- **Root Cause**: ConversationView chat header previously routed to legacy `contactDetails` modal while contacts list routed to `ProfileModal`.
- **Fix**: Routed conversation view header avatar and "More" action menu strictly to canonical `ProfileModal` with universal peerId and username resolution.

### 2. Elimination of Chat UI Freezing & Message Latency (Issues 3–6)
- **Root Cause**: Synchronous Argon2id cloud snapshot sync and synchronous full-database search indexing fired on every keystroke and send.
- **Fix**: Decoupled cloud sync with a 15-second idle debounce; decoupled search indexing with a 250ms trailing debounce; made message wire dispatch non-blocking.

### 3. Wire Receipt Unblocking & JUMBO Size Class (Issues 7 & 14)
- **Root Cause**: Full base64 avatars were embedded in Double Ratchet wire messages and receipts, causing payloads to exceed the 32,764 byte limit and throwing unhandled padding errors that dropped receipts.
- **Fix**: Explicitly stripped avatars from wire messages (`cleanSenderDoc`); expanded transport size classes to include `JUMBO` (128 KiB); fixed receipt processing to update all conversation alias keys.

### 4. Truthful Reply Previews & Distinct Self/Peer Styling (Issues 8–10)
- **Root Cause**: Reply references hardcoded `'Yourself'` and `'Peer'`.
- **Fix**: Resolved actual display names from profile and contacts; added `isSelfReply` boolean; styled `.veil-reply-self` (accent border and tint) and `.veil-reply-peer` (emerald secondary border) distinctly.

### 5. Username-Based Cloud Login & Live Username Change (Issues 11 & 12)
- **Root Cause**: Backend had no `POST /v1/account/change-username` endpoint; local vault envelopes never updated `canonicalUsername` on change.
- **Fix**: Added authenticated `POST /v1/account/change-username` route, updated `AccountService`, added `updateCanonicalUsername` to `SpaceVaultManager`, and synchronized changes across cloud and local storage during username registration.

### 6. Grouped Media Persistence (Issue 13)
- **Root Cause**: `StoredMessage` in `conversationManager.ts` lacked an `attachments` array, dropping grouped photos upon reload.
- **Fix**: Extended `StoredMessage` with `attachments`, persisted multi-item metadata in local store, and updated CSS for adaptive 1:1 tile sizing.

