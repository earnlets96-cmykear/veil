# SECURITY_SCORECARD.md — Subsystem Security Scorecard

## 1. Scorecard Methodology

Subsystems are rigorously evaluated across architecture, implementation correctness, adversarial resilience, test coverage, and documented boundary limitations.

Ratings:
- **`PASS`**: Full cryptographic guarantee verified with positive and negative attack tests.
- **`PASS WITH LIMITATIONS`**: Secure implementation with inherent real-world or platform limitations honestly documented.
- **`FAIL`**: Cryptographic flaw or exploitable vulnerability.
- **`NOT IMPLEMENTED`**: Out of scope for current milestone.

---

## 2. Subsystem Evaluation

| Subsystem | Rating | Strengths & Verified Defenses | Documented Limitations |
| :--- | :---: | :--- | :--- |
| **1. Cryptographic Primitives** | `PASS` | Audited `@noble` mature libraries, zero custom crypto, constant-time comparisons, 64 KiB chunked CSPRNG. | Hardware side-channel attacks on host CPU. |
| **2. Key Management & Hierarchy** | `PASS` | Strict domain separation via HKDF-SHA256, independent master keys, memory zeroization on destruction. | V8/JavaScript engine GC memory copies. |
| **3. Space Storage & Isolation** | `PASS` | Independent Argon2id salts per Space, authenticated local database, zero cross-space decryption. | Plaintext flash memory wear-leveling artifacts. |
| **4. 1-to-1 E2EE Messaging** | `PASS` | Double Ratchet protocol with forward secrecy and post-compromise self-healing. | Skipped message key memory limit exhaustion. |
| **5. Group E2EE Messaging** | `PASS` | Sender Key protocol with epoch ratchet and forward secrecy upon member removal. | Group admin coercion / malicious member plaintext leak. |
| **6. Encrypted Media Pipeline** | `PASS` | 64 KiB authenticated chunking with AAD binding and SHA-256 integrity verification. | Server chunk deletion / denial-of-service. |
| **7. Multi-Device Synchronization** | `PASS` | Ephemeral X25519 DH QR handshake, 6-digit SAS MITM protection, selective space sync. | SAS visual comparison bypass if user is careless. |
| **8. Cryptographic Recovery** | `PASS` | BIP-39 24-word phrases + Argon2id encrypted `.veilbackup` files; zero server escrow. | Loss of phrase + password results in permanent lockout. |
| **9. Privacy UX & Panic Lock** | `PASS WITH LIMITATIONS` | Quick Lock, multi-space Panic Lock, auto-lock timers, locked-state UI purge. | Software-only lock cannot block external camera capture. |
| **10. Metadata & Traffic Privacy** | `PASS WITH LIMITATIONS` | Size bucket padding (512B–64KB), bounded timing jitter (20–400ms), batching. | Powerful global passive adversary with statistical timing models. |
| **11. Server Zero-Knowledge Boundary** | `PASS` | Blind mailboxes, capability tokens, zero plaintext/keys in database. | Server sees client network IP address in direct TLS mode. |
| **12. Supply Chain & Dependencies** | `PASS` | Pinned dependencies, lockfile enforced, zero vulnerable third-party packages. | Upstream supply chain compromise in package registries. |
