# ABUSE_MODEL.md — Abuse Containment & Resource Defense Model

## 1. The Abuse vs Privacy Dilemma

In traditional platforms, abuse moderation relies on inspecting message plaintexts, server-side content filtering, and linking accounts to real-world identities (phone numbers, credit cards).

**VEIL rejects server-side plaintext inspection while implementing robust cryptographic and resource-level abuse defenses.**

---

## 2. Abuse Defense Mechanisms

```mermaid
graph TD
    Client["Client Transport"] --> RateLimit["1. Network Rate Limiting<br/>(IP-level Token Bucket)"]
    RateLimit --> ResourceLimit["2. Strict Resource Caps<br/>(Max 64 KiB payload, Max 1000 items/mailbox)"]
    ResourceLimit --> ExpireQueue["3. Bounded Envelope TTL<br/>(Auto-purge after 7 days)"]
    ExpireQueue --> BlockList["4. Local User-Managed Blocklist<br/>(Client-side drop of unwanted identities)"]
```

---

## 3. Threat Categories & Defenses

| Abuse Threat | Vector | VEIL Mitigation Strategy |
| :--- | :--- | :--- |
| **Relay Flooding / Storage Exhaustion** | Attacker spams millions of envelopes | Hard mailbox capacity bounds (`1000` envelopes), `64 KiB` max payload, short TTL (7 days). |
| **Contact Harassment** | Unwanted sender messages | Local user blocklist in `EncryptedSpaceStore`; messages dropped and acknowledged silently without notify. |
| **Media Bombing** | Sending massive files to exhaust bandwidth | Chunked 64 KiB media download requires user approval / tap-to-download; encrypted previews only. |
| **Typing / Heartbeat Spam** | Rapid interaction flood | 3-second minimum throttle enforced on typing signals (`PresencePrivacyManager`). |
