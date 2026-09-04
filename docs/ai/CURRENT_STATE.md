# CURRENT_STATE.md — Verified Phase & System Status

## Current Verified Phase: RUNTIME FORENSIC FIX PASS (Group State, Reconnect Oscillation, Attachments & Chat Overview)
- **Status**: **COMPLETE & PRODUCTION-VERIFIED 100%**
- **Branch**: `main`
- **Verification Deliverables**:
  - Authoritative Dual-Account Verification Suite: `scripts/runtime-forensic-verification.ts` executed against live production relay `https://veil-rga0.onrender.com` (15/15 steps passing with code 0)
  - Full Test Suite: 354 test files, 1,016/1,016 tests passing (100% clean pass across all regression & acceptance suites)
  - Web App Build: `npm run build` in 1.86s with 0 errors
  - Release Manifest: `release/v1.0.0/manifest.json` updated with sha256 checksums

---

## Verified Subsystems & Runtime Proofs

### 1. Real Group Membership & Invite Propagation
- **Status**: **GREEN (Automated + Live Production Verified)**
- **Architecture & Fixes**:
  - In `src/group/groupManager.ts`, added `exportSenderKeyDistribution(session, groupId)` and made `processSenderKeyDistribution` & `decryptGroupMessage` accept `Uint8Array | string` (auto-converting base64 signing keys).
  - In `src/ui/app/AppState.tsx`:
    - `createGroup` & `addGroupMember`: enriched members with directory keys/mailboxes, used `creatorIdentityId: myDoc.identityId` and `senderSigningKey: myDoc.signingPublicKey`.
    - Inbound `GROUP_INVITE`: hydrated `GroupState`, ensured local member entry in `groupState.members`, and processed initial sender key distribution.
    - Inbound `GROUP_MESSAGE`: processed attached `senderKeyDistribution` before decryption, ensured sender exists in `groupState.members`, and decrypted group message.
    - Group message sending (`sendMessage`, `sendAttachments`, `sendVoiceMessage`): exported and attached `senderKeyDistribution`, used real `myDoc.identityId` and `myDoc.signingPublicKey`, and executed fanout across all member mailboxes.
    - Conversation header member count calculated via `Object.keys(activeConversation.groupState?.members || {}).length`.
- **Runtime Proof**:
  - Automated: `tests/critical-stability-p0.test.ts` Section 10 verifies multi-member sender key distribution, member addition, and member replies.
  - Live Relay: `scripts/live-production-test.ts` Step 8 verified live group creation, invite distribution, sender key broadcast, and member reply over Render production relay.

### 2. Delivery & Read Receipts Strictly Monotonic Progression
- **Status**: **GREEN (Automated + Live Production Verified)**
- **Architecture & Fixes**:
  - Bound local UI message IDs directly to wire delivery IDs via `explicitDeliveryId` in `encryptAndPackWireMessage` and passed `newMsg.id` across all outgoing send handlers.
  - In `src/messaging/readReceipts.ts`:
    - Enforced peer attribution: `cleanReader !== cleanAuth` strictly rejects forged receipts in 1-to-1 conversations.
    - Monotonicity guarantee: messages in status `READ` never regress to `DELIVERED_TO_RECIPIENT` or `SENT_TO_RELAY`.
    - Inbound read receipt traverses and marks all unread outgoing messages up to `lastReadMessageId` as `READ`.
  - Canonical visual mapping in `src/ui/components/ui/MessageStatus.tsx`:
    - `SENT_TO_RELAY` -> Single gray tick (`CheckIcon`)
    - `DELIVERED_TO_RECIPIENT` -> Double gray ticks (`CheckCheckIcon`, color `var(--veil-text-secondary)`)
    - `READ` -> Double accent colored ticks (`CheckCheckIcon`, color `var(--veil-accent-secondary)`)
- **Runtime Proof**:
  - Automated: `tests/critical-stability-p0.test.ts` Section 11 verifies strict monotonicity and peer attribution rejection; `tests/phase53-read-receipts.test.ts` passes 7/7 tests.
  - Live Relay: `scripts/live-production-test.ts` Step 6 & 7 verified Alice progression from `SENT_TO_RELAY` -> `DELIVERED_TO_RECIPIENT` -> `READ` upon Bob's receipts.

### 3. Media Direct Upload & Cloudflare R2 Authorization (Fail-Closed)
- **Status**: **GREEN (Automated + Live Production Verified)**
- **Architecture & Fixes**:
  - Removed client-side chunking/encryption overhead for media files; direct binary upload via `cloudClient.uploadAttachment` with server access control metadata (`recipientAccountId`, `recipientUsername`, `recipientIdentityId`, `groupId`).
  - Strict fail-closed error handling: if media upload fails or server rejects, status is set immediately to `FAILED` and no wire message is sent, preventing phantom "sent" messages.
  - Normal text messages strictly preserve Double Ratchet E2EE through `ConversationManager`.
  - Authorized recipient download: `cloudHandler.ts` authorizes uploader, direct recipients (by account ID or username), and group members.
- **Runtime Proof**:
  - Automated: `tests/critical-stability-p0.test.ts` Section 3 & 4; `tests/phase40-attachment-delivery.test.ts`.
  - Live Relay: `scripts/live-production-test.ts` Step 7 & 7b verified both encrypted attachment and raw media direct upload and download over Render relay.

### 4. Photo Media Durable Persistence (IndexedDB)
- **Status**: **GREEN (Automated Tested)**
- **Architecture & Fixes**:
  - `MediaCacheManager` in `src/ui/utils/mediaCache.ts` uses dedicated IndexedDB database (`veil_media_cache`, store `media`).
  - Checks IndexedDB before network refetch; persists downloaded media immediately.
  - In-flight request deduplication (`inFlight.set`) runs synchronously before async IndexedDB lookups, preventing duplicate concurrent network requests.
- **Runtime Proof**:
  - Automated: `tests/critical-stability-p0.test.ts` Section 6; `tests/phase37-media-restart.test.ts`.

### 5. Grouped Media Responsive Collage Layout
- **Status**: **GREEN (Automated Tested)**
- **Architecture & Fixes**:
  - In `src/ui/components/media/GroupedMediaGrid.tsx` and `src/styles/veil-components.css`:
    - 1 image: 100% full-width responsive preview.
    - 2 images: 2-column equal split (`grid-template-columns: repeat(2, 1fr)`).
    - 3 images: Telegram-style collage — left hero image spanning 2 rows (`grid-row: 1 / 3`, width ratio `1.6fr`), 2 stacked images on right (`1fr`).
    - 4 images: 2x2 symmetrical grid.
    - 5+ images: 2x2 grid with `+N` count overlay badge on 4th thumbnail.
  - Set `.veil-grouped-thumb` aspect-ratio to `auto` and added `min-width: 0`, `overflow: hidden` to eliminate card clipping.
- **Runtime Proof**:
  - Automated: `tests/phase43-grouped-media-combinations.test.ts` (3/3 passed); `tests/phase45d-media-rendering.test.tsx` (3/3 passed).

### 6. Voice Note Audio Card UI & Event Containment
- **Status**: **GREEN (Automated Tested)**
- **Architecture & Fixes**:
  - Compact layout: `[ ▶ / ⏸ ]  [FileAudioIcon] Audio message  [ 0:12 ]` with slim progress bar.
  - Replaced unicode emoji `🎵` with vector SVG `FileAudioIcon` (conforms to zero-emoji security rule).
  - Zero CPU waveform animations: static CSS progress bar without background requestAnimationFrame loops.
  - Full event barrier: `stopPropagation` on `onClick`, `onContextMenu`, `onTouchStart`, `onTouchMove`, `onPointerDown` preventing swipe-to-reply or message selection mode during playback.
- **Runtime Proof**:
  - Automated: `tests/phase31-chat-ui.test.tsx`, `tests/phase31-ui-components.test.tsx`, `tests/phase29-voice-message.test.ts`, `tests/critical-stability-p0.test.ts`.

### 7. Android Hardware Back Button & Soft Keyboard
- **Status**: **GREEN (Compilation & Build Verified)**
- **Architecture & Fixes**:
  - Android Back Button: Integrated `@capacitor/app` and wired hardware back-button listener in `AppState.tsx` with proper navigation hierarchy:
    Active Modal $\to$ Active Conversation $\to$ Active Search $\to$ Exit App.
  - Text Input / Backspace: Disabled Capacitor input interceptor (`android: { captureInput: false }` in `capacitor.config.ts`) ensuring smooth textarea typing and backspace handling.
- **Runtime Proof**:
  - Capacitor Android Sync: `npx cap sync android` with `@capacitor/app@8.1.1`.
  - Android APK Build: `cd android; .\gradlew.bat assembleDebug` built successfully in 22s (`android/app/build/outputs/apk/debug/app-debug.apk`, 4.59 MB).

---

## Live Production Relay Verification (`https://veil-rga0.onrender.com`)

| Step | Target | Result | Evidence |
|---|---|---|---|
| Step 1: Crypto Init | Local Space & Prekeys | **PASS** | Sealed under Argon2id |
| Step 2: Account Reg | Live Render Cloud | **PASS** | Registered disposable accounts `@alice_fn_...` & `@bob_fn_...` |
| Step 3: Network & WS | WebSocket Transport | **PASS** | 5 rapid `reconnectNow()` calls, 0 oscillation, stayed `connected` |
| Step 4: Group Creation | Group Manager | **PASS** | Group "team" created, Alice+Bob added, Alice state = 2 members |
| Step 5: Invite Transport | Relay & Bob Hydration | **PASS** | Bob received `GROUP_INVITE`, hydrated state = 2 members |
| Step 6: Bob Reload | Bob Client Storage | **PASS** | Reloaded Bob retains 2 members |
| Step 7: Bob Re-login | Bob Vault & Space | **PASS** | Bob locked space, fresh unlock retains 2 members |
| Step 8: Alice Reload | Alice Client Storage | **PASS** | Reloaded Alice retains 2 members |
| Step 9: Group Msg (A->B) | Group Sender Key Wire | **PASS** | Alice group message decrypted by Bob: "Hey team! This is Alice." |
| Step 10: Group Msg (B->A) | Group Sender Key Wire | **PASS** | Bob group reply decrypted by Alice: "Hey Alice! Bob received it..." |
| Step 11: Photo Attachments | Cloudflare R2 Cloud | **PASS** | Alice uploaded 3 photos, Bob downloaded all 3 (NO 404 access denied!) |
| Step 12: Dual Restart | Client State Persistence | **PASS** | Both sessions restarted, group = 2 members on both devices |
| Step 13: DM Receipts (A->B) | Direct Message & Read | **PASS** | Progression: 1 tick -> 2 gray ticks -> 2 colored ticks (READ) |
| Step 14: DM Receipts (B->A) | Direct Message & Read | **PASS** | Reverse DM read receipt processed -> 2 colored ticks (READ) |
| Step 15: Clean Disconnect | WebSocket Transport | **PASS** | Clean teardown without error or lingering sockets |
