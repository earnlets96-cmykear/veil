# RELAY_PRIVACY.md — VEIL Relay Metadata Minimization & Privacy Guarantees

## 1. Zero Central Identity & Data Minimization

The VEIL relay enforces strict data minimization:
- **No User Accounts**: No usernames, passwords, phone numbers, email addresses, or profile photos exist on the server.
- **No Social Graph**: The server does not know who is communicating with whom. Senders address envelopes to random 256-bit `mailboxId` routing tokens.
- **No Plaintext Message Storage**: The server never sees message text, media file names, or conversation titles.

---

## 2. Privacy-Preserving Structured Logging

The relay uses `PrivacyLogger` with strict field redaction:
- Capability tokens, passwords, keys, authorization headers, and payloads are automatically replaced with `[REDACTED]` prior to serialization.
- Server logs contain only high-level operational diagnostics (request counts, uptime, error statuses).

---

## 3. Explicit Privacy Boundaries & Anonymity Limitations

1. **IP Address Exposure**: The server observes client TCP/IP connections. To conceal IP metadata, clients should route traffic over Tor, Nym mixnets, or privacy VPNs.
2. **Timing Correlation**: An adversary observing both sender and receiver network traffic simultaneously might correlate packet timing if traffic shaping/jitter is disabled.
3. **Mailbox Rotation**: Clients should periodically rotate blind mailbox tokens using VEIL's capability rotation protocol.
