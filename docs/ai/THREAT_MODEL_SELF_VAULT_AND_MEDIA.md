# Threat Model: Local Self Vault and Video Upload Memory

## Scope

This review covers local notes addressed to the active Space identity and the Android recent-media selection / encrypted-upload memory path. It does not change identity keys, AEAD algorithms, attachment chunk format, group Sender Key behavior, relay authorization, or message wire payloads.

## Assets and boundaries

- Space identity IDs, encrypted local messages, media encryption keys, and encrypted media outbox records remain partitioned by the active `SpaceSession` and `EncryptedSpaceStore`.
- A My Vault message is identified by exact equality with the active Space identity. It is written to `veil:ui:messages` through the encrypted store and is excluded from directory contact requests, Double Ratchet setup, relay delivery, and recovery-vault cloud sync.
- The local search index is volatile memory and is cleared with the active Space lifecycle.
- Android media selection reads the user's chosen `content://` URI in bounded 1 MiB ranges. Each native bridge result contains only one Base64 chunk. The assembled `File` remains plaintext in process memory until upload preparation completes.
- Attachment encryption continues to use the existing XChaCha20-Poly1305 chunk format. Upload retries retain ciphertext in the encrypted media outbox. The plaintext main-thread buffer and worker copy, plus the temporary media key bytes, are zeroized after use. Plaintext is no longer copied into `MediaCache` during upload.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| A user accidentally sends a contact request or network message to their own identity | Contact request rejects the active identity; My Vault messages take a local-only path before recipient lookup or envelope dispatch | Previously queued self-directed envelopes may still be present until the user removes them or the queue is otherwise drained |
| Notes cross Space boundaries | Self detection uses the active identity ID, and note data is written through the active encrypted Space session | Existing devices, backups, or unlocked process memory are outside this local routing change |
| Selecting a large video allocates a complete native byte array and Base64 copy | Native reads are bounded to 1 MiB per plugin call; invalid/oversized chunk responses are rejected | The final `File` and encryption working buffers still scale with the selected file size; Android may impose device-specific memory limits |
| Plaintext video remains in an extra app cache after encryption | Upload code keeps the File object URL for preview, zeroizes the encryption input after preparation, zeroizes the worker input, and omits full plaintext from `MediaCache` | JavaScript/engine copies and the user's source media are not under deterministic zeroization control |
| Relay or storage receives plaintext media or note text | Media upload sends existing encrypted chunks only; My Vault text does not reach the relay or cloud sync | The unlocked UI necessarily displays plaintext to the local user |

## Adversarial regression coverage

- A selected native media URI spanning more than two chunks is read through bounded ranges with sequential offsets and reconstructs the expected file size.
- Active identity messages are persisted locally and return before network dispatch.
- A distinct identity ID is not treated as the active Space's My Vault.
- A self contact request is rejected by the app-state action, even if invoked outside the UI.
- Attachment encryption tests retain wrong-key rejection and existing ciphertext wire compatibility.

## Release gates

Run Android compilation and physical-device tests with small and large videos, including low-memory conditions and failure/retry cases. Complete independent security review, formal audit, and explicit dual sign-off before deployment, as required by the post-RC security freeze.
