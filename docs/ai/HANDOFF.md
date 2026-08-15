# HANDOFF.md — AI Agent Session Handoff

## 1. Project Overview & Current Phase

- **Project**: VEIL (Privacy-First Messenger with Multi-Space Cryptographic Architecture)
- **Current Phase**: **PHASE 6: Multi-Device Synchronization & Cryptographic Recovery** — Complete
- **Status**: 184/184 tests passing across 61 test files
- **Current Branch**: `master`

---

## 2. Phase 6 Implementation Summary

### What Was Implemented
1. **Ephemeral Device Linking Protocol** (`src/device/enrollment.ts`):
   - Ephemeral X25519 Diffie-Hellman key agreement between Primary and Secondary devices.
   - 6-digit Short Authentication String (SAS) derivation via `HKDF-SHA256(ikm=sharedSecret, salt=pubP||pubS, info="veil-v1-device-sas", length=4)` for MITM prevention.
   - Encrypted credential tunnel using `XChaCha20-Poly1305` keyed from the ephemeral DH shared secret.
   - Ed25519-signed device authorization records binding secondary device identity to Space identity.
2. **Selective Space Synchronization** (`src/device/enrollment.ts`):
   - User explicitly selects which Space(s) to transfer during enrollment.
   - Unselected Spaces produce zero key material, zero envelopes, and zero metadata in the tunnel payload.
3. **Device Registry & Revocation** (`src/device/deviceManager.ts`):
   - `DeviceRegistry` tracking all enrolled devices per Space with `ACTIVE` / `REVOKED` status.
   - Signed `DeviceRevocationRecord` tombstones using the Space's Ed25519 identity key.
   - Revoked devices are permanently blocked from re-registration.
4. **BIP-39 Mnemonic Recovery** (`src/recovery/bip39.ts`, `src/recovery/wordlist.ts`):
   - Standard 24-word English mnemonic phrase encoding of the 256-bit Space Master Key (SMK).
   - 8-bit SHA-256 checksum validation.
   - Deterministic Space and identity restoration from mnemonic phrase alone.
5. **Encrypted Emergency Recovery File** (`src/recovery/recoveryVault.ts`):
   - Standalone `.veilbackup` file format (`VEIL-RECOVERY-v1`) protected by Argon2id + XChaCha20-Poly1305.
   - Import with wrong passphrase correctly rejected.
6. **Space Vault Master Key Import** (`src/spaces/vault.ts`):
   - `CreateSpaceOptions.masterKey` field enables deterministic Space creation from recovered/imported keys.

### Verified Invariants (184/184 Tests Passing)
- **Phases 0-5**: All previous invariants maintained (Space Vaults, identities, Double Ratchet, groups, media).
- **Phase 6**: Device enrollment SAS handshake, MITM detection, selective sync isolation, device revocation, BIP-39 mnemonic generation/restoration, encrypted backup file export/import, anti-backdoor enforcement.

---

## 3. Invariants the Next Agent Must NOT Break

1. **NEVER INVENT CRYPTOGRAPHY**: Use established primitives (`@noble/curves`, `@noble/hashes`, `@noble/ciphers`).
2. **FORWARD SECRECY & POST-COMPROMISE SECURITY**: Never reuse message keys; zeroize them immediately after use; rotate group sender keys on member removal.
3. **THE SERVER IS UNTRUSTED**: The relay server receives only opaque transport envelopes, blind mailbox tokens, and opaque ciphertext media chunks; never message plaintexts, prekey private keys, group secrets, or media encryption keys.
4. **CROSS-SPACE ISOLATION**: Space A cannot decrypt Space B's conversations, group states, or media items.
5. **ZERO SENSITIVE LOGGING**: No plaintexts, passwords, SMKs, media keys, or private keys in logs.
6. **ZERO SERVER RECOVERY**: Server has zero ability to reset passwords, escrow keys, or bypass Argon2id envelopes.

---

## 4. Exact Next Action for Incoming Agent

Proceed to **Phase 7: Privacy UX, App Lock, Notifications, Panic Lock, Decoy Space** ([`prompts/PHASE_07.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_07.md)).
1. Read `AGENTS.md` and `docs/ai/PROJECT_CONTEXT.md`.
2. Update `docs/ai/ACTIVE_TASK.md` for Phase 7.
3. Implement app-lock biometric/PIN screen, notification privacy controls, panic lock (instant wipe), and enhanced Decoy Space UX.
