# CURRENT_STATE.md — Verified Phase & System Status

## Current Verified Phase: PHASE 46B (Forensic Runtime Repair: Security Settings, Password Change, Username Identity & Recovery)
- **Status**: **COMPLETE & VERIFIED 100%**
- **Branch**: `main`
- **Phase 46B Test Results**: **`tests/phase46b-runtime-repair.test.tsx` (13 comprehensive security & UI tests, 100% clean pass)**
- **Phase 46 Test Results**: **`tests/phase46-account-collision-recovery.test.ts` (7 comprehensive suites, 100% clean pass)**
- **Full Test Suite**: **337 test files / 905 automated tests passing (100% clean pass)**
- **Web App Build**: **PASS (`npm run build` built in 1.79s)**
- **Release Manifest**: **PASS (`node scripts/release-build.mjs` - 6 artifacts)**
- **Capacitor Sync**: **PASS (`npx cap sync android` in 0.145s)**
- **Android APK Build**: **PASS (`cmd.exe /c gradlew.bat assembleDebug` BUILD SUCCESSFUL in 17s)**
- **Physical Android Verification**: **Ready for physical device deployment and live acceptance testing**

---

## Phase 46B Verified Deliverables & Forensic Fixes

1. **Settings Modal Crash Fix & Direct Category Routing**:
   - Resolved fatal `ReferenceError: PasswordInput is not defined` by adding `PasswordInput` to the `./ui/index.ts` imports in `SettingsModal.tsx`.
   - Added `initialCategory?: SettingsCategory` to `SettingsModalProps` and updated `ActiveModal` in `types.ts`.
   - Wired the post-recovery banner "Change Password" button in `App.tsx` to directly open `SettingsModal` on the `'privacy'` tab.

2. **Strict Canonical Username Architecture & Terminology Standard**:
   - Replaced all legacy terminology ("Account Name", "Account") with "Username" in `RestoreAccountModal.tsx` and across the UI.
   - Enforced canonical normalization across all inputs: `trim().toLowerCase().replace(/^@/, '')`.
   - Removed automatic space-to-username slugification in `CreateSpaceModal.tsx`, requiring explicit, validated username input for new accounts.

3. **Directory Profile Identity Ownership Enforcement**:
   - Updated `src/server/storage/postgresRelayStore.ts` `registerProfile` to query existing profiles before upserting.
   - Rejects hijacking attempts with `CONFLICT: Username @{username} is already registered to a different identity` when the existing profile belongs to a different `identityId`.
   - Atomically deletes obsolete username mappings when an identity legitimately renames their profile.

4. **Elimination of Dangerous `session.name` Fallbacks & Cold Cache Race Conditions**:
   - Replaced synchronous `store.get` with asynchronous `store.getAsync` across `AppState.tsx` and `AccountManager.ts`.
   - Removed all fallback paths that derived usernames from `session.name` (such as `"mainspace"`). Space usernames are now resolved strictly via:
     1. Stored signed profile (`veil:user:profile`)
     2. Stored cloud session (`veil:cloud:session`)
     3. Header envelope canonical username (`envelope.canonicalUsername`)
   - Restored accounts rehydrate their directory profile using their canonical username and Ed25519 identity keys without corruption.

5. **Durable Multi-Space Persistence & Zero-Leakage Cryptographic Lifecycle**:
   - Verified that password changes rewrap local space envelopes with fresh salt/KDF, update server Argon2id auth hashes, and re-encrypt zero-knowledge recovery vaults.
   - Confirmed that multi-space accounts and encrypted partition records persist durably across server restarts and fresh-client restores.
   - Verified zero plaintext passwords, master keys, or signing keys leak into diagnostics or telemetry logs.
