# HANDOFF.md — AI Agent Session Handoff

## 1. Project Overview & Current Phase

- **Project**: VEIL (Privacy-First Messenger with Multi-Space Cryptographic Architecture)
- **Current Phase**: **PHASE 3: Privacy-Preserving Untrusted Transport Interface** — Complete
- **Status**: 132/132 tests passing across 24 test files
- **Current Branch**: `master`

---

## 2. Phase 3 Implementation Summary

### What Was Implemented
1. **Blind Mailbox Model** (`src/transport/capability.ts`, `src/transport/server.ts`):
   - Opaque random 32-byte hex `mailboxId`.
   - 256-bit client-held capability secrets.
   - Server-stored verifiers: `SHA-256(capability || "veil-v1-mailbox-auth")`.
2. **Deterministic Size Classes & Padding** (`src/transport/padding.ts`):
   - Fixed classes: `SMALL` (512B), `MEDIUM` (2KB), `LARGE` (8KB), `XLARGE` (32KB).
   - 4-byte length prefix + CSPRNG random padding bytes.
3. **Transport Envelope Model** (`src/transport/envelope.ts`):
   - Version 1 envelope with `envelopeId`, `mailboxId`, `payload`, `sizeClass`, `createdAt`, `expiresAt` (TTL).
4. **Encrypted Local Outbox & Inbox** (`src/transport/outbox.ts`, `src/transport/inbox.ts`):
   - Outbox queue stored encrypted under Space's `StorageKey` with retry backoff.
   - Inbox with cryptographic `processed_ids` deduplication registry for replay protection.
5. **Untrusted Mock Transport Server & Client** (`src/transport/server.ts`, `src/transport/client.ts`):
   - Server holds zero user profiles, passwords, SMKs, or private keys.
   - Implements TTL auto-purge, failure simulation, database dump audit.

### Verified Invariants (132/132 Tests Passing)
- **Phase 0 & 1**: Space Vault, Argon2id KDF, XChaCha20-Poly1305 AEAD, AAD binding, 100-Space isolation.
- **Phase 2**: Independent Ed25519/X25519 identities, self-signed documents, 60-digit fingerprints.
- **Phase 3**: Blind mailboxes, capability verifier hashing, size classes, TTL expiration, replay deduplication, offline queueing, malicious server handling, and server database zero-secret audit.

---

## 3. Invariants the Next Agent Must NOT Break

1. **NEVER INVENT CRYPTOGRAPHY**: Use established libraries (`@noble/hashes`, `@noble/ciphers`, `@noble/curves`).
2. **THE SERVER IS UNTRUSTED**: The server must NEVER receive passwords, SMKs, private keys, plaintext messages, or social graphs.
3. **BLIND MAILBOXES**: Mailboxes must not be derived from user phone numbers, emails, or public keys.
4. **CROSS-SPACE ISOLATION**: Space A cannot read Space B's outbox, inbox, or transport capability.
5. **ZERO SENSITIVE LOGGING**: No capability secrets, private keys, or plaintexts in logs or error traces.
6. **MANDATORY ATTACK TESTS**: Maintain negative and adversarial test coverage for all features.

---

## 4. Exact Next Action for Incoming Agent

Proceed to **Phase 4: End-to-End Encrypted 1-to-1 Messaging & Double Ratchet** ([`prompts/PHASE_04.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_04.md)).
1. Read `AGENTS.md` and `docs/ai/PROJECT_CONTEXT.md`.
2. Update `docs/ai/ACTIVE_TASK.md` for Phase 4.
3. Implement the Double Ratchet algorithm (X25519 DH ratchet, symmetric KDF chains, message keys) using the Phase 2 identities and Phase 3 transport envelopes.
4. Add Prekey bundles (Identity Key, Signed Prekey, One-Time Prekeys) for asynchronous session initiation (X3DH / Signal-style handshake).
