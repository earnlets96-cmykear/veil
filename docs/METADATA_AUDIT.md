# METADATA_AUDIT.md — VEIL System-Wide Metadata Audit

## 1. Executive Summary

This audit catalogs all metadata vectors across VEIL's architecture, evaluates observable traffic signatures, and documents applied minimizations and operational justifications.

---

## 2. Comprehensive Metadata Classification

```
CATEGORY A — ZERO LEAKAGE (Strictly Confidential)
• Plaintext message contents (E2EE Double Ratchet)
• Plaintext media attachments & thumbnails (XChaCha20-Poly1305 per-file keys)
• Space Master Keys, Identity Seeds, Prekey Private Keys
• User passwords & KDF input secrets
• Multi-Space relationships and Space names

CATEGORY B — MINIMIZED & OBFUSCATED (Padded / Shaped)
• Message payload sizes (Quantized into 512B, 2KB, 8KB, 32KB, 64KB buckets)
• Message transmission timing (Bounded random jitter 20ms–500ms + batching)
• Mailbox lifetime (Periodic capability token rotation with grace epochs)
• Push notification payloads (Wakeup signals only, zero content/sender)
• Interaction signals (Optional rate-limited typing & read receipts)

CATEGORY C — OPERATIONALLY NECESSARY (Documented Justifications)
• Blind Mailbox Token (`mailboxId`): Required for asynchronous blind packet routing.
• Capability Auth Verifier (`verifier`): Required to authenticate mailbox fetch requests.
• Transport Protocol Version (`version: 1`): Required for packet wire serialization.
• Network Layer Source IP: Visible at socket layer over direct TLS (mitigated via proxy/Tor).
```

---

## 3. Component-by-Component Metadata Surface

| Component | Raw Vector | Who Observes | Mitigation in Phase 8 | Residual Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Message Payloads** | Exact character length | ISP, Relay Server | Quantized size bucket padding (512B to 64KB) | Bucket threshold boundaries |
| **Message Delivery** | Immediate socket transmission | Passive Wiretap | Bounded timing jitter + envelope batching queue | Statistical burst analysis |
| **Mailbox Routing** | Permanent static mailbox ID | Relay Server | Periodic capability secret rotation | Temporary active session window |
| **Push Notifications** | APNs / FCM notification payload | Apple / Google | Zero plaintext, zero sender name, generic wakeup signal | App wakeup event timestamp |
| **Media Attachments** | Chunk file transfer sizes | Blob Storage / CDN | Standardized 64 KiB chunks + size padding | Total chunk count |
| **Typing & Receipts** | Keystroke & read timestamps | External Contact | Rate-limited batching, disabled by default | Interaction state if enabled |
