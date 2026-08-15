# SERVER_PRIVACY.md — Server Logging, Retention & Access Policies

## 1. Zero-Knowledge Server Operating Standard

VEIL relay servers operate under strict minimization principles:
1. **NO CONTENT LOGGING**: Plaintexts, passwords, master keys, session keys, and media files are NEVER logged.
2. **MINIMAL OPERATIONAL LOGS**: Production servers record only generic HTTP status codes and transient performance metrics.
3. **EPHEMERAL STORAGE**: Delivered transport envelopes are deleted immediately upon client acknowledgment (`acknowledgeEnvelope`). Expired envelopes are purged automatically by `purgeExpired()`.

---

## 2. Retention Schedules

| Data Category | Retention Limit | Destruction Method |
| :--- | :--- | :--- |
| **Unacknowledged Envelopes** | Maximum 14 days (or client TTL) | Automatic database deletion |
| **Delivered Envelopes** | 0 seconds (Immediate) | Hard delete on ACK |
| **Capability Verifiers** | Active token epoch | Replaced on token rotation |
| **Connection Access Logs** | Transient (Max 24 hours for DoS mitigation) | Rolling log rotation |

---

## 3. Server Access Controls

- **Operational Least Privilege**: Server operators have zero access to decryption keys or user mappings because keys exist solely on client devices.
- **Subpoena Resistance**: A compromised or legally compelled server database dump yields only opaque random bytes, blind mailbox IDs, and SHA-256 verifiers with zero user identities or plaintexts.
