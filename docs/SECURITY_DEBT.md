# SECURITY_DEBT.md — Accepted Risks & Technical Hardening Roadmap

## 1. Overview

This document transparently tracks architectural trade-offs, accepted platform limitations, and future hardening items for post-release versions of VEIL.

---

## 2. Accepted Technical Limitations

| Item | Context | Mitigation Strategy | Future Hardening Roadmap |
| :--- | :--- | :--- | :--- |
| **V8 / JavaScript Memory Garbage Collection** | JavaScript engines do not guarantee immediate physical RAM zeroization when objects are de-referenced. | Explicit `zeroize(Uint8Array)` in memory utilities; aggressive session destruction. | Transition sensitive cryptographic core to WebAssembly/Rust with pinned secure memory allocators. |
| **Direct TLS Client IP Visibility** | Standard client-to-server TLS connections inherently expose client IP addresses to the relay server. | Decoupled `ITransportAdapter` allows routing over SOCKS5 proxies or VPNs. | Native Tor Onion Service transport and Nym Mixnet adapter integration (Phase 10+). |
| **Plausible Deniability on Flash Memory** | Forensic flash memory wear-leveling can leave residual ciphertext blocks even after file deletion. | Authentic Decoy Spaces; generic unlock errors; sealed storage envelopes. | Full disk container encryption and randomized block allocation strategies. |
| **Global Passive Traffic Analysis** | Nation-state adversaries observing global internet backbones can correlate packet arrival timings. | Size bucket quantization (512B–64KB); bounded timing jitter (20–400ms); envelope batching. | Continuous constant-rate cover traffic generation (Loopix architecture). |

---

## 3. Independent Audit Recommendation

This internal adversarial security audit was conducted rigorously under red-team assumptions. However, prior to high-risk public deployment or enterprise operational use, an independent professional third-party cryptographic code audit is strongly recommended.
