# OPERATIONS.md — Production Operations & Maintenance Manual

## 1. System Health Monitoring

Production relay instances expose unauthenticated health endpoints for load balancer probing:
- **`GET /healthz`**: Returns `200 OK` with JSON `{"status":"ok","timestamp":1786...}` when active memory and storage subsystems are healthy.
- **`GET /readyz`**: Returns `200 OK` when network interfaces are bound and queue processors are listening.

---

## 2. Server Logging Policy

In accordance with [`docs/SERVER_PRIVACY.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/SERVER_PRIVACY.md):
- **Allowed Log Fields**: Timestamp, Log Level (`INFO`, `WARN`, `ERROR`), Error Code, Opaque Envelope ID (on error).
- **Prohibited Log Fields**: Client IP addresses, Request Payload Bodies, Capability Secrets, Mailbox IDs in debug traces, User Identifiers.

---

## 3. Routine Maintenance & Storage Garbage Collection

1. **Envelope Expiration Sweep**: The relay daemon runs an automatic TTL garbage collection cycle every 60 seconds, purging envelopes where `expiresAt <= Date.now()`.
2. **Mailbox Inactivity Cleanup**: Empty mailboxes with zero activity and no envelopes for >30 days are purged from storage.
3. **Database Maintenance**: SQLite/PostgreSQL vacuuming should be scheduled during low-traffic windows (weekly).

---

## 4. Key Rotation Procedures

- **Client Mailbox Capabilities**: Rotated epoch-by-epoch (`MailboxRotationManager`) with a 1-epoch grace period.
- **Group Sender Keys**: Automatically rotated whenever a member is removed or periodically upon epoch milestones (`GroupStateManager`).
- **Server TLS Certificates**: Automated rotation via ACME / Let's Encrypt with 60-day renewal intervals.
