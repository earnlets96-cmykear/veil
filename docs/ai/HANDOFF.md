# HANDOFF.md — AI Agent Session Handoff

## 1. Project Overview & Current Phase

- **Project**: VEIL (Privacy-First Messenger with Multi-Space Cryptographic Architecture)
- **Current Phase**: **PHASE 1: Cryptographic Space Prototype & Envelope Storage**
- **Status**: Complete & Verified (46/46 tests passing)
- **Current Branch**: `master`

---

## 2. Verified Repository Reality

- **Cryptographic Implementation**:
  - `src/crypto/kdf.ts`: Argon2id KDF (`@noble/hashes` v1.7.0).
  - `src/crypto/aead.ts`: XChaCha20-Poly1305 AEAD (`@noble/ciphers` v2.3.0).
  - `src/crypto/hkdf.ts`: Domain-separated HKDF-SHA256 (`@noble/hashes` v1.7.0).
  - `src/crypto/memory.ts`: Best-effort zeroization & secure buffer wrappers.
  - `src/crypto/utils.ts`: CSPRNG, Base64/Hex conversion, constant-time equality.
- **Space Layer**:
  - `src/spaces/envelope.ts`: `SpaceHeaderEnvelope` (version: 1) validator/serializer.
  - `src/spaces/session.ts`: `SpaceSession` managing active volatile keys and memory destruction.
  - `src/spaces/vault.ts`: `SpaceVaultManager` with credential-selected unlocking, password change, and deletion.
  - `src/storage/spaceStore.ts`: `EncryptedSpaceStore` with partitioned AEAD key-value storage.
- **Test Status**:
  - `tests/phase0-baseline.test.ts` (12 tests) — PASS
  - `tests/security-logging.test.ts` (1 test) — PASS
  - `tests/crypto-primitives.test.ts` (13 tests) — PASS
  - `tests/tampering-corruption.test.ts` (7 tests) — PASS
  - `tests/space-vault.test.ts` (8 tests) — PASS
  - `tests/space-isolation.test.ts` (5 tests, including 100-Space test) — PASS
  - **Total**: 46/46 passed (100% passing)

---

## 3. Invariants the Next Agent Must NOT Break

1. **NEVER INVENT CRYPTOGRAPHY**: Use only mature, selected libraries (`@noble/hashes`, `@noble/ciphers`, `@noble/curves`, WebCrypto).
2. **PASSWORD IS NOT THE SPACE MASTER KEY**: Passwords derive KEK via Argon2id; KEK unseals random 256-bit SMK.
3. **ISOLATION BY DEFAULT**: Space A and Space B share ZERO key material. Space A cannot decrypt Space B database records.
4. **DOMAIN SEPARATION**: All subkeys derive via HKDF-SHA256 with distinct domain tags (`"veil-v1-storage-key"`, `"veil-v1-identity-seed"`, etc.).
5. **ZERO SENSITIVE LOGGING**: No passwords, SMKs, or plaintexts in logs or error traces.
6. **MANDATORY ATTACK TESTS**: All security features must maintain negative/tampering tests.

---

## 4. Exact Next Action for Incoming Agent

Proceed to **Phase 2: Independent Space Cryptographic Identities** ([`prompts/PHASE_02.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_02.md)).
1. Read `AGENTS.md` and `docs/ai/PROJECT_CONTEXT.md`.
2. Update `docs/ai/ACTIVE_TASK.md` for Phase 2.
3. Implement `SpaceIdentityManager` using `@noble/curves/ed25519` for signing and X25519 for key exchange, derived deterministically from each Space's `IdentitySeed`.
4. Implement contact card formatting (`veil://contact?...`), QR serialization, safety numbers, and cross-space identity independence tests.
