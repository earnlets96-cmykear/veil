# HANDOFF.md — AI Agent Session Handoff

## In-Timeline Device Media Streaming & Chat Responsiveness — 2026-10-12
- **Status**: Implemented, verified with focused unit tests, web bundle built, Capacitor synced, and Android debug APK assembled.
- **Root cause**:
  1. Horizontal swipe gesture on sidebar tabs was blocked when finger touched conversation items because item containers had button-like roles. When the finger was lifted, the click event fired and selected the conversation.
  2. Opening a conversation froze due to synchronous heavy message list rendering (60 messages default), plus uncontrolled re-render loops in conversation auto-read receipts.
  3. Video and file uploads on native Android blocked the user inside a "Preparing..." modal until the whole file was read chunk-by-chunk into memory.
- **Change**:
  1. Refined swipe touch handler in `Sidebar.tsx` to allow gliding over conversation items, guarded against false clicks after swipe, and wrapped selection in `React.startTransition`.
  2. Reduced initial message window in `ConversationView.tsx` from 60 to 30 with dynamic increment on scroll, and guarded auto-mark-as-read to only run when unreadCount > 0.
  3. Staged native media attachments immediately in `AppState.tsx` with local thumbnail and size metadata (0ms staging), closing `MediaPickerModal` immediately. Moved device chunk reading into `uploadWorker` with 0%-100% active timeline progress reporting.
- **Verification**:
  - `phase134` (touch navigation), `phase135` (attachment retention), `phase86` (share media redesign), `phase74` (device media bridge), and `phase58` (UI acceptance) pass.
  - Production bundle compiled (`npm run build`).
  - Capacitor synced (`npx cap sync android`).
  - Android debug APK assembled (`app-debug.apk`, 10.2 MB).

## Direct Media Recipient Preflight — 2026-10-12
- **Status**: Implemented and focused-verified; no deployment authorization implied.
- **Root cause**: Direct attachment sending started encrypted upload before checking that a recipient Double Ratchet session or prekey bundle was available. The supplied browser error confirms this failure after upload. Text/voice already attempted directory refresh.
- **Change**: Resolve missing direct-recipient material before upload using a signature/expiry-validated directory profile, exact identity match, verified embedded identity document, and existing contact signing-key pin. Preserve existing contact verification and metadata during refresh. Fail before upload when no trusted profile is available; existing E2EE and attachment wire formats remain untouched.
- **TikTok**: Supplied browser logs show direct `www.tiktok.com/oembed` requests are CORS-blocked and rate-limited (HTTP 429). ADR-130 disallows arbitrary relay proxying/caching. Any same-origin/native request strategy needs a separate privacy/architecture review and ADR.
- **Verification**: `npm run typecheck` passes; focused preflight/outbox suites pass (8 tests). Full `npm test`: 363 files passed / 108 failed (1,525 passed / 215 failed / 6 skipped), dominated by unavailable localhost relay/recovery connections, plus unrelated source-contract/UI assertion failures. One focused authenticated-media test could not connect to its localhost recovery server.
- **Release gates**: Physical Android send/retry and TikTok playback validation, independent security review, formal audit, and explicit dual sign-off remain mandatory under the post-RC security freeze.
- **Preserve unrelated worktree changes**: deleted `business-card/` content and modified `release/v1.0.0/{manifest.json,checksums.sha256}` were present before this task. Do not stage or revert them. Full test execution created `.veil_persist_regression_temp/` and `.veil_test_sql_recovery_suite/`; remove only after verifying they remain generated test artifacts.

## Uploaded Media Retry and Social Preview Follow-up — 2026-10-12
- Confirmed the attachment UI can show a failed message after ciphertext upload completed because later message dispatch or outbox cleanup shared the same failure boundary. The outbox now records `UPLOADED`; retry restores ciphertext as before but reuses the existing attachment/object ID and does not upload again. Cleanup after relay dispatch is best-effort.
- Verification: 5 attachment/outbox suites / 18 tests and 4 social-video suites / 16 tests pass; `npm run typecheck` passes. No production build was run in this pass.
- TikTok remains unresolved; the user reports a general issue across TikTok, rather than one specific post. The app calls the official oEmbed endpoint directly from the client, but the sandbox could not resolve `www.tiktok.com` to inspect the live response. Keep to official oEmbed/player endpoints; ADR-130 forbids relay proxying and generic page scraping. The Render deployment screenshot belongs to another service and cannot be diagnosed from this checkout.
- Takeover report: read `AGENTS.md` and required `docs/ai` architecture/security/task docs; inspected recent git history and the worktree. Current HEAD was `048f917`. Preserve pre-existing `business-card/` deletions and `release/v1.0.0/{manifest.json,checksums.sha256}` edits; do not stage or revert them. The new regression test and source/docs changes are the scoped work.
- Next action: inspect the Android WebView network error/response for the official oEmbed request, then decide whether an allowed client-side compatibility fix exists. Physical playback and post-RC security review/dual sign-off remain release gates.

## Social Video Player Action Controls — 2026-10-12
- Player footer controls now use a compact responsive action bar: external-link affordance, VEIL fullscreen, and icon close. Existing callbacks and destinations are unchanged. Buttons have 40px minimum hit targets, accessible labels, visible keyboard focus, and reduced-motion handling.
- Five social-video suites / 29 tests and `npm run typecheck` pass. The Impeccable scan reported existing findings in other shared-stylesheet sections. Physical Android WebView visual validation remains pending.
- Changed source: `src/ui/components/ui/SocialVideoPreviewCard.tsx`, `src/styles/veil-components.css`, and `tests/phase130-social-video-preview-ui.test.tsx`. Preserve unrelated working-tree modifications and artifacts.

## TikTok Player Loading Regression — 2026-10-12
- Phase 131's 15-second readiness timeout removed the active TikTok iframe when `onPlayerReady` was not received, even without an explicit player error. Retry recreated the same URL and repeated the issue.
- The timeout now leaves the iframe mounted and shows a non-blocking waiting status. Actual player/iframe errors still show recovery controls. Six social-video suites / 30 tests and TypeScript pass.
- Verify TikTok playback and full-screen behavior in physical Android WebView; `adb` is not available in this environment.

## Attachment Retry and Video Scroll Responsiveness — 2026-10-11
- Attachment uploads no longer race a shorter caller timeout against CloudClient's own bounded request. The old race could reject early while the underlying transfer continued and then launch another upload. Existing reauthentication behavior remains; retry starts after the bounded request settles and reuses the created object ID.
- Video thumbnail extraction waits for the message tile to approach the viewport; fallback `<video>` elements use `preload="none"`.
- Focused Phase 105/106/107 suites pass (12 tests), TypeScript passes, and the production Vite bundle builds (existing mixed-import and large-chunk warnings remain). Full `npm test`: 355 files passed / 113 failed (1,510 tests passed / 220 failed / 6 skipped); most failures involve local relay/recovery socket denials, with some unrelated UI assertion failures.
- Physical Android send/scroll validation remains outstanding. No attachment wire format or crypto behavior changed.
- Preserve unrelated working-tree changes, including the Android release asset/index, release manifests/checksums, temporary regression folders, and `business-card/`.

## Microphone Permission Prompt Follow-up — 2026-10-11
- Android WebView may continue reporting microphone permission state `prompt` after the user has acknowledged VEIL's explanation. Store that acknowledgement as a local UI preference and skip the repeated explanation; direct requests still reach the platform/browser permission flow. Explicitly denied access keeps the Settings guidance.
- Verification: Phase 135 permission persistence, Phase 36, Phase 37, and Phase 129 recording suites pass (12 tests); `npm run typecheck` passes.
- No authentication, cryptographic, Space-isolation, or message protocol changes.

## Attachment Read, Thumbnail, and Responsiveness Follow-up — 2026-10-10
- Native Android document chunks now read until actual stream EOF and return `bytesRead`/`isLast`; TypeScript assembles the file without trusting an inaccurate OpenableColumns size. Existing encrypted attachment payload format is unchanged.
- Recent image/video tiles lazily request a 120px native thumbnail when they approach the viewport. This restores video previews and avoids serially decoding the full recent-media grid before showing it.
- Upload progress updates are throttled to at most 10 per second and moved to `UploadProgressContext`; only `ConversationView` consumes that context, avoiding app-wide React context invalidation on XHR progress.
- `npm run typecheck` passes. Tests were not run in this pass. Android Gradle packaging failed before compilation with `Unable to establish loopback connection`; physical-device checks remain required.
- No authentication, cryptographic, Space-isolation, or attachment wire-format changes. Continue preserving unrelated working-tree edits and user artifacts.

## Message Bubble Palettes — 2026-10-10
- Implemented six curated incoming/outgoing palettes and a VEIL Default control in the Appearance screen; each card previews both directions. ThemeManager persists the selection locally and restores it independently of accent and shape.
- Actual message bubbles and the live Appearance preview share palette tokens. All 12 light/dark surface-text pairs pass the 4.5:1 contrast check; both theme/appearance suites pass (20 tests) and TypeScript passes.
- A live VEIL browser preview was not available in this environment; this pass verified rendered markup and shared production CSS selectors.

## Expanded Themes and Wallpapers — 2026-10-10
- Implemented Glacier/Canyon/Aurora theme cards and six new offline CSS wallpapers, with two choices each for Nature, Abstract, and Patterns.
- Added JPEG/PNG/WebP image normalization and app-origin IndexedDB persistence for custom wallpapers, including restore-on-start, reselect, replacement, removal, and object-URL cleanup on replacement/remove/pagehide.
- Focused results: 21 tests pass across four suites; `npm run typecheck` passes. Live preview and web image-host access were blocked by sandbox socket/network restrictions. New catalog wallpapers use CSS designs pending a future opportunity to bundle sourced photographs.
- Custom wallpaper bytes are not encrypted by VEIL Spaces and are not uploaded or synchronized; the Appearance UI explains this.

## Attachment Send Retention Follow-up
- Both the media picker and file-preview send paths await AppState send setup before clearing their staged selections. On setup errors, files remain selected and the user sees a retry prompt.
- Phase 135 plus six existing attachment/audio suites pass (24 tests); TypeScript passes.
- Follow-up audit: Android recent Files query omits audio-library rows, while the system Browse all files picker can select them. Mixed multi-file batches still route through an image/video gallery renderer and need a type-aware display fix.

## Mobile Chat List Interaction Follow-up — 2026-10-10
- Raised the floating New Chat action using the Android safe-area inset, added outside-touch/Escape dismissal for the Security menu, and wired horizontal conversation-list swipes to All, Unread, and Groups. Vertical scrolling and control taps remain intact.
- Added `tests/phase134-sidebar-touch-navigation.test.ts`. The new suite (4), Phase 62 sidebar/app-lock suite (10), and Phase 127 chat-list suite (5) pass; `npm run typecheck` passes.
- UI-only scope; no cryptography, identity, Space boundary, relay, or message wire protocol changed. Preserve all pre-existing unrelated working-tree changes.

## Composer Input Responsiveness Follow-up
- MessageComposer no longer binds the textarea to per-keystroke React state. It stores live text in a ref and only rerenders when switching between the empty and non-empty send/microphone control. Edit prefill, send, emoji insertion/backspace, and textarea resizing read/update this live value.
- Verification: Phase 134 composer responsiveness, Phase 108 composer responsiveness, and Phase 102B emoji drawer suites pass (12 tests); `npm run typecheck` passes.
- No cryptography, identity, Space isolation, transport, or message protocol changed.

## Media Bubble UI Follow-up
- Reduced single and grouped photo/video message previews to a 300px maximum width and reduced their maximum height.
- Outgoing photo and video previews get a 1px `--veil-border` border; sticker art is excluded.
- Phase 101 media suite (8 tests) and TypeScript pass. The Impeccable detector reported only existing findings outside the changed selectors.

## Phase 133 Update — My Vault, Group Entry & Video Upload Memory
- Added My Vault as the local destination for the active Space's own identity. Text notes are stored via the encrypted Space store and return before contact/directory lookup, relay delivery, or cloud recovery sync; self-directed contact requests are rejected.
- New Chat now opens group creation. A named creator-only group can be created and populated later through the existing group details flow.
- Android recent media is read in sequential 1 MiB chunks instead of returning the complete file as Base64. Upload no longer retains a separate full plaintext `MediaCache` entry; main-thread plaintext, worker plaintext, and temporary media key buffers are zeroized after encryption.
- Added ADR-133, `docs/ai/THREAT_MODEL_SELF_VAULT_AND_MEDIA.md`, and `tests/phase133-reported-user-flows.test.ts`.
- Verification: five focused suites / 19 tests pass; TypeScript and production Vite build pass. Full `npm test` baseline: 346 files passed / 112 failed (1,463 passed / 220 failed / 6 skipped), with failures primarily from localhost relay/recovery connection limits. The Phase 56C recovery integration test also cannot connect to localhost in this sandbox.
- Android compile and physical-device large-video testing remain required. No key identity, crypto primitive, attachment wire format, group protocol, or relay behavior changed. Post-RC independent review, formal audit, and dual sign-off remain deployment gates.
- Preserve unrelated pre-existing edits in Android notification/video preview files, Phase 130 docs/tests/styles, release manifests/checksums, `business-card/`, and the local regression temp directories. Do not include those in a Phase 133 commit.

## Phase 130 Update — Social Video Preview Layout & Playback
- Replaced the manual Load preview prompt with bounded in-view provider metadata loading (120px viewport margin); offscreen cards do not fetch. Provider attribution is visible, thumbnails stay remote, and playback still requires a tap.
- Video cards/bubbles now share a compact responsive width. Instagram uses a taller embed frame. Added an optional Escape-dismissible full-screen player and TikTok error handling that validates the exact origin and iframe source, with Retry/Open original fallback.
- Added ADR-132 and updated the threat model for in-view provider egress. Five focused suites / 28 tests pass; typecheck and production Vite build pass. Impeccable found only pre-existing issues outside video selectors.
- Physical Android/WebView playback validation, independent security review, formal audit, and dual sign-off remain outstanding. No cryptography, identity, Space boundary, relay, or wire protocol changes.
- Preserve unrelated Android/release artifact changes, Phase 129 voice-composer work, and local test/business-card directories; keep them out of this feature commit.

## Phase 128 Update — Android Full Preview Reply & Media Recovery
- Local Full Preview Android notifications now include inline replies bound to the conversation and Space. Native RemoteInput is cleared from its one-shot intent before an in-memory event reaches AppState; replies are captured on both cold launch and Activity reuse, and `sendMessage` handles them only while that Space is active. Local notifications use VEIL's current accent color. FCM notifications remain generic. Active notifications clear on lock and privacy-mode changes.
- Attachment and voice requests now stop before cloud access if session restoration fails. Voice playback chooses valid audio metadata rather than passing through `application/octet-stream` from an old cache entry.
- Four Phase 128 suites / nine tests pass and TypeScript passes. Full baseline suite: 341 files passed / 109 failed (1,447 passed / 216 failed / 6 skipped), primarily blocked loopback relay/recovery plus existing UI assertions. Latest Android Gradle attempt stopped before compilation because access to the user-level Gradle lock file was denied.
- Added ADR-131 and `docs/ai/THREAT_MODEL_NOTIFICATION_REPLIES.md`. Physical Android validation, independent security review, formal audit, and explicit dual sign-off are required before deployment. Preserve pre-existing Android asset/release metadata changes and local test/business-card artifacts.

## Phase 127 Update — Composer Recording & Chat List Polish
- Preserved the selected floating-island composer layout and controls. Recording drag visuals are written to CSS variables at animation-frame cadence; only gesture state changes trigger React rendering. The locked recorder has one cancel button, and action releases are prevented from bubbling into the recording gesture.
- Recording motion is restrained and respects reduced-motion settings. Chat timestamp/menu alignment uses the row trailing edge while preserving the menu's 44px target.
- Focused Phase 127/108/101 voice/122 shell/37 suites pass (23 tests); `npm run typecheck` and `npm run build` pass. Full suite: 341 files passed / 109 failed (1,447 tests passed / 216 failed / 6 skipped), mostly blocked loopback relay/recovery tests, plus unrelated Phase 98/101/112 UI assertions.
- Impeccable detector reported only existing warnings outside the edited recording/sidebar selectors. Physical Android interaction validation remains outstanding. No cryptography, identity, Space isolation, relay, or message wire protocol changes.
- Preserve unrelated pre-existing worktree changes and generated test folders: Android public index, release manifest/checksums, `.veil_persist_regression_temp/`, `.veil_test_sql_recovery_suite/`, and `business-card/`.

## Phase 124 Update — Notification Settings & App Lock Reliability
- Notification settings now separate device permission, local foreground privacy, and Android background-push state. Registration status is finite (`off`, `registering`, `ready`, `error`), errors are user-safe/retryable, and FCM notification content stays generic.
- App Lock now reads validated persisted leave-app, inactivity, and screen-off delays. Legacy settings migrate to canonical values; failed writes roll back. Resume checks gate App UI while pending; foreground inactivity resets on pointer/key/touch events; Android screen-off marker stores only monotonic elapsed time and is consumed once.
- Added ADR-129 and `docs/ai/THREAT_MODEL_APP_LOCK.md`. No crypto, identity, Space-isolation, or message wire format changes.
- Verification: 12 focused suites / 68 tests pass; TypeScript passes; Impeccable detector reports no findings. Full baseline `npm test` was interrupted after existing blocked loopback relay/recovery failures. Gradle failed before compile because it could not establish a loopback connection.
- Still required: Android native compile with loopback available, physical-device permission/push/screen-off/process-death/Space-switch validation, independent security audit, and explicit dual sign-off before deployment.
- Preserve unrelated local changes: `android/app/src/main/assets/public/index.html`, release checksums/manifest, `android/app/google-services.json`, `.veil_persist_regression_temp/`, `.veil_test_sql_recovery_suite/`, and `business-card/`.

## Phase 123 Update — Mailbox Recovery & Contact Handshake Security Review
- Independent review found that an accepted contact response could use a different signing key under the pending peer identity ID; a legacy request verifier also accepted signatures that did not bind the recipient or timestamp.
- Contact responses now require the pending request's pinned signing key, a valid nested identity document whose identity ID matches the profile, and a valid response signature. Inbound contact requests now require a valid matching identity document and only accept the full recipient/time-bound signature form.
- Added adversarial tests for both findings. Phase 34/123/37/67 suites pass (11 tests); broader Phase 23/24/33/34/37/67/123 contact and delivery regressions pass (26 tests across 10 files) with local relay permission; `npm run typecheck` passes.
- Initial peer review rejected sign-off and the findings were addressed. Follow-up peer review, formal independent security audit, explicit dual sign-off, and Android/two-device validation remain required before deployment. No crypto primitive, ratchet, or message ciphertext format changed.
- Preserve unrelated pre-existing worktree changes: `android/app/src/main/assets/public/index.html`, `release/v1.0.0/checksums.sha256`, `release/v1.0.0/manifest.json`, `.veil_persist_regression_temp/`, `.veil_test_sql_recovery_suite/`, and `business-card/`.

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
