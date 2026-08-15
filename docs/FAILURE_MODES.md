# VEIL Failure Modes & Resiliency Guide

## 1. Handled Failure Scenarios

| Failure Scenario | System Reaction | User Experience |
| :--- | :--- | :--- |
| **Relay Server Offline** | Messages enqueued in local encrypted queue (`veil:queue:*`) | Outgoing messages marked as `QUEUED`, auto-retries on reconnect |
| **Mid-flight Disconnect** | WebSocket reconnects with exponential backoff; ACK deferred until storage write | Zero message loss; duplicate envelope suppression prevents double-display |
| **Bit-Flipped Ciphertext** | AEAD Poly1305 authentication fails | Message discarded with security warning; session integrity preserved |
| **Corrupted Attachment** | SHA-256 integrity hash verification fails | Download aborted; error displayed to recipient |
| **Locked Space Access** | AssertActive throws error | Prevents unauthorized background operations while Space is locked |
| **Emergency Panic Lock** | Instant zeroization of SMK and active session keys | Screen immediately switches to neutral lock screen |
