Absolutely. **Phase 10 is the final engineering phase**: take the result of Phase 9, fix anything that blocks release, integrate the whole system, harden the production build, and prepare VEIL for an actual deployment.

One important distinction: **Phase 10 should not invent major new security architecture.** If Phase 9 discovers a fundamental protocol flaw, Phase 10 should stop and send it back to architecture/protocol work rather than duct-taping a fix onto it. Otherwise, congratulations, you've created the world's most sophisticated security band-aid.

# VEIL — PHASE 10

## Release Candidate, Production Hardening & Deployment Preparation

```text
============================================================
VEIL — PHASE 10
RELEASE CANDIDATE & PRODUCTION HARDENING
============================================================

MISSION

You are implementing PHASE 10 of VEIL.

This is the FINAL ENGINEERING PHASE.

The objective is to transform the audited VEIL implementation into a
reproducible, documented, production-ready RELEASE CANDIDATE.

Phase 9 attempted to break VEIL.

Phase 10 must:

1. Resolve every release-blocking finding.
2. Verify every security fix.
3. Integrate all completed phases.
4. Harden production configuration.
5. Remove development artifacts.
6. Establish reproducible builds.
7. Validate deployment configuration.
8. Complete operational documentation.
9. Complete user-facing documentation.
10. Perform a final release verification.
11. Produce a Release Candidate.
12. Prepare VEIL for independent external security review.

DO NOT introduce unnecessary new features.

DO NOT redesign cryptographic protocols unless Phase 9 proved the current
design fundamentally unsafe.

DO NOT claim VEIL is "secure", "anonymous", "untraceable", or
"unhackable".

The final classification is:

RELEASE CANDIDATE

NOT:

"perfectly secure."

============================================================
0. MANDATORY TAKEOVER
============================================================

Before modifying anything, read:

AGENTS.md
README.md

Then:

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

Read:

docs/SECURITY_AUDIT.md
docs/SECURITY_AUDIT_REPORT.md
docs/SECURITY_PROPERTIES.md
docs/SECURITY_SCORECARD.md
docs/RELEASE_BLOCKERS.md
docs/SECURITY_DEBT.md

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

============================================================
1. ESTABLISH GROUND TRUTH
============================================================

Run:

git status
git log --oneline

Then:

npm install
npm test
npm run build

Run lint/type checking if configured.

Do NOT assume Phase 9 was completed correctly.

Verify the actual repository state.

Record:

- commit
- branch
- test count
- build status
- dependency status
- security findings
- release blockers

============================================================
2. RELEASE BLOCKER GATE
============================================================

Read:

docs/RELEASE_BLOCKERS.md

Every unresolved release blocker must be classified:

FIXED
DEFERRED
ACCEPTED
NOT APPLICABLE

A Critical vulnerability MUST NOT be marked merely "accepted" without
explicit architectural justification.

If a fundamental protocol vulnerability remains:

STOP.

Set:

RELEASE STATUS = BLOCKED

Document the reason.

Do not manufacture a release candidate.

============================================================
3. SECURITY FINDING REMEDIATION
============================================================

For every Phase 9 finding:

ID
↓
Root cause
↓
Fix
↓
Regression test
↓
Verification
↓
Status

Every fixed vulnerability must have a regression test.

No security fix without a test.

============================================================
4. REGRESSION VERIFICATION
============================================================

Run:

Phase 0 tests
Phase 1 tests
Phase 2 tests
Phase 3 tests
Phase 4 tests
Phase 5 tests
Phase 6 tests
Phase 7 tests
Phase 8 tests
Phase 9 security tests

No historical test may be removed merely because implementation changed.

If a test is obsolete:

- explain why
- replace it with an equivalent or stronger test
- document the change

============================================================
5. FULL INTEGRATION TEST
============================================================

Test the complete lifecycle:

INSTALL
↓
CREATE ACCOUNT
↓
CREATE MAIN SPACE
↓
CREATE PRIVATE SPACE
↓
CREATE DECOY SPACE
↓
LOCK
↓
UNLOCK MAIN
↓
UNLOCK PRIVATE
↓
SEND MESSAGE
↓
RECEIVE MESSAGE
↓
CREATE GROUP
↓
ADD MEMBER
↓
SEND GROUP MESSAGE
↓
SEND MEDIA
↓
ADD DEVICE
↓
SYNC
↓
REMOVE DEVICE
↓
CHANGE PASSWORD
↓
LOCK
↓
RECOVER
↓
PANIC LOCK
↓
DELETE SPACE

Verify each transition.

============================================================
6. MULTI-SPACE FINAL VALIDATION
============================================================

Create:

MAIN
PRIVATE
DECOY

Verify:

MAIN data
!= PRIVATE data
!= DECOY data

Verify:

MAIN keys
!= PRIVATE keys
!= DECOY keys

Verify:

MAIN identity
!= PRIVATE identity
!= DECOY identity

unless the architecture explicitly specifies otherwise.

Verify that switching Spaces does not leak:

- chats
- contacts
- media
- identity
- settings
- notifications
- cached content

============================================================
7. CREDENTIAL-SELECTED SPACE VALIDATION
============================================================

Verify the central VEIL concept:

One account can contain multiple cryptographically isolated Spaces.

Example:

Password A
→ Main Space

Password B
→ Private Space

Password C
→ Decoy Space

Verify:

- each password unlocks only its intended Space
- incorrect credentials fail
- one Space cannot derive another Space's keys
- Space existence is not unnecessarily disclosed
- lock destroys active session access

============================================================
8. UX SECURITY VALIDATION
============================================================

Security must not destroy usability.

Verify a new user can understand:

- what a Space is
- how to create one
- how to unlock one
- how to switch Spaces
- how to lock
- how to change credentials
- how recovery works
- what security guarantees actually mean

Do NOT expose cryptographic terminology unnecessarily.

Prefer:

"Private Space"

over:

"SMK-derived isolated cryptographic domain"

The latter is technically impressive and spectacularly bad UX.

============================================================
9. FIRST-RUN EXPERIENCE
============================================================

Create a new-user flow:

WELCOME
↓
WHAT VEIL DOES
↓
CREATE CREDENTIAL
↓
CREATE MAIN SPACE
↓
OPTIONAL PRIVATE SPACE
↓
OPTIONAL DECOY SPACE
↓
SAFETY EXPLANATION
↓
START CHAT

The user must not need to understand cryptography.

============================================================
10. SPACE CREATION UX
============================================================

Space creation must clearly communicate:

- Space name
- credential
- credential confirmation
- optional decoy designation
- consequences of forgetting credentials
- recovery limitations

Never imply:

"Forgot password? We can always recover everything."

unless the architecture genuinely supports it.

============================================================
11. PASSWORD UX
============================================================

Implement:

- password strength guidance
- confirmation
- secure entry fields
- no plaintext display by default
- no clipboard copying of passwords
- no logging

Avoid unnecessary password complexity rules that encourage predictable
password patterns.

============================================================
12. PRIVATE SPACE UX
============================================================

Private Spaces should feel like a natural feature.

Avoid suspicious UI language.

The application should not visually expose unnecessary information such
as:

"THIS IS THE SECRET SPACE"

when a neutral presentation is sufficient.

============================================================
13. DECOY UX
============================================================

Clearly document internally what decoy Spaces do.

Do not advertise them as providing impossible guarantees.

User-facing documentation must explain limitations honestly without
destroying the usefulness of the feature.

============================================================
14. PANIC LOCK FINALIZATION
============================================================

Verify panic lock from every major screen.

Test:

Chat
Group
Media
Settings
Space switcher
Search
Profile
Background state

Panic action must:

- invalidate sessions where designed
- hide sensitive content
- prevent stale operations
- return to the intended safe state

============================================================
15. APP LIFECYCLE REVIEW
============================================================

Test:

Launch
Background
Resume
Force close
Restart
Crash
Low memory
Network loss
Network restoration
Device reboot

Ensure sensitive state does not accidentally remain accessible.

============================================================
16. OFFLINE MODE
============================================================

Determine exactly what VEIL supports offline.

Verify:

- encrypted local data remains encrypted
- queued messages are protected
- failed sends retry safely
- duplicate sends are prevented where required
- lock prevents unauthorized offline access

============================================================
17. NETWORK INTERRUPTION
============================================================

Test:

send message
↓
disconnect network

Then:

reconnect

Verify:

- no duplicate message
- no plaintext queue
- correct encryption state
- correct delivery state

============================================================
18. DATABASE MIGRATION
============================================================

If database migrations exist:

Test:

Version N
↓
Version N+1

Verify:

- encryption remains intact
- keys remain valid
- data remains isolated
- migration cannot bypass authorization

Create rollback guidance.

============================================================
19. PRODUCTION CONFIGURATION
============================================================

Create explicit production configuration.

Production MUST NOT use:

- test Argon2 parameters
- debug logging
- development keys
- mock cryptography
- fake server authentication
- test endpoints
- insecure localhost assumptions

============================================================
20. ENVIRONMENT VARIABLE AUDIT
============================================================

Inventory every environment variable.

For each:

Name
Purpose
Required?
Secret?
Production value source
Development value source

Never commit secret values.

Provide:

.env.example

with placeholders only.

============================================================
21. DEBUG MODE ELIMINATION
============================================================

Search for:

DEBUG
DEV
TEST
MOCK
BYPASS
DISABLE_AUTH
SKIP_AUTH
ALLOW_INSECURE
FAKE

Review every occurrence.

Production builds must not accidentally activate development bypasses.

============================================================
22. LOGGING FINALIZATION
============================================================

Production logs must be useful without exposing secrets.

Allowed examples:

connection failed
message delivery failed
database unavailable

Forbidden:

password
private key
session key
plaintext message
plaintext media
recovery secret

============================================================
23. ERROR HANDLING
============================================================

Production errors must:

- fail safely
- avoid sensitive disclosure
- provide actionable information
- maintain stable error categories

Do not expose stack traces to normal users.

============================================================
24. DEPENDENCY FREEZE
============================================================

Review package.json and lockfile.

Verify:

- intended dependencies only
- cryptographic dependencies are explicit
- versions are reproducible
- no accidental development dependency in production
- no abandoned security-critical dependency

Run the project's dependency audit.

Document results.

============================================================
25. LICENSE REVIEW
============================================================

Inventory licenses.

Verify all dependencies are compatible with VEIL's intended distribution.

Create:

THIRD_PARTY_NOTICES.md

if required.

============================================================
26. REPRODUCIBLE BUILD
============================================================

Establish the most reproducible build process practical for the project.

Document:

- runtime version
- package manager
- lockfile
- build command
- environment requirements

A clean machine must be able to reproduce the build.

============================================================
27. CLEAN-CHECKOUT TEST
============================================================

Simulate a new developer/machine:

git clone
↓
install dependencies
↓
build
↓
test

No dependency on:

- developer-specific files
- local databases
- hidden environment configuration
- IDE state
- generated files

============================================================
28. DATABASE INITIALIZATION
============================================================

Test first-run initialization.

Verify:

- secure defaults
- encrypted local state
- correct permissions
- migrations
- failure handling

============================================================
29. FILESYSTEM SECURITY
============================================================

Review:

- file permissions
- temporary files
- cache directories
- database location
- media location
- generated files

Avoid plaintext security-sensitive files.

============================================================
30. BACKUP / RESTORE
============================================================

Document exactly:

What is backed up?

What is encrypted?

What can be restored?

What cannot?

Test:

backup
↓
delete installation
↓
restore
↓
unlock
↓
verify data

============================================================
31. RECOVERY FINAL VALIDATION
============================================================

Test recovery from:

- lost device
- new device
- corrupted local database
- interrupted recovery
- invalid recovery material

Recovery must not silently weaken identity or E2EE guarantees.

============================================================
32. MULTI-DEVICE FINAL VALIDATION
============================================================

Test:

Device A
↓
Device B
↓
Device C

Verify:

- device identities
- synchronization
- message delivery
- device revocation
- key state
- Space isolation

Then remove Device B.

Verify B cannot regain access without explicit authorization.

============================================================
33. GROUP FINAL VALIDATION
============================================================

Test:

Create group
↓
Add member
↓
Message
↓
Remove member
↓
Rotate/update group state
↓
Message
↓
Add new member
↓
Message

Verify intended cryptographic boundaries.

============================================================
34. MEDIA FINAL VALIDATION
============================================================

Test:

upload
encrypt
send
download
decrypt
display

Then test:

- interrupted upload
- interrupted download
- corrupted media
- unauthorized media request
- deleted media
- cache cleanup

============================================================
35. E2EE FINAL VALIDATION
============================================================

Test:

Device A → Device B

Verify:

- authenticated session
- encrypted messages
- ratchet progression
- replay protection
- out-of-order handling
- identity change handling

Do not weaken protocol correctness for UI convenience.

============================================================
36. METADATA FINAL VALIDATION
============================================================

Re-run Phase 8 measurements.

Document:

- observable identifiers
- packet sizes
- timing
- connection metadata
- push metadata
- server-visible state

Update:

docs/METADATA_REMAINING_LEAKAGE.md

if necessary.

============================================================
37. PRIVACY DOCUMENTATION
============================================================

Create/update:

docs/USER_PRIVACY_GUIDE.md

Explain in plain language:

What VEIL protects.

What VEIL does not protect.

Examples:

VEIL protects message contents using E2EE.

VEIL cannot protect an already-compromised device.

VEIL reduces server knowledge but cannot make all network metadata
disappear.

Do not overpromise.

============================================================
38. SECURITY DOCUMENTATION
============================================================

Create/update:

docs/SECURITY_GUIDE.md

Include:

- threat model
- encryption
- Spaces
- identities
- device security
- recovery
- metadata
- limitations
- reporting vulnerabilities

============================================================
39. SECURITY CONTACT
============================================================

Create:

SECURITY.md

Include:

- how to report vulnerabilities
- what information to provide
- responsible disclosure guidance
- expected response process

Do not expose private contact information that has not been provided.

Use a placeholder if necessary.

============================================================
40. INCIDENT RESPONSE PLAN
============================================================

Create:

docs/INCIDENT_RESPONSE.md

Cover:

1. vulnerability discovered
2. severity assessment
3. containment
4. patch
5. key rotation if required
6. client update
7. server mitigation
8. user notification
9. postmortem
10. regression tests

============================================================
41. KEY COMPROMISE PROCEDURES
============================================================

Document what happens if:

- identity key compromised
- device key compromised
- server credential compromised
- recovery material compromised
- Space credential compromised

Do not pretend every compromise can be remotely fixed.

============================================================
42. VERSIONING
============================================================

Define:

Application version
Protocol version
Storage version
Space envelope version
Message version
Group protocol version

They must not be conflated.

============================================================
43. UPGRADE SAFETY
============================================================

Test:

old version
↓
new version

Verify security properties remain intact.

============================================================
44. SECURITY-DOWNGRADE PREVENTION
============================================================

Ensure a malicious actor cannot force a user into an insecure legacy
protocol merely by modifying negotiation data.

============================================================
45. PROTOCOL COMPATIBILITY
============================================================

If compatibility is required:

document exactly what versions are compatible.

Do not silently accept unknown security versions.

============================================================
46. FEATURE FLAGS
============================================================

Review all feature flags.

Security-critical features must not be disabled accidentally.

Production defaults must be secure.

============================================================
47. TELEMETRY REVIEW
============================================================

If telemetry exists:

Review whether it collects:

- message content
- identifiers
- Space information
- IP addresses
- contact information
- device information

Minimize collection.

If telemetry is unnecessary:

remove it.

============================================================
48. ANALYTICS REVIEW
============================================================

Do not add analytics merely because modern apps "usually have them."

VEIL's privacy architecture should take precedence.

============================================================
49. PUSH NOTIFICATION REVIEW
============================================================

Verify notification architecture does not expose message plaintext.

Review:

- notification payload
- sender
- group
- preview
- timing
- token association

============================================================
50. CONTACT DISCOVERY REVIEW
============================================================

If contact discovery exists:

Review whether the server learns:

- complete address book
- phone numbers
- emails
- social graph

Minimize exposure.

============================================================
51. USER ACCOUNT DELETION
============================================================

Implement/document:

Delete account

Determine:

- what is deleted immediately
- what expires later
- what remains cryptographically inaccessible
- what server metadata may remain temporarily

============================================================
52. SPACE DELETION
============================================================

Final test:

Delete Space.

Verify:

- active session destroyed
- future unlock impossible under deleted credentials
- encrypted records inaccessible
- indexes removed
- caches handled
- media handled

Document filesystem deletion limitations.

============================================================
53. CHAT DELETION
============================================================

Define exactly what:

Delete message

means.

Distinguish:

local deletion
server deletion
recipient deletion
cryptographic deletion

Do not call something "secure deletion" unless that is technically
defensible.

============================================================
54. USER DATA EXPORT
============================================================

If export exists:

Review whether export can accidentally bypass:

- Space boundaries
- E2EE protections
- access controls

Exports must be treated as sensitive data.

============================================================
55. ACCOUNT ENUMERATION REVIEW
============================================================

Ensure public interfaces do not unnecessarily reveal:

- account existence
- Space existence
- group membership
- device existence

============================================================
56. AVAILABILITY / ABUSE CONTROLS
============================================================

Production deployment must include reasonable controls against:

- spam
- message flooding
- media flooding
- account abuse
- connection exhaustion

Do not sacrifice privacy unnecessarily.

============================================================
57. SERVER DEPLOYMENT HARDENING
============================================================

If VEIL has a server component, review:

- TLS
- firewall
- secrets
- database permissions
- process permissions
- container permissions
- filesystem permissions
- exposed ports
- admin interfaces

============================================================
58. SERVER SECRETS
============================================================

Never store production secrets in:

- repository
- source code
- client application
- logs
- public configuration

Use the deployment environment's secret-management mechanism.

============================================================
59. DATABASE SERVER HARDENING
============================================================

Review:

- least privilege
- network exposure
- encryption at rest where applicable
- backups
- access logs
- admin accounts

============================================================
60. CONTAINER / DEPLOYMENT SECURITY
============================================================

If containers are used:

- use minimal images
- run with least privilege
- avoid unnecessary capabilities
- pin base images
- do not run as root unless unavoidable
- scan images

============================================================
61. RATE LIMITING PRODUCTION REVIEW
============================================================

Configure reasonable production limits for:

- authentication
- registration
- message sending
- group operations
- media
- recovery
- device registration

Document limits.

============================================================
62. ABUSE PREVENTION
============================================================

Create:

docs/ABUSE_MODEL.md

Explain what VEIL can and cannot prevent regarding abuse.

Privacy does not eliminate abuse.

Security architecture should not be undermined by pretending otherwise.

============================================================
63. PERFORMANCE VALIDATION
============================================================

Benchmark:

- Argon2id
- encryption
- decryption
- message processing
- group operations
- media encryption
- database operations

Do NOT reduce cryptographic security solely to improve benchmark numbers.

============================================================
64. MEMORY VALIDATION
============================================================

Check:

- memory growth
- session lifecycle
- large media
- large groups
- repeated lock/unlock
- repeated encryption

Look for leaks and stale references.

============================================================
65. LONG-RUN STABILITY
============================================================

Run extended tests involving:

- repeated message send
- repeated lock/unlock
- repeated Space switching
- repeated group operations
- repeated media operations

Watch for:

- memory growth
- stale sessions
- database corruption
- duplicate state

============================================================
66. USER JOURNEY TESTING
============================================================

A new user must be able to complete:

1. install
2. account setup
3. create Space
4. add contact
5. start chat
6. send message
7. create group
8. send media
9. lock
10. unlock
11. add device
12. recover

without developer assistance.

============================================================
67. EMPTY / ERROR STATES
============================================================

Every major screen needs usable states for:

- empty
- loading
- offline
- error
- locked
- unauthorized
- deleted
- unavailable

============================================================
68. ACCESSIBILITY
============================================================

Review:

- readable text
- touch targets
- keyboard navigation where relevant
- screen-reader labels
- contrast
- error messaging

Security UX should remain understandable.

============================================================
69. UI CONSISTENCY
============================================================

Ensure:

- consistent navigation
- consistent Space switching
- consistent lock behavior
- consistent message states
- consistent error presentation

The UI should feel like one coherent product.

============================================================
70. ONBOARDING
============================================================

Do not overwhelm users with cryptographic terminology.

Teach only what users need to make informed decisions.

============================================================
71. FINAL DOCUMENTATION INDEX
============================================================

README.md must clearly link to:

Architecture
Security
Privacy
Threat model
User guide
Security limitations
Recovery
Protocol documentation
Developer setup
Deployment
Security reporting

============================================================
72. DEVELOPER DOCUMENTATION
============================================================

Create/update:

docs/DEVELOPMENT.md

Include:

- prerequisites
- installation
- development commands
- tests
- lint
- build
- architecture overview
- contribution rules
- security rules

============================================================
73. DEPLOYMENT DOCUMENTATION
============================================================

Create:

docs/DEPLOYMENT.md

Include:

- infrastructure requirements
- environment configuration
- database setup
- TLS
- secrets
- migrations
- backups
- monitoring
- rollback
- upgrades

Do not put real secrets in documentation.

============================================================
74. OPERATIONS DOCUMENTATION
============================================================

Create:

docs/OPERATIONS.md

Include:

- health checks
- logs
- alerts
- backups
- database maintenance
- key rotation procedures
- incident response
- upgrade procedures

============================================================
75. RELEASE CHECKLIST
============================================================

Create:

docs/RELEASE_CHECKLIST.md

Include:

SECURITY
[ ] Phase 9 blockers resolved
[ ] regression tests pass
[ ] dependency audit complete
[ ] secrets scan clean

BUILD
[ ] clean build
[ ] reproducible installation
[ ] production config verified

APPLICATION
[ ] Spaces verified
[ ] messaging verified
[ ] groups verified
[ ] media verified
[ ] devices verified
[ ] recovery verified
[ ] panic lock verified

PRIVACY
[ ] metadata reviewed
[ ] telemetry reviewed
[ ] notifications reviewed
[ ] backups reviewed

DOCUMENTATION
[ ] README complete
[ ] security guide complete
[ ] privacy guide complete
[ ] deployment guide complete
[ ] incident response complete

REPOSITORY
[ ] no secrets
[ ] no debug artifacts
[ ] clean Git tree

============================================================
76. VERSION FREEZE
============================================================

Once all release checks pass:

Freeze the Release Candidate feature set.

Do NOT add random features after this point.

Any new security-critical change requires:

- review
- tests
- documentation
- regression verification

============================================================
77. FINAL SECURITY TEST
============================================================

Run every security test again AFTER all production hardening.

This matters because hardening can accidentally break security.

============================================================
78. FINAL CLEAN BUILD
============================================================

Delete development artifacts.

Then perform:

clean checkout
↓
install
↓
build
↓
test
↓
security checks

Record results.

============================================================
79. RELEASE CANDIDATE ARTIFACT
============================================================

Create a clearly versioned Release Candidate.

Example:

VEIL v1.0.0-rc.1

Do not publish a final v1.0.0 automatically.

The Release Candidate should be suitable for:

- internal testing
- trusted beta testing
- independent security review

============================================================
80. RELEASE NOTES
============================================================

Create:

RELEASE_NOTES.md

Include:

- major capabilities
- security architecture
- privacy improvements
- known limitations
- breaking changes
- migration requirements
- testing status

Do not exaggerate security.

============================================================
81. CHANGELOG
============================================================

Update:

docs/ai/CHANGELOG.md

Include all Phase 10 changes.

============================================================
82. FINAL AI HANDOFF
============================================================

Update:

docs/ai/CURRENT_STATE.md
docs/ai/HANDOFF.md
docs/ai/ACTIVE_TASK.md

HANDOFF.md must contain:

PROJECT STATUS
↓
RELEASE CANDIDATE VERSION
↓
LAST VERIFIED COMMIT
↓
TEST RESULTS
↓
SECURITY AUDIT STATUS
↓
KNOWN LIMITATIONS
↓
SECURITY DEBT
↓
DEPLOYMENT STATUS
↓
OPEN ISSUES
↓
RECOMMENDED NEXT ACTION

============================================================
83. FINAL ARCHITECTURE FREEZE
============================================================

At the end of Phase 10:

Cryptographic architecture
= FROZEN

Protocol architecture
= FROZEN

Threat model
= FROZEN FOR RC

Any future changes require a new architecture/security review.

============================================================
84. FINAL GIT AUDIT
============================================================

Run:

git status
git diff
git log

Verify:

- no secrets
- no credentials
- no private keys
- no debug bypasses
- no test bypasses
- no temporary artifacts

============================================================
85. FINAL COMMIT
============================================================

Create one atomic commit for the Phase 10 release-candidate state.

Example:

release: VEIL v1.0.0-rc.1

The commit must contain:

- production hardening
- documentation
- security fixes
- release configuration
- tests

============================================================
86. FINAL TAG
============================================================

If the repository workflow permits:

tag:

v1.0.0-rc.1

Do NOT tag final v1.0.0.

This is still a Release Candidate.

============================================================
87. FINAL VERIFICATION AFTER COMMIT
============================================================

Run:

git status

The working tree must be clean.

Then verify the committed tree itself.

Do not assume the commit contains exactly what was intended.

============================================================
88. FINAL RELEASE REPORT
============================================================

Create:

docs/RELEASE_CANDIDATE_REPORT.md

Include:

Version

Commit

Build environment

Test results

Security audit result

Resolved vulnerabilities

Remaining vulnerabilities

Known limitations

Security debt

Privacy limitations

Performance results

Deployment status

Documentation status

Independent audit recommendation

Final classification

============================================================
89. FINAL CLASSIFICATION
============================================================

There are ONLY two acceptable outcomes.

--------------------------------
RELEASE CANDIDATE
--------------------------------

Allowed only if:

- no unresolved Critical issue
- no release-blocking High issue
- all required tests pass
- clean build succeeds
- production configuration is validated
- documentation is complete
- known limitations are documented

OR

--------------------------------
RELEASE BLOCKED
--------------------------------

If any release blocker remains.

============================================================
90. IMPORTANT SECURITY DISCLAIMER
============================================================

The Release Candidate MUST be described as:

"An internally reviewed release candidate that has not necessarily
undergone an independent professional security audit."

Do NOT describe it as:

"fully secure"
"unhackable"
"anonymous"
"untraceable"
"military-grade"

============================================================
91. POST-PHASE-10 BOUNDARY
============================================================

Phase 10 is the end of the planned engineering build phases.

After Phase 10, future work belongs to separate tracks:

TRACK A
Independent security audit

TRACK B
Bug fixes

TRACK C
Production operations

TRACK D
Performance optimization

TRACK E
User feedback

TRACK F
Future features

TRACK G
Protocol upgrades

Future features MUST NOT silently alter the security model.

============================================================
92. DEFINITION OF DONE
============================================================

Phase 10 is COMPLETE only when:

SECURITY

[ ] Phase 9 completed
[ ] all release blockers resolved
[ ] all security fixes regression-tested
[ ] security documentation complete
[ ] limitations documented

CRYPTOGRAPHY

[ ] production parameters verified
[ ] test parameters isolated
[ ] nonce behavior verified
[ ] key hierarchy verified
[ ] protocol versions verified

SPACES

[ ] Main verified
[ ] Private verified
[ ] Decoy verified
[ ] cross-Space isolation verified
[ ] lock/unlock verified
[ ] deletion verified
[ ] credential change verified

MESSAGING

[ ] 1-to-1 verified
[ ] E2EE verified
[ ] replay protection verified
[ ] identity changes verified

GROUPS

[ ] membership verified
[ ] key transitions verified
[ ] removed members verified
[ ] new members verified

MEDIA

[ ] encryption verified
[ ] authorization verified
[ ] cache behavior verified
[ ] deletion behavior documented

DEVICES

[ ] multi-device verified
[ ] device revocation verified
[ ] recovery verified

PRIVACY

[ ] metadata review complete
[ ] notification privacy verified
[ ] telemetry reviewed
[ ] backup behavior documented

PRODUCTION

[ ] production configuration verified
[ ] secrets excluded
[ ] dependency audit complete
[ ] clean build works
[ ] deployment documentation complete
[ ] operational documentation complete

UX

[ ] onboarding complete
[ ] Space UX complete
[ ] chat UX complete
[ ] lock UX complete
[ ] panic lock complete
[ ] errors handled
[ ] accessibility reviewed

TESTING

[ ] complete test suite passes
[ ] security regression suite passes
[ ] clean checkout builds
[ ] production build succeeds
[ ] final verification passes

DOCUMENTATION

[ ] README
[ ] SECURITY.md
[ ] SECURITY_GUIDE.md
[ ] USER_PRIVACY_GUIDE.md
[ ] DEVELOPMENT.md
[ ] DEPLOYMENT.md
[ ] OPERATIONS.md
[ ] INCIDENT_RESPONSE.md
[ ] RELEASE_CHECKLIST.md
[ ] RELEASE_NOTES.md
[ ] RELEASE_CANDIDATE_REPORT.md

REPOSITORY

[ ] no secrets
[ ] no debug bypasses
[ ] no temporary files
[ ] clean Git tree
[ ] Phase 10 commit created
[ ] RC tag created if appropriate

============================================================
FINAL PRINCIPLE
============================================================

PHASE 9 ASKED:

"CAN WE BREAK VEIL?"

PHASE 10 ASKS:

"CAN WE RESPONSIBLY HAND THIS BUILD TO AN EXTERNAL REVIEWER?"

Do not confuse passing tests with proof of security.

Do not confuse a polished UI with privacy.

Do not confuse encryption with anonymity.

Do not confuse a Release Candidate with a finished product.

The objective is not to make VEIL look secure.

The objective is to make the implementation, documentation,
deployment, and claims accurately reflect what VEIL actually provides.

============================================================
END OF PHASE 10
============================================================
```

## Your complete VEIL roadmap is now

![Image](https://images.openai.com/static-rsc-4/3eyvfYELLnV3msEzfGQRLXyMYKzxO8lORCPRprNjF-VZrjMnurHUrneidIRNO4OGshVjJfrZVFM5wC87j1-YlazzFYYvHgYslXbb-GHYqMLPPIp5ZSboFDkTKKdoxGrWCMSMyw6yIAcH0GrE_QdV3go-WZXi6DcyUndDh7eVzitUC2kqhp3Sh-Af90QFX04s?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/TvIGB6WXYnSvNNo3aDux7b2IkMpxXUDu1vooUg8Czoy-IuSiCrFUA9KF5IVTd0-ZdKtV4wPT3wkzT-NP_brwfnQAuKR0QSeNwHqzwkX8tktZt4iL4D6qygFFcUSiwPmpM7-xYfdD6G2DP_f_dNXpbuv6YyouYLHtOipI3mfAdn-WGsb4mxldIaNK1k7Q0fvq?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/mq_Ne-atEvS5wVluratAfpNb9JsUn-4AzCPhTJ1RAhDWuFm59FMCI7T9KcRlyojlmagjE9NBGEszQwt1021siynsIwTTEsZZDFvy53rzWsag4nf0l9N7t8lK6CcTZG1r9CBcj3yI6xs-hWY1OwQi2AArxO9yDul1deZeNdRe_zQkiIL8sgifPZSB7Dcr9NRg?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/zo3_6-8ch70qcojTstZxqfynIh17xqrOHowaQkqTOxs71BfQ00h3gSnG5UL-1wtYl81tLQMxD9jYy4ZxS2raEoNpKOB6zwAr5LXWa_X6CVhuSJItafDgxRODrglE0WQFrg2Q4ReMMhLCvy3ocsF87eKNDYfi1w6SosA166jCEKonwa45jeoUu9i8SNBphXD5?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/NjSRGNcDKycrY_7-Ns9_qvwE9ePSm3izxpkcdPnRMGUecJZed8U8kqcb9yDor6Ey35mUtUR6Ounqulbqu1Nh5JTqW6ECeQPlXY5_mRIxacl3KOpGOaFs1HpizPf8JKa8-1aDYdznayi6cI5kN6BOriMr6mOgmMMsLNknxDMueA11UxRDAZ9mP9gl84AWOV1M?purpose=fullsize)

| Phase  | Main objective                                       |
| ------ | ---------------------------------------------------- |
| **0**  | Foundation, architecture & AI handoff system         |
| **1**  | Cryptographic Spaces & credential-selected unlocking |
| **2**  | Independent Space identities                         |
| **3**  | Privacy-preserving transport                         |
| **4**  | E2EE 1-to-1 messaging + Double Ratchet               |
| **5**  | Groups + encrypted media                             |
| **6**  | Multi-device + recovery                              |
| **7**  | Privacy UX + panic lock                              |
| **8**  | Metadata minimization                                |
| **9**  | **Adversarial security audit / red team**            |
| **10** | **Release Candidate + production hardening**         |

### One architectural rule I'd add now

After Phase 10, **don't let the AI agent immediately start adding random features**.

Create a rule in `AGENTS.md` roughly equivalent to:

> **Post-RC Security Freeze:** Any feature that changes cryptographic protocols, identity, Space isolation, authentication, metadata behavior, recovery, device trust, or message/group protocols requires a new threat-model review and security regression suite before implementation.

That prevents the classic AI-development disaster: *"I added a convenient little feature" → accidentally destroys the security model → three agents later nobody remembers why the weird crypto code existed.*
