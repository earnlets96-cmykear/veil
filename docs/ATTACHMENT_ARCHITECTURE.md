# ATTACHMENT_ARCHITECTURE.md — VEIL Encrypted Attachment Pipeline

## 1. Chunking & Encryption Pipeline

1. **Chunking**: Files are divided into 64 KiB chunks (`DEFAULT_CHUNK_SIZE`).
2. **Authenticated Encryption**: Each chunk is encrypted with XChaCha20-Poly1305 using a unique 24-byte random nonce and associated data containing `attachmentId:chunkIndex:totalChunks`.
3. **Integrity Hash**: Plaintext is hashed via SHA-256 (`sha256Hash`) for full-file integrity validation post-reassembly.
4. **Blind Transmission**: Encrypted chunks travel as opaque E2EE payloads through the relay.
5. **Ephemeral Object URLs**: Decrypted files exist in browser memory as ephemeral `Blob` URLs and are revoked immediately upon Space lock or Panic Lock.
