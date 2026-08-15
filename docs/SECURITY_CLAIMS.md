# VEIL Formal Security Claims and Boundaries

## 1. Explicit Security Claims

| Claim | Boundary | Underlying Assumptions |
| :--- | :--- | :--- |
| **Confidentiality** | Message contents, media, and attachments are encrypted E2EE. | Relays and network observers cannot compute discrete logarithms on Curve25519 or break Poly1305. |
| **Integrity** | Bit-flipped or modified envelopes are rejected. | XChaCha20-Poly1305 AEAD authentication tags cannot be forged without key knowledge. |
| **Multi-Space Isolation** | Unlocking Space A yields zero cryptographic access to Space B. | Argon2id salt uniqueness prevents cross-space key collision. |
| **Plausible Deniability** | Neutral lock screen does not disclose Space existence or counts. | Adversary inspects device screen without root access to unencrypted volatile memory. |

---

## 2. What VEIL Does NOT Guarantee

1. **Host OS Compromise**: If an attacker has root/kernel-level access or a hardware keylogger installed, active memory can be dumped while a Space is unlocked.
2. **ISP Traffic Analysis**: Network adversaries can observe connection timing and packet endpoints unless the client routes traffic through Tor or an external VPN.
3. **Physical Flash Memory Zeroization**: Web browsers cannot guarantee physical flash cell overwriting in IndexedDB; plaintext persistence protection is achieved via AEAD ciphertext.
