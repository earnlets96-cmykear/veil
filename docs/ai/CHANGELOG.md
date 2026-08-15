# CHANGELOG.md — VEIL Project Changelog

All notable changes, architectural decisions, and security milestones across the VEIL project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Phase 4] - 2026-08-15

### Added
- **End-to-End Encrypted 1-to-1 Messaging (Double Ratchet & X3DH)**:
  - `src/ratchet/types.ts`: Protocol data structures, `PrekeyBundle`, `SignedPrekey`, `OneTimePrekey`, `RatchetMessage`, `PersistedRatchetState`.
  - `src/ratchet/kdf.ts`: Root key KDF (HKDF-SHA256), Symmetric chain KDF (HMAC-SHA256), and canonical header AAD serialization.
  - `src/ratchet/prekeys.ts`: `PrekeyManager` managing generation, signing, and consumption of Signed Prekeys and One-Time Prekey pools.
  - `src/ratchet/x3dh.ts`: Extended Triple Diffie-Hellman protocol (`initiateX3DH` and `receiveX3DH`).
  - `src/ratchet/ratchet.ts`: `DoubleRatchetSession` implementing full Signal-specification DH and symmetric ratcheting, bounded skipped message keys (`MAX_SKIPPED_KEYS = 500`), and single-use key zeroization.
  - `src/messaging/sessionStore.ts`: `RatchetSessionStore` providing encrypted persistence in `EncryptedSpaceStore`.
  - `src/messaging/conversationManager.ts`: `ConversationManager` orchestrating asynchronous handshakes, outbox/inbox queues, message sending/receiving, and local encrypted history.
- **Architecture Decisions**: Documented `ADR-019` (X3DH Key Agreement), `ADR-020` (Double Ratchet Protocol), `ADR-021` (Bounded Skipped Keys), `ADR-022` (Encrypted Session Persistence).
- **Test Suites (10 new suites, 15 new tests, 147 total)**:
  - `tests/prekey-management.test.ts`: SPK Ed25519 signing and OPK pool consumption.
  - `tests/x3dh-handshake.test.ts`: Asymmetric handshake equality and MITM signature rejection.
  - `tests/double-ratchet-core.test.ts`: Bidirectional ping-pong messaging with DH ratchet steps.
  - `tests/out-of-order-messages.test.ts`: Skipped messages (1, 3, 2) and immediate key erasure on use.
  - `tests/forward-secrecy.test.ts`: Current state compromise cannot decrypt past messages.
  - `tests/post-compromise-recovery.test.ts`: Break-in recovery after fresh DH ratchet step.
  - `tests/ratchet-tampering.test.ts`: Header sequenceNum tampering and bit-flipped ciphertext rejection.
  - `tests/session-persistence.test.ts`: Ratchet session restoration across lock/unlock cycles.
  - `tests/conversation-e2ee.test.ts`: Full integration (Alice -> X3DH -> Ratchet -> Mock Transport -> Ratchet -> Bob).
  - `tests/ratchet-isolation.test.ts`: Cross-space isolation (Private Space cannot decrypt Main Space messages).

---

## [Phase 3] - 2026-08-15

### Added
- **Privacy-Preserving Untrusted Transport Interface**:
  - `src/transport/types.ts`: Size classes (`SMALL`, `MEDIUM`, `LARGE`, `XLARGE`), `TransportEnvelope`, `MailboxCapability`, `ServerMailboxRecord`, `ITransportAdapter`.
  - `src/transport/padding.ts`: Length-prefixed deterministic padding and safe unpadding.
  - `src/transport/capability.ts`: Opaque `mailboxId` generation, 256-bit capability secrets, and `SHA-256(capability || tag)` verifier derivation.
  - `src/transport/protection.ts`: Temporary Phase 3 authenticated transport protection.
  - `src/transport/envelope.ts`: Version 1 transport envelope packaging, TTL calculation, and validation.
  - `src/transport/outbox.ts`: `EncryptedOutbox` partitioned per Space in `EncryptedSpaceStore` with retry state.
  - `src/transport/inbox.ts`: `EncryptedInbox` partitioned per Space with encrypted processed ID deduplication registry.
  - `src/transport/server.ts`: `MockTransportServer` with capability verifier checks, TTL auto-purge, failure simulation, and database dump inspection.
  - `src/transport/client.ts`: `TransportClient` coordinating outbox/inbox queues, retries, and offline mode.
- **Architecture Decisions**: Documented `ADR-015` (blind mailbox model), `ADR-016` (size classes and padding), `ADR-017` (encrypted outbox/inbox), `ADR-018` (transport adapter pattern).
- **Test Suites (10 new suites, 31 new tests, 132 total)**:
  - `tests/transport-mailbox.test.ts`: Mailbox lifecycle, status queries, deletion.
  - `tests/transport-authentication.test.ts`: Capability verification, wrong token rejection, verifier one-way hashing.
  - `tests/transport-isolation.test.ts`: Main vs Private vs Decoy space transport isolation.
  - `tests/transport-tampering.test.ts`: Payload ciphertext tampering, nonce tampering, malformed envelope rejection.
  - `tests/transport-replay.test.ts`: Envelope replay detection, duplicate retry rejection, lock/unlock persistence.
  - `tests/transport-padding.test.ts`: Size classes (512B, 2KB, 8KB, 32KB), boundary sizes, safe corruption handling.
  - `tests/transport-expiration.test.ts`: Envelope TTL expiration, fetch auto-purge, global purge.
  - `tests/transport-failure.test.ts`: Offline mode queueing, timeout resilience, recovery on reconnection.
  - `tests/malicious-server.test.ts`: Corrupted server payload handling, truncated response handling.
  - `tests/metadata-exposure.test.ts`: Server database dump audit (zero passwords, SMKs, private keys, or plaintexts).

---

## [Phase 2] - 2026-08-15

### Added
- **Cryptographic Identity Layer**:
  - `src/crypto/hkdf.ts`: Extended with two-tier HKDF identity derivation domains (`veil-v1-identity-seed`, `veil-v1-signing-key`, `veil-v1-key-agreement`).
  - `src/identity/signing.ts`: Ed25519 digital signature wrapper (`@noble/curves/ed25519.js`, v1.8.0).
  - `src/identity/keyAgreement.ts`: X25519 key agreement wrapper (`@noble/curves/ed25519.js`, exports `x25519`).
  - `src/identity/canonical.ts`: Deterministic canonical serialization with explicit field ordering.
  - `src/identity/fingerprint.ts`: SHA-256 fingerprint (12 × 5-digit groups) and identity ID computation.
  - `src/identity/document.ts`: Self-signed `IdentityDocument` with Ed25519 self-signature over canonical bytes.
  - `src/identity/manager.ts`: `SpaceIdentityManager` managing creation, encrypted persistence, loading, signing, verification, and DH key agreement.
- **SpaceSession Extension**: Added `getMasterKey()` for internal identity derivation within the Space boundary.
- **Architecture Decisions**: Documented `ADR-012` (two-tier HKDF identity derivation), `ADR-013` (self-signed identity binding), `ADR-014` (Space cloning produces same identity).
- **Test Suites (52 new tests, 101 total)**:
  - `tests/identity-generation.test.ts`: Identity creation, determinism, Space independence.
  - `tests/identity-signatures.test.ts`: Ed25519 sign/verify, tampered message, wrong key.
  - `tests/key-agreement.test.ts`: X25519 DH commutativity, isolation.
  - `tests/identity-isolation.test.ts`: Cross-Space identity independence, locked Space, signing attacks.
  - `tests/identity-document.test.ts`: Self-signature verification, field tampering, unknown version.
  - `tests/identity-fingerprint.test.ts`: Determinism, format, canonical round-trip.
  - `tests/identity-tampering.test.ts`: Key substitution, bit flips, Frankenstein documents.
  - `tests/identity-lifecycle.test.ts`: Persistence, lock/unlock, password change preserves identity, deletion.

---

## [Phase 1] - 2026-08-15

### Added
- **Cryptographic Space Vault Engine**:
  - `src/crypto/kdf.ts`: Argon2id password KDF (`@noble/hashes/argon2.js`, RFC 9106).
  - `src/crypto/aead.ts`: XChaCha20-Poly1305 authenticated encryption (`@noble/ciphers/chacha.js`).
  - `src/spaces/envelope.ts`: Versioned `SpaceHeaderEnvelope` with canonical AAD context binding.
  - `src/spaces/session.ts`: `SpaceSession` with volatile key management and `destroy()`.
  - `src/spaces/vault.ts`: `SpaceVaultManager` with AAD, targeted/discovery unlock, crash-safe password change.
  - `src/storage/spaceStore.ts`: `EncryptedSpaceStore` with partitioned AEAD storage.

### Fixed
- Enforced AAD envelope metadata binding (`VEIL-v1|version:1|spaceId:<id>|alg:...|salt:...`).
- Optimized credential-selected unlock with targeted `unlockSpace(password, spaceId)`.
- Crash-safe transactional password change with atomic commit.
- Corrected terminology to "selected established cryptographic primitives".

---

## [Phase 0] - 2026-08-15

### Added
- AI-Agent Continuity System, architecture documentation, phase prompts, baseline scaffolding.
