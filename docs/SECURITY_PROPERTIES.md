# SECURITY_PROPERTIES.md — Formal Security Property Matrix

## 1. Matrix Overview

This document maps every primary security claim of VEIL to its implementing cryptographic primitive, governing test suite, formal guarantee level, and explicit boundary limitation.

---

## 2. Cryptographic Security Property Matrix

| Security Property | Technical Implementation | Governing Test Suite | Guarantee Level | Boundary Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **End-to-End Confidentiality** | Double Ratchet (`X25519` + `HKDF-SHA256` + `XChaCha20-Poly1305`) | `tests/conversation-e2ee.test.ts`, `tests/double-ratchet-core.test.ts` | Mathematical | Endpoint device compromise breaks confidentiality |
| **Forward Secrecy (1-to-1)** | Ephemeral DH ratchet + immediate key erasure | `tests/forward-secrecy.test.ts` | Mathematical | Un-deleted skipped message keys if not delivered |
| **Post-Compromise Security (1-to-1)** | Symmetric chain re-seeded on each DH step | `tests/post-compromise-recovery.test.ts` | Mathematical | Active continuous MITM during key agreement |
| **Group Forward Secrecy** | Sender Key rotation on member departure | `tests/group-add-remove.test.ts`, `tests/group-epochs.test.ts` | Mathematical | Malicious member can screenshot or export plaintext |
| **Media Chunk Integrity** | Per-chunk `XChaCha20-Poly1305` AEAD with AAD index binding | `tests/media-integrity.test.ts`, `tests/media-corruption.test.ts` | Cryptographic | Server can drop chunks (DoS), but cannot tamper |
| **Multi-Space Isolation** | Independent `Argon2id` salts + separate SMKs + isolated DB partitions | `tests/space-isolation.test.ts`, `tests/identity-isolation.test.ts` | Cryptographic | Cross-space data access impossible without password |
| **Device Linking MITM Protection**| Ephemeral DH + 6-digit SAS confirmation code derived via HKDF | `tests/device-enrollment.test.ts`, `tests/device-sas-mitm.test.ts` | User-Interactive | User must accurately visually compare SAS code |
| **Zero-Knowledge Recovery** | BIP-39 24-word phrase (256-bit SMK + 8-bit checksum) | `tests/bip39-recovery.test.ts`, `tests/no-server-backdoor.test.ts` | Cryptographic | Stolen recovery phrase grants full Space access |
| **Instant Memory Containment** | `panicLock()`: Wipes active sessions, zeroes keys, clears UI | `tests/panic-lock.test.ts`, `tests/locked-state.test.ts` | Best-Effort (OS-Bounded) | JavaScript GC memory compaction limitations |
| **Traffic Size Obfuscation** | Discrete size bucket quantization (512B, 2KB, 8KB, 32KB, 64KB) | `tests/message-padding.test.ts`, `tests/metadata-analysis.test.ts` | Probabilistic | Bucket transition thresholds still visible |
| **Traffic Timing Obfuscation** | Bounded random jitter (20–400ms) + batching queues | `tests/timing-privacy.test.ts`, `tests/transport-privacy.test.ts` | Probabilistic | Global passive adversary correlating traffic bursts |
