# CHANGELOG.md — VEIL Project Changelog

All notable changes, architectural decisions, and security milestones across the VEIL project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
