# Cross-Platform Compatibility Matrix

| Feature | Desktop Web | Mobile Android | Compatibility Invariant |
| :--- | :--- | :--- | :--- |
| **Double Ratchet E2EE** | ✅ Supported | ✅ Supported | 100% Identical Curve25519 & AEAD |
| **Group Tree Ratchet** | ✅ Supported | ✅ Supported | 100% Identical epoch transitions |
| **Attachments (64 KiB)** | ✅ Supported | ✅ Supported | Authenticated chunking & SHA-256 |
| **Signed Invitations** | ✅ Supported | ✅ Supported | `veil://invite/...` format |
| **Multi-Space Partitioning** | ✅ Supported | ✅ Supported | Complete cryptographic isolation |
| **Emergency Panic Lock** | ✅ Supported | ✅ Supported | Synchronous key zeroization |
