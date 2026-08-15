# NETWORK_SECURITY.md — Client Network Security & Isolation Model

## 1. Per-Space Network Isolation

VEIL strictly isolates network state between distinct Spaces:
- **No Shared Mailbox Identifiers**: Space A and Space B allocate independent blind mailboxes on the relay.
- **No Shared Capability Tokens**: Capability tokens are stored encrypted under each Space's unique `StorageKey`.
- **No Shared Queues**: Outbound and inbound queues exist purely in the active Space's storage partition.
- **Locked Space Security**: When Space A locks, its WebSocket connection is terminated and all memory buffers are wiped. An unlocked Space B cannot observe or manipulate Space A's network traffic.

---

## 2. Transport Security & TLS Enforcement

- In production configuration (`enforceTls: true`), `HttpTransport` rejects any relay endpoint not beginning with `https://` and `WebSocketTransport` rejects any endpoint not beginning with `wss://`.
- TLS downgrade attacks fail closed with `TlsRequiredError`.

---

## 3. Privacy & Logging Invariants

- Plaintext messages, private keys, passwords, and Space Master Keys NEVER enter the network layer.
- Capability tokens and envelope payloads are NEVER output in debug or console logs.
