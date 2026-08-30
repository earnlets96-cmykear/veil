# Phase 45A Authenticated Media and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore secure, authenticated attachment delivery and fresh-install account recovery without persisting authentication credentials.

**Architecture:** A token-only persisted session is bound to its Space; an in-memory coordinator supplies credentials only during the active unlock/recovery flow. A versioned, outer-encrypted recovery snapshot captures each unlocked Space's identity and encrypted application records, while server attachment authorization resolves only canonical recipient identities.

**Tech Stack:** TypeScript, React, Vitest, Argon2id, XChaCha20-Poly1305, IndexedDB/MemoryAdapter, VEIL cloud HTTP server.

---

### Task 1: Fail-closed session and attachment transport

**Files:**
- Modify: `src/network/cloudClient.ts`
- Modify: `src/ui/app/AppState.tsx`
- Test: `tests/phase45a-auth-security.test.ts`

- [ ] Write a failing test asserting an attachment call without a syntactically valid installed session rejects before invoking `fetch`, and that a 401 clears the installed session.
- [ ] Run `npx vitest run tests/phase45a-auth-security.test.ts` and observe the expected failure.
- [ ] Add `CloudSessionState` validation and `requireAuthenticatedSession`; gate attachment create/upload/download/delete; remove CloudClient console output.
- [ ] Replace `ensureCloudSession` with token-only restoration and in-memory credential reauthentication; remove `explicitPassword`, `authPassword`, and registration fallback.
- [ ] Re-run the focused test and commit `fix: fail closed for unauthenticated media requests`.

### Task 2: Canonical recipient attachment authorization

**Files:**
- Modify: `src/contacts/types.ts`
- Modify: `src/contacts/contactManager.ts`
- Modify: `src/contacts/contactRequestManager.ts`
- Modify: `src/ui/app/AppState.tsx`
- Test: `tests/phase45a-authenticated-media-e2e.test.ts`

- [ ] Write a failing HTTP test where a recipient with a verified canonical username downloads the sender's encrypted ciphertext, while a display-name-only/third-party request is rejected.
- [ ] Run the test and observe recipient authorization fail with the current display-name metadata.
- [ ] Propagate canonical username from verified profile data into contacts and reject sends without it; send this field as attachment recipient authorization metadata.
- [ ] Run the focused test and commit `fix: authorize media recipients by canonical account identity`.

### Task 3: Versioned encrypted recovery snapshot

**Files:**
- Modify: `src/account/accountManager.ts`
- Modify: `src/storage/types.ts` if raw encrypted-record import/export types require exposure
- Modify: `src/ui/app/AppState.tsx`
- Test: `tests/phase45a-auth-recovery-e2e.test.ts`

- [ ] Write a failing fresh-adapter recovery test that creates identity/contact/conversation state and encrypted media metadata before snapshot upload, wipes local storage, restores, validates identity and all state, and downloads/decrypts ciphertext with the new authenticated session.
- [ ] Run the test and observe the missing records after v1 restoration.
- [ ] Implement validated `VEIL-RECOVERY-SNAPSHOT-v2` creation and restoration, preserving encrypted records and supporting legacy v1 blobs for identity-only upgrade.
- [ ] Remove persisted auth-password writes from registration, creation, unlock, and recovery flows.
- [ ] Run the focused test and commit `feat: restore encrypted recovery snapshot on fresh install`.

### Task 4: Recursive diagnostic redaction

**Files:**
- Modify: `src/debug/runtimeDiagnostics.ts`
- Modify: `src/ui/utils/mediaLogger.ts`
- Modify: `src/account/accountManager.ts`
- Test: `tests/phase45a-sensitive-logging.test.ts`

- [ ] Write a failing test that captures console/history while exercising session, recovery, media, nested diagnostic objects, and fake password/token/key/identifier/blob values.
- [ ] Run the test and observe current identifier leakage.
- [ ] Implement recursive key/value redaction, replace sensitive recovery diagnostic payloads with coarse status, and redact MediaLogger error context.
- [ ] Re-run the focused test and commit `fix: redact recovery and media diagnostics`.

### Task 5: Verification and project records

**Files:**
- Modify: `docs/ai/CURRENT_STATE.md`
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CHANGELOG.md`
- Modify: `docs/ai/HANDOFF.md`

- [ ] Run `npx vitest run tests/phase45a-*.test.ts tests/phase45a-*.test.tsx`.
- [ ] Run `npx vitest run`.
- [ ] Run `npm run build`, `node scripts/release-build.mjs`, `npx cap sync android`, and `cmd /c "cd android && gradlew.bat assembleDebug"`.
- [ ] Record exact command results and remaining physical-device work in project records.
- [ ] Commit `docs: record Phase 45A forensic verification`.
