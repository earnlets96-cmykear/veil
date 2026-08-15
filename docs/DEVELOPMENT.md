# DEVELOPMENT.md — Developer Setup & Contributing Guide

## 1. Prerequisites

- **Node.js**: Version `18.x`, `20.x`, or `22.x` LTS.
- **Package Manager**: `npm` (v9+ or v10+).
- **TypeScript**: TypeScript 5.3+.
- **Git**: For version control.

---

## 2. Installation & Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/veil-project/veil.git
cd veil

# 2. Install dependencies (strictly adhering to package-lock.json)
npm ci

# 3. Run all test suites
npm test

# 4. Build the production distribution
npm run build
```

---

## 3. Project Structure

```
chat/
├── src/
│   ├── crypto/         # Mature cryptographic wrappers (@noble/ciphers, @noble/hashes, @noble/curves)
│   ├── spaces/         # Multi-Space vault manager, SpaceSession, Argon2id sealing
│   ├── storage/        # Authenticated local storage (EncryptedSpaceStore)
│   ├── identity/       # Ed25519/X25519 identity generation, self-signed identity documents
│   ├── transport/      # Blind mailboxes, capability tokens, traffic shaping, jitter, batching
│   ├── ratchet/        # 1-to-1 Double Ratchet engine and session state management
│   ├── group/          # Group state machine, epochs, Sender Key protocol
│   ├── media/          # 64 KiB chunked encrypted media pipeline
│   ├── device/         # Multi-device enrollment, ephemeral QR DH, 6-digit SAS verification
│   ├── recovery/       # 24-word BIP-39 mnemonic recovery and .veilbackup vault
│   └── privacy/        # Privacy UX, Quick Lock, Panic Lock, Auto-Lock, Disclosure Guards
├── tests/              # 90+ comprehensive positive, negative, adversarial, and fuzzing test suites
├── docs/               # Full system documentation and architectural specifications
│   └── ai/             # AI continuity context, decisions, active tasks, and handoff records
└── prompts/            # Phase prompts (Phase 0 through Phase 10)
```

---

## 4. Coding & Security Rules

1. **NEVER INVENT CRYPTOGRAPHY**: Use established primitives (`@noble/curves`, `@noble/hashes`, `@noble/ciphers`). Never write custom ciphers, KDFs, or random number generators.
2. **ZERO UNENCRYPTED SENSITIVE DATA**: Never log passwords, SMKs, private keys, or plaintexts to console output or error traces.
3. **MANDATORY NEGATIVE TESTING**: Every security control requires negative/adversarial tests (wrong passwords, corrupted ciphertexts, epoch rollbacks, cross-space attacks).
4. **DOCUMENT ARCHITECTURAL CHANGES**: Any architectural adjustment requires documenting an ADR in `docs/ai/DECISIONS.md`.
5. **ZERO WARNINGS / CLEAN TEST PASS**: All test suites must pass 100% cleanly before committing.
