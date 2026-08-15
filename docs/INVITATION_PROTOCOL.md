# INVITATION_PROTOCOL.md — VEIL Cryptographic Invitation Protocol v1

## 1. Protocol Overview

VEIL invitations allow users to share their public cryptographic identity without exposing private keys, passwords, or Space Master Keys.

### Canonical Invitation Schema

```json
{
  "version": 1,
  "identityId": "8f4b2a1c...",
  "name": "Alice",
  "signingPublicKey": "base64...",
  "keyAgreementPublicKey": "base64...",
  "fingerprint": "ALICE-FINGERPRINT-1234",
  "createdAt": 1771100000000,
  "expiresAt": 1771704800000,
  "signature": "base64..."
}
```

---

## 2. Security Guarantees

1. **Ed25519 Authentication**: The sender signs the canonical JSON payload with their Space Identity signing private key. Any tampering invalidates the signature.
2. **Strict Expiration**: Invitations expire by default after 7 days (`expiresAt`). Expired invitations are rejected.
3. **No Private Secrets**: Contains strictly public keys and public identifiers.
4. **Transport Independence**: Transmitted as `veil://invite/<base64>` links, QR codes, or JSON files.
