# ACTIVE_TASK.md — Active Task Tracker

## Current Active Task: Phase 46B — Forensic Runtime Repair: Security Settings, Password Change, Username Identity & Recovery
- **Status**: **COMPLETE & VERIFIED 100%**
- **Objective**: Forensically repair the 12 runtime failure modes identified during physical Android runtime testing:
  1. Fix fatal SettingsModal crash on opening Privacy & Security due to missing `PasswordInput` import
  2. Route post-recovery banner "Change Password" directly to Privacy & Security settings
  3. Remove auto-slugification and enforce explicit canonical username entry in CreateSpaceModal
  4. Standardize terminology to "Username" across RestoreAccountModal and lock screens
  5. Enforce directory profile identity ownership and prevent username hijacking
  6. Prevent dangerous `session.name` fallbacks that corrupted restored usernames
  7. Persist cloud session and recovery security flags using asynchronous storage methods
  8. Eliminate cold storage cache race conditions during space initialization and contact requests
  9. Verify complete password change lifecycle (envelope rewrapping + cloud auth update + recovery vault re-encryption)
  10. Verify durable multi-space SQL persistence and recovery across cold server restarts
  11. Build comprehensive 13-test regression suite (`tests/phase46b-runtime-repair.test.tsx`)
  12. Verify full 337-file repository test suite, web bundle, release manifest, and Android APK build

## Tasks Completed
- [x] Fixed `PasswordInput` import in `src/ui/components/SettingsModal.tsx` to eliminate fatal ReferenceError and ErrorBoundary crash.
- [x] Extended `ActiveModal` and `SettingsModalProps` with `initialCategory` support and wired post-recovery banner to direct `privacy` tab.
- [x] Standardized modal labels and placeholders to canonical "Username" with `@` stripping and lowercasing.
- [x] Enforced directory profile identity ownership in `src/server/storage/postgresRelayStore.ts` to reject conflicts and clean up previous username records.
- [x] Replaced all dangerous `session.name` fallback logic in `src/ui/app/AppState.tsx` with authoritative profile/session/envelope username resolution.
- [x] Switched storage writes to `store.setAsync` in `src/account/accountManager.ts` to ensure durable persistence of cloud sessions and recovery flags.
- [x] Authored 13-test regression suite in `tests/phase46b-runtime-repair.test.tsx` covering UI, normalization, uniqueness, directory ownership, password change, recovery, and secret redaction.
- [x] Verified 100% clean test passes:
  - `tests/phase46b-runtime-repair.test.tsx` (13/13 passed)
  - `tests/phase46-account-collision-recovery.test.ts` (7/7 passed)
  - Full Vitest suite: 337 test files / 905 tests passed (100% clean pass)
- [x] Verified Web production build: `npm run build` (dist built cleanly in 1.79s).
- [x] Verified Release manifest: `node scripts/release-build.mjs` (6 artifacts generated).
- [x] Verified Capacitor sync: `npx cap sync android` (sync finished in 0.145s).
- [x] Verified Android APK build: `cmd.exe /c gradlew.bat assembleDebug` (BUILD SUCCESSFUL in 17s).
