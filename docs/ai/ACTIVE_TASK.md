# ACTIVE_TASK.md — Active Work Tracker

## Active Phase: CRITICAL RUNTIME FIX PASS (Groups • Receipts • Media • Audio • Layout • Performance)
- **Status**: **COMPLETE & PRODUCTION-VERIFIED 100%**
- **Branch**: `main`
- **Output Report**: `docs/ai/CURRENT_STATE.md`

### Completed Tasks
- [x] **Real Group Membership & Invite Propagation**:
  - Implemented `exportSenderKeyDistribution` and made group sender key processing accept `Uint8Array | string`.
  - Added full member enrichment, directory mailbox resolution, and local member entry in `AppState.tsx`.
  - Wired group fanout for messages, attachments, and voice notes.
  - Calculated conversation header member count from `groupState.members`.
  - Verified multi-member sender key distribution, member addition, and member replies.
- [x] **Delivery & Read Receipts Monotonic Progression**:
  - Bound local UI message IDs directly to wire delivery IDs via `explicitDeliveryId`.
  - Enforced peer attribution in `readReceipts.ts` (`cleanReader !== cleanAuth` rejects forged receipts).
  - Enforced strict monotonic progression (`SENT_TO_RELAY` $\to$ `DELIVERED_TO_RECIPIENT` $\to$ `READ`, never regressing).
  - Configured canonical UI indicators in `MessageStatus.tsx` (single gray tick, double gray ticks, double colored ticks).
- [x] **Media Direct Upload & Access Control (Fail-Closed)**:
  - Direct binary upload via `cloudClient.uploadAttachment` with server access control.
  - Fail-closed error handling: on upload failure, sets status immediately to `FAILED` and aborts wire envelope.
  - Maintained Double Ratchet E2EE for all text messages.
- [x] **Grouped Media Collage Layout**:
  - 1 image: 100% width.
  - 2 images: 2-column equal split.
  - 3 images: Telegram-style collage (left hero spanning 2 rows 1.6fr, 2 stacked on right 1fr).
  - 4 images: 2x2 grid.
  - 5+ images: 2x2 grid with `+N` badge.
  - Fixed `.veil-grouped-thumb` aspect-ratio from `1 / 1` to `auto`.
- [x] **Voice Note Audio Card UI & Event Containment**:
  - Compact layout: `[ ▶ / ⏸ ]  [FileAudioIcon] Audio message  [ 0:12 ]` with progress bar.
  - Vector SVG `FileAudioIcon` replacing unicode emoji.
  - Event containment (`stopPropagation`, `preventDefault`) on click, contextmenu, pointer, touch preventing swipe-to-reply.
- [x] **Performance & Lag Elimination**:
  - Removed client chunking/encryption overhead on media files.
  - Synchronous `MediaCache` inFlight deduplication.
- [x] **Android Hardware Back Button & Soft Keyboard**:
  - Wired `@capacitor/app` back-button listener respecting navigation hierarchy (Modal $\to$ Chat $\to$ Search $\to$ Exit).
  - Disabled Capacitor input capture (`captureInput: false`) resolving backspace swallowing.
- [x] **Automated Verification & Packaging**:
  - Primary stability test suite passing (6/6 tests).
  - Vite production bundle built successfully in 2.29s (`npm run build`).
  - Capacitor Android synced (`npx cap sync android`).
  - Android debug APK assembled successfully in 22s (`app-debug.apk`, 4.59 MB).
  - Live production relay test suite passed 100% against `https://veil-rga0.onrender.com`.
