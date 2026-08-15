# VEIL v1.0.0-rc.1 — Release Candidate Notes

**Release Date**: August 15, 2026  
**Classification**: `RELEASE CANDIDATE` (Internal Adversarial Review Complete)  
**Commit**: `v1.0.0-rc.1`

---

## 1. Welcome to VEIL v1.0.0-rc.1

VEIL is an open-source, privacy-first messaging application featuring multi-space cryptographic isolation, credential-selected unlocking, untrusted relay transport, and an AI-Agent continuity architecture.

This Release Candidate marks the completion of the 11 disciplined engineering phases (Phase 0 through Phase 10), verified by a full adversarial red-team audit and 230+ automated tests passing with 100% success.

---

## 2. Key Architecture Highlights

- **Multi-Space Cryptographic Isolation**:
  - Independent `SpaceMasterKey` (SMK) derivation per Space via `Argon2id`.
  - Credential-selected unlocking: Entering password A unlocks Main Space, password B unlocks Private Space, and password C unlocks Decoy Space.
- **End-to-End Encryption**:
  - 1-to-1 Messaging using `Double Ratchet` (X25519 DH + symmetric chain ratchets) with forward secrecy and post-compromise self-healing.
  - Multi-party Group Messaging using `Sender Keys` with signed epoch state transitions and forward secrecy upon member removal.
- **Encrypted Media Pipeline**:
  - 64 KiB chunked encryption under `XChaCha20-Poly1305` with AAD chunk binding.
- **Multi-Device & Zero-Knowledge Recovery**:
  - Ephemeral DH QR enrollment with 6-digit SAS verification.
  - 24-word BIP-39 mnemonic recovery and password-encrypted `.veilbackup` files.
- **Privacy UX & Emergency Defenses**:
  - Multi-space `Panic Lock` with instantaneous session destruction and memory zeroization.
  - Granular notification privacy tiers and automatic locked-state UI cache purge.
- **Metadata Minimization & Traffic Obfuscation**:
  - Size bucket quantization (`512B`, `2KB`, `8KB`, `32KB`, `64KB`).
  - Bounded timing jitter (20ms–400ms), batching queues, and mailbox capability epoch rotation.

---

## 3. Verified Cryptographic Invariants

```
Test Files: 91 passed (91)
Tests:      230+ passed (230+)
Pass Rate:  100% Clean Pass
```

- Zero custom cryptography (strictly mature `@noble` libraries).
- Zero plaintext secrets in database records, network packets, or application logs.
- Zero server backdoors or password escrow.

---

## 4. Known Limitations & Responsible Disclaimer

- **No Magic Hardware Immunity**: VEIL relies on the security of the host operating system. A device infected with kernel-level spyware or physical screen cameras is out of scope for software-layer cryptography.
- **Independent Audit Recommendation**: While VEIL has passed an extensive internal adversarial red-team security audit (Phase 9), an independent third-party professional audit is strongly recommended prior to high-risk public deployment.
