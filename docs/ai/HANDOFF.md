# HANDOFF.md — AI Agent Session Handoff

## Phase 122 Update — Mobile Safe Area, Voice Authentication & Chat Menu
- The fixed mobile home sidebar now anchors below `--veil-safe-top` and above `--veil-safe-bottom`; its previous `inset: 0` escaped body safe-area padding and let the home UI sit under Android system bars.
- Voice chunk AEAD additional data is the attachment ID, while the relay assigns a different cloud object ID. Playback incorrectly substituted object ID in the media cache and direct decrypt path. Both paths now pass `meta.attachmentId || meta.objectId`, preserving compatibility with older metadata that lacks attachmentId.
- Sidebar chat-row Pin/Delete menus now close on outside pointer/touch and Escape; pointerdown on the trigger/menu is excluded.
- Timestamp trace: outgoing direct preview stamps local send time, but the direct wire payload has no timestamp and inbound stored messages are stamped at receipt/decryption. Group payloads do carry a timestamp. Do not alter direct protocol timestamp behavior without an ADR, threat review, adversarial tests, and dual sign-off required by the post-RC freeze.
- Added `tests/phase122-mobile-shell-voice-menu.test.ts`. Phase 122 (4), Phase 89 (9), and Phase 116 (5) suites pass; TypeScript passes. Relay-backed Phase 29/30/45e voice integration attempts are blocked by sandbox loopback `EACCES`; Android device validation is outstanding.
- No message wire format, identity, or cryptographic behavior changed; voice chunk decryption now supplies the original existing AAD identifier correctly.
- Preserve unrelated worktree changes: `android/app/src/main/assets/public/index.html`, `release/v1.0.0/checksums.sha256`, `release/v1.0.0/manifest.json`, `.veil_persist_regression_temp/`, `.veil_test_sql_recovery_suite/`, and `business-card/`.

## Phase 121 Update — Avatar Crop Preview & Output Alignment
- Fixed the actual profile customizer issue: its preview used the image's intrinsic pixel dimensions while export separately computed a fit scale, so what the user framed could differ from the applied image.
- Added shared geometry in `src/ui/utils/avatarCropGeometry.ts`. The preview now fits the loaded natural dimensions to cover the crop aperture, and the export uses the same fit/zoom/rotation scale. Panning is clamped to keep the crop covered. Crop failures show an error rather than silently applying the original uncropped image.
- The same AvatarCropModal serves ProfileModal and SettingsModal. Added crop-geometry regressions and corrected a legacy Avatar test that still asserted the former CSS background implementation after avatars moved to `<img object-fit="cover">`.
- Phase 121, Phase 68, avatar processing, profile avatar, and unlock regression suites pass (35 tests); TypeScript passes. Android portrait/landscape crop validation remains outstanding.
- No crypto, identity, authentication, or message protocol changes.

## Phase 120 Update — Unlock Hydration & Profile Photo Refresh
- AppState begins cloud authentication in parallel with independent encrypted local reads. Contacts, conversations, requests, profile/privacy, mute settings, and messages are fetched with one `Promise.all`, then local UI state is populated before the cloud result gates remote sync. Argon2id, PIN credential checks, encryption, and identity protocols are unchanged.
- ProfileModal keys fetched profile documents to the active peer so a prior peer's document is ignored immediately after switching. It verifies the expected identity and the contact's known signing key, then persists valid avatar updates in the encrypted contact record so the list and conversation header refresh as well.
- Added `tests/phase120-startup-avatar-refresh.test.ts`; it verifies concurrent local read starts, avatar precedence, profile-document target scoping, and identity matching. Phase 38/67/90/118 and Phase 120 suites pass (24 tests); `npm run typecheck` passes.
- Android device validation remains outstanding. The attached MP4 could not be opened in this environment; validate actual unlock timing and profile-photo behavior on device.
- No cryptographic, authentication, identity, or wire-format changes.
- Preserve unrelated existing worktree changes: `android/app/src/main/assets/public/index.html`, `release/v1.0.0/checksums.sha256`, `release/v1.0.0/manifest.json`, `.veil_persist_regression_temp/`, `.veil_test_sql_recovery_suite/`, and `business-card/`.

## Phase 119 Update — Shared-Media Caption Focus
- Fixed caption typing dismissing the mobile keyboard. `MediaPickerModal` passed a new inline `onClose` callback after each caption edit; Modal's effect depended on it, so cleanup restored focus and setup refocused the first button.
- Modal now calls the latest `onClose` from a ref, while focus lifecycle depends on modal-open state and Escape behavior rather than callback identity.
- Added `tests/phase119-modal-focus-lifecycle.test.ts`; modal focus, shared-media modal, and UI system suites pass (14 tests), and TypeScript passes. Android keyboard behavior still needs device validation.

## Phase 118 Update — Sticker Cache, Avatar Consistency & Shared Media
- Sticker image bytes are cached in a bounded IndexedDB store (300 assets / 64 MiB maximum) using a SHA-256 URL digest as the record key; raw URLs are not stored as identifiers. In-flight fetches are deduplicated and direct/relay image routes are raced.
- Shared avatars now render through a clipped `<img>` with `object-fit: cover`, and keep deterministic initials/group fallbacks visible if image loading fails. Direct conversation headers and message peers resolve the current contact avatar before legacy conversation fields.
- Shared-media entries flatten both `attachment` and `attachments`; grouped photos/files now appear in their corresponding tabs. The gallery asks MediaImage for the authenticated full-resolution source.
- Added `tests/phase118-sticker-avatar-gallery.test.tsx` and updated legacy assertions for the current avatar, relay route, and drawer sizing behavior. Nine focused sticker/media/avatar/gallery suites pass (84 tests); `npm run typecheck` and `git diff --check` pass.
- No cryptographic protocol or wire format changes. Android device validation is outstanding.

## Phase 117 Update — Confirmed Local Chat Deletion
- Sidebar conversation rows now have a dedicated overflow action for Pin/Unpin and Delete chat. Delete asks for confirmation and clarifies that deletion is limited to the active Space; contacts, group membership, and other participants' copies remain.
- Deletion writes encrypted `veil:ui:deleted_conversations` tombstones before changing visible state, then removes UI/direct/group history, pending outbound envelopes, and pending media outbox jobs. Recovery merge filters rows at or before the tombstone while retaining later messages.
- Added `tests/phase117-delete-chat.test.ts`. Delete-chat, Phase 31 recovery, Phase 111 outbound recovery, and P0 stability passed (13 tests); `npm run typecheck` and `git diff --check` passed. Phase 29 recovery integration tests are blocked by sandbox-denied loopback relay connections.
- No cryptographic protocol or wire format was changed. Android/device interaction remains unvalidated.
- Preserve unrelated pre-existing files: `android/app/src/main/assets/public/index.html`, `release/v1.0.0/checksums.sha256`, `release/v1.0.0/manifest.json`, `.veil_persist_regression_temp/`, `.veil_test_sql_recovery_suite/`, and `business-card/`.

## Phase 116 Update — Android Safe Area & Inbound Delivery Recovery
- Android now reserves at least 24 CSS pixels above app content when the native WebView reports a zero safe-area inset; larger reported cutouts still win.
- Inbound sync no longer ACKs messages with missing or failed handlers. Persisted pending envelopes are replayed on sync/re-entry; duplicate WebSocket deliveries are only acknowledged after processing; overlapping syncs cannot process one envelope concurrently. AppState now propagates undecryptable payload failures unless the existing legacy JSON fallback recognizes them.
- Added `tests/phase116-delivery-and-safe-area.test.ts`. Focused Phase 116 + Phase 84 suites pass (12 tests); `npm run typecheck` passes. Relay-backed delivery suites fail to connect to loopback servers in this sandbox. Validate on a physical Android device.
- This enforces the existing ACK-after-persistence decision without changing crypto or wire format. Because delivery lifecycle is security-sensitive after RC, independent review and dual sign-off are still required before deployment.
- Preserve unrelated existing changes: `android/app/src/main/assets/public/index.html`, `release/v1.0.0/checksums.sha256`, `release/v1.0.0/manifest.json`, `.veil_persist_regression_temp/`, `.veil_test_sql_recovery_suite/`, and `business-card/`.

## Phase 115 Update — Touch Context Menu Dismissal
- Fixed the mobile dismissal race: touch pointerdown no longer unmounts capture listeners before touchstart can be absorbed. Delayed native contextmenu is now swallowed while the app menu is open, preventing it from dismissing the menu opened by the same hold; the nested text bubble filters touch-generated events too.
- Mouse/non-touch pointer dismissal and desktop right-click remain supported.
- Regression verification: context menu, sticker touch, and audio scrubber context isolation suites passed (26 tests); `npm run typecheck` passed. Impeccable detector reported only pre-existing side-tab/bounce-easing patterns elsewhere in `ConversationView.tsx` (lines 2735, 440, 479).
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
