# VEIL — PHASE 17
# REAL-WORLD DEPLOYMENT, PRODUCTION INTEGRATION, SECURITY VALIDATION & RELEASE HARDENING

You are the implementation agent for VEIL.

You are NOT starting a new project.

You are continuing an existing privacy-first messaging application whose implementation has been completed through Phase 16.

============================================================
0. ABSOLUTE RULE — TAKE OVER THE EXISTING PROJECT
============================================================

Before writing ANY code:

1. Inspect the repository.
2. Read:
   - AGENTS.md
   - README.md
   - docs/SYSTEM_SUMMARY.md
   - docs/ARCHITECTURE.md
   - docs/THREAT_MODEL.md
   - docs/CRYPTOGRAPHY.md
   - docs/SECURITY.md
   - docs/PRIVACY.md
   - docs/KNOWN_LIMITATIONS.md
   - docs/STORAGE_ARCHITECTURE.md
   - docs/RELAY_PROTOCOL.md
   - docs/RELAY_ARCHITECTURE.md
   - docs/RELAY_SECURITY.md
   - docs/RELAY_PRIVACY.md
   - docs/NETWORK_ARCHITECTURE.md
   - docs/CLIENT_RELAY_INTEGRATION.md
   - docs/OFFLINE_DELIVERY.md
   - docs/NETWORK_SECURITY.md
   - docs/UI_ARCHITECTURE.md
   - docs/UX_SECURITY.md
   - docs/CONTACT_ARCHITECTURE.md
   - docs/INVITATION_PROTOCOL.md
   - docs/MESSAGE_LIFECYCLE.md
   - docs/ATTACHMENT_ARCHITECTURE.md
   - docs/DEVICE_LINKING.md
   - docs/DATABASE_ARCHITECTURE.md
   - docs/NOTIFICATION_PRIVACY.md
   - docs/PRODUCTION_CONFIGURATION.md
   - docs/PRODUCTION_DEPLOYMENT.md
   - docs/ai/PROJECT_CONTEXT.md
   - docs/ai/CURRENT_STATE.md
   - docs/ai/ACTIVE_TASK.md
   - docs/ai/HANDOFF.md
   - docs/ai/DECISIONS.md
   - docs/ai/SECURITY_RULES.md
   - docs/ai/CHANGELOG.md

2. Inspect the actual source tree.

3. Inspect package.json and package-lock.json.

4. Run the existing test suite BEFORE making changes.

5. Run the existing production build BEFORE making changes.

6. Inspect the latest Git commit and working tree.

7. Treat the ACTUAL repository state as the source of truth.

DO NOT assume the previous AI agent's completion report is necessarily correct.

If the report says 300 tests pass, independently verify it.

If implementation differs from documentation, investigate the discrepancy before changing anything.

============================================================
1. CURRENT VERIFIED PROJECT BASELINE
============================================================

The previous agent reports:

VEIL Phase 0–16 completed.

Latest reported commit:

3350e08

Reported state:

131 test files passed
300 tests passed
0 failures
0 skipped

Production build:

tsc && vite build

completed successfully.

Phase 16 reportedly added:

- Performance benchmarking
- Full system E2E orchestration
- Relay CLI
- Persistent relay storage
- Final system documentation
- Production configuration
- Self-hosting documentation

The existing architecture includes:

CRYPTO:
- Argon2id
- XChaCha20-Poly1305
- HKDF-SHA256
- Ed25519
- X25519
- Double Ratchet
- Group ratchet/state management
- Best-effort memory zeroization

SPACES:
- Multiple cryptographically isolated Spaces
- Credential-selected unlocking
- Decoy Spaces
- Independent Space Master Keys
- Independent storage keys
- Space switching isolation
- Panic Lock

STORAGE:
- IndexedDB
- EncryptedSpaceStore
- SpaceVaultManager
- schema migrations
- persistent encrypted records
- restart persistence

RELAY:
- Blind relay
- HTTP API
- WebSocket transport
- capability authentication
- TTL
- rate limiting
- bounded queues
- persistent file-backed relay storage
- relay CLI

NETWORK:
- HTTP transport
- WebSocket transport
- offline queue
- reconnect/backoff
- ACK-after-persistence
- duplicate suppression
- per-Space mailbox isolation

MESSAGING:
- 1-to-1 E2EE
- Double Ratchet
- groups
- epoch rotation
- encrypted attachments
- contact invitations
- safety-number verification

UI:
- React 19
- multi-Space interface
- lock screen
- conversations
- groups
- contacts
- attachments
- settings
- panic lock
- privacy controls

============================================================
2. PHASE 17 OBJECTIVE
============================================================

Phase 17 is NOT about adding random features.

Phase 17 exists to answer one question:

"Does VEIL actually work as a real application when deployed and used by independent users over a real network?"

The objective is to transition VEIL from:

"well-tested implementation"

to:

"real-world validated release candidate."

Phase 17 MUST focus on:

A. Real deployment
B. Independent client-to-client communication
C. Production relay integration
D. HTTPS/WSS deployment
E. Persistence validation
F. Browser restart/recovery
G. Security hardening
H. Failure testing
I. Performance validation under realistic conditions
J. Release packaging
K. Documentation
L. Reproducible self-hosting

============================================================
3. CRITICAL ARCHITECTURAL FREEZE
============================================================

DO NOT rewrite or replace:

src/crypto/
src/spaces/
src/ratchet/
src/group/
src/recovery/

unless a verified Phase 17 security defect requires a change.

Do NOT replace cryptographic primitives.

Do NOT invent custom cryptography.

Do NOT replace XChaCha20-Poly1305 with another primitive merely for convenience.

Do NOT replace Double Ratchet with another protocol.

Do NOT weaken Space isolation.

Do NOT store plaintext credentials or keys.

Do NOT introduce localStorage persistence for secrets.

Do NOT put passwords, private keys, SMKs, decrypted messages, or plaintext attachment contents into logs.

Do NOT disable TLS enforcement in production.

Do NOT add analytics, telemetry, trackers, advertising SDKs, or third-party data collection.

Do NOT introduce paid cloud services as a requirement.

VEIL must remain fully self-hostable and capable of being developed and tested with free/open-source tooling.

If a proposed change conflicts with an existing ADR:

STOP.

Explain the conflict.

Do not silently override the ADR.

============================================================
4. PHASE 17 WORKSTREAMS
============================================================

Implement Phase 17 in the following workstreams.

------------------------------------------------------------
WORKSTREAM A — PRODUCTION ENVIRONMENT VALIDATION
------------------------------------------------------------

Create a reproducible production environment.

Requirements:

1. Separate:
   - client
   - relay server

2. Relay must run as an independent process.

3. Client must be able to connect to a separately running relay.

4. Production configuration must be environment-driven.

5. No development-only defaults may accidentally activate in production.

6. Production mode MUST fail closed when:
   - TLS is unavailable
   - relay URL is invalid
   - required configuration is missing
   - unsupported protocol version is encountered

7. Validate:

RELAY_HOST
RELAY_PORT
RELAY_STORAGE_DIR

and all existing configuration values.

8. Add configuration validation before startup.

9. Produce actionable errors without leaking secrets.

------------------------------------------------------------
WORKSTREAM B — HTTPS / WSS PRODUCTION DEPLOYMENT
------------------------------------------------------------

The current relay intentionally supports HTTP/WS and expects TLS termination upstream.

Phase 17 must provide a reproducible secure deployment architecture.

Support a reverse proxy configuration such as:

Client
  |
 HTTPS/WSS
  |
Reverse Proxy
  |
HTTP/WS
  |
VEIL Relay

Provide production configuration examples for a free/self-hostable reverse proxy.

Preferred options may include:

- Caddy
- Nginx

Do NOT make either one a mandatory paid service.

Requirements:

- TLS 1.3 preferred
- HTTP -> HTTPS redirect
- WS -> WSS
- correct forwarding headers
- WebSocket upgrade support
- request body limits
- connection timeout
- idle timeout
- security headers where appropriate

Do NOT trust arbitrary forwarded headers.

Document the trust boundary.

Add deployment documentation.

------------------------------------------------------------
WORKSTREAM C — REAL TWO-CLIENT E2E TEST
------------------------------------------------------------

This is one of the most important parts of Phase 17.

Create a testable real deployment scenario:

CLIENT A
+
CLIENT B
+
REAL RELAY PROCESS

Not merely mocked classes.

The test should:

1. Start a real relay server process.
2. Start/connect Client A.
3. Start/connect Client B.
4. Create separate Spaces.
5. Exchange invitations.
6. Establish E2EE session.
7. Verify safety numbers.
8. Send message A -> B.
9. Verify B decrypts correctly.
10. Reply B -> A.
11. Verify A decrypts correctly.
12. Disconnect B.
13. Send A -> B while B is offline.
14. Verify relay queues message.
15. Restart B.
16. Verify B receives the message.
17. ACK only after persistence.
18. Verify relay removes acknowledged envelope.
19. Verify duplicate delivery does not create duplicate messages.
20. Verify attachment transfer.
21. Verify attachment integrity.
22. Verify Space isolation.

The test must use the actual protocol implementation.

Do not mock the cryptographic layer.

------------------------------------------------------------
WORKSTREAM D — APPLICATION RESTART VALIDATION
------------------------------------------------------------

Test actual restart behavior.

Simulate:

Client starts
↓
Space created
↓
Contact created
↓
Conversation created
↓
Messages exchanged
↓
Attachment received
↓
Client closes
↓
Client restarts
↓
Unlock Space
↓
Recover state

Verify:

- Spaces remain available
- envelopes remain intact
- messages remain available
- contacts remain available
- group state remains available
- ratchet state remains recoverable
- queued messages remain recoverable
- attachment metadata remains recoverable
- no plaintext secrets were persisted

Also test:

LOCK
↓
RESTART
↓
UNLOCK

and:

PANIC LOCK
↓
RESTART
↓
verify expected recovery behavior

------------------------------------------------------------
WORKSTREAM E — REAL FAILURE INJECTION
------------------------------------------------------------

Test failure scenarios that unit tests may not capture.

At minimum:

1. Relay unavailable.
2. Relay process crashes.
3. Network disconnect during send.
4. Network disconnect during receive.
5. WebSocket disconnect during message delivery.
6. HTTP timeout.
7. Duplicate envelope.
8. ACK lost.
9. ACK delayed.
10. Corrupted envelope.
11. Corrupted IndexedDB record.
12. Corrupted attachment chunk.
13. Browser refresh during send.
14. Application restart during queued delivery.
15. Relay storage file unavailable.
16. Relay storage directory permissions failure.
17. Disk full / quota exhaustion.
18. Unsupported protocol version.
19. Expired invitation.
20. Replayed invitation.
21. Revoked mailbox.
22. Locked Space attempting network access.
23. Space switch while network activity is active.
24. Panic lock during active transfer.

For each failure:

- fail safely
- do not leak plaintext
- do not corrupt cryptographic state
- do not silently lose acknowledged messages
- do not bypass authentication
- recover when possible
- surface safe user-facing state

------------------------------------------------------------
WORKSTREAM F — MULTI-SPACE ADVERSARIAL VALIDATION
------------------------------------------------------------

The defining feature of VEIL is multi-Space isolation.

Create an aggressive integration suite.

Create at least:

10 Spaces.

Each Space must have:

- unique password
- unique SMK
- unique StorageKey
- unique identity
- unique mailbox
- unique conversations
- unique local search index
- unique network queues

Attempt:

Space A -> Space B storage access
Space A -> Space B network queue
Space A -> Space B mailbox
Space A -> Space B search index
Space A -> Space B conversation
Space A -> Space B attachment
Space A -> Space B identity
Space A -> Space B notification state

Every unauthorized operation must fail.

Then:

LOCK A
SWITCH B

Verify no A plaintext remains accessible.

Then:

PANIC LOCK

Verify volatile application state is cleared.

------------------------------------------------------------
WORKSTREAM G — SECURITY AUDIT
------------------------------------------------------------

Perform a complete Phase 17 security audit.

Search the entire repository for:

console.log
console.error
console.warn
debugger
password
passphrase
secret
privateKey
masterKey
SMK
StorageKey

Do not blindly delete legitimate documentation/code references.

Determine whether any sensitive runtime values can reach:

- console
- localStorage
- sessionStorage
- IndexedDB unencrypted fields
- URLs
- query parameters
- DOM attributes
- browser history
- error reports
- notification content
- relay logs

Check for:

- accidental secret logging
- insecure randomness
- hardcoded credentials
- development secrets
- test credentials accidentally used in production
- HTTP production endpoints
- WS production endpoints
- overly permissive CORS
- unsafe forwarded headers
- path traversal
- relay storage path manipulation
- request smuggling risks
- oversized payload handling
- malformed JSON handling
- WebSocket abuse
- rate-limit bypass
- mailbox capability leakage
- replay handling
- invitation replay
- stale session use
- locked Space access
- cross-Space state contamination

Do not claim "secure" merely because tests pass.

Document residual risks.

------------------------------------------------------------
WORKSTREAM H — DEPENDENCY & SUPPLY-CHAIN AUDIT
------------------------------------------------------------

Inspect package.json.

Identify:

- production dependencies
- development dependencies
- unnecessary packages
- abandoned packages
- duplicated functionality
- suspicious packages
- unused packages

Run available package audit tooling.

Do NOT automatically upgrade every package.

For every security-related upgrade:

- inspect breaking changes
- run full tests
- run build
- verify crypto compatibility

Do not replace stable dependencies without reason.

Document dependency decisions.

------------------------------------------------------------
WORKSTREAM I — PERFORMANCE & RESOURCE VALIDATION
------------------------------------------------------------

Phase 16 established basic benchmarks.

Phase 17 must test realistic workloads.

Test:

1. 1,000 messages
2. 10,000 messages
3. 100 contacts
4. 1,000 contacts
5. 100 conversations
6. 10 Spaces
7. large attachment transfers
8. offline queue buildup
9. reconnect after long offline period

Measure:

- startup time
- unlock time
- message send latency
- message receive latency
- IndexedDB write latency
- IndexedDB read latency
- attachment encryption throughput
- attachment decryption throughput
- search latency
- memory growth
- queue drain rate
- relay throughput

Do NOT establish arbitrary performance requirements without measurement.

Record actual measurements.

Compare against Phase 16 baselines.

------------------------------------------------------------
WORKSTREAM J — BROWSER / CLIENT COMPATIBILITY
------------------------------------------------------------

Validate the application in realistic browsers.

At minimum document support expectations for:

- Chromium-based browsers
- Firefox
- Safari where technically possible

Verify:

- IndexedDB
- WebCrypto
- WebSocket
- file APIs
- Blob URLs
- clipboard
- notifications
- responsive UI

If a browser lacks a required capability:

FAIL CLEARLY.

Do not silently degrade security.

Document compatibility.

------------------------------------------------------------
WORKSTREAM K — MOBILE / RESPONSIVE UX VALIDATION
------------------------------------------------------------

VEIL must not only look good on desktop.

Validate:

- narrow mobile viewport
- tablet viewport
- desktop viewport

Check:

- lock screen
- sidebar
- conversation
- message composer
- attachment flow
- group details
- contacts
- settings
- panic lock
- Space switching

The UI must remain understandable to a first-time user.

Remember the original product requirement:

VEIL should be simpler and more attractive for a new user than confusing privacy-focused chat interfaces.

Do not sacrifice security for visual simplicity.

Add onboarding explanations where necessary.

------------------------------------------------------------
WORKSTREAM L — ACCESSIBILITY
------------------------------------------------------------

Perform accessibility validation.

Check:

- keyboard navigation
- focus management
- modal focus trapping
- Escape behavior
- screen-reader labels
- ARIA roles
- sufficient text contrast
- visible focus indicators
- button labels
- error announcements
- form validation
- attachment controls
- lock screen controls

Do not expose secrets through accessibility labels.

------------------------------------------------------------
WORKSTREAM M — RELEASE BUILD
------------------------------------------------------------

Create reproducible release commands.

At minimum:

npm test
npm run build
npm run relay

Add scripts only if they are actually useful.

Create:

- production client build
- relay server production build
- release artifact generation where appropriate

Do not bundle private development files into production artifacts.

Verify dist/ contents.

Verify relay packaging.

------------------------------------------------------------
WORKSTREAM N — SELF-HOSTING PACKAGE
------------------------------------------------------------

VEIL's server must remain self-hostable.

Create a simple deployment structure such as:

deployment/
├── README.md
├── Caddyfile.example
├── nginx/
│   └── veil.conf.example
├── systemd/
│   └── veil-relay.service.example
├── docker/
│   └── Dockerfile
└── .env.example

Only create Docker support if it actually works.

Do not make Docker mandatory.

Provide:

1. Local deployment.
2. Linux server deployment.
3. Reverse proxy deployment.
4. Relay storage configuration.
5. Backup considerations.
6. Update procedure.
7. Log management.
8. Shutdown/restart procedure.

Everything must be reproducible.

------------------------------------------------------------
WORKSTREAM O — BACKUP & RECOVERY VALIDATION
------------------------------------------------------------

Document exactly what can and cannot be backed up.

Separate:

CLIENT LOCAL DATA
RELAY DATA
IDENTITY KEYS
SPACE RECOVERY MATERIAL
MESSAGE HISTORY

Do not claim that backing up relay data automatically restores E2EE client state.

Test:

- client recovery
- Space recovery
- relay restart
- relay data backup/restore

Document the security implications.

------------------------------------------------------------
WORKSTREAM P — PRIVACY REVIEW
------------------------------------------------------------

Review the complete data lifecycle:

USER INPUT
↓
CLIENT MEMORY
↓
ENCRYPTION
↓
LOCAL STORAGE
↓
NETWORK
↓
RELAY
↓
NETWORK
↓
RECIPIENT
↓
DECRYPTION
↓
LOCAL STORAGE

For every stage document:

What data exists?
Who can see it?
How long does it exist?
Is it encrypted?
What metadata exists?

Pay particular attention to:

- IP addresses
- timestamps
- mailbox identifiers
- capability tokens
- message sizes
- attachment sizes
- connection timing
- relay logs
- browser metadata

Do not claim metadata anonymity that VEIL does not provide.

Clearly distinguish:

CONTENT PRIVACY

from

NETWORK ANONYMITY

from

METADATA PRIVACY.

------------------------------------------------------------
WORKSTREAM Q — FINAL SECURITY UX
------------------------------------------------------------

Review all user-facing security decisions.

The application should make the secure choice the easy choice.

Verify:

- neutral lock screen
- Space switching
- decoy Space behavior
- panic lock
- auto-lock
- safety number verification
- invitation verification
- device revocation
- notification privacy
- attachment handling

Avoid frightening users with unnecessary cryptographic terminology.

For example:

Instead of exposing:

"X25519 identity key mismatch"

prefer:

"Contact verification failed. The identity of this contact may have changed."

Provide technical details behind an advanced/details section where appropriate.

------------------------------------------------------------
5. NEW TEST SUITES
============================================================

Create tests where useful.

Recommended:

tests/phase17-production-config.test.ts
tests/phase17-real-relay-e2e.test.ts
tests/phase17-restart-recovery.test.ts
tests/phase17-failure-injection.test.ts
tests/phase17-multispace-adversarial.test.ts
tests/phase17-security-audit.test.ts
tests/phase17-dependency-audit.test.ts
tests/phase17-performance-realistic.test.ts
tests/phase17-privacy-regression.test.ts
tests/phase17-release-artifacts.test.ts

Do not create fake tests whose only purpose is to increase the test count.

Tests must verify meaningful behavior.

============================================================
6. SECURITY INVARIANTS
============================================================

The following MUST remain true:

1. No plaintext passwords persisted.
2. No plaintext private keys persisted.
3. No plaintext SMKs persisted.
4. No plaintext StorageKeys persisted.
5. No plaintext message bodies persisted outside authorized decrypted runtime state.
6. Relay never decrypts E2EE content.
7. Relay never receives client private keys.
8. Locked Spaces cannot access plaintext state.
9. Space A cannot access Space B state.
10. Panic Lock destroys volatile access to sensitive state.
11. Production networking requires TLS.
12. No custom cryptography.
13. No hardcoded secrets.
14. No credential logging.
15. No silent downgrade from secure transport.
16. No insecure fallback in production.
17. No third-party analytics/tracking.
18. No security claim may exceed demonstrated evidence.

============================================================
7. IMPORTANT — DO NOT OVERENGINEER
============================================================

Do not turn Phase 17 into another massive architecture rewrite.

Prefer:

EXISTING IMPLEMENTATION
+
REAL INTEGRATION
+
REAL DEPLOYMENT
+
REAL TESTING
+
HARDENING

over:

NEW ABSTRACTIONS
+
NEW CRYPTOGRAPHY
+
NEW PROTOCOL
+
UNNECESSARY REFACTOR

If something already works, leave it alone.

============================================================
8. FREE DEVELOPMENT / DEPLOYMENT REQUIREMENT
============================================================

The project must remain usable without paid infrastructure.

Do NOT require:

- paid cloud database
- paid relay hosting
- paid authentication provider
- paid monitoring
- paid CDN
- paid API
- proprietary analytics

Everything necessary for development and self-hosting must be reproducible with free/open-source tools.

Optional third-party services may be documented separately, but they must never be mandatory.

============================================================
9. DOCUMENTATION
============================================================

Create or update:

docs/PHASE17_PRODUCTION_VALIDATION.md
docs/DEPLOYMENT.md
docs/SELF_HOSTING.md
docs/SECURITY_AUDIT.md
docs/FAILURE_MODES.md
docs/COMPATIBILITY.md
docs/PERFORMANCE.md
docs/BACKUP_RECOVERY.md
docs/PRIVACY_DATA_FLOW.md
docs/RELEASE.md

Update:

docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/HANDOFF.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md

Add appropriate ADRs.

Do not fabricate successful deployment results.

Clearly distinguish:

VERIFIED
from
DOCUMENTED
from
NOT TESTED
from
KNOWN LIMITATION.

============================================================
10. AI AGENT CONTINUITY SYSTEM
============================================================

This is mandatory.

At the START:

Read:

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md

At the END:

Update all relevant AI continuity files.

ACTIVE_TASK.md must contain:

- current Phase 17 objective
- current workstream
- completed work
- remaining work
- current tests
- current build state
- known failures
- blockers

CURRENT_STATE.md must contain the verified repository state.

HANDOFF.md must contain enough information for another AI agent to continue without asking:

"What have we done?"

It must include:

- current phase
- current commit
- completed work
- remaining work
- files changed
- tests executed
- test counts
- build result
- known limitations
- exact next action

CHANGELOG.md must record Phase 17 changes.

============================================================
11. TAKEOVER PROTOCOL
============================================================

If you are a replacement AI agent:

DO NOT START IMPLEMENTING IMMEDIATELY.

First:

1. Read the AI continuity files.
2. Inspect git status.
3. Inspect recent commits.
4. Run tests.
5. Run build.
6. Determine the exact stopping point.
7. Continue from there.

Never assume the previous agent finished a task merely because ACTIVE_TASK says so.

Verify.

If the previous agent left uncommitted work:

Inspect it before modifying it.

============================================================
12. GIT DISCIPLINE
============================================================

Use atomic commits.

Recommended commits:

feat(phase17): production environment validation
feat(phase17): secure reverse proxy deployment
test(phase17): real relay integration
test(phase17): failure injection
test(phase17): multispace adversarial validation
security(phase17): production security hardening
docs(phase17): deployment and release documentation
chore(phase17): release packaging

Do not create one giant unexplained commit.

Before each commit:

npm test
npm run build

must pass unless explicitly documenting a known temporary failure.

Final working tree must be clean.

============================================================
13. FINAL VERIFICATION
============================================================

Before declaring Phase 17 complete:

Run:

npm test

npm run build

and every production validation script created during Phase 17.

Verify:

- real relay starts
- client builds
- client connects to relay
- HTTPS/WSS deployment works in the documented configuration
- two independent clients can communicate
- invitations work
- safety verification works
- E2EE works
- attachments work
- offline queue works
- restart recovery works
- Space isolation works
- panic lock works
- relay persistence works
- failure recovery works
- no sensitive logs appear
- production configuration fails closed
- release artifacts are reproducible

============================================================
14. FINAL ACCEPTANCE CRITERIA
============================================================

Phase 17 is complete ONLY if:

[ ] Existing Phase 0–16 tests still pass.

[ ] Phase 17 tests pass.

[ ] Production build passes.

[ ] Relay production process starts successfully.

[ ] Independent client connects to relay.

[ ] HTTPS/WSS deployment is documented and tested.

[ ] Two independent clients exchange real E2EE messages.

[ ] Offline delivery works.

[ ] Restart recovery works.

[ ] Attachments work across independent clients.

[ ] Invitations work across independent clients.

[ ] Safety-number verification works.

[ ] Multi-Space isolation survives realistic usage.

[ ] Panic Lock works during active application/network state.

[ ] Relay restart does not corrupt queued envelopes.

[ ] Corrupted data fails safely.

[ ] No plaintext secrets appear in persistent storage.

[ ] No plaintext secrets appear in logs.

[ ] Production configuration fails closed.

[ ] Dependency audit completed.

[ ] Security audit completed.

[ ] Browser compatibility documented.

[ ] Mobile/responsive UI validated.

[ ] Accessibility validated.

[ ] Self-hosting instructions work.

[ ] Backup/recovery behavior documented.

[ ] Release procedure documented.

[ ] Known limitations explicitly documented.

[ ] AI continuity files updated.

[ ] Git working tree clean.

============================================================
15. FINAL REPORT FORMAT
============================================================

When finished, report exactly:

# PHASE 17 COMPLETE

## 1. Real-World Validation

- Deployment:
- Relay:
- HTTPS/WSS:
- Independent clients:
- E2EE:
- Offline delivery:
- Restart recovery:
- Attachments:
- Invitations:
- Multi-Space isolation:

## 2. Security Validation

- Secret logging audit:
- Persistent storage audit:
- Network security:
- Relay blindness:
- Cross-Space isolation:
- Panic Lock:
- Dependency audit:
- Remaining risks:

## 3. Failure Testing

List every failure scenario tested and the result.

## 4. Performance

Report actual measured values.

Do NOT invent values.

## 5. Compatibility

List tested browsers/platforms and results.

## 6. Deployment

List:

- local deployment
- production deployment
- reverse proxy
- self-hosting
- relay configuration
- backup/recovery

## 7. Tests

Report:

- total test files
- total tests
- passed
- failed
- skipped

## 8. Build

Report exact build command and result.

## 9. Git

Report:

- commits
- final commit hash
- working tree status

## 10. Known Limitations

Be brutally honest.

Do not say "fully secure."

Do not say "anonymous" unless the specific anonymity property has actually been demonstrated.

Do not say "production ready" merely because automated tests pass.

============================================================
16. MOST IMPORTANT PRINCIPLE
============================================================

VEIL is a privacy-first messaging application.

Its strongest feature is not the number of tests.

Its strongest feature is that:

THE ARCHITECTURE, SECURITY MODEL, USER EXPERIENCE,
AND REAL-WORLD DEPLOYMENT ALL AGREE WITH EACH OTHER.

Do not optimize for impressive completion reports.

Optimize for discovering things that would actually break when a real person installs VEIL and uses it.

If something fails:

DO NOT HIDE IT.

Document it.

Fix it if it is within Phase 17 scope.

Otherwise record it as a known limitation and continue.

Begin Phase 17 now.