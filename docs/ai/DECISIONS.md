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

---

## ADR-019: X3DH Asynchronous Initial Key Agreement with Signed Prekeys

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: In Phase 4, we need an asynchronous, authenticated initial key agreement mechanism so that Alice can establish an encrypted session with Bob even if Bob is offline.
- **Decision**: Implement the Extended Triple Diffie-Hellman (X3DH) protocol:
  - Bob publishes a `PrekeyBundle` containing his `IdentityDocument`, an X25519 `SignedPrekey` (signed with his Ed25519 identity key), and optional `OneTimePrekeys`.
  - Alice verifies the Signed Prekey signature and computes $DH_1 \parallel DH_2 \parallel DH_3 \ [\parallel DH_4]$ using an ephemeral keypair.
  - Initial Double Ratchet root key is derived via `HKDF-SHA256(IKM, "veil-v1-x3dh-master")`.
- **Reason**: Standard, mathematically proven asynchronous authenticated key exchange preventing MITM attacks.
- **Consequences**: Bob can receive messages sent while offline; Signed Prekeys provide forward secrecy against long-term identity compromise.

---

## ADR-020: Standard Double Ratchet Protocol Implementation

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: 1-to-1 conversations require Forward Secrecy and Post-Compromise Security.
- **Decision**: Implement the full Signal Double Ratchet specification:
  - Asymmetric X25519 DH Ratchet with KDF-RK (`HKDF-SHA256(RK, DH, "veil-v1-ratchet-root")`).
  - Symmetric Sending/Receiving chains with KDF-CK (`HMAC-SHA256`).
  - Single-use ephemeral message keys zeroized immediately after encryption/decryption.
  - AAD authentication binding message headers (`dhRatchetPub`, `sequenceNum`, `prevChainLength`) to ciphertext via XChaCha20-Poly1305.
- **Reason**: Guarantees that past messages cannot be decrypted if current keys are compromised (Forward Secrecy), and future messages regain secrecy after a subsequent DH ratchet step (Break-in Recovery).
- **Consequences**: Every message consumes a fresh message key. Replay attacks are cryptographically rejected.

---

## ADR-021: Bounded Skipped-Message-Key Store with Single-Use Key Erasure

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Out-of-order and delayed network packets must be decryptable without unbounded memory growth or denial-of-service risks.
- **Decision**: Maintain a bounded skipped-message-key store (`MAX_SKIPPED_KEYS = 500`) indexed by `"dhRatchetPub:sequenceNum"`. When a skipped message arrives, it is decrypted and its key is immediately zeroized and permanently deleted from storage.
- **Reason**: Supports out-of-order delivery while bounding RAM/storage and preventing message key reuse.
- **Consequences**: Messages delayed beyond 500 skipped intervals or excessively old keys will fail to decrypt (fails safely).

---

## ADR-022: Encrypted Local Session and Message Persistence per Space

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Double Ratchet session states and message histories must survive application restarts and Space lock/unlock cycles.
- **Decision**: Ratchet sessions (`RatchetSessionStore`) and message histories (`ConversationManager`) are encrypted at rest inside `EncryptedSpaceStore` under the active Space's `StorageKey`.
- **Reason**: Preserves complete cryptographic isolation between Spaces on the same device.
- **Consequences**: Space A cannot observe Space B's active conversations or message histories. When a Space locks, session keys are wiped from volatile memory.

---

## ADR-023: Sender Keys with Epoch Ratcheting for Scalable Group E2EE

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Group messaging with $N$ members requires $O(1)$ computation and transmission complexity rather than $O(N)$ pairwise encryptions per broadcast.
- **Decision**: Adopt the **Sender Keys** protocol (Signal / Megolm group ratcheting scheme). Each participant generates a symmetric Chain Key, ratchets it via `kdfSenderChainStep(chainKey)` on each sent message, and distributes `SenderKeyDistributionMessage` to group members over pairwise Double Ratchet 1-to-1 channels.
- **Reason**: Proven cryptographic standard for asynchronous, multi-party end-to-end encryption.
- **Consequences**: Senders encrypt broadcast messages once; recipients decrypt in $O(1)$ using their stored inbound sender key state.

---

## ADR-024: Cryptographically Signed Group Actions and Anti-Rollback Epochs

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Group state operations (creation, member additions, removals, role promotions) must be authenticated without trusting the relay server.
- **Decision**: Model all group state transitions as `GroupAction` structures signed with the acting member's `Ed25519` identity key. Group state maintains a strictly monotonically increasing `epoch` counter. Any action or distribution message with `epoch < currentEpoch` is rejected.
- **Reason**: Prevents forged admin actions, unauthorized role changes, and malicious server rollback attacks.
- **Consequences**: The untrusted server cannot alter group membership or forge administrator actions.

---

## ADR-025: Forward Secrecy on Group Member Removal via Key Rotation

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: When a member leaves or is removed from a group, they must be prevented from decrypting subsequent messages.
- **Decision**: Removing a member increments the group Epoch ($Epoch_{k+1}$), forces all remaining members to reset their outbound Sender Keys, and distributes new Sender Keys exclusively to active remaining members over pairwise Double Ratchet channels.
- **Reason**: Guarantees forward secrecy against departed members.
- **Consequences**: The removed member does not receive Epoch $k+1$ sender keys and cannot decrypt future conversation content or media.

---

## ADR-026: Single-Use Cryptographically Random Symmetric Keys per Media Object

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Media files (images, audio, video, documents) must be encrypted before upload to untrusted blob storage.
- **Decision**: Generate an independent, cryptographically random 32-byte symmetric key (`mediaKey`) for every single media object. The media key is delivered exclusively inside end-to-end encrypted messages (`RatchetMessage` or `GroupMessagePayload`).
- **Reason**: Prevents key reuse across media files, conversations, or Spaces. Decryption keys are never exposed in URLs, headers, or server databases.
- **Consequences**: The untrusted relay server receives opaque ciphertext only and cannot decrypt media or correlate media objects.

---

## ADR-027: Streaming Chunk Authenticated Encryption with AAD Binding and SHA-256 Digest

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Large media files must be encrypted and transferred efficiently without unbounded RAM consumption or chunk substitution vulnerabilities.
- **Decision**: Partition media into 64 KiB chunks and encrypt each with `XChaCha20-Poly1305`. Authenticate chunk sequence via canonical AAD (`mediaId`, `chunkIndex`, `totalChunks`, `isLastChunk`). Require SHA-256 plaintext digest verification upon reassembly.
- **Reason**: Detects and rejects chunk reordering, missing chunks, chunk duplication, and cross-file chunk substitution attacks.
- **Consequences**: Corrupted, truncated, or tampered media chunks fail AEAD decryption immediately.

---

## ADR-028: Untrusted Media Relay and Local Gallery Isolation per Space

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Untrusted media storage and privacy UX boundary must be strictly enforced.
- **Decision**: Media blobs on the relay are protected by blind capability tokens. Decrypted media files and thumbnails are stored exclusively inside the Space partition in `EncryptedSpaceStore` and never automatically exported to shared OS device galleries.
- **Reason**: Upholds multi-space cryptographic isolation and prevents media leaks to OS-level apps or photo sync services.
- **Consequences**: Locking a Space locks all associated media; deleting a Space wipes all associated media cache.

---

## ADR-029: Ephemeral Out-of-Band Key Agreement with 6-Digit SAS for Device Enrollment


- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Secondary devices must be enrolled into a Space securely without trusting intermediate networks or QR relay channels.
- **Decision**: Perform an ephemeral X25519 Diffie-Hellman handshake between Primary and Secondary devices. Derive a 6-digit Short Authentication String (SAS) using `HKDF-SHA256(ikm=sharedSecret, salt=concat(pubP, pubS), info="veil-v1-device-sas", length=4)`. Transmit Space credentials only after mutual visual SAS confirmation over an `XChaCha20-Poly1305` encrypted tunnel.
- **Reason**: Prevents active Man-in-the-Middle (MITM) attacks during device linking.
- **Consequences**: Key substitution by an attacker produces distinct 6-digit codes and aborts the handshake before any Space secrets are sent.

---

## ADR-030: Selective Space Synchronization and Multi-Space Boundary Preservation

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Users may want to link a work laptop to "Work Space" while keeping "Private Space" strictly on their personal phone.
- **Decision**: The user explicitly chooses which Space(s) to synchronize during enrollment. Unselected Spaces are completely excluded from the enrollment payload.
- **Reason**: Maintains absolute multi-space cryptographic isolation across physical devices.
- **Consequences**: A secondary device has zero knowledge, keys, or envelopes for unselected Spaces.

---

## ADR-031: Cryptographically Signed Device Revocation and Authorization Registry

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Lost or compromised secondary devices must be revocable by the primary device.
- **Decision**: Maintain a `DeviceRegistry` per Space. Revocation creates a signed `DeviceRevocationRecord` using the Space's Ed25519 identity key, marking the device `REVOKED` and excluding it from future multi-device routing and prekey rotations.
- **Reason**: Ensures authoritative, verifiable revocation without centralized servers.
- **Consequences**: Revoked devices are permanently blocked from re-registering or accessing future state.

---

## ADR-032: Zero-Knowledge BIP-39 24-Word Mnemonic Space Recovery

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Users must be able to restore a Space on a brand new device if all enrolled devices are lost, without server assistance.
- **Decision**: Encode the 256-bit permanent Space Master Key (SMK) into a standard 24-word BIP-39 mnemonic phrase with an 8-bit SHA-256 checksum. Recovery directly reconstructs the SMK and all deterministic subkeys (`IdentitySeed`, `StorageKey`, etc.).
- **Reason**: Industry-standard, human-writable, offline zero-knowledge recovery mechanism.
- **Consequences**: Users can restore their full Space and identity deterministically from paper backups.

---

## ADR-033: Anti-Escrow and Zero Server Password Reset Enforcements

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Relay servers and backend infrastructure must never possess key recovery capabilities.
- **Decision**: Enforce that the server has zero recovery endpoints, zero master key escrow, and zero ability to reset passwords or bypass Argon2id KDF envelopes.
- **Reason**: Mathematical guarantee of zero-trust and anti-surveillance architecture.
- **Consequences**: Loss of both password and recovery phrase results in permanent cryptographic lockout (no backdoors).

---

## ADR-034: Two-Tier Lock Model (Quick Lock vs. Panic Lock)

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Users need both a regular lock for daily use and an aggressive containment action for high-risk or coercive situations.
- **Decision**: Implement two explicit lock tiers: `quickLock(spaceId)` for locking the active Space and clearing its immediate UI state, and `panicLock()` which destroys ALL active Space sessions, wipes all volatile session keys from memory, and clears all UI state across all Spaces. Neither lock deletes on-disk encrypted Space envelopes or revokes enrolled devices.
- **Reason**: Balances everyday usability with emergency containment without risking accidental data loss.
- **Consequences**: Users can trigger an instant wipe of in-memory data without destroying their account or devices.

---

## ADR-035: Granular Notification Privacy Tiers and Locked-State Notification Purge

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: OS-level notifications often leak sender names, conversation topics, and sensitive plaintexts onto lock screens.
- **Decision**: Provide three per-Space notification tiers (High, Balanced, Convenient). When a Space is locked, all incoming notifications automatically collapse to High Privacy (`"VEIL: New message"`). Locking a Space immediately purges its active notification records.
- **Reason**: Prevents lock-screen reconnaissance and cross-space notification leakage.
- **Consequences**: Plaintext messages and sensitive sender names never appear in notifications unless explicitly configured and unlocked.

---

## ADR-036: Complete UI State Purge and Isolated Search Caching upon Space Locking

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: UI memory caches, drafts, thumbnail previews, search indexes, and clipboard items can linger after a Space is locked.
- **Decision**: Centralize UI state tracking in `UIStateManager`. When a Space locks, all its associated messages, drafts, media previews, clipboard tracking, and search indexes are wiped immediately.
- **Reason**: Guarantees that locking a Space leaves zero residual plaintexts in active UI layers.
- **Consequences**: Prevents app-switcher snooping, memory inspection of cached UI nodes, and cross-space search index leakage.

---

## ADR-037: Genuine Decoy Spaces with Cryptographic Independence and Anti-Disclosure

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Coercive adversaries demanding device access require plausible deniability without fragile fake-UI simulations.
- **Decision**: Decoy Spaces are implemented as authentic encrypted Spaces with independent SMKs, storage partitions, identities, and real messaging capabilities. Unlock screens and error messages never disclose whether other Spaces exist or which password maps to which Space.
- **Reason**: Decoy Spaces function indistinguishably from normal Spaces while maintaining absolute cryptographic isolation.
- **Consequences**: Opening a decoy under coercion exposes a real, working messenger without revealing primary Spaces.

---

## ADR-038: Human-Centered Security Indicators and Anti-Theater Marketing Guard

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Technical cryptographic details (epochs, ratchets, HKDF labels) overwhelm users, while misleading marketing ("military-grade", "unhackable") creates false confidence.
- **Decision**: Abstract security status into simple, actionable indicators (`Verified ✓`, `Unverified`, `Security Changed ⚠`). Enforce `DisclosureGuard` to reject prohibited marketing terms in user-facing text and collapse all authentication errors to `"Unable to unlock."`
- **Reason**: Promotes usability and transparent, honest privacy engineering.
- **Consequences**: Users easily understand their security state without security theater or misleading promises.

---

## ADR-039: Standardized Size Bucket Quantization for Message Envelopes

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Message character counts leak communication intent and language patterns over network wiretaps.
- **Decision**: Pad all application payloads into discrete power-of-two size buckets (512B, 2KB, 8KB, 32KB, 64KB) using CSPRNG random bytes before encryption. Enforce hard bounds (`MAX_MESSAGE_SIZE = 64KB`, `MAX_PADDED_SIZE = 128KB`).
- **Reason**: Prevents passive wiretaps and ISPs from correlating message length distributions.
- **Consequences**: Slightly increases bandwidth usage for short messages in exchange for high size-correlation resistance.

---

## ADR-040: Bounded Timing Jitter and Transport Envelope Batching

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Immediate packet dispatch upon keystrokes or send actions allows network observers to infer interactive chatting.
- **Decision**: Introduce `TrafficShaper` with configurable random jitter (20ms–400ms) and envelope batching queues (up to 5 envelopes per dispatch in High mode).
- **Reason**: Disconnects the physical user send event from the wire transmission timestamp.
- **Consequences**: Adds minor, bounded latency to outgoing packets while significantly complicating traffic timing correlation.

---

## ADR-041: Mailbox Capability Epoch Rotation with Overlapping Grace Periods

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Static mailbox authorization tokens create long-term correlation risks on untrusted servers.
- **Decision**: Rotate mailbox capability secrets on an epoch schedule (`MailboxRotationManager`), storing only SHA-256 verifiers on the server. Accept capabilities from both the current epoch and the immediate previous epoch (grace period) to guarantee in-flight delivery.
- **Reason**: Provides forward-secrecy properties for mailbox access without disrupting offline message retrieval.
- **Consequences**: A leaked old capability secret cannot be used to read future messages.

---

## ADR-042: Rate-Limited Presence and Minimal Interaction Signals

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Fine-grained typing indicators and instant read receipts reveal active user presence, reading habits, and typing speeds.
- **Decision**: Typing indicators and read receipts are disabled by default. When enabled, typing signals are rate-limited to a minimum 3-second interval, and read receipts use opaque identifiers. Last-seen status defaults to `'nobody'`.
- **Reason**: Minimizes behavioral profiling and side-channel timing analysis.
- **Consequences**: Users retain full control over interaction signals without leaking keystroke rhythms.

---

## ADR-043: Three-Tier Traffic Privacy Configuration (Standard, Balanced, High)

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Different threat models require different trade-offs between battery/latency efficiency and traffic analysis resistance.
- **Decision**: Provide `Standard` (immediate, minimal overhead), `Balanced` (default: 20-120ms jitter, 3-envelope batching), and `High` (100-400ms jitter, 5-envelope batching) modes with documented operational parameters.
- **Reason**: Gives users transparent, measurable privacy controls without confusing or misleading marketing slogans.
- **Consequences**: High-threat users can choose stronger obfuscation, while standard users experience zero latency overhead.

---

## ADR-044: Adversarial Red-Team Verification and Security Property Matrix Enforcement

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Relying solely on standard unit tests risks overlooking subtle cryptographic misuse, boundary violations, or parser edge cases.
- **Decision**: Introduce explicit adversarial red-team test suites that attempt actual attacks (1-bit AEAD tampering, cross-space database injections, epoch rollbacks, media chunk swapping, BIP-39 word tampering, mailbox IDORs, and panic lock race conditions). Document all security properties in `docs/SECURITY_PROPERTIES.md`.
- **Reason**: Proves that the implementation actively rejects malformed or malicious inputs under hostile conditions.
- **Consequences**: Validates core cryptographic invariants with zero reliance on security through obscurity.

---

## ADR-045: Comprehensive Hostile Parser Fuzzing and Input Bounding

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Parsers processing untrusted network data or local backup files can be vectors for memory exhaustion, unhandled exceptions, or denial-of-service.
- **Decision**: Subject `MessagePadding`, `validateTransportEnvelope`, `MediaEncryptor`, and `RecoveryVault` to 500+ iterations of random, malformed, empty, and oversized byte inputs (`audit-fuzz-parsers.test.ts`). Enforce hard length checks prior to memory allocation.
- **Reason**: Guarantees parser stability and graceful error handling across all entry points.
- **Consequences**: Prevents unhandled crashes and unbounded memory consumption.

---

## ADR-046: Cryptographic Invariant Integrity and Nonce Space Verification

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Nonce collisions in AEAD schemes (such as Poly1305) can result in catastrophic plaintext and key recovery.
- **Decision**: Audit and verify all nonce generation paths (`audit-crypto-invariants.test.ts`), confirming that 10,000+ sequential 24-byte CSPRNG nonces exhibit zero collisions, and enforce strict domain separation across all HKDF subkey derivations (`deriveStorageKey`, `deriveIdentitySeed`, `deriveSigningKeyMaterial`, `deriveKeyAgreementMaterial`).
- **Reason**: Eliminates nonce reuse risks and guarantees key material independence.
- **Consequences**: Mathematical assurance of cryptographic correctness.

---

## ADR-047: Real-Time Panic Lock Session Invalidation Across Concurrent Operations

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: In a panic situation, pending asynchronous network or storage operations might attempt to continue using session keys after lock invocation.
- **Decision**: Ensure that `SpaceSession.destroy()` and `LockManager.panicLock()` immediately invalidate session active flags and zeroize volatile key buffers before returning, causing any in-flight asynchronous operations attempting storage access to throw immediately.
- **Reason**: Guarantees instantaneous session termination and zero stale key persistence.
- **Consequences**: Prevents race conditions during emergency lock triggers.

---

## ADR-048: Release Readiness Gate and Release Candidate Designation

- **Date**: 2026-08-15
- **Status**: Accepted
- **Context**: Transitioning from development to release requires a formal, non-negotiable security gate.
- **Decision**: Define mandatory blocker criteria in `docs/RELEASE_BLOCKERS.md` and complete a full scorecard in `docs/SECURITY_SCORECARD.md`. Designate VEIL as a **`RELEASE CANDIDATE`** only after 100% test pass across all 90 test suites with zero unresolved blockers.
- **Reason**: Ensures high standards of quality, transparency, and accountability before Phase 10 packaging.
- **Consequences**: The project is formally verified and ready for Phase 10 release packaging.







