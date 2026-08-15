# HANDOFF.md — AI Agent Session Handoff

## 1. Project Overview & Current Phase

- **Project**: VEIL (Privacy-First Messenger with Multi-Space Cryptographic Architecture)
- **Current Phase**: **PHASE 5: Encrypted Group Messaging & Encrypted Media** — Complete
- **Status**: 175/175 tests passing across 54 test files
- **Current Branch**: `master`

---

## 2. Phase 5 Implementation Summary

### What Was Implemented
1. **Group Protocol & Sender Keys** (`src/group/senderKey.ts`, `src/group/groupKdf.ts`, `docs/GROUP_PROTOCOL.md`):
   - Scalable $O(1)$ group message encryption using the Sender Keys protocol (Signal / Megolm group ratcheting).
   - Symmetric chain key stepping via `HMAC-SHA256` (`kdfSenderChainStep`).
   - Ed25519 signature verification on all group messages and `SenderKeyDistributionMessage` payloads.
   - AAD context binding on group headers (`groupId`, `epoch`, `senderIdentityId`, `sequenceNum`).
   - Bounded out-of-order skipped key cache (`MAX_GROUP_SKIPPED_KEYS = 500`) with immediate single-use key zeroization.
2. **Authenticated Group State & Anti-Rollback Epochs** (`src/group/groupState.ts`, `src/group/groupManager.ts`):
   - Role hierarchy (`CREATOR` > `ADMIN` > `MEMBER`) cryptographically verified with Ed25519 signatures.
   - Strictly monotonic epoch progression preventing rollback attacks.
   - Encrypted group metadata (name, description, avatar) encrypted at rest with epoch-derived metadata keys.
3. **Forward Secrecy on Member Departure**:
   - Removing a member increments the group Epoch ($Epoch_{k+1}$), forces all remaining members to reset their outbound Sender Keys, and distributes new Sender Keys exclusively to remaining members over 1-to-1 Double Ratchet channels.
   - The removed member never learns $Epoch_{k+1}$ keys and cannot decrypt future messages.
4. **Encrypted Media Vault & Untrusted Blob Transport** (`src/media/mediaEncryptor.ts`, `src/media/mediaStorage.ts`, `src/media/mediaVault.ts`, `docs/MEDIA_SECURITY.md`):
   - Unique, cryptographically random 32-byte symmetric keys generated per media object.
   - 64 KiB chunked streaming encryption using `XChaCha20-Poly1305` with AAD binding (`mediaId`, `chunkIndex`, `totalChunks`, `isLastChunk`).
   - SHA-256 integrity digest verification upon reassembly.
   - Decryption keys travel strictly inside end-to-end encrypted messages; never exposed in URLs or server payloads.
   - Space-partitioned local cache in `EncryptedSpaceStore`; zero leakage to public OS device galleries.

### Verified Invariants (175/175 Tests Passing)
- **Phases 0-4**: Space Vaults, Argon2id KDF, XChaCha20-Poly1305 AEAD, independent Ed25519/X25519 identities, blind mailboxes, Double Ratchet 1-to-1 E2EE, X3DH key agreement.
- **Phase 5**: Group creation, membership hierarchy, member addition/removal, forward secrecy on removal, epoch advancement, group replay prevention, out-of-order group delivery, malicious server resistance, cross-group/cross-space isolation, media encryption/decryption across MIME types, chunk reordering/duplication/substitution detection, capability-based blob authorization, and full E2EE group+media integration.

---

## 3. Invariants the Next Agent Must NOT Break

1. **NEVER INVENT CRYPTOGRAPHY**: Use established primitives (`@noble/curves`, `@noble/hashes`, `@noble/ciphers`).
2. **FORWARD SECRECY & POST-COMPROMISE SECURITY**: Never reuse message keys; zeroize them immediately after use; rotate group sender keys on member removal.
3. **THE SERVER IS UNTRUSTED**: The relay server receives only opaque transport envelopes, blind mailbox tokens, and opaque ciphertext media chunks; never message plaintexts, prekey private keys, group secrets, or media encryption keys.
4. **CROSS-SPACE ISOLATION**: Space A cannot decrypt Space B's conversations, group states, or media items.
5. **ZERO SENSITIVE LOGGING**: No plaintexts, passwords, SMKs, media keys, or private keys in logs.

---

## 4. Exact Next Action for Incoming Agent

Proceed to **Phase 6: Multi-Device Synchronization, Device Linking & Cryptographic Recovery** ([`prompts/PHASE_06.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_06.md)).
1. Read `AGENTS.md` and `docs/ai/PROJECT_CONTEXT.md`.
2. Update `docs/ai/ACTIVE_TASK.md` for Phase 6.
3. Implement QR-code/ephemeral-channel device linking for linking secondary devices to a Space.
4. Implement per-device cryptographic identity sub-keys and pairwise multi-device Double Ratchet fan-out.
5. Implement zero-knowledge cryptographic space recovery and passphrase backup export.
