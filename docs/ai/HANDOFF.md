# HANDOFF.md — AI Agent Session Handoff

## 1. Project Overview & Current Phase

- **Project**: VEIL (Privacy-First Messenger with Multi-Space Cryptographic Architecture)
- **Current Phase**: **PHASE 4: End-to-End Encrypted 1-to-1 Messaging (Double Ratchet & X3DH)** — Complete
- **Status**: 147/147 tests passing across 34 test files
- **Current Branch**: `master`

---

## 2. Phase 4 Implementation Summary

### What Was Implemented
1. **Prekey Architecture** (`src/ratchet/prekeys.ts`):
   - Signed Prekeys (`SPK`) signed with Ed25519 identity key.
   - Ephemeral One-Time Prekey (`OPK`) pools stored encrypted in `EncryptedSpaceStore`.
   - Public `PrekeyBundle` creation for asynchronous contact initiation.
2. **X3DH Protocol** (`src/ratchet/x3dh.ts`):
   - Initiator computes $DH_1 \parallel DH_2 \parallel DH_3 \ [\parallel DH_4]$ using ephemeral keypair.
   - Receiver computes identical shared master secret via stored prekeys.
3. **Double Ratchet State Machine** (`src/ratchet/ratchet.ts`):
   - Asymmetric X25519 DH Ratchets with KDF-RK (`HKDF-SHA256`).
   - Symmetric Sending/Receiving Chains with KDF-CK (`HMAC-SHA256`).
   - Bounded out-of-order skipped message key handling (`MAX_SKIPPED_KEYS = 500`).
   - Single-use message key zeroization.
   - AAD header authentication with XChaCha20-Poly1305.
4. **Encrypted Session & Message Persistence** (`src/messaging/sessionStore.ts`, `src/messaging/conversationManager.ts`):
   - Ratchet sessions and conversation histories encrypted at rest in `EncryptedSpaceStore`.

### Verified Invariants (147/147 Tests Passing)
- **Phases 0-3**: Space Vaults, Argon2id KDF, XChaCha20-Poly1305 AEAD, independent Ed25519/X25519 identities, blind mailboxes, size classes.
- **Phase 4**: X3DH handshake equality, MITM detection, ping-pong DH ratcheting, out-of-order message decryption (1, 3, 2), forward secrecy, post-compromise break-in recovery, header/ciphertext tampering rejection, lock/unlock persistence, and cross-space conversation isolation.

---

## 3. Invariants the Next Agent Must NOT Break

1. **NEVER INVENT CRYPTOGRAPHY**: Use established primitives (`@noble/curves`, `@noble/hashes`, `@noble/ciphers`).
2. **FORWARD SECRECY & POST-COMPROMISE SECURITY**: Never reuse message keys; zeroize them immediately after use; ratchet forward on replies.
3. **THE SERVER IS UNTRUSTED**: The relay server receives only opaque transport envelopes and blind mailbox tokens; never message plaintexts, prekey private keys, or identity keys.
4. **CROSS-SPACE ISOLATION**: Space A cannot decrypt Space B's conversations or access Space B's ratchet sessions.
5. **ZERO SENSITIVE LOGGING**: No message plaintexts, message keys, or private keys in logs.

---

## 4. Exact Next Action for Incoming Agent

Proceed to **Phase 5: Encrypted Group Messaging & Encrypted Media** ([`prompts/PHASE_05.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_05.md)).
1. Read `AGENTS.md` and `docs/ai/PROJECT_CONTEXT.md`.
2. Update `docs/ai/ACTIVE_TASK.md` for Phase 5.
3. Implement Sender Keys (Group Ratchet / Megolm-style ratchet) for scalable multi-party end-to-end encryption.
4. Implement Encrypted Media Vault (symmetric media encryption with chunking and ephemeral keys).
