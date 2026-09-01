# ACTIVE_TASK.md — Active Work Tracker

## Current Active Task: Phase 50C — Invalid Current Password Forensic Investigation & Architecture Fix

### Objectives & Checklist
- [x] Trace exact local validation path and identify why valid passwords were being falsely rejected with "Invalid current password".
- [x] Uncover session token retention bug across multiple accounts on the same device.
- [x] Remove premature local-only blocker from `AccountManager.changePassword`.
- [x] Make server authentication authoritative for account password changes (`/v1/account/change-password`).
- [x] Make local space envelope rewrapping safe and resilient for decoy and multi-space configurations.
- [x] Author dedicated Phase 50C acceptance suite (`tests/phase50c-password-validation-forensic.test.ts`) covering scenarios A–G.
- [x] Run full regression test suites across Phases 46, 46B, 47, 48, 49, 50, and 50C (47 tests passing, 100% clean pass).
- [x] Verify production web build (`npm run build`).
- [x] Verify release manifest packaging (`node scripts/release-build.mjs`).
- [x] Sync Capacitor Android (`npx cap sync android`).
- [x] Compile Android Debug APK (`./gradlew.bat assembleDebug` BUILD SUCCESSFUL in 23s).
- [x] Update documentation (`docs/ai/CURRENT_STATE.md`, `docs/ai/ACTIVE_TASK.md`, `CHANGELOG.md`, `walkthrough.md`).
