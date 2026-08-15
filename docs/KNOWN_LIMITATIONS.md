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
