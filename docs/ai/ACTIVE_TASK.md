# ACTIVE_TASK.md — Active Task Tracker

## Current Active Task: Phase 47 — Password Change, Messaging UX, Same-Device Discovery, Video Upload & Profile UI Forensic Repair
- **Status**: **COMPLETE & VERIFIED 100%**
- **Objective**: Forensically repair the physical Android runtime issues observed during live testing:
  1. Fix Account Passphrase change lifecycle (re-authenticate if necessary, update cloud auth, rewrap local space envelopes, re-encrypt zero-knowledge recovery snapshot).
  2. Standardize minimum password length across the entire application to 3 characters.
  3. Implement animated SVG Telegram-style circular sending/loading indicator and upload progress ring (strictly no Unicode emojis).
  4. Normalize directory search queries (strip leading `@`, whitespace, and casing) so same-device and remote accounts discover each other reliably.
  5. Harden physical Android video upload by inferring MIME types from file extensions when `file.type` is empty on Android WebViews.
  6. Refine video player controls with safely clamped seek scrubbing (`0 <= targetTime <= duration`) without recreating video elements or resetting to zero.
  7. Reorganize ProfileModal layout into Telegram reference hierarchy (Header, Primary Actions, Identity Info, Media Section with categorized counts, Contact Actions).
  8. Implement centralized error normalization in `src/utils/errors.ts` to eliminate `[object Object]` leaks to JSX.
  9. Add comprehensive Phase 47 test suite (`tests/phase47-runtime-media-account.test.tsx`) and verify entire repository test suite, web bundle, release manifest, and Android APK build.

## Tasks Completed
- [x] Created `src/utils/errors.ts` and normalized error handling across all modals to prevent `[object Object]` leaks.
- [x] Updated minimum password length to 3 characters across client, server (`accountService.ts`), recovery vault (`recoveryVault.ts`), and UI helpers.
- [x] Fixed password change cloud authentication, envelope rewrapping, and recovery vault re-encryption in `src/account/accountManager.ts` and `src/ui/app/AppState.tsx`.
- [x] Enhanced `MessageStatus.tsx` with animated circular SVG spinner ring and determinate upload percentage ring.
- [x] Added leading `@` stripping and case normalization in directory queries across `directoryClient.ts`, `relayServer.ts`, and all storage adapters.
- [x] Added `inferMime` in `AppState.tsx` for Android video uploads and clamped seek calculations in `MediaViewer.tsx`.
- [x] Added missing vector icons (`PhoneIcon`, `MessageSquareIcon`, `BellIcon`, `BellOffIcon`, `QrCodeIcon`, `LinkIcon`, `EditIcon`) in `Icons.tsx` and rebuilt `ProfileModal.tsx` matching Telegram reference design.
- [x] Authored comprehensive test suite in `tests/phase47-runtime-media-account.test.tsx` (7/7 tests passing).
- [x] Verified 100% clean test passes:
  - `tests/phase47-runtime-media-account.test.tsx` (7/7 passed)
  - `tests/phase46b-runtime-repair.test.tsx` (13/13 passed)
  - `tests/phase46-account-collision-recovery.test.ts` (7/7 passed)
  - Full Vitest suite: 338 test files / 912 tests passed (100% clean pass)
- [x] Verified Web production build: `npm run build` (dist built cleanly in 1.74s).
- [x] Verified Release manifest: `node scripts/release-build.mjs` (6 artifacts generated).
- [x] Verified Capacitor sync: `npx cap sync android` (sync finished in 0.15s).
- [x] Verified Android APK build: `cd android && ./gradlew.bat assembleDebug` (BUILD SUCCESSFUL in 20s).
