# VEIL — PHASE 6

## Multi-Device, Device Linking, Secure Recovery & Device Revocation

```text
============================================================
VEIL — PHASE 6
MULTI-DEVICE, DEVICE LINKING & RECOVERY
============================================================

MISSION

You are implementing PHASE 6 of VEIL.

Phase 1 established:
- Cryptographic Spaces
- Credential-selected unlocking
- Encrypted local storage

Phase 2 established:
- Independent Space identities
- Ed25519/X25519 identity architecture
- Identity isolation

Phase 3 established:
- Privacy-preserving transport
- Blind mailbox architecture
- Metadata minimization

Phase 4 established:
- 1-to-1 E2EE
- Double Ratchet
- Forward secrecy
- Post-compromise recovery

Phase 5 established:
- Group E2EE
- Group membership
- Group key management
- Encrypted media

Phase 6 now adds:

- multiple devices per Space
- secure device identities
- device linking
- device authorization
- device verification
- device synchronization
- encrypted state synchronization
- device revocation
- lost-device handling
- secure recovery
- recovery credentials
- recovery security model

============================================================
CRITICAL PRINCIPLE
============================================================

A DEVICE IS NOT AN ACCOUNT.

A Space identity may have multiple authorized devices.

Example:

                 VEIL SPACE
                     │
          ┌──────────┼──────────┐
          │          │          │
       Phone       Laptop     Tablet
          │          │          │
       Device A   Device B   Device C
          │          │          │
          └──────────┼──────────┘
                     │
              Same Space identity
              Different device keys

Each device MUST have its own cryptographic identity.

DO NOT simply copy private keys between devices.

DO NOT assume that possession of a login password automatically makes
a device trusted.

============================================================
1. TAKEOVER PROCEDURE
============================================================

Before coding:

Read:

AGENTS.md
README.md

docs/ARCHITECTURE.md
docs/THREAT_MODEL.md
docs/CRYPTOGRAPHY.md
docs/KEY_HIERARCHY.md
docs/SPACE_MODEL.md
docs/IDENTITY_MODEL.md
docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/SECURITY.md
docs/KNOWN_LIMITATIONS.md
docs/GROUP_PROTOCOL.md
docs/MEDIA_SECURITY.md

Read:

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md
docs/ai/CHANGELOG.md

Inspect all Phase 1–5 source code.

Run:

npm test

ALL previous tests must pass before Phase 6 begins.

Do not rewrite previous architecture merely because a new implementation
would be easier.

Preserve the existing security boundaries.

============================================================
2. PHASE 6 SECURITY MODEL
============================================================

The device model must distinguish:

SPACE

DEVICE

IDENTITY

SESSION

RECOVERY CREDENTIAL

Example:

Space
 │
 ├── Device A
 │     ├── Device identity
 │     ├── Local encrypted state
 │     └── Active sessions
 │
 ├── Device B
 │     ├── Device identity
 │     ├── Local encrypted state
 │     └── Active sessions
 │
 └── Device C
       ├── Device identity
       ├── Local encrypted state
       └── Active sessions

Never confuse:

Space identity

with

device identity.

============================================================
3. DEVICE IDENTITY
============================================================

Every device receives a unique cryptographic device identity.

The device identity must be generated locally.

Do not derive the device private key from:

- password
- username
- device name
- phone number
- email
- timestamp

The private device key must remain local.

The public device identity may be shared through authenticated
protocols.

============================================================
4. DEVICE ID
============================================================

Each device receives an opaque device ID.

Requirements:

- unique
- unpredictable where appropriate
- not derived from personally identifying information
- versioned
- cryptographically associated with the device identity

Do not use:

deviceName

as the cryptographic device identifier.

============================================================
5. DEVICE REGISTRATION
============================================================

Implement:

registerDevice()

A device becomes authorized only after a secure authorization process.

Do NOT allow:

"password entered → automatically trust every device."

The device must be cryptographically authorized by an already trusted
device or through the defined recovery mechanism.

============================================================
6. FIRST DEVICE
============================================================

The first device in a Space becomes the initial trusted device.

It must establish:

- device identity
- device authorization state
- device list
- device verification state

Document what happens if the first device is lost.

============================================================
7. DEVICE LINKING
============================================================

Implement secure device linking.

Example:

PHONE
 │
 │ Generate pairing session
 ▼
LAPTOP
 │
 │ Displays pairing code / QR
 ▼
PHONE verifies pairing
 │
 ▼
Cryptographic authentication
 │
 ▼
Laptop becomes authorized
```

The pairing process must NOT rely solely on:

* a short code
* username
* password
* server approval

A short code may assist human verification, but the actual authorization
must be cryptographic.

============================================================
8. PAIRING UX
=============

Design a simple pairing flow.

Example:

PHONE:

"Link a new device"

```
   ↓
```

Shows QR / pairing code

```
   ↓
```

LAPTOP:

"Scan QR"

```
   ↓
```

Both devices establish authenticated channel

```
   ↓
```

PHONE:

"New device detected"

Laptop identity
Fingerprint / safety information

```
   ↓
```

[Approve]

```
   ↓
```

Cryptographic authorization

The server must not be able to silently approve a device.

============================================================
9. HUMAN VERIFICATION
=====================

Provide a device verification mechanism.

Possible forms:

* QR comparison
* short authentication string
* safety number/fingerprint

The user must be able to determine:

"This laptop is actually the device I intended to link."

Document limitations of visual verification.

============================================================
10. DEVICE AUTHORIZATION
========================

A trusted device should be able to:

* list devices
* verify devices
* rename devices locally
* revoke devices
* inspect device status

Example:

Devices

✓ Pixel
✓ Laptop
✓ Tablet

Each device has:

* device ID
* public identity
* verification status
* last known activity where privacy allows

============================================================
11. DEVICE REVOCATION
=====================

Implement:

revokeDevice(deviceId)

When a device is revoked:

* future synchronization must stop
* new E2EE sessions must not be established through it
* it must not receive future group state
* it must not receive future account/Space state
* its authorization must become invalid

Do not claim that revocation can erase data already stored on a device.

If an attacker controls the physical device, previously synchronized
plaintext may remain accessible.

Document this clearly.

============================================================
12. LOST DEVICE
===============

Implement a lost-device workflow.

Example:

User loses phone.

From trusted laptop:

Devices
↓
Phone
↓
Revoke

The revoked device must no longer receive future synchronized state.

Document what happens if:

* device is offline
* device comes online later
* device was already compromised
* attacker has copied local files

============================================================
13. OFFLINE REVOKED DEVICE
==========================

A revoked device may remain offline.

When it reconnects:

server must not simply allow synchronization.

The device authorization state must be cryptographically checked.

The server cannot be the sole authority for device trust.

============================================================
14. DEVICE STATE
================

Create a formal model.

DeviceRecord:

* deviceId
* public identity
* protocol version
* authorization state
* verification state
* creation metadata
* revocation state

Do not store private device keys in the server database.

============================================================
15. DEVICE LIST PRIVACY
=======================

Determine what the server knows about devices.

Minimize:

* device names
* device types
* IP history
* geographic information
* activity history

Do not expose a permanent detailed device activity profile unless
necessary.

============================================================
16. MULTI-DEVICE E2EE
=====================

Phase 4 currently supports 1-to-1 E2EE.

Phase 6 must extend it to multiple authorized devices.

Do NOT simply copy the same Double Ratchet state between devices.

Each device must have its own cryptographic session state.

Conceptually:

Alice Phone
│
├── Ratchet ── Bob Phone
│
├── Ratchet ── Bob Laptop
│
└── Ratchet ── Bob Tablet

The exact architecture must be documented.

============================================================
17. MULTI-DEVICE MESSAGE FANOUT
===============================

When Alice sends a message:

Alice Device
│
▼
Authenticated message
│
├────────► Bob Phone
├────────► Bob Laptop
└────────► Bob Tablet

Each authorized destination device must have appropriate cryptographic
protection.

Do not assume one device's session key is valid for every device.

============================================================
18. DEVICE SESSION ESTABLISHMENT
================================

Implement secure sessions between device identities.

Every session must authenticate the intended destination device.

Prevent:

* unknown device injection
* device impersonation
* session substitution
* unauthorized device addition

============================================================
19. DEVICE ADDITION + EXISTING CONTACTS
=======================================

When a new device is linked:

Existing contacts may need to authenticate the new device.

Do not silently make a newly linked device indistinguishable from an
old verified device.

Provide an appropriate verification/update mechanism.

Document the UX.

============================================================
20. CONTACT DEVICE CHANGES
==========================

If Bob adds a new device:

Alice may need to receive a device-list change.

The system must detect:

* device added
* device revoked
* identity changed

Do not silently ignore identity changes.

============================================================
21. KEY TRANSPARENCY
====================

Implement an explicit concept of device trust state.

Example:

VERIFIED

UNVERIFIED

REVOKED

UNKNOWN

Messages involving a changed device identity must not silently continue
under assumptions of the old identity.

============================================================
22. GROUP MULTI-DEVICE
======================

Phase 5 groups now need to work with multiple devices.

Example:

Alice:

* Phone
* Laptop

Bob:

* Phone
* Tablet

Group:

Alice Phone
Alice Laptop
Bob Phone
Bob Tablet

Each authorized device must participate correctly according to the
selected group protocol.

Do not duplicate group membership incorrectly.

A USER and a DEVICE are different entities.

============================================================
23. GROUP DEVICE REMOVAL
========================

If Bob's laptop is revoked:

Bob's phone remains authorized.

Bob's laptop must not retain future group access.

The group protocol must perform the appropriate state transition.

Do not accidentally remove Bob entirely because one device was revoked.

============================================================
24. DEVICE LINKING + GROUP SECURITY
===================================

Test:

Alice has Phone.

Alice creates Group.

Alice links Laptop.

Laptop becomes authorized.

Laptop receives appropriate future group state.

Then Laptop is revoked.

Laptop must not receive future group state.

Alice Phone remains functional.

============================================================
25. ENCRYPTED STATE SYNCHRONIZATION
===================================

Devices need synchronization.

Possible synchronized data:

* contacts
* conversation metadata
* encrypted message state
* group state
* settings
* encrypted media references

All synchronization must be authenticated and encrypted.

Do not upload plaintext databases merely to simplify synchronization.

============================================================
26. WHAT MUST NOT SYNCHRONIZE IN PLAINTEXT
==========================================

Never synchronize plaintext:

* Space Master Key
* password
* private identity keys
* device private keys
* raw session secrets
* media keys outside E2EE protection
* plaintext message databases

============================================================
27. SECURE STATE TRANSFER
=========================

When linking a new device, define exactly what state is transferred.

Prefer minimum necessary state.

Do not blindly clone:

entire device filesystem

or

entire cryptographic memory state.

The new device should establish its own local cryptographic state.

============================================================
28. SESSION STATE MIGRATION
===========================

Do not assume existing live ratchets can simply be copied.

Document whether:

* sessions are recreated
* state is securely transferred
* sender keys are regenerated
* group state is re-established

The selected architecture must preserve the intended security properties.

============================================================
29. MULTI-DEVICE MESSAGE HISTORY
================================

Define how a newly linked device receives history.

Default secure policy:

New device does NOT automatically receive unlimited historical
plaintext.

History synchronization must use encrypted state transfer.

Document:

* what history is transferred
* who authorizes it
* how much is transferred
* whether media is transferred
* whether old sessions are recreated

============================================================
30. HISTORY TRANSFER AUTHORIZATION
==================================

The existing trusted device must explicitly authorize sensitive history
transfer where appropriate.

Do not allow:

new device → server → download everything

without cryptographic authorization.

============================================================
31. MEDIA SYNCHRONIZATION
=========================

Media synchronization must preserve Phase 5 security.

The server stores:

encrypted media.

The new device receives the media key only through an authorized
encrypted synchronization process.

Do not expose media keys through the server API.

============================================================
32. RECOVERY MODEL
==================

Design recovery carefully.

VEIL recovery must NOT mean:

"Forgot password → server resets account."

The server must not possess enough information to decrypt the Space.

Create:

docs/RECOVERY_MODEL.md

It must explain:

* recovery credential
* recovery keys
* recovery process
* device loss
* password loss
* all-device loss
* attacker with recovery credential
* recovery limitations

============================================================
33. RECOVERY MUST BE OPTIONAL
=============================

Do not force a recovery mechanism that weakens the main threat model.

The user should understand:

No recovery

versus

Recovery enabled

and the security tradeoff.

============================================================
34. RECOVERY CREDENTIAL
=======================

If a recovery credential is implemented:

It must be generated securely.

It must not be:

* the normal password
* a predictable phrase
* username + birthday
* server-generated secret sent by email

Prefer a high-entropy recovery secret or recovery key protected by
appropriate mechanisms.

============================================================
35. RECOVERY KEY FORMAT
=======================

Design a user-friendly recovery representation.

Potential approach:

high-entropy recovery key

displayed as:

groups of characters/words

with:

* checksum/error detection
* version
* human-readable formatting

Do not reduce entropy simply to make it easier to type.

============================================================
36. RECOVERY STORAGE
====================

The server must not receive a plaintext recovery secret.

If recovery requires a server-side verifier, it must be designed so that
the verifier cannot decrypt the Space.

Document the exact threat model.

============================================================
37. RECOVERY FROM LOST DEVICE
=============================

Scenario:

User has:

Phone
Laptop

Phone lost.

Laptop still trusted.

Laptop:

revoke Phone

link replacement Phone

The replacement device must receive only authorized state.

============================================================
38. RECOVERY FROM ALL DEVICES LOST
==================================

Scenario:

All devices lost.

User has recovery credential.

Define:

Recovery credential
↓
Secure recovery process
↓
New device
↓
New device identity
↓
Re-establish trusted state

Do NOT assume old device private keys magically return.

Document which existing sessions must be re-established.

============================================================
39. RECOVERY SECURITY
=====================

If an attacker obtains the recovery credential:

assume the attacker may be able to recover the protected Space.

Do not claim otherwise.

Recovery credentials are effectively high-value secrets.

Provide a way to rotate/revoke recovery material where possible.

============================================================
40. RECOVERY + DECOY SPACES
===========================

VEIL's multiple-password architecture remains fundamental.

Do NOT accidentally create a recovery flow that reveals the existence
of hidden Spaces.

The recovery architecture must explicitly address:

Main Space

Private Space

Decoy Space

The existence of a hidden Space must not automatically become visible
through recovery.

============================================================
41. PASSWORD CHANGE + MULTI-DEVICE
==================================

Integrate Phase 1 password changes.

Changing the Space password must NOT unnecessarily invalidate properly
authorized devices unless the security model requires it.

However, document exactly what password changes affect:

* local unlocking
* device authorization
* recovery
* encrypted state

============================================================
42. DEVICE REVOCATION + PASSWORD CHANGE
=======================================

Test:

Password changed.

Old authorized devices remain or become invalid according to the
documented policy.

Revoked devices remain revoked.

Do not accidentally resurrect revoked devices.

============================================================
43. DEVICE LIMITS
=================

Define a supported maximum number of devices.

Do not assume unlimited devices.

Test:

1 device
2 devices
5 devices
10 devices
maximum supported devices

Document performance and security implications.

============================================================
44. DEVICE NAME PRIVACY
=======================

Device names are user metadata.

Do not require:

"John's iPhone"

or

"John's MacBook"

as identifiers.

Allow neutral names.

Do not send unnecessary device metadata to the server.

============================================================
45. CLOCK / TIMESTAMP SECURITY
==============================

Do not rely solely on local timestamps for device authorization.

Handle:

* clock skew
* incorrect device time
* replayed timestamps

Use authenticated protocol state rather than trusting wall-clock time.

============================================================
46. MALICIOUS SERVER TESTING
============================

Simulate server attacks:

* fake device
* duplicate device
* stale device state
* forged device authorization
* fake revocation
* revoked-device resurrection
* device substitution
* history substitution
* replayed synchronization
* altered synchronization ciphertext
* stale group state
* malicious media references

All must fail safely.

============================================================
47. MALICIOUS DEVICE TESTING
============================

Assume an authorized device becomes malicious.

Test:

Device A compromised.

Device A attempts:

* add unauthorized device
* forge another device
* access revoked device data
* access another Space
* obtain another Space's keys
* modify synchronized state
* impersonate another device

The system must limit the compromise according to its documented
security model.

============================================================
48. DEVICE IDENTITY CHANGE
==========================

If a device's cryptographic identity changes unexpectedly:

DO NOT silently accept it.

Require:

* re-verification
* re-linking
* or explicit recovery process

depending on the architecture.

============================================================
49. BACKUP SECURITY
===================

Do not automatically create plaintext backups.

If local backup is supported:

encrypt it.

The backup encryption key must be independently protected.

Document:

* backup contents
* encryption
* recovery
* deletion
* compromise implications

============================================================
50. CLOUD BACKUP
================

Do not implement provider-specific cloud backup in Phase 6 unless
required by the architecture.

If cloud backup is introduced:

the provider must not receive plaintext VEIL secrets.

============================================================
51. DEVICE WIPE
===============

Implement secure local cleanup where practical.

When a device is removed/revoked:

* destroy local active session keys
* destroy temporary secrets
* clear protected local caches
* invalidate local authorization state

Document that secure deletion cannot be guaranteed perfectly on all
storage hardware/operating systems.

============================================================
52. MEMORY HYGIENE
==================

Continue Phase 1 best-effort zeroization.

Sensitive temporary buffers must be wiped where practical.

Do not claim JavaScript memory can be perfectly erased.

Preserve the existing limitation documentation.

============================================================
53. TEST SUITE
==============

Create:

tests/device-identity.test.ts
tests/device-registration.test.ts
tests/device-linking.test.ts
tests/device-verification.test.ts
tests/device-revocation.test.ts
tests/device-recovery.test.ts
tests/device-state.test.ts
tests/device-sync.test.ts
tests/device-history.test.ts
tests/device-media-sync.test.ts
tests/multi-device-e2ee.test.ts
tests/multi-device-groups.test.ts
tests/device-rollback.test.ts
tests/device-replay.test.ts
tests/device-malicious-server.test.ts
tests/device-malicious-client.test.ts
tests/device-isolation.test.ts
tests/recovery-security.test.ts
tests/recovery-fuzz.test.ts
tests/device-crash-recovery.test.ts

============================================================
54. REQUIRED DEVICE TESTS
=========================

[ ] unique device identity

[ ] device ID uniqueness

[ ] private device key remains local

[ ] device registration works

[ ] secure device linking works

[ ] unauthorized linking rejected

[ ] pairing authentication works

[ ] verification works

[ ] device list works

[ ] device revocation works

[ ] revoked device cannot synchronize

[ ] revoked device cannot receive future messages

[ ] revoked device cannot receive future group state

[ ] revoked device cannot be resurrected by stale server state

[ ] cross-Space device access rejected

============================================================
55. MULTI-DEVICE MESSAGE TESTS
==============================

Test:

Alice Phone
Alice Laptop

Bob Phone
Bob Laptop

Verify:

[ ] Alice Phone can securely communicate with Bob Phone

[ ] Alice Phone can securely communicate with Bob Laptop

[ ] Alice Laptop can securely communicate with Bob Phone

[ ] Alice Laptop can securely communicate with Bob Laptop

[ ] each destination device is authenticated

[ ] device sessions are independent

[ ] unauthorized devices cannot decrypt

[ ] revoked devices stop receiving future content

============================================================
56. GROUP MULTI-DEVICE TESTS
============================

Create:

Alice Phone
Alice Laptop
Bob Phone
Bob Laptop
Charlie Phone

All participate in a group.

Test:

* group messages
* device addition
* device removal
* member removal
* device revocation

Critical:

Removing Bob Laptop must NOT remove Bob Phone.

Revoking Bob Laptop must stop future group state delivery to Bob Laptop.

============================================================
57. RECOVERY TESTS
==================

Test:

[ ] recovery credential generation

[ ] recovery credential validation

[ ] wrong recovery credential rejection

[ ] recovery authentication

[ ] recovery from lost device

[ ] recovery from all devices lost

[ ] recovery does not expose plaintext secrets

[ ] recovery does not reveal hidden Space existence unnecessarily

[ ] recovery credential rotation where supported

[ ] revoked device remains revoked after recovery

============================================================
58. RECOVERY ATTACK TESTS
=========================

Test:

* brute-force attempts
* malformed recovery credential
* replayed recovery request
* modified recovery state
* recovery state rollback
* fake recovery response
* server substitution
* compromised recovery credential

Ensure failures do not reveal unnecessary information.

============================================================
59. SYNCHRONIZATION TESTS
=========================

Test:

* duplicate state
* missing state
* stale state
* corrupted state
* reordered state
* replayed state
* wrong-device state
* wrong-Space state

The client must reject invalid state safely.

============================================================
60. CRASH TESTS
===============

Simulate crashes during:

* device linking
* device authorization
* device revocation
* state synchronization
* recovery
* device replacement
* key rotation

No crash may leave the system in an ambiguous security state.

============================================================
61. SECURITY LOGGING
====================

Audit all new logs.

Never log:

* recovery secrets
* private device keys
* private identity keys
* session secrets
* Space Master Keys
* passwords
* plaintext messages
* plaintext media

Error messages must not reveal whether a sensitive secret was partially
correct unless the protocol explicitly requires it.

============================================================
62. FUZZ TESTING
================

Fuzz:

* device records
* device IDs
* public keys
* authorization messages
* pairing messages
* synchronization state
* recovery state
* device lists
* revocation records

Malformed input must not:

* crash
* bypass authorization
* resurrect revoked devices
* cross Space boundaries
* leak secrets

============================================================
63. PRIVACY AUDIT
=================

Answer:

"What does the server know about my devices?"

Document:

* number of devices visible to server
* device identifiers
* connection times
* IP information
* synchronization timing
* revocation timing
* metadata leakage

Minimize this information wherever practical.

Do not claim:

"server cannot tell devices apart"

unless actually demonstrated.

============================================================
64. THREAT MODEL UPDATE
=======================

Update:

docs/THREAT_MODEL.md

Add:

* stolen device
* lost device
* compromised device
* malicious linked device
* malicious server
* recovery credential theft
* all-device loss
* device identity replacement
* device rollback
* device synchronization attacks

Explicitly define:

What VEIL protects against.

What VEIL does not protect against.

============================================================
65. RECOVERY DOCUMENTATION
==========================

Create:

docs/RECOVERY_MODEL.md

Must contain:

1. Recovery architecture
2. Recovery credential design
3. Recovery threat model
4. Lost-device recovery
5. All-device recovery
6. Device revocation
7. Recovery credential compromise
8. Recovery limitations
9. Hidden Space considerations
10. Backup considerations

============================================================
66. DEVICE DOCUMENTATION
========================

Create:

docs/DEVICE_MODEL.md

Document:

* device identity
* device authorization
* device verification
* linking
* revocation
* synchronization
* device state
* device trust
* device lifecycle

============================================================
67. ARCHITECTURE UPDATES
========================

Update:

docs/ARCHITECTURE.md
docs/IDENTITY_MODEL.md
docs/KEY_HIERARCHY.md
docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/SECURITY.md
docs/KNOWN_LIMITATIONS.md

Clearly distinguish:

SPACE IDENTITY

DEVICE IDENTITY

SESSION KEYS

RECOVERY KEYS

GROUP KEYS

MEDIA KEYS

Do not collapse them into one master secret.

============================================================
68. AI CONTINUITY
=================

Update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
docs/ai/HANDOFF.md

HANDOFF.md must include:

* device architecture
* device identity model
* linking protocol
* verification mechanism
* revocation mechanism
* synchronization architecture
* multi-device E2EE architecture
* group/device integration
* recovery architecture
* recovery limitations
* security tests
* privacy findings
* known limitations
* exact Phase 7 requirements

============================================================
69. NO UNRELATED WORK
=====================

DO NOT implement:

* voice calls
* video calls
* public group discovery
* social discovery
* advertisements
* analytics
* centralized identity tracking
* advanced anonymity network
* disappearing-message UX redesign
* unrelated UI rewrite

Do not turn Phase 6 into a general feature-development phase.

============================================================
70. DEFINITION OF DONE
======================

Phase 6 is complete ONLY when:

PREVIOUS PHASES

[ ] Phase 1 passes
[ ] Phase 2 passes
[ ] Phase 3 passes
[ ] Phase 4 passes
[ ] Phase 5 passes

DEVICE MODEL

[ ] device identity implemented
[ ] device ID implemented
[ ] device registration implemented
[ ] device authorization implemented
[ ] device linking implemented
[ ] human verification implemented
[ ] device list implemented
[ ] device revocation implemented
[ ] lost-device workflow implemented
[ ] revoked-device synchronization blocked

MULTI-DEVICE E2EE

[ ] per-device sessions implemented
[ ] destination device authentication implemented
[ ] multi-device messaging works
[ ] device changes detected
[ ] device identity changes require verification
[ ] revoked devices stop receiving future content

GROUPS

[ ] multi-device group participation works
[ ] device removal does not incorrectly remove user
[ ] revoked device loses future group access

SYNC

[ ] encrypted synchronization implemented
[ ] state authentication implemented
[ ] replay protection implemented
[ ] rollback protection implemented
[ ] stale-state handling implemented
[ ] cross-Space synchronization rejected

RECOVERY

[ ] recovery architecture documented
[ ] recovery credential implemented if selected
[ ] recovery authentication implemented
[ ] lost-device recovery implemented
[ ] all-device recovery implemented or explicitly documented as
unsupported
[ ] recovery compromise threat documented
[ ] recovery does not expose hidden Spaces unnecessarily

SECURITY

[ ] malicious-server tests pass
[ ] malicious-device tests pass
[ ] fuzz tests pass
[ ] crash tests pass
[ ] security logging audit passes
[ ] privacy audit completed

DOCUMENTATION

[ ] DEVICE_MODEL.md created
[ ] RECOVERY_MODEL.md created
[ ] architecture updated
[ ] threat model updated
[ ] identity model updated
[ ] key hierarchy updated
[ ] privacy documentation updated
[ ] known limitations updated
[ ] AI continuity updated

REPOSITORY

[ ] no secrets committed
[ ] full test suite passes
[ ] Git diff reviewed
[ ] working tree clean
[ ] Phase 6 commit created

============================================================
71. FINAL STOP CONDITION
========================

STOP AFTER PHASE 6.

DO NOT IMPLEMENT PHASE 7.

The repository must be left ready for:

PHASE 7 —
PRIVACY UX, PANIC LOCK, DISGUISED/DECOY ACCESS
AND HUMAN-CENTERED SECURITY

============================================================
FINAL PRINCIPLES
================

A SPACE IS NOT A DEVICE.

A DEVICE IS NOT AN IDENTITY.

A PASSWORD IS NOT A DEVICE AUTHORIZATION.

DO NOT COPY PRIVATE KEYS BETWEEN DEVICES UNNECESSARILY.

EVERY DEVICE MUST HAVE ITS OWN CRYPTOGRAPHIC IDENTITY.

DEVICE LINKING MUST BE CRYPTOGRAPHICALLY AUTHENTICATED.

THE SERVER MUST NOT BE THE SOLE TRUST AUTHORITY.

REVOCATION MUST PREVENT FUTURE ACCESS.

REVOCATION CANNOT ERASE PLAINTEXT ALREADY STORED ON A COMPROMISED
DEVICE.

RECOVERY IS A HIGH-VALUE SECURITY FUNCTION.

RECOVERY MUST NOT BECOME A SERVER-SIDE MASTER KEY.

DO NOT LEAK HIDDEN SPACE EXISTENCE THROUGH RECOVERY.

DO NOT LOG DEVICE OR RECOVERY SECRETS.

DO NOT TRUST SERVER-SUPPLIED DEVICE STATE.

DO NOT TRUST CLIENT-SUPPLIED AUTHORIZATION FLAGS.

DO NOT SILENTLY ACCEPT DEVICE IDENTITY CHANGES.

DO NOT CLAIM PERFECT SECURE DELETION.

DO NOT CLAIM ANONYMITY THAT HAS NOT BEEN VERIFIED.

PRESERVE ALL SECURITY PROPERTIES FROM PHASES 1–5.

STOP WHEN PHASE 6 IS COMPLETE.

````

### The important architectural upgrade in Phase 6

The key thing we're changing here is **not just "let the user log in on another phone."**

VEIL becomes:

**One Space → multiple independently authenticated devices.**

So instead of:

```text
Space
  │
  └── Private Key
        │
        ├── Phone
        ├── Laptop
        └── Tablet
````

we want:

```text
                     SPACE
                       │
                 Space Identity
                       │
          ┌────────────┼────────────┐
          │            │            │
       Device A     Device B     Device C
       Phone        Laptop       Tablet
          │            │            │
     Device Key    Device Key    Device Key
          │            │            │
          └────────────┼────────────┘
                       │
                Authorized Devices
```

That distinction becomes **extremely important for VEIL's anonymity model**. If somebody gets your laptop, you should be able to revoke *that device* without destroying your entire Space. And if you add a new device, it shouldn't magically inherit every old cryptographic secret just because the server says it's yours.

Also, **Phase 6 is the point where recovery becomes dangerous**. A normal chat app can use "forgot password → email reset." VEIL can't casually do that, because the server shouldn't possess the keys necessary to decrypt your Spaces in the first place. That's why the recovery design gets its own threat model instead of being bolted on as a normal authentication feature.
