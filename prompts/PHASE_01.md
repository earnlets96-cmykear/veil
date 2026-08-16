# VEIL — PHASE 1
# CRYPTOGRAPHIC SPACE PROTOTYPE & ENVELOPE STORAGE

VERSION: 1.1

============================================================
MISSION
============================================================

You are now executing PHASE 1 of VEIL.

Phase 0 has already established the project foundation, architecture,
documentation, AI-agent continuity system, and baseline testing.

Phase 1 has one primary purpose:

PROVE THAT VEIL'S MULTI-SPACE SECURITY MODEL ACTUALLY WORKS.

The defining feature of VEIL is that multiple Spaces can exist on one
device while remaining cryptographically isolated.

Example:

Password A → Main Space

Password B → Private Space

Optional:

Password C → Decoy Space

These must NOT merely be UI profiles.

Each Space must have independently protected cryptographic material.

============================================================
IMPORTANT SECURITY POSITION
============================================================

DO NOT assume that Phase 0 documentation is automatically correct.

Before implementing Phase 1:

1. Inspect the existing cryptographic code.
2. Inspect its dependencies.
3. Inspect existing tests.
4. Run the existing test suite.
5. Compare implementation against documentation.
6. Identify anything that is documented but not actually implemented.
7. Identify anything described as "audited" that has not actually been
   independently audited.

Documentation is not evidence of implementation.

A cryptographic primitive is not "audited" merely because it is documented.

If Phase 0 contains language such as:

"audited cryptography"

but no actual independent audit exists, correct the wording.

Use terminology such as:

"selected cryptographic primitives"

or

"planned cryptographic construction"

where appropriate.

============================================================
PART 1 — TAKEOVER VERIFICATION
============================================================

Before changing code, read:

AGENTS.md

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md
docs/ai/CHANGELOG.md

Then inspect:

- repository structure
- package.json
- source tree
- tests
- cryptographic utilities
- storage utilities
- TypeScript configuration
- Git history
- Git status

Run the entire existing test suite.

Record the actual result.

Do not trust a previous agent's claim that tests pass.

============================================================
PART 2 — CRYPTOGRAPHIC IMPLEMENTATION AUDIT
============================================================

Before building new cryptographic functionality, inspect the existing
implementation of:

- randomBytes()
- zeroize()
- withSecureBuffer()
- constant-time comparison
- encoding/decoding
- Argon2id or other password KDF
- encryption/decryption
- authentication
- SpaceHeaderEnvelope
- SpaceIdentity
- any key derivation code

For every security-sensitive component classify it as:

A. Actually implemented and tested.

B. Implemented but insufficiently tested.

C. Documented but not implemented.

D. Placeholder/mock implementation.

E. Security-sensitive implementation requiring redesign.

Document discrepancies.

Do not silently work around an incorrect implementation.

============================================================
PART 3 — CRYPTOGRAPHY POLICY
============================================================

NON-NEGOTIABLE:

DO NOT INVENT CRYPTOGRAPHY.

Do not implement custom:

- encryption algorithms
- hashing algorithms
- password KDFs
- key exchange
- authentication schemes
- random number generation
- MAC constructions
- AEAD constructions
- key derivation algorithms
- secure deletion algorithms

Use mature, established cryptographic libraries.

Prefer well-maintained, widely reviewed primitives.

The implementation must use authenticated encryption for protected
security-sensitive data.

Do not implement raw encryption without authentication.

============================================================
PART 4 — CRYPTOGRAPHIC SELECTION VS IMPLEMENTATION
============================================================

Do not blindly implement a named algorithm simply because a previous
document mentions it.

For every primitive selected for Phase 1, document:

Primitive

Library

Library version

Purpose

Parameters

Why it was selected

Security assumptions

Known limitations

Testing approach

Example:

Password KDF
→ Argon2id
→ established maintained implementation
→ derives key-encryption material from password

The purpose of this section is to prevent an AI agent from confusing:

"we wrote code called Argon2id"

with:

"we are safely using an established Argon2id implementation."

============================================================
PART 5 — KEY ARCHITECTURE
============================================================

Implement and document a clear key hierarchy.

Conceptually:

USER PASSWORD
      │
      ▼
PASSWORD KDF
      │
      ▼
KEY ENCRYPTION KEY (KEK)
      │
      ▼
ENCRYPTED SPACE KEY ENVELOPE
      │
      ▼
SPACE MASTER KEY (SMK)
      │
      ├──────────────┐
      ▼              ▼
Storage Key     Future Subkeys
      │
      ▼
Protected Space Data

The exact architecture may differ if there is a strong technical reason.

If it differs:

1. Explain why.
2. Update KEY_HIERARCHY.md.
3. Record an ADR.
4. Add tests.

============================================================
PART 6 — PASSWORD IS NOT THE SPACE KEY
============================================================

The password must NOT directly become the Space Master Key.

The password should be processed through an established password KDF.

The Space Master Key should be independently generated using a CSPRNG.

Conceptually:

Password
→ KDF
→ KEK

CSPRNG
→ random SMK

KEK
→ protects SMK

This provides separation between:

human credential

and

actual Space encryption material.

============================================================
PART 7 — SPACE CREATION
============================================================

Implement:

createSpace()

Process:

1. User selects Space name.
2. User supplies password.
3. Generate cryptographically secure random Space Master Key.
4. Generate appropriate cryptographic nonce/salt material.
5. Derive KEK using the established password KDF.
6. Encrypt/authenticate the Space Master Key.
7. Create the Space envelope.
8. Persist the protected envelope.
9. Clear temporary sensitive material where practical.

The Space Master Key must NOT be deterministically derived from
the password.

============================================================
PART 8 — ENVELOPE DESIGN
============================================================

Implement a versioned encrypted Space envelope.

The envelope should clearly separate:

PUBLIC METADATA

from

PROTECTED METADATA

from

SECRET KEY MATERIAL

At minimum, the design must account for:

- format version
- KDF parameters
- salt
- encryption parameters
- nonce/IV where required
- authenticated ciphertext
- protected Space key material
- integrity/authentication information

Do not expose unnecessary metadata.

Do not store passwords.

Do not store plaintext keys.

============================================================
PART 9 — ENVELOPE VERSIONING
============================================================

Every Space envelope must have a format version.

Example:

version: 1

Future versions must be able to change the format without silently
interpreting old data incorrectly.

Invalid versions must fail safely.

Unknown versions must be rejected.

Do not silently downgrade to an older format.

============================================================
PART 10 — SPACE UNLOCK
============================================================

Implement:

unlockSpace(password)

Correct password:

Password
→ KDF
→ KEK
→ authenticated envelope verification
→ decrypt Space Master Key
→ open Space

Incorrect password:

→ fail safely.

Tampered envelope:

→ fail safely.

Corrupted envelope:

→ fail safely.

Unknown envelope version:

→ fail safely.

Never partially unlock a Space.

============================================================
PART 11 — SPACE LOCK
============================================================

Implement:

lockSpace()

When a Space is locked:

- protected key material should no longer remain unnecessarily accessible
- active references to sensitive material should be released
- sensitive buffers should be cleared where practical
- subsequent protected operations must fail

IMPORTANT:

Do not falsely claim that JavaScript/TypeScript provides guaranteed
physical memory zeroization.

Document realistic limitations of the runtime.

Use best-effort zeroization where technically appropriate.

============================================================
PART 12 — MEMORY SAFETY
============================================================

Review:

zeroize()
withSecureBuffer()

Ensure they are not merely decorative APIs.

Test that sensitive buffers are actually modified as expected.

Avoid unnecessary duplication of sensitive buffers.

Do not convert sensitive binary material to strings unnecessarily.

Be especially careful with:

- passwords
- decrypted keys
- plaintext key material

Document runtime limitations.

============================================================
PART 13 — SPACE ISOLATION
============================================================

This is the PRIMARY acceptance criterion.

Create:

Main Space

Private Space

Each must have independent cryptographic material.

Example:

Main SMK = random value A

Private SMK = random value B

A != B

Unlocking Main must NOT reveal Private's SMK.

Unlocking Private must NOT reveal Main's SMK unless explicitly authorized.

============================================================
PART 14 — CROSS-SPACE ATTACK TESTING
============================================================

Write explicit negative tests.

Attempt:

1. Main Space → Private Space key access.
2. Main Space → Private Space database access.
3. Main Space → Private Space plaintext access.
4. Main Space → Private Space storage access.
5. Private Space → Main Space key access.
6. Locked Space → plaintext access.
7. Wrong credential → Space access.
8. Guessing one Space's password → other Space access.
9. Reusing Main Space key material → Private Space access.

Every unauthorized attempt must fail.

Do not merely test:

"two Spaces can be created."

Prove:

"two Spaces cannot improperly access each other."

============================================================
PART 15 — CRYPTOGRAPHIC INDEPENDENCE
============================================================

Verify that each Space receives independently generated key material.

Test:

Create 100 Spaces.

Verify:

- keys are distinct
- salts are distinct where required
- nonces are never improperly reused
- credentials remain independent
- deleting one Space does not affect another

Do not rely solely on statistical uniqueness as proof of correctness.

Also inspect the implementation.

============================================================
PART 16 — TAMPERING TESTS
============================================================

Modify every security-sensitive part of an envelope.

Test:

- ciphertext modification
- authentication tag modification
- nonce modification
- salt modification
- KDF parameter modification
- version modification
- metadata modification
- truncation
- appended garbage
- random bytes

The system must fail safely.

Never return partially decrypted secrets.

============================================================
PART 17 — CORRUPTION AND CRASH TESTING
============================================================

Test:

- interrupted writes
- corrupted storage
- incomplete envelope
- application crash during creation
- application crash during unlock
- application crash during lock
- application restart
- device restart

The system must never silently treat corrupted data as valid.

============================================================
PART 18 — PASSWORD CHANGE
============================================================

Implement secure password change if the architecture supports it
at this phase.

The conceptual operation should be:

Old Password
→ old KEK
→ recover protected SMK

New Password
→ new KDF
→ new KEK
→ re-protect SMK

Avoid unnecessarily re-encrypting all Space data merely because
the password changed.

The Space Master Key should remain independent of the password.

Test:

Old password → rejected after change.

New password → succeeds.

Space data → remains accessible.

============================================================
PART 19 — SPACE DELETION
============================================================

If Space deletion is implemented in Phase 1:

Separate:

logical deletion

from

cryptographic destruction

Do not claim guaranteed forensic deletion.

If secure deletion cannot be guaranteed by the runtime/storage system,
document that limitation.

A safer design may involve destroying access to the Space's encryption
key rather than making unrealistic claims about physical storage erasure.

============================================================
PART 20 — DECOY SPACE
============================================================

Do NOT make Decoy Space a priority over core Space isolation.

If implemented:

Credential A → Main

Credential B → Decoy

The decoy must have its own independent cryptographic identity/key
material.

However, explicitly document that this does NOT automatically provide:

- forensic deniability
- anti-forensic protection
- protection against a compromised operating system
- protection against hardware extraction
- guaranteed absence of evidence
- protection against someone observing the screen

If implementing Decoy Space would compromise the correctness of the
core architecture, defer it.

Do not sacrifice core security for a flashy feature.

============================================================
PART 21 — STORAGE MODEL
============================================================

Phase 1 should remain LOCAL ONLY.

Do not build the server.

Do not build messaging.

Do not build synchronization.

The goal is to validate the local Space security boundary first.

Each Space should have protected storage that can later support:

- identity
- contacts
- chats
- groups
- media

without breaking the Space security boundary.

============================================================
PART 22 — DATABASE BOUNDARY
============================================================

Document whether Spaces use:

1. Separate databases.

2. Separate encrypted databases.

3. One database with cryptographically isolated records.

4. Another architecture.

Do not select an architecture merely for convenience.

The key question is:

Can a compromised application component belonging to one Space obtain
another Space's plaintext without authorization?

Design tests around this question.

============================================================
PART 23 — LOGGING AUDIT
============================================================

Search the entire codebase for accidental sensitive logging.

Check for:

- passwords
- keys
- plaintext messages
- decrypted payloads
- tokens
- sensitive identifiers

Development logging must not expose secrets.

Write tests or static checks where practical.

============================================================
PART 24 — ERROR HANDLING
============================================================

Security-sensitive failures must not leak unnecessary information.

Avoid errors such as:

"Password correct but authentication tag was invalid."

Prefer generic user-facing errors such as:

"Unable to unlock Space."

Internal diagnostics must also avoid exposing secrets.

Avoid making credential probing unnecessarily informative.

============================================================
PART 25 — DOCUMENTATION CORRECTIONS
============================================================

Review and update:

docs/CRYPTOGRAPHY.md
docs/KEY_HIERARCHY.md
docs/SPACE_MODEL.md
docs/SECURITY.md
docs/KNOWN_LIMITATIONS.md

Also update:

docs/ai/DECISIONS.md

if any architecture changes are made.

Correct any Phase 0 wording that overstates security.

Especially distinguish:

IMPLEMENTED

from

PLANNED

and:

SELECTED

from

AUDITED

An actual external security audit must never be implied unless one
actually occurred.

============================================================
PART 26 — SECURITY CLAIM DISCIPLINE
============================================================

Never claim:

"100% secure"

"unhackable"

"completely anonymous"

"forensically invisible"

"military-grade"

"fully audited"

unless the claim is specifically justified and independently verified.

The correct objective is:

"VEIL implements a documented security architecture with explicit
threat boundaries and tested security properties."

============================================================
PART 27 — TEST SUITE
============================================================

Create comprehensive Phase 1 tests.

Minimum categories:

A. Key generation

B. KDF

C. Envelope creation

D. Envelope decryption

E. Authentication

F. Wrong credential

G. Tampering

H. Corruption

I. Version handling

J. Space isolation

K. Locking

L. Unlocking

M. Restart

N. Password change

O. Storage isolation

P. Secret logging detection where practical

Q. Concurrent operations where applicable

R. 100-Space independence test

============================================================
PART 28 — PROPERTY / FUZZ TESTING
============================================================

Where practical, add property-based or fuzz testing for:

- envelope parsing
- serialization
- corrupted input
- random malformed envelopes
- version handling

The parser must not crash or expose secrets on malformed input.

============================================================
PART 29 — PERFORMANCE
============================================================

Measure the password KDF.

The KDF should be deliberately expensive enough to resist brute-force
attacks while remaining usable on the target device.

Do not blindly copy parameters from another project.

Document chosen parameters and the reasoning.

Do not weaken KDF parameters simply to make tests faster.

Tests may use explicitly marked test-only parameters where appropriate,
but production configuration must remain separate.

============================================================
PART 30 — NO LATER-PHASE FEATURES
============================================================

DO NOT implement:

- messaging
- contacts
- E2EE conversations
- groups
- media messaging
- server transport
- multi-device
- recovery
- notifications
- panic UX
- metadata anonymity systems

Those belong to later phases.

Do not "prepare ahead" by implementing them now.

============================================================
PART 31 — DEFINITION OF DONE
============================================================

Phase 1 is COMPLETE only when all are true:

[ ] Phase 0 independently verified

[ ] Existing tests pass

[ ] Cryptographic implementation reviewed

[ ] Documentation/implementation discrepancies corrected

[ ] No unsupported "audited" claims remain

[ ] Established cryptographic libraries used

[ ] No custom cryptographic primitives

[ ] Password KDF implemented correctly

[ ] Space Master Keys independently generated

[ ] Password is not the Space Master Key

[ ] Encrypted Space envelope implemented

[ ] Authenticated encryption implemented

[ ] Envelope versioning implemented

[ ] Main Space implemented

[ ] Private Space implemented

[ ] Independent key material verified

[ ] Space creation works

[ ] Space unlocking works

[ ] Space locking works

[ ] Wrong password fails

[ ] Tampering fails

[ ] Corruption fails

[ ] Unknown version fails

[ ] Cross-Space access fails

[ ] Locked Space access fails

[ ] Restart tests pass

[ ] Storage isolation tests pass

[ ] Key independence tests pass

[ ] 100-Space test passes

[ ] Password-change tests pass if implemented

[ ] Sensitive logging reviewed

[ ] Error handling reviewed

[ ] Memory-handling limitations documented

[ ] Decoy limitations documented if implemented

[ ] Security claims reviewed

[ ] Documentation updated

[ ] Architecture decisions recorded

[ ] Full test suite passes

[ ] Git diff reviewed

[ ] No secrets committed

[ ] CURRENT_STATE.md updated

[ ] ACTIVE_TASK.md updated

[ ] CHANGELOG.md updated

[ ] HANDOFF.md created

[ ] Meaningful Git commit created

[ ] Working tree clean

============================================================
FINAL STOP CONDITION
============================================================

When every Phase 1 requirement is satisfied:

STOP.

DO NOT:

- begin Phase 2
- implement identities
- implement messaging
- implement networking
- implement groups
- refactor unrelated code
- add speculative features

Leave the repository in a clean, tested, documented state.

The next AI agent must be able to continue from the repository alone.

THE REPOSITORY IS THE MEMORY.

NEVER GUESS ABOUT SECURITY.

PROVE THE SPACE ISOLATION BEFORE BUILDING ON TOP OF IT.