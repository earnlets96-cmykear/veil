# SECURITY_RULES.md — Non-Negotiable Security Policies for VEIL

This document outlines mandatory, permanent security invariants for all developers and AI agents working on the VEIL project.

---

## 1. Cryptographic Invariants

1. **NO CUSTOM CRYPTOGRAPHY**:
   - Never design or implement custom ciphers, hash functions, MACs, KDFs, PRNGs, or key exchange handshakes.
   - Use only established, audited algorithms:
     - **Password KDF**: Argon2id (RFC 9106) with tuned memory/iteration limits.
     - **AEAD Symmetric Encryption**: XChaCha20-Poly1305 (IETF) or AES-256-GCM.
     - **Digital Signatures**: Ed25519 (RFC 8032).
     - **Key Exchange / Diffie-Hellman**: X25519 (RFC 7748).
     - **Asymmetric E2EE**: Double Ratchet Algorithm with prekey bundles.
     - **Key Derivation from Master Keys**: HKDF-SHA256 (RFC 5869).
2. **SECURE RANDOM GENERATION**:
   - All nonces, salts, ephemeral keys, and master keys must be generated using cryptographically secure random number generators (`crypto.getRandomValues` in browser/WebCrypto or `crypto.randomBytes` in Node.js).
   - Nonces must never be reused with the same key.

---

## 2. Space Isolation & Key Custody

1. **ISOLATION BY DEFAULT**:
   - Each Space must reside in its own encrypted storage envelope or separate encrypted database partition.
   - Decrypting Space A must never reveal or unlock Space B's Master Key, database, or identity.
2. **NO PLAINTEXT PASSWORDS**:
   - User passwords must never be stored in plaintext, logged, transmitted over network sockets, or held in permanent memory.
   - Passwords are fed strictly into Argon2id to derive the Space Key Encryption Key (KEK).
3. **MEMORY HYGIENE**:
   - Sensitive key buffers (`Uint8Array`) must be explicitly wiped / zeroized (`buffer.fill(0)`) when closing a Space or upon user lock/panic lock.
4. **KEY HIERARCHY SEPARATION**:
   - Storage keys, ratchet identity keys, and transport authentication tokens must be derived using domain-separated HKDF strings (`"veil-v1-storage"`, `"veil-v1-identity"`, etc.) so that compromising one subkey does not compromise others.

---

## 3. Server & Network Trust Model

1. **UNTRUSTED SERVER**:
   - The relay server is strictly untrusted.
   - The server must never receive or process plaintext messages, group keys, media encryption keys, or user passwords.
   - The server routes blind blobs based on blind recipient mailbox tokens or ephemeral routing identifiers.
2. **NO CROSS-SPACE LINKAGE**:
   - Server endpoints and network protocols must not expose that two different Space identities originate from the same physical client or IP address where preventable (supporting blind tokens and transport decoupling).
3. **E2EE FOR ALL CONTENT & MEDIA**:
   - Text messages, files, voice notes, and media attachments must be encrypted on the client device prior to upload.
   - Media blobs are encrypted with single-use ephemeral keys transmitted out-of-band within the E2EE message envelope.

---

## 4. Logging & Telemetry

1. **ZERO SENSITIVE LOGGING**:
   - Logs, error traces, and console outputs must NEVER include:
     - Plaintext passwords or PINs
     - Private keys or derived master keys
     - Plaintext message contents or contact names
     - Storage encryption nonces or cipher keys
2. **ZERO EXTERNAL TELEMETRY**:
   - VEIL will contain no third-party analytics trackers, crash-reporting SDKs that upload unredacted dumps, or tracking pixels.

---

## 5. Security-Critical Stop Condition

If you encounter uncertainty regarding:
- Key derivation or envelope structure
- Multi-space cryptographic boundary verification
- Identity linkage or leak prevention
- Ratchet protocol state transitions
- Recovery mechanisms

**STOP IMMEDIATELY.**
1. Explain the exact ambiguity.
2. Research established cryptographic standards.
3. Propose a standards-compliant solution and document an ADR in [`docs/ai/DECISIONS.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/DECISIONS.md).

---

## 6. Mandatory Testing Requirements

Every security-sensitive component must feature **negative / adversarial tests**:
- [x] Wrong password fails KDF envelope decryption and returns generic rejection error.
- [x] Tampered ciphertext fails AEAD authentication check without leaking specifics.
- [x] Nonce reuse is prevented.
- [x] Cross-space memory access is rejected.
- [x] Locked Space files cannot be parsed by unlocked Space handlers.
