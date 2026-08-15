# DECISIONS.md — Architecture Decision Records (ADRs)

This document records all architectural decisions made across the VEIL project lifecycle.

---

## ADR-001: Independent Cryptographic Identity per Space

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: Each Space generates and maintains completely independent Ed25519 (signing) and X25519 (Diffie-Hellman) keypairs. A Space's public identity is mathematically unrelated to any other Space's public identity.
- **Reason**: Sharing a single root identity between Spaces would allow network observers to correlate activities across Spaces.

---

## ADR-002: Argon2id + Envelope Encryption for Space Storage

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: Each Space has a randomly generated 256-bit SMK sealed via XChaCha20-Poly1305 with an Argon2id-derived KEK and unique random 32-byte salt.

---

## ADR-003: Technology Stack Selection

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: TypeScript 5.x, React 19, Vite, `@noble/curves` + `@noble/hashes` + `@noble/ciphers`, Vitest.

---

## ADR-004: Untrusted Relay Transport with Blind Mailboxes

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: Transport uses rotating blind mailbox tokens. Relay stores opaque ciphertext blobs.

---

## ADR-005: Vanilla CSS Design System

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: Custom tokenized CSS Design System with zero external paid UI libraries.

---

## ADR-006: Decoy Space & Panic Lock Boundary

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: Optional Decoy Space with independent identity; Panic Lock zeros volatile memory. Does NOT guarantee forensic deniability.

---

## ADR-007: Argon2id Implementation Selection

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: `@noble/hashes/argon2.js` (v1.7.0). Production: $m=65536$ KiB, $t=3$, $p=1$, 32-byte salts.

---

## ADR-008: XChaCha20-Poly1305 for Envelope and Partition AEAD

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: `@noble/ciphers/chacha.js` (v2.3.0). 192-bit nonces, 128-bit Poly1305 tags.

---

## ADR-009: Domain-Separated HKDF-SHA256 Subkey Architecture

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: HKDF-SHA256 (RFC 5869) with explicit domain tags. Identity keys deferred to Phase 2, now implemented.

---

## ADR-010: AEAD Authenticated Associated Data (AAD) Envelope Binding

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: AAD = `"VEIL-v1|version:1|spaceId:<id>|alg:XChaCha20-Poly1305|salt:<salt>"` bound during AEAD encrypt/decrypt of SMK.

---

## ADR-011: Phase 1 Space Discovery & Identifier Model

- **Date**: 2026-08-15
- **Status**: Accepted
- **Decision**: Targeted unlock `unlockSpace(password, spaceId)` for $O(1)$ and discovery scan for $O(N)$. Phase 1 spaceId is local metadata, not anonymous.

---

## ADR-012: Two-Tier HKDF Identity Derivation

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Phase 2 requires independent Ed25519 signing and X25519 key agreement keypairs per Space. The keypairs must be deterministically reproducible from the Space Master Key so that identity survives password changes.
- **Decision**: Implement a two-tier HKDF derivation hierarchy:
  - Tier 1: `identitySeed = HKDF(SMK, "veil-v1-identity-seed")`
  - Tier 2a: `signingKeyMaterial = HKDF(identitySeed, "veil-v1-signing-key")`
  - Tier 2b: `keyAgreementMaterial = HKDF(identitySeed, "veil-v1-key-agreement")`
- **Reason**: Two-tier derivation provides domain separation between signing and key agreement while allowing future identity sub-derivations (e.g. prekeys) from the identity seed without touching the SMK directly.
- **Consequences**: Identity is deterministic from SMK. Changing the password rewraps the same SMK, so identity is preserved. Compromising the signing key does not reveal the key agreement key (and vice versa).

---

## ADR-013: Self-Signed Identity Document Binding

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: An identity document contains both a signing public key and a key agreement public key. We need a cryptographic mechanism to prove these keys belong together.
- **Decision**: The identity document is self-signed: the Ed25519 signing key signs the canonical serialization of the document (excluding the `signature` field). Canonical serialization uses explicit field ordering, not `JSON.stringify()`.
- **Reason**: Self-signature proves the signing key owner authorized the binding of both public keys into a single identity. No external CA or server trust required.
- **Consequences**: Tampering with any field (including `identityId`, `fingerprint`, `createdAt`, or either public key) invalidates the signature. Unknown versions are rejected.

---

## ADR-014: Space Cloning Produces Same Identity (Phase 2 Limitation)

- **Date**: 2026-08-15
- **Status**: Accepted (Known Limitation)
- **Context**: Since identity keys are deterministically derived from the SMK, copying the encrypted Space storage to another device and unlocking with the same password produces the same cryptographic identity.
- **Decision**: Document this as a known Phase 2 limitation. Multi-device identity management and clone detection belong to Phase 6.
- **Reason**: Deterministic derivation is required for password-change identity preservation. Clone detection requires additional protocol mechanisms not yet designed.
- **Consequences**: Two devices could impersonate the same identity. Phase 6 must address this with device-binding or identity versioning.

---

## ADR-015: Blind Mailbox Model with Server-Held SHA-256 Capability Verifiers

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: In Phase 3, we require a transport relay routing mechanism that does not maintain user accounts, user profiles, or social graphs on the server.
- **Decision**: Mailboxes are identified by random 32-byte hex strings (`mailboxId`). Access is authorized via a 256-bit client-held capability secret. The server stores only `SHA-256(capability || "veil-v1-mailbox-auth")`.
- **Reason**: The server cannot correlate mailboxes with user identities. A server database breach does not yield valid capability tokens to unauthorized parties.
- **Consequences**: Clients must safeguard their capability tokens. Mailboxes are unlisted and impossible to enumerate.

---

## ADR-016: Standard Size Classes & Deterministic Length-Prefixed Padding

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Variable payload lengths reveal message types and conversation activity to network observers.
- **Decision**: Enforce standard size classes (`SMALL`: 512B, `MEDIUM`: 2048B, `LARGE`: 8192B, `XLARGE`: 32768B) using 4-byte length-prefixed random padding before application-layer encryption.
- **Reason**: Obscures message size and reduces traffic analysis signature.
- **Consequences**: Slight bandwidth overhead for short messages; maximum single transport payload capped at 32,764 bytes (large files must be chunked in Phase 5).

---

## ADR-017: Encrypted Local Outbox and Deduplicated Inbox Partitioned per Space

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Network failures and retries must not result in lost messages or duplicate processing across Spaces.
- **Decision**: Implement `EncryptedOutbox` and `EncryptedInbox` partitioned per Space in `EncryptedSpaceStore`. Envelopes carry a random `envelopeId` which the inbox registers in an encrypted `processed_ids` list.
- **Reason**: Provides offline queueing and idempotent delivery while preserving strict cross-space cryptographic isolation.
- **Consequences**: Space A cannot observe Space B's pending outbox or received inbox items.

---

## ADR-018: Decoupled Transport Adapter Pattern (ITransportAdapter)

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: We need a transport interface that supports local unit testing without cloud dependencies, while being extensible to WebSockets, HTTP, or privacy networks.
- **Decision**: Define `ITransportAdapter` with concrete implementations `MockTransportServer` (for in-memory local testing) and future network adapters.
- **Reason**: Decouples application logic from specific transport protocols. Zero paid cloud dependencies.

