# VEIL — Encrypted Attachment Real-Device Testing & Verification

## 1. Attachment Pipeline Architecture

Large files (images, documents, binaries) are processed via the `AttachmentPipeline`:
1. **Authenticated Chunking**: Data is split into 64 KiB discrete chunks.
2. **XChaCha20-Poly1305 AEAD**: Each chunk is encrypted under the symmetric transfer key with chunk index AAD.
3. **SHA-256 Integrity Verification**: The full plaintext SHA-256 hash is computed and authenticated.
4. **Ephemeral Object Lifecycle**: Decrypted blobs are converted to ephemeral Object URLs and revoked immediately upon modal closure or session destruction.

---

## 2. Real-Device Test Scenarios

| Test Case | Payload Size | Verification Check | Status |
| :--- | :--- | :--- | :--- |
| **Small Image** | 45 KiB | Single chunk, instant render | PASS |
| **Large Photo** | 4.2 MiB | Multi-chunk reassembly, SHA-256 verified | PASS |
| **Binary File** | 1.0 MiB | Byte-for-byte fidelity, zero corruption | PASS |
| **Tampered Ciphertext** | 1.0 MiB | Bit flip detected, AEAD decrypt throws | PASS |
| **Ephemeral URL Cleanup** | N/A | Object URLs revoked; zero unencrypted storage | PASS |
