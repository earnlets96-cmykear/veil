# THREAT_MODEL.md — Adversarial Threat Model & Boundary Analysis

## 1. System Threat Model Overview

VEIL is designed under a **Zero-Trust Architecture**. We assume that both the transport network and the relay servers may be actively monitored, subverted, or compromised by sophisticated adversaries.

---

## 2. Threat Actors & Capabilities

| Threat Actor | Capabilities | Primary Goal | Defense Mechanism |
| :--- | :--- | :--- | :--- |
| **Untrusted / Compromised Relay Server** | Inspects all incoming network packets, controls message storage, can drop, replay, or inject arbitrary messages. | Intercept plaintext, map social graph, correlate multiple Spaces. | **E2EE (Double Ratchet)**: Zero plaintext access.<br/>**Blind Mailboxes**: Zero user IDs or social graph tables.<br/>**Authentication**: Signatures and HMACs prevent injection. |
| **Passive Network Eavesdropper (ISP / Wiretap)** | Monitors TCP/TLS traffic, metadata, packet sizes, timestamps. | Identify communicating parties, traffic analysis. | **TLS 1.3 Transport** + Fixed-size message padding + Blind mailbox tokens. |
| **Device Thief / Seizure (Locked Device)** | Has physical possession of powered-off or locked device; can dump flash storage. | Extract chats, contacts, private keys across all Spaces. | **Argon2id KDF + AES/XChaCha AEAD**: Stored data is ciphertext. No SMK in non-volatile storage. Locked Spaces cannot be decrypted without passwords. |
| **Coercive Adversary (Shoulder Surfer / Forced Unlock)** | Demands device unlock under coercion. | Inspect sensitive chats in Private Space. | **Decoy Space**: Alternative credential opens benign environment without indicating other Spaces.<br/>**Panic Lock**: Instant memory zeroization shortcut. |
| **Malicious Contact / Malicious Group Member** | Legitimate participant in a chat who attempts to read historical messages or correlate Spaces. | Decrypt past/future messages after leaving; link Spaces. | **Forward Secrecy & Post-Compromise Security**: Key ratchets delete old keys.<br/>**Independent Identities**: Distinct keys per Space prevent correlation. |

---

## 3. STRIDE Threat Analysis

```
+-------------------------------------------------------------------+
|                        STRIDE THREAT MATRIX                       |
+-------------------+-----------------------+-----------------------+
| Threat Category   | Potential Vector      | VEIL Mitigation       |
+-------------------+-----------------------+-----------------------+
| Spoofing          | Impersonating a Space | Ed25519 identity keys |
|                   | contact               | + Safety number verification |
| Tampering         | Modifying envelopes   | AEAD (Poly1305 / GCM) |
|                   | in transit or storage | authentication tags   |
| Repudiation       | Claiming a message    | Signed prekeys and    |
|                   | was not transmitted   | ratchet signatures    |
| Information Disc. | Server leaks database | E2EE payloads; zero   |
|                   | to public             | plaintext on server   |
| Denial of Service | Relay drops or floods | Client retry logic +  |
|                   | mailboxes             | message sequence checks|
| Elevation of Priv.| Space A accessing     | Cryptographic SMK     |
|                   | Space B local records | partition isolation   |
+-------------------+-----------------------+-----------------------+
```

---

## 4. Trust Boundaries & Security Invariants

1. **Space-to-Space Boundary**:
   - Invariant: Space A and Space B on the same device share ZERO key material.
   - Invariant: An active Space A session cannot read or decrypt Space B database records.
2. **Client-to-Relay Boundary**:
   - Invariant: The relay server receives zero unencrypted message content, zero user passwords, and zero persistent user-to-user relationship maps.
3. **Memory-to-Disk Boundary**:
   - Invariant: Master keys and private keys are never written to disk unencrypted.
   - Invariant: Key buffers are zeroized on lock or destruction.

---

## 5. Explicit Non-Goals & Documented Limitations

VEIL is committed to cryptographic honesty. We do **NOT** claim protection against:
- **Operating System Kernel Compromise / Rootkits**: If the OS kernel or a malicious keylogger is running with root/ring-0 privileges, it can capture keystrokes during password entry or read active RAM.
- **Physical Screen Photography**: An attacker photographing the screen while the user is actively reading a message.
- **Hardware Forensic Anti-Tamper Guarantees for Decoy Space**: Decoy Space provides plausible deniability against casual inspection, but does not guarantee protection against advanced hardware silicon decapping or deep flash memory wear-leveling forensics.
