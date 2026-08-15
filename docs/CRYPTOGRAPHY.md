# CRYPTOGRAPHY.md — Audited Cryptographic Specifications

## 1. Cryptographic Invariant

> **VEIL strictly enforces the rule: NEVER INVENT CRYPTOGRAPHY.**
> All algorithms, constructions, and parameter choices are based on published, peer-reviewed, and mature cryptographic standards.

---

## 2. Cryptographic Primitives Matrix

| Primitive Category | Selected Algorithm | Standard / Reference | Purpose |
| :--- | :--- | :--- | :--- |
| **Password KDF** | **Argon2id** | RFC 9106 | Derives Space Key Encryption Key (KEK) from password |
| **Symmetric AEAD** | **XChaCha20-Poly1305** & **AES-256-GCM** | IETF / NIST SP 800-38D | Seals Space Master Key envelopes and local storage partitions |
| **Digital Signatures** | **Ed25519** | RFC 8032 | Identity authentication, signed prekeys, and contact verification |
| **Key Agreement (DH)** | **X25519** | RFC 7748 | Ephemeral and long-term Diffie-Hellman key exchange |
| **Key Derivation** | **HKDF-SHA256** | RFC 5869 | Expands Space Master Key into domain-separated subkeys |
| **End-to-End Ratchet** | **Double Ratchet** | Signal Protocol / audited specs | Guarantees Forward Secrecy & Post-Compromise Security |
| **CSPRNG** | **WebCrypto CSPRNG** / `crypto.getRandomValues` | W3C Web Cryptography API | Generates salts, nonces, and cryptographic keys |

---

## 3. Detailed Parameter Specifications

### 1. Password Key Derivation (Argon2id)
- **Algorithm**: Argon2id
- **Memory Cost ($m$)**: $65,536\text{ KiB}$ ($64\text{ MiB}$)
- **Time Cost ($t$)**: $3\text{ iterations}$
- **Parallelism ($p$)**: $1\text{ thread}$
- **Salt Length**: $32\text{ bytes}$ ($256\text{ bits}$, generated per Space)
- **Derived Key Length**: $32\text{ bytes}$ ($256\text{ bits}$)

### 2. Envelope Authenticated Encryption (AEAD)
- **Algorithm**: XChaCha20-Poly1305 (or AES-256-GCM)
- **Key Size**: $256\text{ bits}$ ($32\text{ bytes}$)
- **Nonce Size**: $192\text{ bits}$ ($24\text{ bytes}$ for XChaCha20) or $96\text{ bits}$ ($12\text{ bytes}$ for AES-GCM)
- **Tag Size**: $128\text{ bits}$ ($16\text{ bytes}$)
- **Invariant**: Nonces are cryptographically random and never reused with the same key.

### 3. Asymmetric Keys & Signatures
- **Identity Curve**: Curve25519 / Ed25519
- **Public Key Size**: $32\text{ bytes}$
- **Private Key Size**: $32\text{ bytes}$
- **Signature Length**: $64\text{ bytes}$

### 4. HKDF Subkey Expansion
- **Hash Function**: SHA-256
- **Domain String Tags**:
  - Storage: `"veil-v1-storage-key"`
  - Identity: `"veil-v1-identity-seed"`
  - Prekeys: `"veil-v1-prekey-seed"`
  - Media: `"veil-v1-media-key"`

---

## 4. Double Ratchet Lifecycle

Each active 1-to-1 conversation maintains an asymmetric Diffie-Hellman ratchet combined with dual symmetric KDF ratchets:
1. **KDF Chain Ratchet**: Every message sent advances the sending chain key and yields an ephemeral message key.
2. **DH Ratchet**: When a reply arrives, a new ephemeral X25519 key exchange occurs, resetting the root key and generating fresh symmetric chains.
3. **Forward Secrecy**: Message keys are deleted immediately after decryption; past ciphertexts cannot be decrypted even if future keys are compromised.
4. **Break-in Recovery (Post-Compromise Security)**: Once an active session ratchets after key compromise, the attacker loses the ability to decrypt subsequent messages.
