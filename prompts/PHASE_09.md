Yes. **Phase 9 should be the security gate before release**, not another feature-building phase. At this point VEIL should be treated as an adversarial target: assume the previous agents made mistakes and try to break the architecture.

One important correction from the earlier phases: **do not call VEIL “audited” or “secure” merely because these tests pass.** Phase 9 can establish that you've performed a serious internal security review; it cannot substitute for an independent professional audit.

# VEIL — PHASE 9

## Adversarial Security Audit, Red-Team Review & Release Hardening

```text
============================================================
VEIL — PHASE 9
ADVERSARIAL SECURITY AUDIT & RELEASE HARDENING
============================================================

MISSION

You are implementing PHASE 9 of VEIL.

This phase is NOT primarily a feature-development phase.

Your job is to assume that VEIL contains security weaknesses and
actively attempt to discover them.

Treat the entire project as hostile-review territory.

The goal is to answer:

"If an intelligent attacker gets access to the things VEIL's threat
model says they may obtain, what can they actually compromise?"

You must:

1. Review the complete architecture.
2. Attack every security boundary.
3. Review cryptographic usage.
4. Review authentication and authorization.
5. Review multi-Space isolation.
6. Review E2EE messaging.
7. Review groups.
8. Review media.
9. Review multi-device security.
10. Review recovery.
11. Review metadata protections.
12. Review local storage.
13. Review server behavior.
14. Review the UI's security assumptions.
15. Attempt realistic attacks.
16. Fix vulnerabilities discovered during the audit.
17. Re-run all tests.
18. Document vulnerabilities that cannot be fixed.
19. Produce a release-readiness report.

DO NOT declare VEIL "perfectly secure."

============================================================
0. ABSOLUTE RULES
============================================================

SECURITY CLAIMS MUST MATCH REAL IMPLEMENTATION.

DO NOT:

- invent security guarantees
- weaken cryptography to simplify tests
- disable authentication for convenience
- add hidden backdoors
- add recovery bypasses
- log secrets
- silently weaken security controls
- mark failing tests as skipped without justification
- delete security tests because they are inconvenient
- replace secure primitives with custom implementations
- claim "military-grade encryption"
- claim "anonymous" without qualification
- claim "untraceable"
- claim "forensically invisible"

If a security property cannot be guaranteed:

DOCUMENT THE LIMITATION.

============================================================
1. TAKEOVER PROCEDURE
============================================================

Read:

AGENTS.md
README.md

Then read ALL architecture documents:

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

Read Phase 8 documentation:

docs/METADATA_AUDIT.md
docs/API_METADATA_AUDIT.md
docs/SERVER_PRIVACY.md
docs/ANONYMITY_NETWORKS.md
docs/METADATA_REMAINING_LEAKAGE.md

Read protocol documentation:

docs/GROUP_PROTOCOL.md
docs/MEDIA_SECURITY.md
docs/DEVICE_MODEL.md
docs/RECOVERY_MODEL.md

Read AI continuity:

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md
docs/ai/CHANGELOG.md

Then inspect the complete source tree.

============================================================
2. BASELINE
============================================================

Run:

npm test

Record:

- test count
- passing tests
- failing tests
- skipped tests
- warnings
- coverage if available

If the baseline is already failing:

DO NOT hide the failures.

Investigate them first.

============================================================
3. SECURITY INVENTORY
============================================================

Create:

docs/SECURITY_AUDIT.md

Inventory:

- cryptographic keys
- passwords
- identities
- sessions
- encrypted storage
- transport
- server APIs
- database
- message state
- media
- push notifications
- device state
- recovery
- group state
- metadata
- logs

For each item:

Asset
↓
Location
↓
Who can access it
↓
How it is protected
↓
Potential attack
↓
Current mitigation
↓
Remaining risk

============================================================
4. TRUST BOUNDARY REVIEW
============================================================

Identify all trust boundaries.

Examples:

User
↓
Application

Application
↓
Local storage

Application
↓
Network

Client
↓
Server

Server
↓
Database

Device A
↓
Device B

User
↓
Recovery mechanism

Space A
↓
Space B

For every boundary ask:

"What prevents an attacker from crossing it?"

============================================================
5. THREAT ACTOR MATRIX
============================================================

Review at minimum:

A. Curious server operator

Can observe:

- encrypted traffic
- routing metadata
- server database
- logs

Cannot automatically decrypt E2EE content.

B. Stolen unlocked device

Attacker has:

- physical device
- running application
- potentially unlocked Spaces

Determine what is exposed.

C. Stolen locked device

Determine whether encrypted local data remains protected.

D. Malicious client

Attempts:

- forged requests
- malformed messages
- unauthorized operations
- cross-Space access

E. Compromised contact

Can send:

- malicious messages
- malformed protocol data
- oversized media
- malicious group events

F. Network attacker

Can:

- intercept
- replay
- delay
- reorder
- drop
- modify packets

G. Passive traffic observer

Can observe:

- packet size
- timing
- destination
- frequency

H. Malicious administrator

Can inspect server-side data.

I. Compromised device

Determine which guarantees no longer hold.

J. Global passive observer

Document limitations.

============================================================
6. CRYPTOGRAPHIC REVIEW
============================================================

Audit every cryptographic operation.

Verify:

- primitive choice
- key size
- nonce generation
- nonce uniqueness
- authentication
- associated data
- key derivation
- domain separation
- key lifecycle
- key destruction
- random number generation

No custom cryptography.

============================================================
7. KDF REVIEW
============================================================

Review Argon2id usage.

Verify:

- password input handling
- salt randomness
- parameter configuration
- production/test separation
- output length
- domain separation
- failure handling

Ensure test parameters cannot accidentally become production defaults.

============================================================
8. AEAD REVIEW
============================================================

Review every AEAD call.

Verify:

- unique nonce requirements
- random nonce generation where required
- key separation
- associated data
- ciphertext authentication
- failure behavior

Attempt:

- ciphertext modification
- nonce modification
- tag modification
- associated-data modification
- truncation
- replay

Every attack must fail safely.

============================================================
9. HKDF REVIEW
============================================================

Verify:

- unique info strings
- domain separation
- correct extract/expand usage
- output lengths
- no accidental key reuse

Ensure:

StorageKey != IdentityKey != MessagingKey != MediaKey

where protocol architecture requires separation.

============================================================
10. KEY HIERARCHY REVIEW
============================================================

Audit:

Password
↓
Argon2id
↓
KEK
↓
Space Master Key
↓
Derived Keys

Verify that compromise of one derived key does not unnecessarily expose
unrelated keys.

============================================================
11. NONCE AUDIT
============================================================

Search the entire repository for nonce generation.

Look for:

- counters
- random generation
- persistence
- reuse
- serialization

Attempt to identify any path where the same key+nonce combination can
occur.

If a nonce-reuse risk exists:

CLASSIFY AS CRITICAL.

============================================================
12. RANDOMNESS AUDIT
============================================================

Search for:

Math.random()

predictable timestamps

incrementing IDs

weak random generators

user-derived randomness

Replace insecure randomness where security-sensitive.

============================================================
13. PASSWORD HANDLING
============================================================

Search for:

password
passphrase
PIN
secret

Verify:

- no plaintext persistence
- no logging
- no analytics
- no error leakage
- no accidental serialization
- no UI debug output

============================================================
14. MEMORY HYGIENE REVIEW
============================================================

Review:

zeroize()
withSecureBuffer()
destroy()

Identify:

- copies
- strings
- closures
- cached objects
- serialized buffers
- stale references

Document JavaScript/V8 limitations.

Do not claim guaranteed memory erasure.

============================================================
15. SPACE ISOLATION ATTACK
============================================================

This is one of VEIL's most important security tests.

Create:

MAIN
PRIVATE
DECOY

Attempt:

Main → Private access
Main → Decoy access
Private → Main access
Private → Decoy access
Decoy → Main access
Decoy → Private access

Test:

- keys
- storage
- sessions
- messages
- contacts
- media
- settings
- identity
- caches

Every unauthorized access must fail.

============================================================
16. SPACE CONFUSION ATTACK
============================================================

Attempt to confuse the system using:

- duplicate Space IDs
- modified Space names
- corrupted envelopes
- copied envelopes
- renamed Spaces
- stale sessions
- deleted Spaces
- recreated Spaces

Verify cryptographic identity remains authoritative.

============================================================
17. DECOY SPACE REVIEW
============================================================

Review the decoy architecture.

Important:

A decoy Space MUST NOT merely be a UI flag.

Determine whether:

- keys differ
- storage differs
- identity differs
- sessions differ
- metadata differs

Attempt to determine whether an attacker can distinguish a decoy Space
cryptographically.

Document remaining limitations.

============================================================
18. PASSWORD SELECTION ATTACK
============================================================

Attempt:

wrong password
correct password
decoy password
private password
expired password
changed password
deleted Space password

Verify that authentication failures do not leak:

- number of Spaces
- Space names
- Space types
- existence of private Spaces

============================================================
19. PASSWORD ENUMERATION
============================================================

Measure whether different passwords produce observably different
responses.

Avoid creating an oracle revealing:

"This password corresponds to a Space."

============================================================
20. LOCK/UNLOCK RACE CONDITIONS
============================================================

Test:

unlock
↓
lock immediately

unlock
↓
change password
↓
lock

unlock
↓
delete

unlock
↓
background

unlock
↓
application crash

Ensure no stale session remains usable.

============================================================
21. SESSION INVALIDATION
============================================================

After:

lockSpace()

verify:

- old session objects fail
- old keys are unusable
- storage operations fail
- queued operations fail

============================================================
22. DELETE SPACE REVIEW
============================================================

Deleting a Space must invalidate cryptographic access.

Review:

- envelope
- local data
- session
- caches
- indexes
- derived keys
- media
- thumbnails
- temporary files

Document what deletion can and cannot guarantee on modern storage media.

============================================================
23. STORAGE SECURITY
============================================================

Audit encrypted local storage.

Attempt:

- reading database directly
- modifying records
- copying records between Spaces
- replaying old records
- swapping ciphertexts
- changing IDs
- deleting records
- truncating records

All authenticated corruption must fail safely.

============================================================
24. DATABASE CONFUSION
============================================================

Attempt:

Space A record
↓
Space B database

Space B record
↓
Space A database

Verify authentication and partitioning prevent cross-Space acceptance.

============================================================
25. E2EE 1-TO-1 REVIEW
============================================================

Audit Phase 4.

Verify:

- identity keys
- session establishment
- authentication
- ratchet state
- message keys
- skipped messages
- replay protection
- out-of-order messages
- key rotation

Do NOT modify the protocol casually.

============================================================
26. DOUBLE-RATCHET REVIEW
============================================================

Verify:

- DH ratchet
- symmetric ratchet
- chain keys
- message keys
- skipped message key storage
- maximum skipped messages
- state persistence
- crash recovery

Attempt:

- replay old message
- reorder messages
- duplicate messages
- delete message
- replace ciphertext
- rollback state

============================================================
27. FORWARD SECRECY REVIEW
============================================================

Determine whether compromise of current state reveals:

- old messages
- future messages

Document exactly what the implementation guarantees.

============================================================
28. POST-COMPROMISE SECURITY
============================================================

Review whether new ratchet steps can recover security after a temporary
key compromise.

Document limitations.

============================================================
29. SAFETY NUMBER / IDENTITY REVIEW
============================================================

Verify users can detect identity changes.

Attempt:

- identity substitution
- key replacement
- contact reset
- device addition

Ensure identity changes are visible to the appropriate user.

============================================================
30. GROUP SECURITY REVIEW
============================================================

Audit Phase 5.

Review:

- membership changes
- group keys
- epochs
- sender authentication
- removed members
- added members
- replay
- message ordering

============================================================
31. REMOVED MEMBER ATTACK
============================================================

Remove member:

A

Then attempt to have A decrypt future messages.

A MUST NOT gain future group access if the protocol guarantees this.

============================================================
32. NEW MEMBER ATTACK
============================================================

Add member:

B

Verify B cannot decrypt messages sent before B's authorized membership,
unless explicitly designed otherwise.

============================================================
33. GROUP ADMIN ATTACK
============================================================

Attempt unauthorized:

- member removal
- member addition
- role changes
- group settings

Authorization must be cryptographically and server-side enforced where
required.

============================================================
34. MEDIA SECURITY AUDIT
============================================================

Review:

- encryption
- upload
- download
- thumbnails
- caching
- temporary files
- media keys
- deletion
- CDN behavior

Attempt to retrieve media without authorization.

============================================================
35. MEDIA CONFUSION ATTACK
============================================================

Swap:

Media A
↓
Message B

Media B
↓
Message A

Authentication must detect mismatched media.

============================================================
36. MALICIOUS MEDIA
============================================================

Treat media as untrusted input.

Test:

- malformed images
- malformed video
- huge files
- truncated files
- unexpected MIME types
- corrupted encrypted media

Do not execute or trust media metadata unnecessarily.

============================================================
37. MULTI-DEVICE REVIEW
============================================================

Audit Phase 6.

Review:

- device registration
- device keys
- device authorization
- device removal
- synchronization
- session establishment
- recovery

============================================================
38. ROGUE DEVICE ATTACK
============================================================

Attempt to register an unauthorized device.

Verify:

- authorization
- user visibility
- revocation
- session invalidation

============================================================
39. DEVICE REMOVAL
============================================================

Remove Device B.

Verify Device B cannot continue accessing protected resources.

Test:

- cached tokens
- cached keys
- queued messages
- offline state
- reconnect

============================================================
40. RECOVERY ATTACK
============================================================

Audit recovery.

Attempt:

- forged recovery data
- replayed recovery data
- modified recovery data
- partial recovery
- wrong recovery password
- stolen recovery material

============================================================
41. RECOVERY TRADEOFF
============================================================

Explicitly document:

Recovery convenience

vs

Security.

Do not promise recovery from every failure if doing so would weaken the
key hierarchy.

============================================================
42. TRANSPORT SECURITY
============================================================

Review:

- authentication
- TLS
- certificate validation
- request authentication
- replay
- packet modification
- connection handling
- timeouts
- retry behavior

============================================================
43. SERVER AUTHORIZATION
============================================================

Assume the client is malicious.

Never trust:

- client-provided Space ID
- client-provided user ID
- client-provided permissions
- client-provided role
- client-provided ownership

Server authorization must independently validate sensitive operations.

============================================================
44. IDOR / OBJECT ACCESS REVIEW
============================================================

Attempt to change:

/spaces/A

to:

/spaces/B

or equivalent identifiers.

Test:

- messages
- media
- groups
- devices
- mailboxes
- recovery objects

Unauthorized object access must fail.

============================================================
45. AUTHENTICATION REVIEW
============================================================

Audit:

- login
- session tokens
- expiration
- revocation
- refresh
- logout
- device authorization

Attempt token reuse after logout.

============================================================
46. SESSION FIXATION
============================================================

Attempt to force a victim into an attacker-controlled session.

Ensure session identifiers are securely regenerated where necessary.

============================================================
47. TOKEN SECURITY
============================================================

Search for:

- predictable tokens
- long-lived tokens
- tokens in URLs
- tokens in logs
- tokens in analytics
- tokens in client-visible errors

============================================================
48. REPLAY ATTACKS
============================================================

Replay:

- login requests
- message requests
- group events
- device registration
- recovery
- delivery receipts
- media operations

Verify replay protections.

============================================================
49. MALFORMED INPUT AUDIT
============================================================

Every parser is hostile-input territory.

Fuzz:

- JSON
- binary envelopes
- message envelopes
- Space envelopes
- group events
- media metadata
- transport packets

Test:

- null
- empty
- huge
- truncated
- duplicate fields
- unexpected fields
- invalid types
- invalid encodings

============================================================
50. PROTOTYPE POLLUTION / JAVASCRIPT REVIEW
============================================================

Audit dynamic object handling.

Search for unsafe patterns involving:

- object merging
- prototype manipulation
- untrusted JSON
- dynamic property access

Use safe parsing and validation.

============================================================
51. DEPENDENCY AUDIT
============================================================

Run the project's package audit tools.

Review:

- direct dependencies
- transitive dependencies
- known vulnerabilities
- abandoned packages
- suspicious install scripts

Do not blindly update security-sensitive cryptographic dependencies.

Review compatibility before upgrades.

============================================================
52. SUPPLY-CHAIN REVIEW
============================================================

Verify:

- lockfile exists
- dependencies are pinned appropriately
- unexpected packages are absent
- install scripts are understood
- cryptographic libraries are the intended libraries

============================================================
53. SECRET SCAN
============================================================

Search the entire repository for:

- API keys
- private keys
- passwords
- tokens
- credentials
- certificates
- development secrets

No real secrets may be committed.

============================================================
54. LOGGING AUDIT
============================================================

Search:

console.log
console.error
debuggers
verbose logging

Verify logs never contain:

- passwords
- keys
- plaintext messages
- plaintext media
- private identities
- recovery secrets

============================================================
55. ERROR ORACLE REVIEW
============================================================

Attempt to distinguish:

- wrong password
- nonexistent Space
- corrupted Space
- wrong user
- unauthorized device
- nonexistent message

If response differences reveal sensitive information:

minimize them.

============================================================
56. TIMING ORACLE REVIEW
============================================================

Look for operations where timing reveals:

- password correctness
- identity existence
- mailbox existence
- Space existence
- message existence

Do not claim constant-time behavior for the entire application merely
because one comparison function is constant-time.

============================================================
57. METADATA REVIEW
============================================================

Re-run Phase 8's threat model.

Ask:

Can an observer infer:

- message count?
- message timing?
- sender?
- receiver?
- device?
- Space?
- online state?
- media type?
- media size?

Document current leakage.

============================================================
58. PRIVACY SETTING REVIEW
============================================================

Test every privacy setting.

Changing:

Read receipts OFF

must actually stop read receipts.

Changing:

Typing indicators OFF

must actually stop typing events.

No UI-only security settings.

============================================================
59. NOTIFICATION REVIEW
============================================================

Verify locked-device notifications do not reveal sensitive information.

Test:

- message preview
- sender name
- group name
- Space name
- media preview

============================================================
60. SCREEN SECURITY REVIEW
============================================================

Review whether sensitive Space content can appear in:

- app switcher screenshots
- notification previews
- logs
- clipboard
- OS backups
- accessibility exposure

Implement reasonable platform protections where appropriate.

Document platform limitations.

============================================================
61. CLIPBOARD REVIEW
============================================================

If VEIL supports copying sensitive content:

review:

- clipboard persistence
- automatic clearing
- cross-app exposure

Do not silently break expected user functionality without documenting it.

============================================================
62. BACKUP REVIEW
============================================================

Determine whether application data can enter:

- cloud backups
- device backups
- automatic OS snapshots

Sensitive encrypted data must remain encrypted.

Document backup behavior per platform.

============================================================
63. CACHE REVIEW
============================================================

Search for plaintext cached:

- messages
- images
- thumbnails
- profiles
- Space names

Clear or encrypt caches appropriately.

============================================================
64. TEMP FILE REVIEW
============================================================

Search for temporary plaintext files.

Especially:

- media
- exports
- decrypted attachments
- recovery material

============================================================
65. UI SECURITY REVIEW
============================================================

Review the UI for security deception.

Do not display:

"Encrypted"

unless the actual operation is encrypted.

Do not display:

"Anonymous"

unless precisely defined.

Security indicators must correspond to real state.

============================================================
66. PANIC / QUICK LOCK REVIEW
============================================================

Audit Phase 7 panic lock.

Verify:

- sessions destroyed
- sensitive screens hidden
- keys invalidated
- background tasks stopped
- notification state handled

Test rapid activation.

============================================================
67. PANIC LOCK RACE
============================================================

Attempt:

send message
↓
panic lock

download media
↓
panic lock

unlock
↓
panic lock

switch Space
↓
panic lock

No stale operation may continue using destroyed key material.

============================================================
68. CONCURRENCY AUDIT
============================================================

Search for:

- race conditions
- shared mutable state
- duplicate operations
- lock/unlock races
- simultaneous sync
- simultaneous password change
- simultaneous deletion

============================================================
69. CRASH CONSISTENCY
============================================================

Simulate crashes during:

- encryption
- write
- rename
- delete
- password change
- message send
- message receive
- group update
- device registration

Verify recovery does not create:

- plaintext
- corrupt cryptographic state
- duplicate keys
- unauthorized access

============================================================
70. ROLLBACK ATTACK
============================================================

Attempt to restore old:

- database
- Space envelope
- session state
- group state
- device state
- recovery state

Determine whether rollback can bypass security.

============================================================
71. VERSIONING REVIEW
============================================================

Review protocol version handling.

Unknown versions must fail safely.

Do not silently interpret newer security formats as older formats.

============================================================
72. DOWNGRADE ATTACK
============================================================

Attempt:

Version 2
↓
force Version 1

Verify downgrade cannot silently remove security properties.

============================================================
73. SERIALIZATION REVIEW
============================================================

Audit every security-sensitive serializer/deserializer.

Verify:

- canonical representation
- validation
- bounds
- version checks
- authentication

============================================================
74. FUZZING
============================================================

Introduce fuzz testing where practical.

Target:

- envelope parser
- message parser
- group parser
- media metadata parser
- transport parser
- recovery parser

The parser must never:

- crash the application
- hang indefinitely
- allocate unbounded memory
- bypass authentication

============================================================
75. RESOURCE EXHAUSTION
============================================================

Test:

- giant messages
- giant groups
- giant media
- huge batch counts
- huge padding
- huge JSON
- repeated reconnects
- repeated failed passwords
- malformed packets

Verify hard resource limits.

============================================================
76. DOS REVIEW
============================================================

Document realistic denial-of-service risks.

Do not confuse:

"server can be overloaded"

with

"cryptographic compromise."

Classify correctly.

============================================================
77. RATE LIMITING REVIEW
============================================================

Review:

- login attempts
- password attempts
- message sends
- mailbox access
- device registration
- recovery
- group operations
- media uploads

Rate limiting must not become an information oracle.

============================================================
78. SERVER PRIVILEGE REVIEW
============================================================

Determine what a server administrator can access.

Ideally:

plaintext message content
= unavailable

plaintext Space content
= unavailable

password
= unavailable

private keys
= unavailable

Document all exceptions.

============================================================
79. DATABASE BREACH SIMULATION
============================================================

Assume attacker obtains the entire server database.

Ask:

What can they recover?

Test:

- messages
- identities
- Spaces
- contacts
- media
- device relationships
- metadata

============================================================
80. DATABASE MODIFICATION SIMULATION
============================================================

Assume attacker can modify server database records.

Test whether they can:

- alter message routing
- replace ciphertext
- change membership
- impersonate devices
- modify recovery state

Cryptographic authentication should prevent unauthorized content
modification where applicable.

============================================================
81. MALICIOUS SERVER SIMULATION
============================================================

Assume server deliberately sends:

- modified ciphertext
- replayed ciphertext
- reordered messages
- fake acknowledgements
- fake group events
- invalid envelopes

Client must reject invalid cryptographic state.

============================================================
82. MALICIOUS CLIENT SIMULATION
============================================================

Assume attacker controls their own client.

They may send arbitrary protocol data.

Server must not trust client claims.

============================================================
83. COMPROMISED CONTACT SIMULATION
============================================================

A legitimate contact can be malicious.

Attempt:

- malformed messages
- huge media
- group abuse
- replay
- identity confusion

VEIL must remain secure.

============================================================
84. SECURITY PROPERTY MATRIX
============================================================

Create:

docs/SECURITY_PROPERTIES.md

For each property:

Property
Implementation
Test
Threat model
Guarantee level
Limitation

Example:

Forward secrecy
↓
Double Ratchet
↓
Test X
↓
Compromised endpoint
↓
Protocol-level guarantee
↓
Endpoint compromise limitation

============================================================
85. FINDINGS CLASSIFICATION
============================================================

Every vulnerability must be classified:

CRITICAL
HIGH
MEDIUM
LOW
INFORMATIONAL

CRITICAL:

Can directly defeat core security guarantees.

HIGH:

Serious compromise under realistic conditions.

MEDIUM:

Meaningful security degradation.

LOW:

Limited impact.

INFORMATIONAL:

Hardening or documentation issue.

============================================================
86. CVSS-LIKE RISK ANALYSIS
============================================================

For each finding record:

- attack complexity
- privileges required
- user interaction
- scope
- confidentiality impact
- integrity impact
- availability impact

Do not inflate severity.

============================================================
87. FINDING FORMAT
============================================================

Every finding must contain:

ID
Title
Severity
Affected component
Attack scenario
Preconditions
Reproduction
Impact
Root cause
Fix
Regression test
Remaining limitation

============================================================
88. SECURITY REGRESSION TESTS
============================================================

Every fixed vulnerability MUST receive a regression test.

Do not merely fix the implementation.

Test the attack.

============================================================
89. NO SILENT FIXES
============================================================

Every security-relevant architectural change must be recorded in:

docs/ai/DECISIONS.md

Include:

Problem
Decision
Reason
Security impact
Tradeoff

============================================================
90. DOCUMENTATION HONESTY
============================================================

Review every security statement in:

README.md
docs/*.md
UI security descriptions

Remove unsupported claims.

Especially remove:

"unhackable"
"anonymous"
"untraceable"
"military-grade"
"100% secure"
"perfect forward secrecy"

unless technically and precisely qualified.

============================================================
91. SECURITY SCORECARD
============================================================

Create:

docs/SECURITY_SCORECARD.md

Categories:

Cryptography
Key management
Authentication
Authorization
E2EE
Groups
Media
Storage
Metadata
Transport
Server
Multi-device
Recovery
UI
Logging
Dependencies
Fuzzing
Resource limits

Give each:

PASS
PASS WITH LIMITATIONS
FAIL
NOT IMPLEMENTED

Do not use a numeric "security score" as a substitute for analysis.

============================================================
92. INDEPENDENT AUDIT REQUIREMENT
============================================================

Document clearly:

This Phase 9 is an internal adversarial review.

It is NOT equivalent to:

- professional penetration testing
- independent cryptographic audit
- formal verification
- external security certification

Before a real public security-critical release, independent review
should be strongly considered.

============================================================
93. RELEASE BLOCKERS
============================================================

Create:

docs/RELEASE_BLOCKERS.md

At minimum, release must be blocked by unresolved:

- cryptographic key compromise
- authentication bypass
- authorization bypass
- cross-Space isolation failure
- plaintext message exposure
- nonce reuse
- E2EE authentication failure
- group key compromise
- recovery bypass
- server-side plaintext access contrary to architecture
- critical dependency vulnerability
- secret leakage
- security regression

============================================================
94. SECURITY DEBT
============================================================

Create:

docs/SECURITY_DEBT.md

List:

- accepted risks
- technical debt
- future hardening
- protocol limitations
- platform limitations

Do not hide known issues.

============================================================
95. FULL TEST MATRIX
============================================================

Run all tests from:

Phase 0
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
Phase 8
Phase 9

No phase may be silently excluded.

============================================================
96. BUILD VALIDATION
============================================================

Run:

npm test

Type checking.

Linting.

Build.

Dependency audit.

Security scanning where available.

Fuzzing where available.

Record exact commands and results.

============================================================
97. MANUAL ATTACK CHECKLIST
============================================================

Manually attempt:

[ ] wrong password
[ ] decoy password
[ ] cross-Space access
[ ] copied Space envelope
[ ] modified Space envelope
[ ] stale session
[ ] replayed message
[ ] modified ciphertext
[ ] modified nonce
[ ] modified tag
[ ] reordered messages
[ ] removed group member decrypting future message
[ ] unauthorized device
[ ] revoked device reconnect
[ ] recovery replay
[ ] database modification
[ ] server-modified ciphertext
[ ] malformed packet
[ ] oversized packet
[ ] plaintext log search
[ ] secret search
[ ] notification leakage
[ ] cache leakage
[ ] backup leakage
[ ] media swap
[ ] media corruption
[ ] panic-lock race
[ ] lock/unlock race
[ ] password-change race
[ ] delete/recreate race

============================================================
98. SECURITY REVIEW OF TESTS THEMSELVES
============================================================

Do NOT trust tests blindly.

Inspect whether tests could pass while the implementation is insecure.

Look for:

- mocks hiding real crypto
- assertions that are too weak
- tests checking only return values
- missing negative tests
- fake network behavior
- test-only security logic
- disabled production checks

============================================================
99. TEST/PRODUCTION PARITY
============================================================

Ensure:

Production crypto parameters
!= accidentally replaced by test parameters.

Production security checks
!= disabled during normal builds.

Development debug features
!= shipped in production.

============================================================
100. FINAL RELEASE CANDIDATE AUDIT
============================================================

Perform a clean build from a fresh checkout.

Do not rely on development artifacts.

Verify:

- dependency installation
- build
- test
- database initialization
- migrations
- configuration
- environment variables
- production defaults

============================================================
101. FINAL GIT REVIEW
============================================================

Inspect:

git status
git diff
git log

Ensure:

- no secrets
- no debug artifacts
- no temporary files
- no generated private keys
- no credentials
- no test bypasses

============================================================
102. FINAL SECURITY REPORT
============================================================

Create:

docs/SECURITY_AUDIT_REPORT.md

Include:

Executive summary

Threat model

Scope

Methodology

Architecture reviewed

Cryptography reviewed

Attack scenarios

Findings

Fixed vulnerabilities

Accepted risks

Remaining limitations

Test results

Dependency findings

Performance impact

Release blockers

Recommended future work

============================================================
103. AI CONTINUITY
============================================================

Update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md

HANDOFF.md MUST contain:

- complete audit status
- unresolved findings
- resolved findings
- release blockers
- accepted risks
- test status
- dependency status
- security scorecard
- exact next phase requirements

============================================================
104. PHASE 9 DEFINITION OF DONE
============================================================

Phase 9 is complete ONLY when:

ARCHITECTURE

[ ] complete architecture reviewed
[ ] trust boundaries reviewed
[ ] threat model reviewed
[ ] security assumptions documented

CRYPTOGRAPHY

[ ] KDF reviewed
[ ] AEAD reviewed
[ ] HKDF reviewed
[ ] nonce usage reviewed
[ ] randomness reviewed
[ ] key hierarchy reviewed
[ ] key lifecycle reviewed

SPACES

[ ] multi-Space isolation attacked
[ ] decoy architecture attacked
[ ] password-selection behavior attacked
[ ] session invalidation tested

MESSAGING

[ ] 1-to-1 protocol reviewed
[ ] Double Ratchet reviewed
[ ] replay tested
[ ] out-of-order tested
[ ] identity changes tested

GROUPS

[ ] membership transitions tested
[ ] removed-member security tested
[ ] new-member security tested
[ ] admin authorization tested

MEDIA

[ ] encryption reviewed
[ ] media authorization tested
[ ] media swap tested
[ ] cache reviewed
[ ] thumbnail reviewed

DEVICES

[ ] registration reviewed
[ ] rogue-device attack tested
[ ] revocation tested
[ ] synchronization reviewed

RECOVERY

[ ] recovery protocol attacked
[ ] replay tested
[ ] tampering tested
[ ] recovery tradeoffs documented

METADATA

[ ] Phase 8 assumptions re-tested
[ ] timing reviewed
[ ] size leakage reviewed
[ ] identifiers reviewed
[ ] presence reviewed
[ ] push privacy reviewed

SERVER

[ ] authentication reviewed
[ ] authorization reviewed
[ ] IDOR tested
[ ] malicious-server model tested
[ ] database breach model tested
[ ] database modification model tested
[ ] logging reviewed

APPLICATION

[ ] local storage reviewed
[ ] cache reviewed
[ ] temporary files reviewed
[ ] notifications reviewed
[ ] backups reviewed
[ ] clipboard reviewed
[ ] panic lock reviewed

INPUT SECURITY

[ ] parsers fuzzed
[ ] malformed input tested
[ ] resource limits tested
[ ] DoS reviewed

SUPPLY CHAIN

[ ] dependencies reviewed
[ ] lockfile reviewed
[ ] vulnerability audit completed
[ ] secret scan completed

TESTING

[ ] all historical tests pass
[ ] all security regression tests pass
[ ] fuzzing completed where applicable
[ ] clean-build test completed

DOCUMENTATION

[ ] SECURITY_AUDIT.md
[ ] SECURITY_AUDIT_REPORT.md
[ ] SECURITY_PROPERTIES.md
[ ] SECURITY_SCORECARD.md
[ ] RELEASE_BLOCKERS.md
[ ] SECURITY_DEBT.md
[ ] KNOWN_LIMITATIONS.md updated

REPOSITORY

[ ] no secrets
[ ] no debug bypasses
[ ] no temporary artifacts
[ ] clean Git tree
[ ] atomic Phase 9 commit

============================================================
105. FINAL DECISION
============================================================

At the end of the phase, classify VEIL as exactly one:

RELEASE BLOCKED

or

RELEASE CANDIDATE

Do NOT use:

"SECURE"

as the final classification.

If any unresolved Critical or release-blocking High vulnerability exists:

FINAL STATUS = RELEASE BLOCKED.

If no release-blocking vulnerabilities remain:

FINAL STATUS = RELEASE CANDIDATE.

============================================================
106. STOP CONDITION
============================================================

STOP AFTER PHASE 9.

DO NOT IMPLEMENT PHASE 10.

Phase 10 will handle:

RELEASE CANDIDATE,
FINAL INTEGRATION,
PRODUCTION HARDENING,
DOCUMENTATION,
DEPLOYMENT,
AND RELEASE PREPARATION.

============================================================
FINAL PRINCIPLE
============================================================

ASSUME THE IMPLEMENTATION IS WRONG.

TRY TO BREAK IT.

PROVE WHAT CAN BE PROVEN.

DOCUMENT WHAT CANNOT.

FIX WHAT CAN BE FIXED.

NEVER HIDE A SECURITY FAILURE.

NEVER TURN A PASSING TEST INTO A CLAIM OF PERFECT SECURITY.

A SECURITY AUDIT IS ONLY USEFUL IF THE AUDITOR IS WILLING TO FIND BAD NEWS.

STOP WHEN PHASE 9 IS COMPLETE.
============================================================
```

### Where Phase 9 fits

Your VEIL roadmap is now essentially:

| Phase  | Purpose                                  |
| ------ | ---------------------------------------- |
| **0**  | Architecture + AI continuity             |
| **1**  | Cryptographic Spaces                     |
| **2**  | Independent Space identities             |
| **3**  | Privacy-preserving transport             |
| **4**  | E2EE 1-to-1 messaging                    |
| **5**  | Groups + encrypted media                 |
| **6**  | Multi-device + recovery                  |
| **7**  | Privacy UX + panic lock                  |
| **8**  | Metadata minimization + traffic privacy  |
| **9**  | 🔴 **Adversarial security audit**        |
| **10** | Release candidate + production hardening |

The key difference is that **Phase 9 should not be another giant "build features" prompt**. It's deliberately a *break-it* phase. If the agent gets through Phase 9 with everything green, that's much more meaningful than simply adding another 20 features.

And because you're handing this project between AI agents when tokens run out, **the `SECURITY_AUDIT_REPORT.md` + `HANDOFF.md` combination is especially important**: the next agent can see not just what was built, but what was attacked, what failed, what was fixed, and what remains dangerous.
