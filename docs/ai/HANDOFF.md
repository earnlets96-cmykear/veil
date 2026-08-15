# HANDOFF.md — AI Agent Session Handoff

## 1. Project Overview & Current Phase

- **Project**: VEIL (Privacy-First Messenger with Multi-Space Cryptographic Architecture)
- **Current Phase**: **PHASE 2: Independent Space Cryptographic Identities** — Complete
- **Status**: 101/101 tests passing
- **Current Branch**: `master`

---

## 2. Phase 2 Implementation Summary

### What Was Implemented
1. **Two-Tier HKDF Identity Derivation** (`src/crypto/hkdf.ts`):
   - `SMK → HKDF("veil-v1-identity-seed") → identitySeed`
   - `identitySeed → HKDF("veil-v1-signing-key") → Ed25519 private key`
   - `identitySeed → HKDF("veil-v1-key-agreement") → X25519 private key`

2. **Ed25519 Signing** (`src/identity/signing.ts`): `@noble/curves/ed25519.js` v1.8.0.
3. **X25519 Key Agreement** (`src/identity/keyAgreement.ts`): `@noble/curves/ed25519.js` (exports `x25519`).
4. **Canonical Serialization** (`src/identity/canonical.ts`): Deterministic field ordering, no `JSON.stringify()` reliance.
5. **Fingerprint** (`src/identity/fingerprint.ts`): `SHA-256(signingPub || kaPub)` → 12×5-digit human-readable format.
6. **Self-Signed Identity Document** (`src/identity/document.ts`): Ed25519 self-signature over canonical bytes. Verification rejects tampered fields, unknown versions, substituted keys.
7. **SpaceIdentityManager** (`src/identity/manager.ts`): Create, load, persist (encrypted), sign, verify, DH shared secret.
8. **SpaceSession.getMasterKey()**: Exposes SMK for identity derivation within Space boundary.

### Cryptographic Primitives
| Primitive | Library | Version | Standard |
|---|---|---|---|
| Ed25519 | `@noble/curves/ed25519.js` | v1.8.0 | RFC 8032 |
| X25519 | `@noble/curves/ed25519.js` | v1.8.0 | RFC 7748 |
| HKDF-SHA256 | `@noble/hashes/hkdf.js` | v1.7.0 | RFC 5869 |
| SHA-256 | `@noble/hashes/sha256.js` | v1.7.0 | FIPS 180-4 |

### Test Results (101/101)
| Suite | Tests | Status |
|---|---|---|
| `phase0-baseline` | 12 | PASS |
| `security-logging` | 1 | PASS |
| `crypto-primitives` | 13 | PASS |
| `tampering-corruption` | 9 | PASS |
| `space-vault` | 9 | PASS |
| `space-isolation` | 5 | PASS |
| `identity-generation` | 5 | PASS |
| `identity-signatures` | 7 | PASS |
| `key-agreement` | 5 | PASS |
| `identity-isolation` | 4 | PASS |
| `identity-document` | 9 | PASS |
| `identity-fingerprint` | 9 | PASS |
| `identity-tampering` | 7 | PASS |
| `identity-lifecycle` | 6 | PASS |

---

## 3. Invariants the Next Agent Must NOT Break

1. **NEVER INVENT CRYPTOGRAPHY**.
2. **PASSWORD ≠ SMK ≠ IDENTITY KEY**: Three distinct layers.
3. **ISOLATION BY DEFAULT**: Space A identity ≠ Space B identity. Zero shared key material.
4. **DOMAIN SEPARATION**: All subkeys via HKDF with distinct domain tags.
5. **SELF-SIGNED BINDING**: Identity document keys are bound by Ed25519 self-signature.
6. **DETERMINISTIC IDENTITY**: Same SMK → same identity. Password change preserves identity.
7. **ZERO SENSITIVE LOGGING**: No private keys, SMKs, or passwords in logs.
8. **MANDATORY ATTACK TESTS**: All security features must have negative/adversarial tests.

---

## 4. Known Limitations (Phase 2)

- **Space Cloning**: A cloned Space has the same identity (ADR-014). Multi-device management deferred to Phase 6.
- **V8 Memory**: Best-effort zeroization only; GC may leave remnants.
- **No Identity Rotation**: Identity is permanently bound to SMK. Rotation would require new SMK and re-encryption.

---

## 5. Exact Next Action for Incoming Agent

Proceed to **Phase 3: Privacy-Preserving Untrusted Transport Interface** ([`prompts/PHASE_03.md`](file:///c:/Users/RTX%204060/Desktop/PROJECT/chat/prompts/PHASE_03.md)).
