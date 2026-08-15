# VEIL

> **Privacy-First Messenger | Multi-Space Cryptographic Architecture | Zero-Trust Relay**  
> **Current Version**: `v1.0.0-rc.1` (Release Candidate)

VEIL is an open-source, privacy-first messaging application that combines the intuitive, fluid experience of mainstream messengers with a multi-space cryptographic vault architecture and an untrusted relay transport substrate.

---

## Key Features

- **Multi-Space Cryptographic Isolation**: A single VEIL client installation supports multiple, isolated **Spaces** (e.g. Main Space, Work Space, Private Space, optional Decoy Space).
- **Credential-Selected Unlocking**: The credential entered at unlock time deterministically selects which Space to open. Locked Spaces remain impenetrable ciphertext.
- **Independent Cryptographic Identities**: Each Space generates independent Ed25519 signing and X25519 Diffie-Hellman keys. No party can link activities across Spaces.
- **Untrusted Relay Transport**: Messages are routed via blind mailbox tokens. The server sees zero plaintext, zero user account tables, and zero social graphs.
- **End-to-End Encryption**: Built on the Double Ratchet (1-to-1) and Sender Key (Group) algorithms providing Forward Secrecy and Post-Compromise Security.
- **Chunked Encrypted Media**: Media is partitioned into authenticated 64 KiB chunks with AAD binding and encrypted metadata.
- **Zero-Knowledge Multi-Device & Recovery**: Ephemeral QR DH with 6-digit SAS verification and 24-word BIP-39 mnemonic recovery.
- **Privacy UX & Panic Lock**: Single-space Quick Lock, multi-space instant Panic Lock, auto-lock timers, and locked-state memory purging.
- **Metadata Minimization**: Standard size bucket quantization (512B–64KB), bounded timing jitter, and mailbox capability epoch rotation.

---

## Documentation Index

### Release & Operations
- [Release Notes (v1.0.0-rc.1)](RELEASE_NOTES.md) — Release notes and architecture highlights.
- [Release Candidate Certification](docs/RELEASE_CANDIDATE_REPORT.md) — Phase 10 certification report.
- [Release Readiness Checklist](docs/RELEASE_CHECKLIST.md) — Production readiness gate.
- [Developer Guide](docs/DEVELOPMENT.md) — Prerequisites, build, testing, and contribution standards.
- [Deployment Guide](docs/DEPLOYMENT.md) — Server hardening, TLS, and reverse proxy setup.
- [Operations Manual](docs/OPERATIONS.md) — Health checks, maintenance, and monitoring.
- [Incident Response](docs/INCIDENT_RESPONSE.md) — 10-step containment and key compromise protocols.
- [Third-Party Notices](THIRD_PARTY_NOTICES.md) — Open source license attributions.

### Security, Audit & Privacy
- [Security Policy](SECURITY.md) — Vulnerability reporting and responsible disclosure SLAs.
- [Security Guide](docs/SECURITY_GUIDE.md) — Deep technical security architecture guide.
- [User Privacy Guide](docs/USER_PRIVACY_GUIDE.md) — Plain-language privacy guide.
- [Security Audit Report](docs/SECURITY_AUDIT_REPORT.md) — Phase 9 adversarial red-team audit results.
- [Security Scorecard](docs/SECURITY_SCORECARD.md) — Subsystem security ratings.
- [Security Properties Matrix](docs/SECURITY_PROPERTIES.md) — Formal guarantees and boundary limitations.
- [Threat Model & Boundary Analysis](docs/THREAT_MODEL.md) — Adversaries, STRIDE analysis, and trust boundaries.
- [Known Limitations](docs/KNOWN_LIMITATIONS.md) — Explicit, honest security boundaries.
- [Abuse Model](docs/ABUSE_MODEL.md) — Spam and resource exhaustion defenses.

### Core Architecture Specifications
- [Architecture Overview](docs/ARCHITECTURE.md) — System topology, layers, and data flows.
- [Cryptography Specification](docs/CRYPTOGRAPHY.md) — Audited cryptographic primitives & parameters.
- [Key Hierarchy](docs/KEY_HIERARCHY.md) — Key derivation tree (Argon2id -> KEK -> SMK -> Subkeys).
- [Space Model](docs/SPACE_MODEL.md) — Multi-space envelope encryption & isolation.
- [Identity Model](docs/IDENTITY_MODEL.md) — Ed25519/X25519 identities, contact cards, and safety numbers.
- [Metadata Model](docs/METADATA_MODEL.md) — Blind mailbox tokens & traffic analysis mitigation.

### AI-Agent Continuity System
- [AGENTS.md](AGENTS.md) — Root operating contract for AI coding agents (includes Post-RC Freeze).
- [Project Context](docs/ai/PROJECT_CONTEXT.md) — Vision, terminology, and architecture overview.
- [Current State](docs/ai/CURRENT_STATE.md) — Verified phase status and active milestone.
- [Active Task](docs/ai/ACTIVE_TASK.md) — Detailed work tracker for current phase.
- [Decisions (ADRs)](docs/ai/DECISIONS.md) — Architecture Decision Records.
- [Security Rules](docs/ai/SECURITY_RULES.md) — Non-negotiable security mandates.
- [Changelog](docs/ai/CHANGELOG.md) — Version and milestone history.
- [Handoff](docs/ai/HANDOFF.md) — Agent-to-agent session handoff state.

---

## Quick Start (Local Development)

```bash
# 1. Clone repository
git clone <repo-url>
cd chat

# 2. Install dependencies (strictly adhering to package-lock.json)
npm ci

# 3. Run full test suite (91 files, 230+ tests)
npm test

# 4. Build production distribution
npm run build
```

---

## Core Product Principle

> **"Hide the complexity, not the capability."**
