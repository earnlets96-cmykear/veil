# CHANGELOG.md — VEIL Project Changelog

All notable changes, architectural decisions, and security milestones across the VEIL project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Phase 0] - 2026-08-15

### Added
- **AI-Agent Continuity System**: Created root `AGENTS.md` operating contract and persistent `docs/ai/` tracking files (`PROJECT_CONTEXT.md`, `CURRENT_STATE.md`, `ACTIVE_TASK.md`, `DECISIONS.md`, `SECURITY_RULES.md`, `CHANGELOG.md`, `HANDOFF.md`).
- **Core Architecture & Technical Specifications**:
  - `docs/ARCHITECTURE.md` (System topology & component layering)
  - `docs/THREAT_MODEL.md` (Threat actors, STRIDE matrix & trust boundaries)
  - `docs/CRYPTOGRAPHY.md` (Audited cryptographic specifications)
  - `docs/KEY_HIERARCHY.md` (Argon2id -> KEK -> SMK -> domain-separated subkeys)
  - `docs/SPACE_MODEL.md` (Multi-space envelope encryption & credential-selected unlocking)
  - `docs/IDENTITY_MODEL.md` (Independent Ed25519/X25519 identities & safety numbers)
  - `docs/METADATA_MODEL.md` (Blind mailbox routing & traffic analysis mitigations)
  - `docs/PRIVACY.md` (5-layer privacy architecture)
  - `docs/SECURITY.md` (Security policies & memory hygiene)
  - `docs/KNOWN_LIMITATIONS.md` (Honest documentation of threat boundaries)
- **Phase Prompts Suite**: Created `prompts/MASTER_PROMPT.md` and individual prompts `prompts/PHASE_00.md` through `prompts/PHASE_10.md`.
- **Baseline Cryptographic Code & Design Tokens**:
  - `src/types/index.ts`: Core type definitions for envelopes, spaces, and identities.
  - `src/crypto/memory.ts`: Memory hygiene zeroization utility.
  - `src/crypto/utils.ts`: CSPRNG, Base64/Hex encoding, and constant-time comparison.
  - `src/styles/veil-design-system.css`: Vanilla CSS design system tokens and component styles.
  - `tests/phase0-baseline.test.ts`: 12 automated unit and negative tests (100% passing).
