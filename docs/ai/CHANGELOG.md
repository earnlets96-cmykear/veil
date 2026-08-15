# CHANGELOG.md — VEIL Project Changelog

All notable changes, architectural decisions, and security milestones across the VEIL project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Phase 1] - 2026-08-15

### Added
- **Cryptographic Space Vault Engine**:
  - `src/crypto/kdf.ts`: Implemented Argon2id password key derivation using `@noble/hashes/argon2.js` (RFC 9106) with production parameters ($64\text{ MiB}, 3\text{ iterations}$).
  - `src/crypto/aead.ts`: Implemented XChaCha20-Poly1305 authenticated symmetric encryption using `@noble/ciphers/chacha.js` with 192-bit random nonces and 128-bit Poly1305 tags.
  - `src/crypto/hkdf.ts`: Implemented domain-separated HKDF-SHA256 key expansion (RFC 5869).
  - `src/spaces/envelope.ts`: Versioned `SpaceHeaderEnvelope` validator and serializer.
  - `src/spaces/session.ts`: `SpaceSession` managing active volatile memory keys with `destroy()` zeroization.
  - `src/spaces/vault.ts`: `SpaceVaultManager` implementing Space creation, credential-selected unlocking, locking, password change (rewrapping SMK without storage re-encryption), and deletion.
  - `src/storage/spaceStore.ts`: `EncryptedSpaceStore` providing partitioned AEAD key-value storage.
- **Architecture Decisions**: Documented `ADR-007` (Argon2id selection), `ADR-008` (XChaCha20-Poly1305 selection), and `ADR-009` (HKDF subkey separation).
- **Test Suites (46/46 passing)**:
  - `tests/crypto-primitives.test.ts`: Verified KDF, AEAD, HKDF, CSPRNG, and memory zeroization.
  - `tests/space-vault.test.ts`: Verified multi-space creation, unlocking, locking, password change, and deletion.
  - `tests/space-isolation.test.ts`: Verified independent key material ($SMK_{Main} \neq SMK_{Private}$), cross-space attack failure, and 100-Space independence.
  - `tests/tampering-corruption.test.ts`: Verified safe rejection of bit-flipped ciphertexts, modified nonces/salts, altered versions, and malformed JSON.
  - `tests/security-logging.test.ts`: Verified zero sensitive passwords, keys, or plaintexts leak to console or error objects.

---

## [Phase 0] - 2026-08-15

### Added
- **AI-Agent Continuity System**: Created root `AGENTS.md` operating contract and persistent `docs/ai/` tracking files (`PROJECT_CONTEXT.md`, `CURRENT_STATE.md`, `ACTIVE_TASK.md`, `DECISIONS.md`, `SECURITY_RULES.md`, `CHANGELOG.md`, `HANDOFF.md`).
- **Core Architecture & Technical Specifications**: Created `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/CRYPTOGRAPHY.md`, `docs/KEY_HIERARCHY.md`, `docs/SPACE_MODEL.md`, `docs/IDENTITY_MODEL.md`, `docs/METADATA_MODEL.md`, `docs/PRIVACY.md`, `docs/SECURITY.md`, `docs/KNOWN_LIMITATIONS.md`.
- **Phase Prompts Suite**: Created `prompts/MASTER_PROMPT.md` and individual prompts `prompts/PHASE_00.md` through `prompts/PHASE_10.md`.
- **Baseline Cryptographic Code & Design Tokens**:
  - `src/types/index.ts`: Core type definitions for envelopes, spaces, and identities.
  - `src/crypto/memory.ts`: Memory hygiene zeroization utility.
  - `src/crypto/utils.ts`: CSPRNG, Base64/Hex encoding, and constant-time comparison.
  - `src/styles/veil-design-system.css`: Vanilla CSS design system tokens and component styles.
  - `tests/phase0-baseline.test.ts`: 12 automated unit and negative tests.
