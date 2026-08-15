# VEIL Formal Security Assurance & Cryptographic Proof Model

## 1. Cryptographic Security Model

VEIL operates under a strict threat model with explicit security boundaries:

```
[ Compromised Network / ISP ] ────> Mitigated via TLS 1.3 + Opaque AEAD Envelopes
[ Malicious / Untrusted Relay ] ──> Mitigated via Blind Capability Mailboxes + E2EE
[ Physical Forensic Inspection ] ─> Mitigated via Argon2id + Plausible Deniability Decoys
[ Coercion / Shoulder Surfing ] ──> Mitigated via Instant Emergency Panic Lock
```

---

## 2. Mathematical Invariants & Guarantees

1. **IND-CCA2 Security**: All message and storage encryptions utilize XChaCha20-Poly1305 authenticated encryption with associated data (AAD) preventing ciphertext malleability.
2. **Deterministic Domain Separation**: Key derivation uses HKDF-SHA-256 with distinct UTF-8 info strings (`veil-storage-key-v1`, `veil-identity-seed-v1`, `veil-signing-material-v1`), ensuring zero cross-domain key reuse.
3. **CSPRNG Collision Resistance**: 24-byte nonces generated via cryptographically secure random number generators exhibit a collision probability of less than $2^{-96}$ under $10^9$ generated messages.
4. **Post-Compromise Security (PCS)**: Ephemeral DH ratcheting rotates ratchet keys on every interaction turn, restoring forward secrecy after a temporary compromise.
