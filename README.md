# VEIL — Privacy-First Multi-Space Messenger

> **VEIL** is a modern, privacy-first messaging application featuring multi-space cryptographic isolation, credential-selected unlocking, untrusted blind relay transports, and an AI-Agent continuity architecture.

---

## 🌟 Key Architectural Features

- **Multi-Space Cryptographic Isolation**: One VEIL installation supports multiple completely isolated personas (e.g. Personal, Work, Private, Decoy). Each Space has its own keys, contacts, message history, and blind mailboxes.
- **Credential-Selected Unlocking**: Entering a passphrase derives an Argon2id key that unlocks the matching encrypted `SpaceHeaderEnvelope` on-the-fly without disclosing whether other Spaces exist.
- **End-to-End Encryption (E2EE)**: 1-to-1 conversations use the Signal-compliant **Double Ratchet** protocol + X3DH authenticated prekeys. Group chats use **Group Tree Ratchet** with epoch key rotations.
- **Blind Relay Architecture**: The relay server is untrusted. It receives only opaque ciphertext envelopes, authenticates mailbox access via SHA-256 capability tokens, and enforces bounded TTLs.
- **Encrypted Local Persistence**: Client records and queues are stored in IndexedDB encrypted with a per-Space `StorageKey` derived via HKDF-SHA-256.
- **Ephemeral Attachments**: Files are chunked into 64 KiB authenticated slices (XChaCha20-Poly1305 + SHA-256) and decrypted on-demand to ephemeral browser `Blob` URLs.
- **Emergency Panic Lock**: A single trigger instantly wipes volatile session keys from memory, halts network sockets, revokes ephemeral attachment Blobs, and returns to the neutral lock screen.
- **Privacy-Preserving Search & Notifications**: In-memory local search and notification policies (`HIDDEN`, `SENDER_ONLY`, `FULL_OBFUSCATED`) protect against shoulder-surfing and OS-level forensic logging.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
npm test
```

### 3. Start Development Client
```bash
npm run dev
```

### 4. Start Standalone Relay Server
```bash
npm run relay
```

### 5. Build for Production
```bash
npm run build
```

---

## 🔐 Cryptographic Specifications

| Component | Primitive / Algorithm | Standard / Spec |
| :--- | :--- | :--- |
| **Password KDF** | Argon2id ($m=64\text{MB}, t=3, p=4$) | RFC 9106 |
| **Envelope & Storage AEAD** | XChaCha20-Poly1305 (24-byte nonce, 16-byte tag) | Draft-irtf-cfrg-xchacha |
| **Key Derivation** | HKDF-SHA-256 | RFC 5869 |
| **Digital Signatures** | Ed25519 (PureEd25519) | RFC 8032 |
| **Key Agreement** | X25519 ECDH | RFC 7748 |
| **1-to-1 Ratchet** | Double Ratchet Algorithm + X3DH | Signal Protocol |
| **Group Ratchet** | Group Tree / Sender Key Ratchet | Post-Compromise Security |
| **Recovery Mnemonic** | BIP-39 (24-word dictionary) | BIP-0039 |

---

## 📚 Technical Documentation

- [`docs/SYSTEM_SUMMARY.md`](docs/SYSTEM_SUMMARY.md): Complete technical architecture overview.
- [`docs/CONTACT_ARCHITECTURE.md`](docs/CONTACT_ARCHITECTURE.md): Contact model and address book isolation.
- [`docs/INVITATION_PROTOCOL.md`](docs/INVITATION_PROTOCOL.md): Cryptographic signed invitation protocol.
- [`docs/MESSAGE_LIFECYCLE.md`](docs/MESSAGE_LIFECYCLE.md): Message state machine and offline queues.
- [`docs/ATTACHMENT_ARCHITECTURE.md`](docs/ATTACHMENT_ARCHITECTURE.md): Chunked media encryption and reassembly.
- [`docs/DEVICE_LINKING.md`](docs/DEVICE_LINKING.md): Multi-device SAS pairing and revocation.
- [`docs/DATABASE_ARCHITECTURE.md`](docs/DATABASE_ARCHITECTURE.md): Client vs Relay storage boundaries.
- [`docs/NOTIFICATION_PRIVACY.md`](docs/NOTIFICATION_PRIVACY.md): Notification policies and suppression.
- [`docs/PRODUCTION_CONFIGURATION.md`](docs/PRODUCTION_CONFIGURATION.md): Environment configs and TLS rules.
- [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md): Self-hosting relay guide.
- [`docs/ai/DECISIONS.md`](docs/ai/DECISIONS.md): Complete Architecture Decision Records (`ADR-001` through `ADR-080`).

---

## 📄 License

MIT License — 100% Free and Open Source.
