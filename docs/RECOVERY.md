# RECOVERY.md — VEIL Zero-Knowledge Serverless Recovery Specification

## 1. Zero-Knowledge Recovery Invariants

VEIL enforces strict serverless, zero-knowledge account recovery:
1. **NO SERVER PASSWORD RESETS**: The untrusted server cannot reset a user's password, unlock a Space, or issue temporary credentials.
2. **NO KEY ESCROW**: Server databases store zero recovery keys, zero secret shares, and zero plaintext identity documents.
3. **SELF-CUSTODIAL RECOVERY**: Account recovery is strictly client-side via **BIP-39 Mnemonic Phrases** or **Encrypted Emergency Recovery Files**.

---

## 2. BIP-39 Mnemonic Recovery Phrases

Every Space is anchored by a permanent 256-bit **Space Master Key (SMK)**.

### Mnemonic Derivation Standard
1. **Entropy to Words**:
   - The 32-byte (256-bit) SMK is encoded into **24 English words** using the standard BIP-39 wordlist (2048 words).
   - Checksum: First 8 bits of $\text{SHA-256}(\text{SMK})$ are appended to the 256 bits, yielding 264 bits (24 groups of 11 bits).
2. **Words to Entropy**:
   - The 24 words are parsed back into 264 bits.
   - The 8-bit checksum is validated against $\text{SHA-256}(\text{Entropy})$.
   - The original 32-byte SMK is reconstructed.
3. **Space Reconstruction**:
   - Given the restored SMK, the client derives all deterministic subkeys (`StorageKey`, `IdentitySeed`, `IdentityDocument`, etc.) without needing the original password.
   - The user chooses a fresh password on the new device, which generates a fresh `SpaceHeaderEnvelope` wrapping the restored SMK.

---

## 3. Encrypted Emergency Recovery File (`VEIL-RECOVERY-v1`)

Users can also export a standalone encrypted backup file (`.veilbackup`):
- **Format**:
  ```json
  {
    "format": "VEIL-RECOVERY-v1",
    "spaceId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "name": "Main Space",
    "kdfParams": {
      "algorithm": "argon2id",
      "salt": "base64...",
      "timeCost": 3,
      "memoryCost": 65536,
      "parallelism": 1
    },
    "encryptedPayload": {
      "algorithm": "XChaCha20-Poly1305",
      "nonce": "base64...",
      "ciphertext": "base64..."
    },
    "exportedAt": 1786792000000
  }
  ```
- **Password Protection**: The recovery file is encrypted using a user-specified high-entropy recovery passphrase via Argon2id + XChaCha20-Poly1305.
- **Portability**: Can be safely stored offline (e.g., USB drive, printout) without exposing plaintext keys.
