# VEIL — PHASE 16
# PRODUCTION DEPLOYMENT, ADVERSARIAL SECURITY AUDIT & REAL MULTI-CLIENT VALIDATION

You are continuing the existing VEIL project.

IMPORTANT:
Phases 0–15 are COMPLETE.

Current Phase 15 commit:
4a4372e

Current reported baseline:
- 295 tests
- 129 test files
- 0 failures
- 0 skipped
- production build succeeds
- working tree clean

DO NOT restart VEIL.
DO NOT rewrite the cryptographic architecture.
DO NOT replace working subsystems without evidence of a defect.

Phase 16 is NOT a feature-development phase.

Phase 16 exists to determine whether the existing implementation is genuinely deployable and resilient under realistic failure, concurrency, abuse, restart, and security conditions.

==================================================
1. FIRST: VERIFY THE BASELINE
==================================================

Before modifying anything:

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

docs/STORAGE_ARCHITECTURE.md
docs/DATABASE_ARCHITECTURE.md
docs/RELAY_PROTOCOL.md
docs/RELAY_ARCHITECTURE.md
docs/RELAY_SECURITY.md
docs/RELAY_PRIVACY.md
docs/NETWORK_ARCHITECTURE.md
docs/UI_ARCHITECTURE.md
docs/CONTACT_ARCHITECTURE.md
docs/INVITATION_PROTOCOL.md
docs/MESSAGE_LIFECYCLE.md
docs/ATTACHMENT_ARCHITECTURE.md
docs/DEVICE_LINKING.md
docs/NOTIFICATION_PRIVACY.md
docs/PRODUCTION_CONFIGURATION.md
docs/PRODUCTION_DEPLOYMENT.md

Read all files under:

docs/ai/

Then inspect the entire source tree.

Run:

npm test
npm run build

Record the REAL baseline.

Do not trust the previous agent's test count until independently verified.

==================================================
2. CRITICAL AUDIT RULE
==================================================

A passing test is evidence only of what that test actually exercises.

For every major security claim:

TRACE THE REAL CODE PATH.

Identify whether a feature is:

REAL
PARTIALLY IMPLEMENTED
SIMULATED
MOCKED
TEST-ONLY
UNUSED

Do not describe a simulated component as production-ready.

Search the repository for:

TODO
FIXME
MOCK
MOCKED
FAKE
SIMULATED
SIMULATOR
PLACEHOLDER
STUB
TEMP
console.log
debugger
throw new Error("not implemented")
any unsafe casts
disabled security checks

Investigate every relevant result.

==================================================
3. PHASE 16 OBJECTIVE
==================================================

Validate:

CLIENT
↓
CRYPTO
↓
LOCAL STORAGE
↓
NETWORK
↓
TLS
↓
RELAY
↓
PERSISTENT RELAY STORAGE
↓
NETWORK
↓
RECIPIENT STORAGE
↓
CRYPTO
↓
UI

under realistic operating conditions.

The objective is to discover weaknesses before beta release.

==================================================
4. REAL DEPLOYMENT ENVIRONMENT
==================================================

Create a completely local reproducible deployment environment.

Must work without paid infrastructure.

Provide:

docker-compose.yml

and/or equivalent scripts.

The deployment should contain at minimum:

VEIL Client
VEIL Relay
Persistent Relay Storage

If TLS requires a reverse proxy, provide a local production-like configuration.

Prefer:

Nginx / Caddy / equivalent open-source software.

Document:

docs/LOCAL_PRODUCTION_DEPLOYMENT.md

The environment must be reproducible from a clean checkout.

==================================================
5. TLS VALIDATION
==================================================

Verify:

HTTP client → rejected in production mode
HTTPS client → accepted
WS → rejected when insecure
WSS → accepted

Verify:

- certificate failure
- expired certificate
- hostname mismatch
- invalid certificate chain
- TLS downgrade attempt

No silent fallback.

No automatic HTTP downgrade.

Production configuration must fail closed.

==================================================
6. REAL MULTI-CLIENT TEST
==================================================

Build a realistic integration harness.

At minimum:

Alice Client
Bob Client
Charlie Client
Relay Server

Each client must have:

independent storage
independent identity
independent Space
independent network state

Test:

Alice → Bob
Bob → Alice
Alice → Charlie
Group Alice/Bob/Charlie

Then test simultaneous messages.

==================================================
7. CONCURRENT MESSAGE TESTING
==================================================

Test:

100 messages
1,000 messages
multiple conversations
multiple Spaces

Test:

simultaneous sends
simultaneous receives
duplicate envelopes
out-of-order envelopes
delayed envelopes
replayed envelopes

Verify:

no message loss
no duplicate visible messages
no cross-conversation leakage
no cross-Space leakage
correct message ordering semantics

Do not assume network arrival order equals message order.

==================================================
8. RELAY CRASH TESTING
==================================================

This is CRITICAL.

Test relay crashes:

- before enqueue
- during enqueue
- after enqueue
- before ACK
- during ACK
- after ACK
- during TTL sweep
- during persistent storage write

Restart the relay.

Verify:

- no corrupted database
- no unexpected message loss
- no unauthorized duplicate delivery
- queues recover
- expired messages remain expired
- ACK semantics remain correct

==================================================
9. FILE-BACKED RELAY STORE AUDIT
==================================================

Phase 15 introduced:

PersistentRelayStore

with atomic temporary-file rename operations.

This MUST now be aggressively tested.

Test:

concurrent writes
concurrent reads
read during write
process crash during write
partial temporary file
corrupted storage file
missing storage file
permission failure
disk full
invalid JSON/binary record
malformed mailbox record
duplicate record IDs
TTL cleanup during concurrent access

Determine whether the implementation is actually safe for the intended deployment model.

If it is not safe for multi-process concurrency:

DO NOT HIDE THE PROBLEM.

Either:

1. implement safe locking/concurrency control,
OR
2. explicitly document the supported process model and deployment restriction.

==================================================
10. RELAY PRIVACY AUDIT
==================================================

Inspect exactly what the relay can see.

Document:

IP address
connection time
mailbox identifier
capability hash
envelope size
timing
delivery state
TTL metadata

Verify relay NEVER receives:

plaintext messages
plaintext attachments
private keys
Space master keys
passwords
decrypted identities

Create:

docs/RELAY_VISIBLE_METADATA.md

Be honest about remaining metadata leakage.

Do not call the system "anonymous" if it only provides pseudonymous encrypted transport.

Use terminology such as:

privacy-preserving
metadata-minimized
blind relay

unless stronger anonymity has actually been implemented.

==================================================
11. SPACE ISOLATION ATTACK SUITE
==================================================

Attempt:

Space A → Space B data access
Space A → Space B contacts
Space A → Space B messages
Space A → Space B attachments
Space A → Space B search
Space A → Space B network queues
Space A → Space B mailbox capability
Space A → Space B identity
Space A → Space B group state

Test while:

locked
unlocked
switching
panic locking
restarting

Every attack must fail.

==================================================
12. PANIC LOCK AUDIT
==================================================

Stress Panic Lock during:

message composition
message encryption
attachment decryption
attachment upload
attachment download
network reconnect
group operation
search
contact import
device linking

Verify:

UI returns to neutral state
active Space session is destroyed
cryptographic session material is destroyed as far as runtime permits
decrypted message cache is removed
search index is destroyed
temporary attachment objects are revoked
network subscriptions are terminated
pending operations cannot expose plaintext

Document unavoidable JavaScript runtime limitations.

==================================================
13. AUTO-LOCK RACE CONDITIONS
==================================================

Test auto-lock while:

sending message
receiving message
encrypting attachment
decrypting attachment
switching conversation
switching Space
establishing contact
linking device

Verify no operation accidentally reactivates a locked Space.

==================================================
14. INVITATION SECURITY AUDIT
==================================================

Attack invitation system with:

expired invitation
future-dated invitation
tampered signature
wrong signer
wrong Space
replayed invitation
duplicate invitation
truncated payload
oversized payload
malformed encoding
Unicode corruption
clock skew

Verify every invalid invitation fails safely.

==================================================
15. DEVICE REVOCATION AUDIT
==================================================

Create:

Device A
Device B
Device C

Revoke B.

Then attempt:

message sync
new message
old queued message
new session
network reconnect
device re-registration

Device B must not silently regain authorization.

Test revocation after offline operation.

==================================================
16. GROUP SECURITY AUDIT
==================================================

Create:

Alice
Bob
Charlie

Remove Bob.

Then:

send message
send attachment
rotate epoch
restart clients
reconnect Bob
replay old group messages

Verify Bob cannot decrypt content protected by post-removal group state according to the existing group protocol.

Test stale epoch messages.

Test replay.

Test malformed group state.

==================================================
17. ATTACHMENT SECURITY AUDIT
==================================================

Test:

zero-byte file
1-byte file
large file
maximum allowed file
oversized file
corrupted chunk
missing chunk
duplicated chunk
reordered chunks
tampered ciphertext
tampered authentication tag
wrong attachment key
interrupted upload
interrupted download
resume after restart

Verify:

relay only sees encrypted chunks
plaintext never enters relay storage
failed transfers are cleaned up
temporary decrypted Blob URLs are revoked
Space lock destroys active attachment state.

==================================================
18. STORAGE CORRUPTION TESTING
==================================================

CLIENT:

Corrupt:

Space envelope
encrypted record
message
attachment
queue
contact
invitation
metadata

Verify safe failure.

RELAY:

Corrupt:

mailbox
envelope record
TTL metadata
persistent store file

Verify:

no silent authentication bypass
no plaintext leakage
no process crash where recoverable
clear recovery behavior

==================================================
19. RESOURCE EXHAUSTION
==================================================

Test:

maximum mailbox capacity
maximum message size
maximum attachment size
large number of Spaces
large number of contacts
large number of groups
large number of queued messages
large number of WebSocket connections

Verify bounded behavior.

The application must not accept unlimited attacker-controlled memory growth.

==================================================
20. RATE LIMITING AUDIT
==================================================

Test:

HTTP flooding
WebSocket flooding
mailbox creation flooding
envelope flooding
ACK flooding
malformed request flooding
connection churn

Verify rate limits are actually enforced.

Document whether limits are:

per IP
per capability
per mailbox
per connection
global

Do not claim DDoS protection beyond what the implementation provides.

==================================================
21. SECURITY LOGGING AUDIT
==================================================

Capture:

client logs
relay logs
error logs
startup logs
shutdown logs

Search for:

passwords
private keys
master keys
plaintext messages
plaintext attachment metadata
session secrets
capabilities

Use automated secret-pattern tests where possible.

==================================================
22. BROWSER STORAGE AUDIT
==================================================

Inspect IndexedDB and other browser persistence.

Verify:

NO plaintext password
NO plaintext private key
NO plaintext master key
NO plaintext message body
NO plaintext attachment
NO sensitive URL state
NO accidental localStorage secrets

Document legitimate metadata that remains.

==================================================
23. BACKUP & RECOVERY TEST
==================================================

Test the existing recovery system end-to-end.

Scenario:

Create Space
Create identity
Create contacts
Create conversation
Create group
Create messages
Create recovery backup

Destroy local state.

Restore.

Verify:

Space unlock
identity recovery
contact recovery
conversation recovery
group recovery

Do NOT claim recovery of data that the backup format does not actually contain.

Document exact recovery guarantees.

==================================================
24. BROWSER RESTART MATRIX
==================================================

Test:

normal reload
tab close
browser restart
crash simulation
offline restart
relay unavailable restart
Space locked restart
Space unlocked restart

Verify correct state restoration.

==================================================
25. MOBILE / RESPONSIVE VALIDATION
==================================================

Test UI at:

320px
375px
390px
430px
768px
1024px
1440px

Verify:

navigation
chat composer
modals
attachments
groups
settings
Panic Lock
keyboard navigation

No security-sensitive control should become inaccessible on small screens.

==================================================
26. ACCESSIBILITY VALIDATION
==================================================

Test:

keyboard-only navigation
focus trapping
screen reader semantics
modal escape behavior
reduced motion
ARIA labels
form errors

Security-critical actions must remain accessible.

==================================================
27. PERFORMANCE BASELINE
==================================================

Measure:

application startup
Space unlock
message encryption
message decryption
attachment encryption
attachment decryption
search
IndexedDB writes
relay enqueue
relay fetch

Record reasonable baseline measurements.

Do NOT optimize cryptography by weakening security parameters.

==================================================
28. SECURITY DOCUMENTATION
==================================================

Create:

docs/SECURITY_AUDIT_PHASE16.md
docs/DEPLOYMENT_SECURITY.md
docs/RELAY_VISIBLE_METADATA.md
docs/FAILURE_RECOVERY.md
docs/PERFORMANCE_BASELINE.md

Document:

finding
severity
affected component
reproduction
fix
verification

Severity:

CRITICAL
HIGH
MEDIUM
LOW
INFORMATIONAL

Do not suppress findings.

==================================================
29. DEPENDENCY AUDIT
==================================================

Inspect package-lock.json.

Check:

unused dependencies
duplicate dependencies
outdated security-sensitive dependencies
unexpected transitive dependencies

Do not blindly upgrade crypto libraries.

Any dependency upgrade must be tested against the full suite.

==================================================
30. DEFINITION OF DONE
==================================================

Phase 16 is COMPLETE only when:

[ ] Baseline independently verified
[ ] Local production deployment reproducible
[ ] TLS fail-closed verified
[ ] Multi-client E2E verified
[ ] Concurrent messaging verified
[ ] Relay crash recovery verified
[ ] PersistentRelayStore audited
[ ] Client storage audited
[ ] Space isolation attack suite passes
[ ] Panic Lock stress tested
[ ] Auto-lock race tests pass
[ ] Invitation security tested
[ ] Device revocation tested
[ ] Group removal tested
[ ] Attachment adversarial tests pass
[ ] Resource exhaustion bounded
[ ] Rate limiting verified
[ ] Logs audited
[ ] Recovery flow verified
[ ] Browser restart matrix verified
[ ] Responsive UI verified
[ ] Accessibility verified
[ ] Performance baseline documented
[ ] Security findings documented
[ ] Known limitations updated
[ ] AI continuity files updated
[ ] All tests pass
[ ] Production build passes
[ ] Git working tree clean
[ ] Atomic Phase 16 commit created

==================================================
31. ABSOLUTE RULE
==================================================

Do NOT claim VEIL is:

"anonymous"
"untraceable"
"perfectly secure"
"military grade"

unless the implementation and threat model actually justify those claims.

The correct goal is:

A privacy-preserving,
end-to-end encrypted,
multi-space,
self-hostable messaging application
with a blind relay and explicit security boundaries.

==================================================
32. FINAL HANDOFF
==================================================

At completion provide:

1. Actual test count
2. Test files
3. Build result
4. Deployment result
5. Security findings
6. Findings fixed
7. Findings deferred
8. Persistent relay result
9. Multi-client result
10. Recovery result
11. Performance baseline
12. Known limitations
13. Commit hash
14. Working-tree status

Update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md

Do not fabricate results.

If something fails:

REPORT IT.

Fix it if safely possible.

If not safely fixable:

DOCUMENT IT.

Never weaken a security boundary simply to make Phase 16 pass.