# VEIL Backup & Disaster Recovery Guide

## 1. Client-Side Backup & Recovery

- **BIP-39 Mnemonic Phrase**: Exportable 24-word recovery phrase that deterministically regenerates the Space Master Key (SMK) and all derived cryptographic identities.
- **Encrypted Space Backup**: Passphrase-encrypted JSON export of all Space message history, contacts, and settings.

---

## 2. Server-Side Backup & Recovery

- The relay server stores only transient opaque ciphertext envelopes with bounded TTLs (default 14 days).
- Backing up the relay storage directory (`/var/lib/veil/storage`) preserves in-flight undelivered messages across server crashes.
- Relay backups contain zero plaintext message contents or private keys.
