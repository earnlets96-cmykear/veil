# SECURITY.md — Permanent Security Policies & Engineering Standards

## 1. Security Mandates

Every engineer and AI agent contributing to VEIL must strictly uphold the following non-negotiable security standards:

1. **NO CUSTOM CRYPTOGRAPHY**: Use only established, audited libraries and primitives (Argon2id, XChaCha20-Poly1305, AES-256-GCM, Ed25519, X25519, Double Ratchet).
2. **NO PLAINTEXT PASSWORDS**: Passwords must never be stored on disk, logged to console, transmitted over the network, or kept in permanent memory.
3. **ZERO SENSITIVE DATA IN LOGS**: Error traces and console logs must never include private keys, passwords, plaintext messages, or contact identities.
4. **UNTRUSTED SERVER MODEL**: All relay servers and network nodes are considered untrusted.
5. **MANDATORY NEGATIVE TESTS**: Every cryptographic and security-critical feature must include negative and adversarial tests (e.g. wrong password rejection, corrupted ciphertext rejection, tampered signature rejection, cross-space isolation verification).

---

## 2. Memory Hygiene Policy

- Master keys, private keys, and candidate KDF keys must be managed in temporary `Uint8Array` buffers.
- When an active session is locked, closed, or panic-locked, all sensitive buffers must be explicitly zeroized (`buffer.fill(0)`).

---

## 3. Dependency & Supply Chain Security

- All third-party dependencies must be reviewed for audit status, minimal footprint, and zero paid API lock-ins.
- Zero analytics, telemetry SDKs, or unredacted crash reporters are permitted in VEIL.

---

## 4. Vulnerability Disclosure

If you discover a security vulnerability in VEIL:
1. Document the vulnerability with exact reproduction steps.
2. Formulate an Architecture Decision Record (ADR) in `docs/ai/DECISIONS.md`.
3. Implement a fix accompanied by regression and negative tests.
