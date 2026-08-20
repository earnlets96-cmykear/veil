# Account Persistence & Zero-Knowledge Recovery

## 1. Overview
VEIL achieves zero-knowledge account persistence by separating the account authentication verifier from the cryptographic Space Master Key (SMK).

---

## 2. Authentication Verifier (Argon2id)

When a user creates an account:
1. Client generates a random 32-byte salt (`authSalt`).
2. Server computes `authHash = Argon2id(password, authSalt, memory=64MB, iterations=3, parallelism=1)`.
3. Server stores `authHash` and `authSalt` in the `accounts` table.
4. Server never receives, stores, or logs the plaintext password.

---

## 3. Deterministic Identity Restoration Invariants

```
               ┌───────────────────────────────┐
               │    24-Word BIP-39 Mnemonic    │
               └───────────────┬───────────────┘
                               │ PBKDF2-HMAC-SHA512
                               ▼
               ┌───────────────────────────────┐
               │     512-bit Recovery Seed     │
               └───────────────┬───────────────┘
                               │ HKDF-SHA256 (Salt, Info)
                               ▼
               ┌───────────────────────────────┐
               │    256-bit Space Master Key   │ (SMK)
               └───────┬───────────────┬───────┘
                       │               │
      HKDF-SHA256 (Signing)      HKDF-SHA256 (Agreement)
                       ▼               ▼
               ┌───────────────┐ ┌───────────────┐
               │ Ed25519 Keys  │ │ X25519 Keys   │
               └───────┬───────┘ └───────┬───────┘
                       │                 │
                       └────────┬────────┘
                                │ SHA-256(EdPub || DhPub)
                                ▼
                       ┌─────────────────┐
                       │   identityId    │ (Exact Match Byte-for-Byte)
                       └─────────────────┘
```

When a user installs VEIL on a new device and recovers their Space:
- The derived `Space Master Key` is identical byte-for-byte.
- The derived `Ed25519 signing keypair` is identical byte-for-byte.
- The derived `X25519 key agreement keypair` is identical byte-for-byte.
- The computed `identityId` and fingerprint are identical byte-for-byte.
- Existing peers continue communicating with the same Double Ratchet identity without key mismatch warnings.
