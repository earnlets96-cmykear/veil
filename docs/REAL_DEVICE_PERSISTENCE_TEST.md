# Real Device Persistence & Validation Protocol

## 1. Scope & Objective
This protocol validates that user accounts, encrypted Space identities, conversation histories, attachments, and voice recordings persist durably across:
- Browser tab reloads
- Complete browser cache eviction / private window isolation
- Android application uninstall and re-install
- Backend relay restart / Render redeployment

---

## 2. Test Step 1: Account Creation & Profile Publishing
1. Open Device A (e.g., Chrome).
2. Register account `@alice_prod` with secure password.
3. Unlock Space `Personal`.
4. Publish signed directory profile.
5. Record 5-second voice note and send attachment `report.pdf`.

---

## 3. Test Step 2: Backend Cold Restart Simulation
1. Restart the Render Web Service (trigger Manual Deploy or Restart).
2. Confirm `/healthz` returns `{"status": "ok", "database": "connected", "objectStorage": "ok"}`.
3. On Device A, refresh page. Log in with `@alice_prod`.
4. Verify all spaces, contacts, and message history rehydrate immediately from PostgreSQL and R2.

---

## 4. Test Step 3: Clean Device / App Re-installation Recovery
1. Open Device B (e.g., Firefox Private Window or Android fresh install).
2. Choose **Recover Account with Passphrase / Mnemonic**.
3. Input 24-word BIP-39 mnemonic.
4. Verify:
   - Restored Space identity ID matches Device A 100% byte-for-byte.
   - Profile `@alice_prod` is recognized as the same cryptographic identity.
   - Attachment and voice message ciphertexts download and decrypt losslessly.
