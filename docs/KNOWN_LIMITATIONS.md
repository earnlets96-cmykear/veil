# KNOWN_LIMITATIONS.md — Explicit Security Boundaries & Known Limitations

VEIL is committed to absolute engineering honesty. We document what VEIL does **not** protect against so users and security reviewers understand the exact threat model boundaries.

---

## 1. Operating System & Host Environment Compromises

- **Kernel Rootkits & Keyloggers**: If the host operating system is compromised with ring-0/root malware, an attacker can log keystrokes during password entry or directly read process memory while a Space is unlocked.
- **Compromised Hardware / Baseband**: Firmware backdoors or baseband processors with direct DMA (Direct Memory Access) can bypass application-level protections.

---

## 2. JavaScript / V8 Runtime Memory Limitations

- **Garbage Collection & Memory Zeroization**: VEIL implements best-effort buffer zeroization (`zeroize(buffer)` using `Uint8Array.fill(0)`). However, high-level managed runtimes (such as V8, JavaScript engines, and browser environments) do not guarantee that internal string allocations, JIT optimizations, or garbage-collector generational sweeps will not leave temporary remnants in uncompacted heap space.
- **Memory Remnants in Core Dumps**: If an operating system process crash dump or physical RAM cold-boot dump occurs while a Space is unlocked, transient key material in active heap buffers may be extractable before garbage collection or zeroization executes.

---

## 3. Physical & Optical Threats

- **Shoulder Surfing & Screen Photography**: An attacker physically looking at or photographing the device screen while a conversation is open will see the plaintext displayed on the screen.
- **Seizure While Unlocked**: If the device is seized by an adversary while a Space is unlocked and before the auto-lock or panic lock triggers, in-memory keys and open plaintexts in RAM may be extracted via hardware cold-boot attacks.

---

## 4. Decoy Space Limits (Plausible Deniability)

- **Casual vs. Deep Forensic Limits**: Decoy Space provides plausible deniability against visual inspection or casual coercion. However, it does **not** guarantee protection against advanced hardware silicon decapping, power analysis, or deep flash memory wear-leveling forensics where erased flash blocks may contain residual encrypted ciphertext fragments.

---

## 5. Network Metadata under Global Passive Adversaries

- While VEIL uses blind mailbox tokens and uniform message padding, an adversary capable of monitoring all global internet exchange points (e.g. state-level ISP wiretaps) can perform statistical traffic correlation if the client is connected directly via standard TCP/TLS without an onion routing or mixnet transport layer.

---

## 6. Space Cloning & Identity Duplication (Phase 2)

- **Cloned Identity**: Because identity keys are deterministically derived from the Space Master Key via HKDF, copying the encrypted Space storage to another device and unlocking with the same password produces the **same cryptographic identity** on both devices. This means two devices could impersonate the same identity simultaneously.
- **No Clone Detection**: Phase 2 does not implement any mechanism to detect or prevent identity cloning. Multi-device identity management and clone detection are deferred to Phase 6.

---

## 7. Identity Rotation

- **Permanent Identity Binding**: A Space's identity is permanently bound to its SMK. There is currently no mechanism to rotate or revoke an identity key while preserving the Space. Identity rotation would require generating a new SMK and re-encrypting all Space data, which is not supported in Phase 2.
- **Key Compromise**: If a Space's private signing or key agreement key is compromised, the only remediation is to create a new Space with a new identity and re-establish contacts.
