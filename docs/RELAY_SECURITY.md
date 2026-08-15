# RELAY_SECURITY.md — VEIL Relay Security & Threat Model

## 1. Threat Model & Adversary Capabilities

The VEIL relay is designed to withstand an adversary who:
1. **Controls or compromises the relay server**: The adversary can read all server memory, database records, and incoming network packets.
2. **Can inject, drop, or reorder packets**: Active network adversary.
3. **Attempts Denial of Service / Resource Exhaustion**: Attempts to flood mailboxes, open unbounded sockets, or store massive payloads.

---

## 2. Security Invariants

### 1. Zero Plaintext Access
The relay server operates strictly on opaque Base64 ciphertexts. The server contains no code or cryptographic keys to decrypt message payloads.

### 2. One-Way Capability Authorization
Mailbox access is governed by random 256-bit capability tokens. The server stores only `SHA-256(capabilityToken)`. A database breach does not reveal plaintext capability tokens that could be replayed without preimage recovery.

### 3. Cross-Mailbox Cryptographic Isolation
Mailbox A's capability token cannot be used to fetch or acknowledge Mailbox B's envelopes.

### 4. Bounded Execution & Memory Containment
All HTTP body parsing is capped at 128 KiB. Payload size is capped at 64 KiB. Mailbox queues are capped at 1,000 items. Rate limits restrict request spikes.

---

## 3. Production Deployment Security Considerations

For production deployments:
- **TLS Termination**: Must run behind a hardened reverse proxy (e.g. Nginx, Cloudflare, Envoy) with TLS 1.3.
- **DDoS Mitigation**: Upstream edge mitigation (e.g. cloud WAF) is required against volumetric Layer 3/4 floods.
- **Unprivileged Execution**: Must execute as an unprivileged system user (`nobody` or dedicated `veil-relay` user) in a read-only container rootfs.
