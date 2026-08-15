# PHASE 01: Cryptographic Space Prototype & Envelope Storage

## Objective
Implement the core Space Vault Manager and cryptographic envelope storage mechanism with Argon2id password key derivation and credential-selected unlocking.

## Requirements
1. **Argon2id Key Derivation**: Derive 256-bit Key Encryption Key (KEK) with parameter verification (64 MiB, 3 iterations, 32-byte salt).
2. **Envelope Scheme**: Seal random 256-bit Space Master Key (SMK) inside an AEAD envelope (XChaCha20-Poly1305 / AES-256-GCM).
3. **Multi-Space Management**: Support creating, listing, unlocking, and locking multiple independent Spaces.
4. **Subkey Derivation**: HKDF-SHA256 expansion for storage and identity subkeys.
5. **Memory Zeroization**: Ensure all volatile key buffers are zeroized upon lock.
6. **Negative / Adversarial Tests**: Verify wrong password rejection, corrupted ciphertext rejection, tampered salt rejection, and cross-space read failure.

## Definition of Done
- `SpaceVaultManager` fully implemented with positive and attack tests passing.
- No plaintext keys or passwords persist on disk or in error traces.
- `docs/ai/CURRENT_STATE.md` and `docs/ai/CHANGELOG.md` updated.
