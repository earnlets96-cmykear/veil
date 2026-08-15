# DECISIONS.md — Architecture Decision Records (ADRs)

This document records all architectural decisions made across the VEIL project lifecycle.

---

## ADR-001: Independent Cryptographic Identity per Space

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: VEIL allows users to operate multiple Spaces (e.g. Main Space, Work Space, Private Space) within a single client application. We must decide whether Spaces share a single root identity with multiple UI profiles or maintain independent cryptographic identities.
- **Decision**: Each Space generates and maintains completely independent Ed25519 (signing) and X25519 (Diffie-Hellman) keypairs. A Space's public identity is mathematically unrelated to any other Space's public identity.
- **Reason**: Sharing a single root identity or master key between Spaces would allow network observers or compromised relays to correlate contacts and activities across Spaces.
- **Alternatives Considered**:
  - *Single Root Identity with Sub-keys*: Rejected because an attacker with access to the root key or server metadata could correlate all sub-identities.
  - *UI-only profile switching*: Rejected as it provides zero cryptographic isolation.
- **Consequences**: Adding a contact or sending a message in Space A exposes only Identity A. Identity B remains completely hidden.

---

## ADR-002: Argon2id + Envelope Encryption for Space Storage

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: When the application is locked, Space data must remain protected against local physical extraction. We need an authentication and key derivation mechanism where entering a specific password selectively unlocks only the corresponding Space.
- **Decision**: 
  - Each Space has a randomly generated 256-bit Space Master Key (SMK).
  - The SMK is sealed inside an encrypted envelope using XChaCha20-Poly1305 with a Key Encryption Key (KEK) derived via Argon2id (`timeCost: 3, memoryCost: 65536 KiB, parallelism: 1`) using a unique, random 32-byte salt per Space.
  - At unlock time, the entered password derives candidate KEKs against each Space salt. Only the envelope with matching authentication tag decrypts and loads the SMK into volatile memory.
- **Reason**: Argon2id provides state-of-the-art resistance against GPU/ASIC cracking. Envelope encryption allows changing passwords or rotating keys without re-encrypting the entire Space database.
- **Alternatives Considered**:
  - *PBKDF2/scrypt*: Rejected because Argon2id has superior resistance against memory-hard side-channel and ASIC attacks.
  - *Direct password-derived storage key*: Rejected because changing a password would require re-encrypting gigabytes of messages and media.
- **Consequences**: Unlocking Space A has zero mathematical ability to decrypt Space B's envelope. If a wrong password is typed or a decoy password is entered, only the corresponding Space (or Decoy Space) opens.

---

## ADR-003: Technology Stack Selection

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: VEIL requires a clean, cross-platform architecture that runs 100% locally with zero paid services, supports high-performance cryptography, modern responsive UI, and unit/integration testing.
- **Decision**:
  - **Language**: TypeScript 5.x (Strict mode)
  - **Frontend Client**: React 19 + Vite + Vanilla CSS Custom Design System
  - **Cryptography**: `@noble/curves`, `@noble/hashes`, `@noble/ciphers`, and WebCrypto API
  - **Backend / Relay**: Node.js + WebSocket (ws) + Express / lightweight microservice
  - **Testing**: Vitest for fast, isolated unit, negative, and cryptographic tests
- **Reason**: Full TypeScript consistency across client, crypto core, and relay server simplifies protocol definitions, ensures type safety, and eliminates external hosting costs.
- **Consequences**: Fast local build cycles, zero paid API dependencies, and high auditability.

---

## ADR-004: Untrusted Relay Transport Abstraction with Blind Mailboxes

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: The client must transport encrypted messages between Spaces across the network without trusting the relay server.
- **Decision**:
  - Transport interface is decoupled from specific networking protocols (`ITransportAdapter`).
  - Messages are addressed using rotating blind mailbox tokens (`HMAC-SHA256(RecipientPublicPrekey, EphemeralSessionToken)`).
  - The relay stores and forwards encrypted ciphertext blobs without indexing by real identity public keys or user account tables.
- **Reason**: Prevents the relay server from constructing communication social graphs or correlating sender/recipient pairs.
- **Consequences**: Higher metadata privacy even if the relay server is seized or compromised.

---

## ADR-005: Vanilla CSS Design System with Zero External Paid UI Libraries

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: The VEIL interface must feel premium, modern, accessible, and fast, while maintaining a strict zero-paid-services rule and total styling independence.
- **Decision**: Implement a custom, tokenized CSS Design System (`veil-design-system.css`) containing color tokens, dark mode palette, typography scales, glassmorphism, responsive grid, micro-animations, and reusable UI primitives.
- **Reason**: Guarantees zero bloat, complete theme control, and instant performance across mobile and desktop viewports.
- **Consequences**: Consistent, stunning visual aesthetics without relying on third-party UI framework vendor lock-in.

---

## ADR-006: Decoy Space & Panic Lock Boundary Definition

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Users facing coercion may require a Decoy Space or Panic Lock. We must clearly define the cryptographic and legal limits of this feature.
- **Decision**:
  - An optional Decoy Space can be configured with an alternative password.
  - When unlocked with the decoy password, VEIL displays the Decoy Space without showing errors or indicating the presence of other Spaces.
  - VEIL documentation and UI explicitly state that Decoy Space does **not** guarantee forensic deniability against hardware extraction or OS memory dumps.
  - A Panic Lock shortcut instantly zeros volatile memory keys and drops back to the locked state.
- **Reason**: Security honesty is paramount. Never advertise impossible anti-forensic guarantees while still providing practical coercion mitigation.
- **Consequences**: Users gain useful protection while remaining fully informed of threat model limitations.

---

## ADR-007: Argon2id Implementation Selection and Tuning

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: A memory-hard password KDF is required for Space envelope security. We need a pure TypeScript/JS compatible, standards-compliant Argon2id implementation.
- **Decision**: Selected `@noble/hashes/argon2.js` (v1.7.0). Production parameters configured at $m = 65536\text{ KiB}$ ($64\text{ MiB}$), $t = 3\text{ iterations}$, $p = 1\text{ thread}$, with 32-byte salts.
- **Reason**: Zero binary native addons required; cross-platform compatibility across Node.js, Electron, and browsers.
- **Consequences**: Robust brute-force resistance while remaining responsive on modern client devices.

---

## ADR-008: XChaCha20-Poly1305 for Envelope and Partition AEAD

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Need an authenticated symmetric encryption cipher for sealing Space Master Keys and encrypting local storage records.
- **Decision**: Selected XChaCha20-Poly1305 from `@noble/ciphers/chacha.js` (v2.3.0) with 192-bit (24-byte) nonces and 128-bit (16-byte) Poly1305 tags.
- **Reason**: 192-bit extended nonces eliminate birthday-bound nonce collision risks when nonces are generated via CSPRNG.
- **Consequences**: Safe, collision-free encryption across unlimited Space creations and record writes.

---

## ADR-009: Domain-Separated HKDF-SHA256 Subkey Architecture

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: The Space Master Key (SMK) must securely derive independent subkeys for storage encryption, identity signing, ratchet prekeys, and media storage.
- **Decision**: Implemented HKDF-SHA256 (RFC 5869) with explicit domain tags (`"veil-v1-storage-key"`, `"veil-v1-identity-seed"`, `"veil-v1-prekey-seed"`, `"veil-v1-media-key"`).
- **Reason**: Strict cryptographic domain separation guarantees that compromise of a subkey does not compromise the master key or other sibling subkeys.
- **Consequences**: Clean separation of cryptographic responsibilities across subsystems.
