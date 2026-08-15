# SECURITY_AUDIT.md — VEIL Adversarial Security Inventory & Threat Boundary Analysis

## 1. Executive Summary

This document establishes the comprehensive security asset inventory, trust boundaries, threat actor matrix, and vulnerability taxonomy for the VEIL privacy messaging platform as audited during Phase 9.

---

## 2. Security Asset Inventory

| Asset | Storage Location | Protection Mechanism | Access Restrictions | Residual Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Space Master Key (SMK)** | Volatile memory only (sealed in Argon2id envelope on disk) | `XChaCha20-Poly1305` + `Argon2id` KEK | Unlocked active session only; zeroized on lock | RAM dump during active unlocked state |
| **Identity Private Key (Ed25519)** | `EncryptedSpaceStore` (Local DB) | Derived from `IdentitySeed` via HKDF-SHA256 | Active Space session only | Host root compromise |
| **Prekey Private Keys (X25519)** | `EncryptedSpaceStore` (Local DB) | Encrypted under `StorageKey` | Active Space session only | Host root compromise |
| **Ratchet Chain Keys** | `EncryptedSpaceStore` (Local DB) | Ephemeral DH ratchet + continuous deletion of old keys | Active Double Ratchet session only | Endpoint compromised before ratchet advance |
| **Sender Keys (Group E2EE)** | `EncryptedSpaceStore` (Local DB) | Symmetric ratchet; rotated on member departure | Active group members only | Compromised group member |
| **Media Decryption Keys** | E2EE message descriptors (in-flight/stored) | `XChaCha20-Poly1305` per-file symmetric keys | Conversation recipients only | Key recipient leaks key |
| **Mailbox Capability Secrets** | Client memory / `EncryptedSpaceStore` | 256-bit CSPRNG secrets; SHA-256 verifiers on server | Client only; epoch-rotated | Capability token interception in-flight |
| **Backup Passwords / Mnemonics** | Paper / External cold storage | 24-word BIP-39 with 8-bit SHA-256 checksum | User physical possession only | Physical theft of paper backup |

---

## 3. Trust Boundary Review

```
Boundary 1: Space-to-Space Isolation
• Invariant: Space A and Space B share ZERO cryptographic keys, ZERO storage partitions, and ZERO memory buffers.
• Enforcement: Independent Argon2id salts, distinct SMKs, distinct HKDF derived keys, independent AES/XChaCha AEAD tags.

Boundary 2: Client-to-Server Zero-Trust Boundary
• Invariant: The server is an untrusted relay. It receives ZERO plaintexts, ZERO private keys, and ZERO user relationship maps.
• Enforcement: E2EE Double Ratchet, Sender Keys, Blind Mailbox IDs, one-way SHA-256 capability verifiers.

Boundary 3: Storage-to-Memory Boundary
• Invariant: Data at rest is authenticated ciphertext. Master keys are NEVER written unencrypted to non-volatile disk.
• Enforcement: Argon2id KEK envelopes + EncryptedSpaceStore with HMAC/Poly1305 authentication.

Boundary 4: Active Session to Locked State Boundary
• Invariant: Locking a Space immediately destroys session keys, wipes memory caches, and clears UI plaintexts.
• Enforcement: SpaceSession.destroy() + zeroize() + UIStateManager.clearSensitiveContent().
```

---

## 4. Threat Actor Capabilities Matrix

| Threat Actor | Assumed Capabilities | VEIL Architectural Defenses | Non-Guaranteed Scenarios |
| :--- | :--- | :--- | :--- |
| **Untrusted Server Operator** | Full database access, packet inspection, request injection/dropping | E2EE payloads, blind mailboxes, opaque capabilities, AEAD tags | Traffic timing analysis over long observation windows |
| **Passive Network Wiretap (ISP/State)** | Monitors TCP/TLS traffic, packet sizes, timestamps | Standardized size bucket padding (512B–64KB), bounded timing jitter (20–400ms) | Global passive correlation of synchronized bursts |
| **Device Thief (Locked Device)** | Physical possession of locked hardware | Argon2id KDF + XChaCha20-Poly1305 envelope encryption | Extremely weak user passwords susceptible to GPU brute-force |
| **Coercive Observer (Forced Unlock)** | Demands unlock password under duress | Decoy Space (authentic secondary space), Panic Lock shortcut | Deep hardware silicon decapping or flash wear-leveling forensics |
| **Compromised OS / Root Malware** | Kernel-level root access, keylogger, RAM scrapers | Out of scope for software-layer defenses | Root malware can capture passwords during entry |
