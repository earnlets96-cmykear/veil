# ACTIVE_TASK.md — Current Work Tracker

## Task
**VEIL Phase 1: Cryptographic Space Prototype & Envelope Storage (Hardened with Corrections)**

## Objective
Implement and validate the core multi-space cryptographic isolation model, Argon2id KDF, XChaCha20-Poly1305 AEAD with AAD envelope context binding, crash-safe password changes, credential-selected unlocking, partitioned storage encryption, and comprehensive negative/adversarial testing.

## Requirements
- [x] Independent Phase 0 takeover verification and cryptographic audit.
- [x] Implement `src/crypto/kdf.ts` (Argon2id password KDF via `@noble/hashes/argon2.js`).
- [x] Implement `src/crypto/aead.ts` (XChaCha20-Poly1305 AEAD via `@noble/ciphers/chacha.js`).
- [x] Implement `src/crypto/hkdf.ts` (HKDF-SHA256 storage subkey expansion via `@noble/hashes/hkdf.js`).
- [x] Implement `src/spaces/envelope.ts` (Versioned SpaceHeaderEnvelope validator with canonical AAD binder).
- [x] Implement `src/spaces/session.ts` (Active in-memory SpaceSession with memory zeroization).
- [x] Implement `src/spaces/vault.ts` (SpaceVaultManager with AAD context binding, targeted unlocking, and transactional password changes).
- [x] Implement `src/storage/spaceStore.ts` (Partitioned EncryptedSpaceStore).
- [x] Implement full test suites (`crypto-primitives`, `space-vault`, `space-isolation`, `tampering-corruption`, `security-logging`).
- [x] Update documentation and ADRs (`ADR-007` to `ADR-011`) with refined terminology, AAD details, and runtime limitations.
- [x] Run full test suite and verify 100% passing tests (49/49 tests).
- [ ] Create Phase 1 Git commit.

## Acceptance Criteria
1. Unlocking Main Space yields `SMK_Main` which cannot decrypt Private Space ($SMK_{Main} \neq SMK_{Private}$).
2. AAD Context Transplantation attacks fail.
3. Locked Space cannot be read.
4. Tampered ciphertexts, salts, nonces, or tags fail safely.
5. Crash-safe password change rolls back safely on failure.
6. 100-Space independence test passes.
7. All 49 tests pass with zero failures.

## Current Status
Phase 1 Complete — Ready for Git commit.

## Next Action
Stage and commit Phase 1 corrections to Git repository.
