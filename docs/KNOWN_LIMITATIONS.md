# KNOWN_LIMITATIONS.md — Security & Privacy Boundaries of VEIL

## 1. No False Claims

VEIL strictly avoids misleading security marketing:
- **NO "Military-Grade" or "Unhackable" Claims**: Security is defined by formal cryptographic parameters and concrete threat models, not hyperbole.
- **NO "100% Anonymous" Claims**: Metadata minimization reduces traffic signatures, but global passive adversaries can observe network-level packet timing and sizes.
- **NO "Perfect Plausible Deniability" Claims**: While VEIL supports Decoy Spaces and credential-selected unlocking, full forensic device analysis may detect the presence of encrypted storage blocks.

---

## 2. Threat Model Boundaries

### What VEIL CAN Protect Against
1. **Untrusted Relay Server**: The server cannot decrypt messages, cannot impersonate identities, cannot forge group actions, cannot reset passwords, and cannot view media.
2. **Passive Eavesdropper / Network Observer**: All transport payloads and media chunks are authenticated and encrypted (`XChaCha20-Poly1305`, Double Ratchet).
3. **Casual / Shoulder-Surfing Observers**: Quick Lock and Panic Lock wipe sensitive conversation plaintexts, drafts, and media from UI memory.
4. **Credential Coercion (Decoy Spaces)**: Entering a decoy credential unlocks an authentic, independent secondary Space without revealing primary Spaces.
5. **Post-Compromise Security**: Continuous ratcheting and key rotations ensure old compromised keys cannot decrypt future messages.

---

## 3. Real-World Limitations

| Scenario | Limitation | Mitigation |
| :--- | :--- | :--- |
| **Full Forensic Memory Acquisition** | If a device is seized while a Space is unlocked, plaintext keys reside in process RAM. | Use Panic Lock or aggressive Auto-Lock to minimize unlocked window. |
| **Compromised OS / Malware / Keyloggers** | A device with root-level malware can capture keystrokes, screen buffers, or process memory. | VEIL relies on the integrity of the host operating system. |
| **External Screen Cameras** | Hardware-level cameras photographing the physical screen cannot be blocked by software. | Use Privacy Mode (content blurring, hidden sender names). |
| **Traffic Timing Analysis** | A global adversary observing all ISP connections can correlate message packet bursts. | Phase 8 introduces constant-size padding and transport jitter. |
| **Loss of Password AND Recovery Phrase** | The server has zero backdoors; forgotten credentials result in permanent data loss. | Export and safely store the 24-word BIP-39 mnemonic phrase. |
