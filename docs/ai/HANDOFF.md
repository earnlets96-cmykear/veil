# HANDOFF.md — AI Agent Session Handoff

## Phase 115 Update — Touch Context Menu Dismissal
- Fixed the mobile dismissal race: touch pointerdown no longer unmounts capture listeners before touchstart can be absorbed. The nested text bubble also filters touch-generated native contextmenu events so one hold cannot compete with the custom timer and flicker.
- Mouse/non-touch pointer dismissal and desktop right-click remain supported.
- Regression verification: context menu, sticker touch, and audio scrubber context isolation suites passed (25 tests); `npm run typecheck` passed. Impeccable detector reported only pre-existing side-tab/bounce-easing patterns elsewhere in `ConversationView.tsx` (lines 2735, 440, 479).
- Scope is UI gesture handling only; no crypto, identity, or message protocol changes.

## Phase 114 Update — Android Background Push
- Implemented opt-in Android FCM background alerts with a data-only `kind=message` payload. Only text/media/voice sends include a one-bit `notifyRecipient` hint; read receipts/control envelopes do not trigger pushes. Native code ignores server-supplied display content and shows fixed generic text.
- Added capability-authenticated token register/unregister endpoints, relay store persistence (memory/file/PostgreSQL migration), FCM HTTP v1 service-account OAuth, token cleanup, and one-mailbox-per-device-token reassignment.
- Added Settings disclosure and enable/disable control. Silent Counter automatically turns push off. Push remains disabled until the user opts in.
- Added `docs/PUSH_NOTIFICATIONS.md`, `docs/ai/THREAT_MODEL_PUSH.md`, ADR-127, phase docs, and `tests/phase114-push-delivery.test.ts`.
- Verification: push-focused suites passed (10 tests), related notification/sticker suites passed (9 tests), and `npm run typecheck` passed. Full suite was interrupted with widespread sandbox loopback/recovery endpoint failures and no final summary. Gradle/device validation remains outstanding due daemon loopback restrictions.
- External activation still needs Firebase app config at `android/app/google-services.json` plus relay env `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT_JSON`. The service-account key must stay server-side.
- Production deployment remains gated on independent security review, explicit dual sign-off, Firebase setup, and physical Android validation.
- Preserve unrelated existing edits: `android/app/src/main/assets/public/index.html`, `release/v1.0.0/checksums.sha256`, `release/v1.0.0/manifest.json`, `business-card/`. The interrupted full test run also left untracked `.veil_persist_regression_temp/` and `.veil_test_sql_recovery_suite/`; inspect before cleanup.

## Phase 111 Update — Sticker Responses & Outbound Queue
- Fixed sticker fetches to reject non-image HTTP 200 bodies and continue through image proxies.
- Fixed `syncMailbox` to flush queued outbound envelopes after an empty successful fetch; queued message status now reflects `QUEUED`.
- Dedicated regressions reproduce both failures and pass after fixes. 8 focused suites / 84 tests pass; TypeScript and production Vite build pass.
- Existing local-relay integration tests cannot open loopback sockets in this sandbox (`EACCES`).

## Phase 110 Update — Dedicated Sticker Pack Viewer
- Pack-linked sticker taps now open the dedicated pack preview, not the generic media viewer.
- The message action menu offers both “View Sticker Pack” and “Add sticker pack”. The preview can install the pack from its own CTA.
- Verification: 9 focused suites / 69 tests pass; TypeScript and production Vite build pass (existing mixed-import and large-chunk warnings remain).
- Scope is UI only; no crypto, identity, or protocol code changed.

## Phase 108 Update — Sticker Loading & Touch Interaction
- **Status**: Implemented and verified. Focused verification: 8 test files / 66 tests pass; TypeScript passes; production Vite build succeeds.
- **Sticker loading**: `StickerImage` tries direct loading, then one strict proxy fetch. Failed assets become an explicit unavailable icon. Pack installation no longer schedules bursts of dozens of downloads with eight retries, and strict fetch callers reject synthetic fallback stars.
- **Touch behavior**: regular row taps no longer open message actions; moving at least 8px cancels the long-press timer; touch contextmenu events are de-duplicated. Voice reply swipe is enabled outside the waveform, which retains exclusive seek behavior.
- **Drawer**: Mobile open height is `min(400px, 52dvh)`.
- **Modified files**: `ConversationView.tsx`, `VoiceNoteCard.tsx`, `MessageComposer.tsx`, `MediaImage.tsx`, `EmojiDrawer.tsx`, `AddStickerPackModal.tsx`, `StickerImage.tsx`, `telegramStickerService.ts`, sticker/touch regression tests, `veil-components.css`, and phase docs.
- **Build notes**: Production output was written under the Codex visualization directory, not the repository. Vite reports existing mixed static/dynamic import and large chunk warnings.
- **Preserve existing unrelated worktree changes**: `android/app/src/main/assets/public/index.html`, `release/v1.0.0/checksums.sha256`, `release/v1.0.0/manifest.json`, and untracked `business-card/`.
- **Security scope**: No crypto, identity, or protocol code changed.

## Phase 107 Update
- **Current Phase**: **PHASE 107 (Encrypted Media Resume & Chat Responsiveness)**
- **Status**: Implementation complete. Five focused suites (17 tests), `npx tsc --noEmit`, and production Vite build pass. Full suite: 319 files passed, 105 failed (1,325 tests passed, 217 failed, 6 skipped); many failures require local relay/health endpoints rejected by sandbox `EACCES` or external network services.
- **Root causes fixed**: outgoing attachments and voice were uploaded as raw bytes with empty media keys; decrypted images/videos were written to IndexedDB; small media still used synchronous crypto; textarea input synchronously read `scrollHeight`; composer consumed high-frequency upload progress through the broad AppState context.
- **Recovery**: ciphertext is persisted in the Space-partitioned cache and retry metadata/keys through `EncryptedSpaceStore` before upload. On unlock, AppState retries the same message ID using the stored ciphertext. Space lock retains ciphertext but clears decrypted RAM and Blob URLs.
- **Security governance**: ADR-126 and `docs/ai/THREAT_MODEL_MEDIA.md` document the restoration. Independent security audit and dual sign-off are mandatory before deployment.
- **Governance**: Independent security audit and explicit dual sign-off are still required before deployment. Preserve existing unrelated modified release files and `business-card/`.

## Phase 106 Update
- **Current Phase**: **PHASE 106 (Media Re-entry Recovery)**
- **Status**: Implementation complete; TypeScript passes. Full suite had 1536/1537 pass; its sole grouped-media accessible-label failure was fixed and focused Phase 36/40/99/106 suites pass (18/18). Production Vite build passed to temporary output.
- **Key recovery behavior**: persisted outgoing uploads with no surviving worker become `FAILED` with an interruption reason; old `blob:` previews are ignored; failed durable previews show Retry; encrypted stickers reload via attachment ID; invalidated media is deleted from IndexedDB.
- **Important limit**: the app currently keeps upload source bytes in process memory only. A send interrupted by process termination cannot resume; the timeline now reports this instead of spinning forever. The user must send the file/recording again.

## Phase 105 Update
- **Current Phase**: **PHASE 105 (Media Responsiveness, Voice Player Consistency & Sticker UX)**
- **Status**: Implementation complete; web build passed; full suite has one external resolver failure; Android compile could not start because Gradle failed to establish loopback.
- **Key areas**: media upload hashing/encoding, viewport-gated media retrieval, native seek buffering synchronization, emoji drawer sizing, sticker pack add flow, and recording gestures.
- **Focused verification**: `tests/phase105-media-responsiveness.test.ts` (6 tests), `tests/phase101-device-simulator-viewports.test.tsx`, `tests/phase101-media-cache-and-scroll.test.tsx`, `tests/phase94-active-audio-notification-banner.test.tsx`, `tests/phase74-voice-native-seek.test.ts`, `tests/phase102b-emoji-drawer-performance.test.tsx`, and `tests/phase83-telegram-stickers.test.tsx` (89 tests total passing).
- **Full suite**: 1533/1534 pass. `tests/phase91-audio-player-and-stickers.test.tsx` fails only on resolving the external `Zane_fozol_0_9` Telegram sticker pack; isolated rerun also failed (10/11 pass).
- **Web build**: `npm run build` passed (bundle warnings for existing chunk size and mixed static/dynamic imports).
- **Android build**: `gradlew :app:assembleDebug` and `--no-daemon` both failed before compilation with `java.io.IOException: Unable to establish loopback connection`.

## Handoff Summary
- **Current Phase**: **PHASE 74 (Native Media Attachments, Recent Selection Sync & Performance Optimization)**
- **Status**: **COMPLETE & VERIFIED 100%**
- **Branch**: `main`
- **Verification Suites**:
  - `tests/phase74-voice-native-seek.test.ts` (5/5 passed)
  - `tests/phase74-media-interaction.test.tsx` (8/8 passed)
  - `tests/phase74-performance.test.ts` (4/4 passed)
  - `tests/phase74-device-media-bridge.test.ts` (4/4 passed)
  - `tests/phase74-gallery-save.test.ts` (1/1 passed)
  - `tests/phase40-media-picker.test.tsx` (2/2 passed)
  - `tests/phase41-codec-audit.test.ts` (1/1 passed)
  - `tests/phase44a-ui-layout-and-icons.test.tsx` (3/3 passed)
  - `tests/phase57-real-voice-forensic.test.ts` (3/3 passed)
- **Web App Build**: **PASS (`npm run build` in 2.10s, 0 TS errors)**
- **Capacitor Sync**: **PASS (`npm run android:sync` in 0.17s)**
- **Android Gradle**: **PASS (`gradlew.bat assembleDebug` in 20s, 7.45 MB `app-debug.apk`)**
- **Release Manifest**: **PASS (7 artifacts in `release/v1.0.0/`)**

---

## Forensic Fixes Delivered

1. **Persistent Reply System**:
   - `replyTargetRef` in `src/ui/app/AppState.tsx` synchronizes with React state, resolving the stale closure issue where replies were dropped upon send.
   - High-contrast Telegram-style reply bubble styling in `src/styles/veil-components.css`.
   - `toWireReplyReference` in `src/attachments/types.ts` strictly sanitizes wire reply payload fields.

2. **Attachment & Voice Recipient Authorization**:
   - Normalized `targetUsername` resolution across handles, canonical identity IDs, and display names.
   - Forwarded `recipientUsername`, `recipientAccountId`, and `recipientIdentityId` to cloud storage creation.
   - Server-side `handleAttachmentDownload` in `src/server/cloud/cloudHandler.ts` matches recipient username, account ID, and identity ID, eliminating "Attachment not found or access denied" 404s.

3. **Audio Playback & Physical Seeking**:
   - Verified `seek(percent)` sets `audio.currentTime` directly with safe duration bounds.
   - Enforced single-audio mutex playback state.
   - Object URLs retained during playback and revoked on `stop()`.

4. **Video Upload Pipeline & Player State Machine**:
   - Zero-leak wire serialization verified for video attachments.
   - Complete video player controls with scrubbing in `src/ui/components/media/MediaViewer.tsx`.

5. **Diagnostic Telemetry Redaction**:
   - Telemetry sanitizes passwords, private keys, symmetric keys, and secrets with `[REDACTED]`.

---

## Test Suites Added in Phase 45E
- `tests/phase45e-audio-runtime.test.ts`
- `tests/phase45e-video-upload-runtime.test.ts`
- `tests/phase45e-video-player.test.tsx`
- `tests/phase45e-reply-end-to-end.test.ts`
- `tests/phase45e-reply-rendering.test.tsx`
- `tests/phase45e-attachment-integrity.test.ts`
- `tests/phase45e-runtime-redaction.test.ts`
