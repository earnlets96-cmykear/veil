# ACTIVE_TASK.md — Current Work Tracker

## Task
**VEIL Phase 1: Cryptographic Space Prototype & Envelope Storage**

## Objective
Implement and validate the core multi-space cryptographic isolation model, Argon2id KDF, XChaCha20-Poly1305 AEAD envelope wrapping, credential-selected unlocking, partitioned storage encryption, and comprehensive negative/adversarial testing.

## Requirements
- [x] Independent Phase 0 takeover verification and cryptographic audit.
- [ ] Implement `src/crypto/kdf.ts` (Argon2id password KDF via `@noble/hashes/argon2.js`).
- [ ] Implement `src/crypto/aead.ts` (XChaCha20-Poly1305 AEAD via `@noble/ciphers/chacha.js`).
- [ ] Implement `src/crypto/hkdf.ts` (HKDF-SHA256 subkey expansion via `@noble/hashes/hkdf.js`).
- [ ] Implement `src/spaces/envelope.ts` (Versioned SpaceHeaderEnvelope serializer/validator).
- [ ] Implement `src/spaces/session.ts` (Active in-memory SpaceSession with memory zeroization).
- [ ] Implement `src/spaces/vault.ts` (SpaceVaultManager with credential-selected unlocking).
- [ ] Implement `src/storage/spaceStore.ts` (Partitioned EncryptedSpaceStore).
- [ ] Implement full test suites (`crypto-primitives`, `space-vault`, `space-isolation`, `tampering-corruption`, `security-logging`).
- [ ] Update documentation and ADRs with refined terminology and runtime limitations.
- [ ] Run full test suite and verify 100% passing tests.
- [ ] Create Phase 1 Git commit.

## Acceptance Criteria
1. Unlocking Main Space yields `SMK_Main` which cannot decrypt Private Space ($SMK_{Main} \neq SMK_{Private}$).
2. Locked Space cannot be read.
3. Tampered ciphertexts, salts, nonces, or tags fail safely.
4. 100-Space independence test passes.
5. All tests pass with zero failures.

## Current Status
In Progress — Implementing cryptographic core modules.

## Next Action
Author `src/crypto/kdf.ts`, `src/crypto/aead.ts`, and `src/crypto/hkdf.ts`.
