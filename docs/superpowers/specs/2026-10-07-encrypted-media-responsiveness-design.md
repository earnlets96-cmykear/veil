# Encrypted Media Recovery and Messaging Responsiveness

**Date:** 2026-10-07
**Status:** Approved design; awaiting user review before implementation
**Scope:** Encrypted media upload/retrieval, durable cache, playback responsiveness, and composer responsiveness

## Problem

The current media path does not meet the expected privacy and recovery behavior:

- Attachment sending uploads file bytes directly through `CloudClient.uploadAttachment`; the corresponding voice path passes raw audio bytes to the same raw upload endpoint. Attachment metadata currently has empty encryption-key fields in the outgoing media path.
- `MediaCacheManager.saveToIDB` persists non-audio `DecryptedMedia.data` as-is. These entries contain decrypted image/video bytes, while audio is excluded from IndexedDB entirely.
- Upload workers and source buffers exist only in the running app process. Re-entry cannot resume them, so the persisted message can remain in a stale upload state.
- Large cryptographic transforms and some layout work can make media and the message input feel blocked. `MessageComposer.handleTextChange` synchronously resets textarea height and reads `scrollHeight` on each keystroke.

These findings conflict with `docs/ai/SECURITY_RULES.md`, ADR-054, ADR-087, ADR-122, and the post-RC security freeze in `AGENTS.md`.

## Goals

1. Restore client-side encryption for attachments and voice notes using VEIL's existing audited primitives and attachment format; do not create new cryptography.
2. Persist enough **encrypted** transfer state in the active Space's authenticated encrypted store to resume an upload after process exit.
3. Persist downloaded media as ciphertext only. Perform decryption in the worker path and keep plaintext only in short-lived runtime memory/Blob URLs; clear it on Space lock.
4. Make music/audio playback reuse locally cached ciphertext across app re-entry and show bounded, truthful loading/error/retry states.
5. Keep message input responsive during focus and typing, and diagnose conversation-open delays independently.
6. Preserve current attachment authorization, group isolation, message privacy, and wire-safety allowlists.

## Non-goals

- Persisting decrypted message media or audio to disk.
- Changing identity, ratchet, group protocol, or key derivation algorithms.
- Storing reusable media keys outside the active Space's encrypted record boundary.
- Claiming partial network upload resume unless the server API is proven to support verified offset/range uploads. The first implementation may restart the ciphertext upload from byte zero while reusing its encrypted job and stable object identity.
- Deploying a security-sensitive change before the required independent review and dual sign-off.

## Proposed architecture

### 1. Encrypted media preparation

Route attachment and voice sends through the existing `AttachmentPipeline` and `MediaWorkerPool` instead of uploading source bytes. The existing 64 KiB authenticated chunk format, XChaCha20-Poly1305 implementation, and SHA-256 integrity checks are the baseline. Generate a fresh media key with the project's secure random utility. Keep that key inside the Space-encrypted local job and include only the existing wire-approved key material in the end-to-end encrypted message payload.

For payloads below the worker threshold, retain the current small-payload fast path only if profiling confirms it stays within the input/audio interaction budget; otherwise dispatch those transforms to a worker too. No crypto runs synchronously in a React event handler.

### 2. Durable encrypted upload outbox

Create a media transfer service with a per-Space queue. Before a network upload starts, write an authenticated record to `EncryptedSpaceStore` containing the message/job ID, conversation routing context, attachment metadata, encrypted chunk bytes, required key material, and transfer state. Await persistence before dispatching the first upload request.

On Space unlock, recover queued and interrupted jobs, reauthenticate as needed, and retry using the stable attachment/job ID. Once all objects are stored and the encrypted message envelope has been durably enqueued, mark the media job complete and remove its source ciphertext. On cancellation or permanent failure, preserve an actionable UI state and allow retry without selecting the source file again while the encrypted job remains available.

The network API currently accepts whole raw binary bodies and has no demonstrated offset-resume contract. Initial recovery therefore resumes the job by retrying the ciphertext object upload from the beginning. A later chunk/offset protocol would require separate server design, ADR, compatibility tests, and threat review.

### 3. Ciphertext-only media cache and legacy cleanup

Replace the current decrypted `MediaCacheManager` IndexedDB persistence with a dedicated ciphertext cache keyed by Space ID and object ID. Persist downloaded ciphertext before decrypting. Keep decrypted bytes and Blob URLs in bounded RAM cache only, never IndexedDB. Rehydrate by loading ciphertext locally and decrypting in the worker.

On upgrade, remove old `veil_media_cache` records that may contain decrypted media. Run this cleanup without logging filenames, media contents, keys, or other sensitive metadata. Ensure Space lock clears RAM media entries and revokes Blob URLs; ciphertext may remain partitioned by Space because it is not plaintext.

### 4. Audio and music playback

Use the same ciphertext cache and worker decryption path for voice notes and generic audio attachments. Preserve the existing single-player coordination and seek state. Show a loading spinner while a worker/cache/network operation is active, surface a retry action on terminal errors, and stop setting a loading state after timeout/abort/cancel. Plaintext audio remains runtime-only and is discarded on lock or explicit cache clear.

### 5. Composer and conversation responsiveness

Profile conversation switching, first focus, and keystroke-to-paint latency with large histories and active media work. For typing, remove per-keystroke synchronous layout thrashing by coalescing textarea measurement into one animation frame or using a suitable `ResizeObserver`/CSS layout approach. Keep text state local to the composer and prevent unrelated media progress updates from invalidating the text input. Avoid changing timeline behavior without a reproduction or measurement.

## State and failure behavior

- Upload job states: `PREPARING`, `READY`, `UPLOADING`, `UPLOADED`, `ENVELOPE_QUEUED`, `COMPLETE`, `RETRYABLE_FAILED`, `CANCELLED`.
- Re-entered `UPLOADING` jobs become retryable and are automatically rescheduled after the Space is unlocked and a cloud session is available.
- Duplicate recovery must be idempotent by stable message ID, attachment ID, and object ID. Do not send duplicate visible messages if the envelope was already queued.
- Quota or persistence failure must stop before sending media to the server and report a clear local error. It must not silently fall back to volatile storage or plaintext upload.
- Authentication failures trigger the existing session refresh path; integrity/authentication failures fail closed and discard the invalid cache/job rather than presenting bytes as valid media.
- Lock/Panic Lock revokes plaintext Blob URLs and zeroizes transient buffers where existing lifecycle APIs permit.

## Security and governance

This touches media encryption and persistent media handling, so it is security-sensitive under `AGENTS.md`'s post-RC freeze. Before implementation is considered complete for deployment:

1. Document a threat-model review covering local ciphertext, media-key protection, cache partitioning, replay/duplicate upload handling, interrupted jobs, quota failures, and lock/panic cleanup.
2. Add an ADR before changing protocol or persistence architecture.
3. Add positive and adversarial tests: ciphertext-only network and IndexedDB boundaries, tampered chunk rejection, wrong-key rejection, cross-Space cache isolation, interrupted upload idempotency, duplicate envelope suppression, and lock cleanup.
4. Obtain explicit dual sign-off and an independent security audit before deployment.

Never log raw media bytes, plaintext, media keys, credentials, or serialized encrypted job contents.

## Verification plan

- Unit tests for media worker encryption/decryption, ciphertext cache partitioning and migration cleanup, upload job persistence/recovery/state transitions, and composer sizing scheduler.
- Adversarial tests for corrupted ciphertext, wrong media key, cross-Space object IDs, duplicate recovery, interrupted upload retry, and persistence failure.
- Runtime integration tests for image/video/voice/generic audio sends, app process restart during each upload phase, offline re-entry, audio replay from ciphertext cache, and lock/Panic Lock cleanup.
- Responsiveness measurements under a large conversation and large attachment transform: input keystroke-to-paint and focus-to-interactive timings must remain below an agreed device-specific budget, with no long task attributable to encryption/decryption on the UI thread.
- Full TypeScript checks, relevant test suites, production build, and Android build where the local toolchain permits.

## Delivery sequence

1. Add the ADR and threat-model notes; capture baselines and create regression tests.
2. Implement worker-backed encrypted attachment and voice preparation.
3. Implement encrypted durable transfer jobs and restart recovery.
4. Implement ciphertext-only download cache and migrate/remove legacy plaintext media cache entries.
5. Integrate audio playback and lock cleanup.
6. Optimize and measure composer focus/typing and conversation-open behavior.
7. Run adversarial, integration, full-suite, and build verification; request independent security review and dual sign-off before any deployment.
