# VEIL v1.0.0 General Availability (GA) Release Notes

## 1. Release Summary

VEIL v1.0.0 GA is the official production release of the privacy-first multi-space messaging application.

- **Version**: `1.0.0`
- **Release Date**: August 16, 2026
- **License**: MIT
- **Target Environments**: Modern Web Browsers (Chromium, Firefox, Safari) & Node.js 20+

---

## 2. Key Capabilities

- **Multi-Space Cryptographic Partitioning**: Unlimited independent personas on a single device with credential-selected unlocking.
- **Signal-Compliant Double Ratchet E2EE**: 1-to-1 asynchronous messaging with X3DH authenticated prekey handshakes.
- **Group Tree Ratchet**: Post-compromise security and epoch key rotation for secure group chats.
- **Untrusted Blind Relay Server**: Zero plaintext message visibility, persistent mailbox queues, and SHA-256 capability access tokens.
- **Encrypted Local Persistence**: IndexedDB client storage protected by per-Space HKDF StorageKeys.
- **Ephemeral Chunked Attachments**: 64 KiB authenticated slices with SHA-256 integrity reassembly and synchronous memory revocation on lock.
- **Instant Panic Lock**: Immediate memory zeroization, socket termination, and UI neutral lock screen reset.
