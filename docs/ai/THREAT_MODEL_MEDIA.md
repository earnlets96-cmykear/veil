# Media Transfer and Cache Threat Model

## Scope

This review covers outgoing attachment and voice-note preparation, encrypted upload retries after app re-entry, downloaded media caching, and decryption while a Space is unlocked. It does not change identity, Double Ratchet, group key schedules, or relay authorization.

## Assets and boundaries

- Media plaintext and media encryption keys exist only in the unlocked client process.
- Cloud object storage receives the existing XChaCha20-Poly1305 authenticated chunk representation and its ciphertext hash.
- The media cache stores ciphertext bytes partitioned by Space and object identifier.
- Retry metadata, including the media key, is serialized by `EncryptedSpaceStore` under the active Space storage key.
- The relay and IndexedDB media cache are untrusted storage boundaries.

## Threats and controls

| Threat | Control |
|---|---|
| Relay or object-store operator reads an attachment | Encrypt with the existing random 256-bit XChaCha20-Poly1305 media key before upload; put the key in the existing E2EE message envelope. |
| Local disk inspection reveals cached media | Persist only authenticated ciphertext in the media cache; persist keys and retry metadata only through `EncryptedSpaceStore`. |
| Ciphertext is modified or substituted in the cache | Verify the stored ciphertext hash before decryption; AEAD and plaintext SHA-256 checks remain mandatory in the attachment pipeline. |
| Space A reads Space B's media | Cache keys include the Space ID; the encrypted outbox is read through the active `SpaceSession`. |
| App closes during an upload | Persist ciphertext and encrypted retry metadata before network dispatch; after Space unlock recover the job and restore its original message ID. |
| Wrong key, malformed chunk, or truncated ciphertext | Reject the restore/decrypt operation; never fall back to treating encrypted bytes as plaintext. |
| Legacy decrypted media remains in IndexedDB | Delete the legacy `veil_media_cache` database during migration; the new cache does not open or recreate it. |
| Storage quota or IndexedDB failure | Fail the outgoing durable-queue write before upload; do not claim the media can be resumed if it was not persisted. |
| Space lock occurs during playback | Clear runtime plaintext entries and revoke their Blob URLs; ciphertext may remain cached for the next unlock. |

## Compatibility and residual risk

Messages created by the former raw-byte upload path have no media key and remain readable through the legacy compatibility path. New sends must always carry a non-empty media key and ciphertext hash. A crash after server object creation but before its returned object ID is saved may leave an unreferenced ciphertext object; it does not expose plaintext, but server-side orphan cleanup is not part of this change.

## Governance status

This is a security-sensitive media protocol restoration under the post-RC freeze. The implementation uses existing audited primitives and wire chunk format. Adversarial regression tests are required. Independent security audit and the explicit dual sign-off required by `AGENTS.md` remain deployment gates.
