# THREAT_MODEL.md — Adversarial Threat Model & Boundary Analysis

## 1. Threat Model Overview

VEIL is engineered under a **Zero-Trust Architecture**. We assume that both the transport network and the relay servers may be actively monitored, subverted, or compromised by sophisticated adversaries.

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

## 3. STRIDE Threat Matrix

| Threat Category | Potential Vector | VEIL Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Impersonating a Space contact | Ed25519 identity keys + Safety number verification |
| **Tampering** | Modifying envelopes in transit or storage | AEAD (Poly1305 / GCM) authentication tags |
| **Repudiation** | Claiming a message was not transmitted | Signed prekeys and ratchet signatures |
| **Information Disclosure** | Server leaks database to public | E2EE payloads; zero plaintext on server |
| **Denial of Service** | Relay drops or floods mailboxes | Client retry logic + message sequence checks |
| **Elevation of Privilege** | Space A accessing Space B local records | Cryptographic SMK partition isolation |

---

## 4. Trust Boundaries

1. **Space-to-Space Boundary**: Space A and Space B share ZERO key material. An active Space A session cannot read or decrypt Space B database records.
2. **Client-to-Relay Boundary**: The relay server receives zero unencrypted message content, zero user passwords, and zero persistent user-to-user relationship maps.
3. **Memory-to-Disk Boundary**: Master keys and private keys are never written to disk unencrypted. Key buffers are zeroized on lock or destruction.

---

## 5. Explicit Non-Goals & Limitations

VEIL is committed to cryptographic honesty. We do **NOT** claim protection against:
- **Operating System Kernel Compromise / Rootkits**: If the OS kernel or a malicious keylogger is running with root privileges, it can capture keystrokes during password entry or read active RAM.
- **Physical Screen Photography**: An attacker photographing the screen while the user is actively reading a message.
- **Hardware Forensic Anti-Tamper Guarantees for Decoy Space**: Decoy Space provides plausible deniability against casual inspection, but does not guarantee protection against advanced hardware silicon decapping or deep flash memory wear-leveling forensics.
