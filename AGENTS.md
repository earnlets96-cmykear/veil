# AGENTS.md — AI Agent Operating Contract for VEIL

Welcome, AI Coding Agent.

VEIL is a privacy-first messaging application featuring multi-space cryptographic isolation, credential-selected unlocking, untrusted relay transports, and a resilient AI-Agent Continuity System.

Multiple AI agents will work on this codebase across distinct sessions. Because conversation windows are ephemeral:

> **THE REPOSITORY, DOCUMENTATION, TESTS, AND GIT HISTORY ARE THE SINGLE SOURCE OF TRUTH — NEVER THE CONVERSATION MEMORY.**

---

## 1. MANDATORY TAKEOVER PROCEDURE

Every new AI agent entering this project **MUST** execute the following sequence before modifying any code:

1. **Read Core AI Docs**:
   - [`AGENTS.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/AGENTS.md) (This file)
   - [`docs/ai/PROJECT_CONTEXT.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/PROJECT_CONTEXT.md) (Permanent vision & architecture)
   - [`docs/ai/CURRENT_STATE.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/CURRENT_STATE.md) (Verified current phase & status)
   - [`docs/ai/SECURITY_RULES.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/SECURITY_RULES.md) (Non-negotiable security mandates)
   - [`docs/ai/DECISIONS.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/DECISIONS.md) (Architecture Decision Records)
   - [`docs/ai/ACTIVE_TASK.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/ACTIVE_TASK.md) (Active work tracker)
   - [`docs/ai/HANDOFF.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/docs/ai/HANDOFF.md) (If present from a previous agent)
2. **Inspect Repository Reality**:
   - Run `git status`, `git log -n 5`, and inspect modified files.
   - Run existing test suites (`npm test` / `vitest run`).
   - Compare verified repository state against documentation claims.
3. **Produce Takeover Report**:
   - Document project understanding, verified state, active task, and the exact next action before writing code.

---

## 2. NON-NEGOTIABLE CORE RULES

1. **NEVER INVENT CRYPTOGRAPHY**:
   - Never create custom encryption algorithms, custom KDFs, custom key exchange, custom group ratchets, or custom random generators.
   - Strictly use mature, audited libraries (Argon2id, XChaCha20-Poly1305, Ed25519, X25519, Noise/Double Ratchet).
2. **NEVER ASSUME TESTS PASS**:
   - Always run tests via the test runner.
   - Never delete, comment out, or weaken tests to make them pass.
   - Security features require negative/adversarial tests (e.g. wrong password rejection, cross-space isolation enforcement, corrupted ciphertext rejection).
3. **NEVER CASUALLY REDESIGN ARCHITECTURE**:
   - Respect established Architecture Decision Records in `docs/ai/DECISIONS.md`.
   - Any architectural shift requires documenting an ADR first.
4. **NEVER LEAK SENSITIVE DATA**:
   - Passwords, unencrypted master keys, and message plaintexts must NEVER appear in logs, error traces, telemetry, local temporary storage, or untrusted server payloads.
   - Sensitive memory buffers must be zeroized when no longer required.
5. **KEEP THE REPOSITORY COMMITTED & DOCUMENTED**:
   - Make small, atomic, meaningful git commits with descriptive prefixes (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`).
   - Keep `CURRENT_STATE.md`, `ACTIVE_TASK.md`, and `CHANGELOG.md` updated as features are completed.
6. **PRODUCE A CLEAN HANDOFF**:
   - When approaching context/token limits or finishing a phase, generate/update `docs/ai/HANDOFF.md` before stopping.

---

## 3. DEVELOPMENT PHASES DISCIPLINE

VEIL is built sequentially across 11 disciplined phases (Phase 0 to Phase 10):
- **Phase 0**: Architecture, Threat Model, Technology Selection, Design System, AI Continuity
- **Phase 1**: Cryptographic Space Prototype & Envelope Storage
- **Phase 2**: Independent Space Cryptographic Identities
- **Phase 3**: Privacy-Preserving Untrusted Transport Interface
- **Phase 4**: End-to-End Encrypted 1-to-1 Messaging (Double Ratchet)
- **Phase 5**: Encrypted Group Messaging & Encrypted Media
- **Phase 6**: Multi-Device Synchronization & Cryptographic Recovery
- **Phase 7**: Privacy UX, App Lock, Notifications, Panic Lock, Decoy Space
- **Phase 8**: Metadata Minimization & Traffic Obfuscation
- **Phase 9**: Adversarial Security Audit
- **Phase 10**: Release Candidate & Production Packaging

Do NOT skip phases. Validate each phase's Definition of Done before advancing.

---

## 4. DEFINITION OF DONE

A task or feature is complete ONLY when:
- [ ] Code is implemented and adheres to established architecture.
- [ ] Positive and negative/attack tests are written and passing.
- [ ] No secrets or sensitive data leak to logs or server payloads.
- [ ] `docs/ai/CURRENT_STATE.md` and `docs/ai/CHANGELOG.md` are updated.
- [ ] A clean, descriptive git commit is created.

---

## 5. POST-RC SECURITY FREEZE & GOVERNANCE

> **MANDATORY POST-RC SECURITY FREEZE**:
> Any change to cryptographic protocols, identity management, Space isolation boundaries, authentication, metadata defenses, recovery vaults, device trust, or message/group protocols is **STRICTLY FROZEN** after Phase 10.
> 
> Any future modification to security-sensitive components requires:
> 1. A documented threat model review.
> 2. A formal Architecture Decision Record (ADR) in `docs/ai/DECISIONS.md`.
> 3. Adversarial regression test suites with positive and negative attack vectors.
> 4. Explicit dual-signoff and independent security audit prior to deployment.

