# VEIL Zero-Knowledge Account Identity Persistence & Recovery Specification

## 1. Overview & Threat Model

In VEIL, cryptographic identities are bound to isolated Spaces. To allow users to recover their accounts on fresh devices or after app reinstallation without compromising the Zero-Knowledge Security Invariant, VEIL implements client-side encrypted identity vault backups.

---

## 2. Cryptographic Workflow

```
[ User Password ] + [ Salt (32 bytes) ]
          │
          ▼
   Argon2id (t=3, m=64MB, p=1)
          │
          ▼
    [ Key Encryption Key (KEK) (32 bytes) ]
          │
          ▼
   XChaCha20-Poly1305 Encrypt
    - Plaintext: { spaceId, masterKeyBase64, identityDocument, signingPrivateKey, kaPrivateKey }
    - AAD: "VEIL-IDENTITY-BACKUP-v1|user:{username}"
          │
          ▼
   [ Encrypted Vault Blob ] ──(Upload)──> [ Cloud Database (Server) ]
```

---

## 3. Byte-for-Byte Identity Invariant

When an account is restored:
1. Client authenticates via `/v1/account/restore` and receives `encryptedVaultBlob` + `kdfParams`.
2. Client derives KEK via Argon2id from password + salt.
3. Client decrypts `encryptedVaultBlob` locally.
4. Client extracts `masterKey` and re-instantiates the Space Envelope in `SpaceVaultManager`.
5. Deterministic derivation produces the **exact same Ed25519 signing key and identityId**:
   $$\text{identityId} = \text{SHA256}(\text{Ed25519PublicKey})$$
6. Restored identity matches the original identity byte-for-byte.

---

## 4. Security Guarantees

- **No Plaintext on Server**: Server only stores ciphertext `encryptedVaultBlob`.
- **Brute-Force Resistance**: Argon2id parameters (memoryCost = 64MB) prevent GPU dictionary attacks.
- **Tamper Evident**: Poly1305 MAC tag detects any modification of the vault blob.
