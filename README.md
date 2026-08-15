# VEIL

> **Privacy-First Messenger | Multi-Space Cryptographic Architecture | Zero-Trust Relay**

VEIL is a modern, privacy-first messaging application that combines the intuitive, fluid experience of mainstream messengers (Signal/Telegram) with a multi-space cryptographic vault architecture.

---

## Key Features

- **Multi-Space Cryptographic Isolation**: A single VEIL client installation supports multiple, isolated **Spaces** (e.g. Main Space, Work Space, Private Space, optional Decoy Space).
- **Credential-Selected Unlocking**: The credential entered at unlock time deterministically selects which Space to open. Locked Spaces remain impenetrable ciphertext.
- **Independent Cryptographic Identities**: Each Space generates independent Ed25519 signing and X25519 Diffie-Hellman keys. No party can link activities across Spaces.
- **Untrusted Relay Transport**: Messages are routed via blind mailbox tokens. The server sees zero plaintext, zero user account tables, and zero social graphs.
- **End-to-End Encryption**: Built on the Double Ratchet algorithm providing forward secrecy and post-compromise security.
- **Zero Paid Services**: 100% open-source, local-first development with no paid APIs or infrastructure required.

---

## Documentation Index

### Core Architecture & Technical Specifications
- [Architecture Overview](docs/ARCHITECTURE.md) — System topology, layers, and data flows.
- [Threat Model & Boundary Analysis](docs/THREAT_MODEL.md) — Adversaries, STRIDE analysis, and trust boundaries.
- [Cryptography Specification](docs/CRYPTOGRAPHY.md) — Audited cryptographic primitives & parameters.
- [Key Hierarchy](docs/KEY_HIERARCHY.md) — Key derivation tree (Argon2id -> KEK -> SMK -> Subkeys).
- [Space Model](docs/SPACE_MODEL.md) — Multi-space envelope encryption & isolation.
- [Identity Model](docs/IDENTITY_MODEL.md) — Ed25519/X25519 identities, contact cards, and safety numbers.
- [Metadata Model](docs/METADATA_MODEL.md) — Blind mailbox tokens & traffic analysis mitigation.
- [Privacy Model](docs/PRIVACY.md) — Content, Identity, Device, Metadata, and Network privacy.
- [Security Policy](docs/SECURITY.md) — Mandatory security invariants & memory hygiene.
- [Known Limitations](docs/KNOWN_LIMITATIONS.md) — Explicit, honest security boundaries.

### AI-Agent Continuity System
- [AGENTS.md](AGENTS.md) — Root operating contract for AI coding agents.
- [Project Context](docs/ai/PROJECT_CONTEXT.md) — Vision, terminology, and architecture overview.
- [Current State](docs/ai/CURRENT_STATE.md) — Verified phase status and active milestone.
- [Active Task](docs/ai/ACTIVE_TASK.md) — Detailed work tracker for current phase.
- [Decisions (ADRs)](docs/ai/DECISIONS.md) — Architecture Decision Records.
- [Security Rules](docs/ai/SECURITY_RULES.md) — Non-negotiable security mandates.
- [Changelog](docs/ai/CHANGELOG.md) — Version and milestone history.
- [Handoff](docs/ai/HANDOFF.md) — Agent-to-agent session handoff state.

### Phase Prompts
- [Master AI Prompt](prompts/MASTER_PROMPT.md)
- [Phase 00: Architecture & Foundation](prompts/PHASE_00.md)
- [Phase 01: Space Prototype](prompts/PHASE_01.md)
- [Phase 02: Independent Identities](prompts/PHASE_02.md)
- [Phase 03: Untrusted Transport](prompts/PHASE_03.md)
- [Phase 04: E2EE Messaging](prompts/PHASE_04.md)
- [Phase 05: Groups & Media](prompts/PHASE_05.md)
- [Phase 06: Multi-Device & Recovery](prompts/PHASE_06.md)
- [Phase 07: Privacy UX & Panic Lock](prompts/PHASE_07.md)
- [Phase 08: Metadata Minimization](prompts/PHASE_08.md)
- [Phase 09: Adversarial Audit](prompts/PHASE_09.md)
- [Phase 10: Release Candidate](prompts/PHASE_10.md)

---

## Quick Start (Local Development)

```bash
# Clone the repository
git clone <repo-url>
cd chat

# Install dependencies
npm install

# Run unit and cryptographic tests
npm test

# Launch local development UI
npm run dev
```

---

## Core Product Principle

> **"Hide the complexity, not the capability."**
