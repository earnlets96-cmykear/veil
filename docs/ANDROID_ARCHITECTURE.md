# VEIL Android Architecture & Platform Strategy

## 1. Chosen Technology: Hybrid Capacitor Native Container

VEIL utilizes Capacitor to package the production React 19 + TypeScript application into a hardened native Android container (`chat.veil.app`).

### Rationale
- **100% Cryptographic Code Reuse**: The exact audited `@noble/ciphers`, `@noble/curves`, `@noble/hashes`, Double Ratchet, Group Ratchet, and HKDF code run unaltered.
- **Single Source of Truth**: Protocol changes never risk Android-vs-Web divergence or timing side-channels.
- **Native Security Controls**: Direct integration with Android Network Security Config, disabling cleartext traffic, preventing cloud backups, and supporting deep link invitation handlers (`veil://invite/...`).

---

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                 React 19 Presentation Layer                 │
├─────────────────────────────────────────────────────────────┤
│      VEIL Core Engine (Double Ratchet, HKDF, Encrypted Store) │
├─────────────────────────────────────────────────────────────┤
│               Capacitor Native Bridge Layer                 │
├─────────────────────────────────────────────────────────────┤
│         Android Native OS (Network Security, Biometrics)     │
└─────────────────────────────────────────────────────────────┘
```
