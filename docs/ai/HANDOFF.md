# HANDOFF.md — AI Agent Session Handoff

## 1. Project Overview & Current Phase

- **Project**: VEIL (Privacy-First Messenger with Multi-Space Cryptographic Architecture)
- **Current Phase**: **PHASE 0: Architecture, Threat Model, Technology Selection, Design System & AI Continuity Infrastructure**
- **Status**: Complete & Verified
- **Current Branch**: `main`

---

## 2. Verified Repository Reality

- **AI Continuity Suite**: Established and fully populated:
  - [`AGENTS.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/AGENTS.md)
  - [`docs/ai/PROJECT_CONTEXT.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/PROJECT_CONTEXT.md)
  - [`docs/ai/CURRENT_STATE.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/CURRENT_STATE.md)
  - [`docs/ai/ACTIVE_TASK.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/ACTIVE_TASK.md)
  - [`docs/ai/DECISIONS.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/DECISIONS.md) (ADR-001 to ADR-006)
  - [`docs/ai/SECURITY_RULES.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/SECURITY_RULES.md)
  - [`docs/ai/CHANGELOG.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/CHANGELOG.md)
  - [`docs/ai/HANDOFF.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/HANDOFF.md)
- **Core Architecture & Technical Specifications**: Fully written in `docs/`:
  - [`docs/ARCHITECTURE.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ARCHITECTURE.md)
  - [`docs/THREAT_MODEL.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/THREAT_MODEL.md)
  - [`docs/CRYPTOGRAPHY.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/CRYPTOGRAPHY.md)
  - [`docs/KEY_HIERARCHY.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/KEY_HIERARCHY.md)
  - [`docs/SPACE_MODEL.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/SPACE_MODEL.md)
  - [`docs/IDENTITY_MODEL.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/IDENTITY_MODEL.md)
  - [`docs/METADATA_MODEL.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/METADATA_MODEL.md)
  - [`docs/PRIVACY.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/PRIVACY.md)
  - [`docs/SECURITY.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/SECURITY.md)
  - [`docs/KNOWN_LIMITATIONS.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/KNOWN_LIMITATIONS.md)
- **Phase Prompts Suite**: Fully written in `prompts/`:
  - [`prompts/MASTER_PROMPT.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/MASTER_PROMPT.md)
  - [`prompts/PHASE_00.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_00.md) through [`prompts/PHASE_10.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_10.md)
- **Source Code Baseline**:
  - `src/types/index.ts` (Core type definitions)
  - `src/crypto/memory.ts` (Memory zeroization & safe buffers)
  - `src/crypto/utils.ts` (CSPRNG, Base64, Hex, constant-time equality)
  - `src/styles/veil-design-system.css` (Vanilla CSS design system)
  - `tests/phase0-baseline.test.ts` (Unit & negative tests)

---

## 3. Invariants the Next Agent Must NOT Break

1. **NEVER INVENT CRYPTOGRAPHY**: Use only audited primitives (Argon2id, XChaCha20-Poly1305, AES-256-GCM, Ed25519, X25519, Double Ratchet).
2. **ZERO PAID SERVICES**: Keep all dependencies open-source and locally runnable.
3. **ISOLATION BY DEFAULT**: Space A must never access Space B plaintext or keys.
4. **MEMORY HYGIENE**: Zeroize all sensitive key buffers when disposing sessions.
5. **TESTS MANDATORY**: All security features require negative tests.

---

## 4. Exact Next Action for Incoming Agent

Proceed to **Phase 1: Cryptographic Space Prototype & Envelope Storage** ([`prompts/PHASE_01.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_01.md)).
1. Read `AGENTS.md` and `docs/ai/PROJECT_CONTEXT.md`.
2. Update `docs/ai/ACTIVE_TASK.md` for Phase 1.
3. Implement `SpaceVaultManager` with Argon2id envelope creation, credential-selected unlocking, and cross-space negative attack tests.
