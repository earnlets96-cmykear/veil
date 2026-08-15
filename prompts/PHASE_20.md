# IMPLEMENTATION PLAN — VEIL PHASE 20
# Live Production Deployment, Android Client & Cross-Platform Real-Device Validation

You are continuing development of VEIL after completion of Phases 0–19.

VEIL is currently at:

- Version: v1.0.0 GA
- Release tag: v1.0.0
- Phase 19 commit: ce9ee35
- 152 test files
- 334 automated tests
- 0 failures
- 0 skipped
- Production web build succeeds
- Release integrity manifests/checksums exist
- Persistent encrypted IndexedDB storage exists
- Blind persistent relay exists
- HTTP/WebSocket networking exists
- Double Ratchet E2EE exists
- Group messaging exists
- Contacts/invitations exist
- Encrypted attachments exist
- Privacy-preserving notifications exist
- Multi-Space isolation exists
- React 19 UI exists
- Production deployment configurations exist

PHASE 20 IS NOT A CRYPTOGRAPHIC REDESIGN.

The objective is to take the existing v1.0.0 system and make it genuinely usable in the real world:

1. Deploy the relay server to a real reachable server.
2. Host the production web client.
3. Create a proper Android client/application.
4. Make Android and Web interoperable through the existing VEIL protocol.
5. Produce an installable Android APK.
6. Perform real-device end-to-end messaging tests.
7. Validate offline/restart/background behavior.
8. Validate multi-Space security on real devices.
9. Document the complete deployment and testing process.
10. Do NOT declare Phase 20 complete merely because automated unit tests pass.

============================================================
1. ABSOLUTE ARCHITECTURAL INVARIANTS
============================================================

The following are FROZEN unless a concrete incompatibility is discovered and documented:

- src/crypto/
- src/spaces/
- src/ratchet/
- src/group/
- src/recovery/
- src/network/ protocol semantics
- src/server/ relay protocol
- Space isolation model
- E2EE envelope format
- Identity model
- Double Ratchet state machine
- Group ratchet/state machine
- Invitation protocol
- Attachment encryption format
- Storage encryption model

DO NOT:
- invent new cryptographic primitives
- replace XChaCha20-Poly1305
- replace Argon2id
- replace HKDF-SHA256
- weaken authentication
- disable TLS in production
- store plaintext keys for convenience
- create a second incompatible messaging protocol
- create an Android-only cryptographic implementation that behaves differently from Web
- silently alter the relay protocol merely to make Android easier

If Android requires platform-specific adaptation, create a clean adapter around the existing protocol.

The VEIL protocol remains the source of truth.

============================================================
2. FIRST TASK — REPOSITORY AUDIT
============================================================

Before writing code:

Inspect the complete repository.

Read:

- README.md
- docs/SYSTEM_SUMMARY.md
- docs/RELEASE_V1.0.0.md
- docs/GA_RELEASE_CHECKLIST.md
- docs/SECURITY_CLAIMS.md
- docs/NETWORK_ARCHITECTURE.md
- docs/CLIENT_RELAY_INTEGRATION.md
- docs/OFFLINE_DELIVERY.md
- docs/DEPLOYMENT.md
- docs/SELF_HOSTING.md
- docs/PRODUCTION_DEPLOYMENT.md
- docs/BACKUP_RECOVERY.md
- docs/DEVICE_LINKING.md
- docs/CONTACT_ARCHITECTURE.md
- docs/ATTACHMENT_ARCHITECTURE.md
- docs/PRIVACY_DATA_FLOW.md
- docs/ai/CURRENT_STATE.md
- docs/ai/ACTIVE_TASK.md
- docs/ai/DECISIONS.md
- docs/ai/HANDOFF.md

Inspect:

- package.json
- package-lock.json
- tsconfig.json
- Vite configuration
- existing network implementation
- existing relay implementation
- existing storage implementation
- existing React application
- existing build scripts
- existing deployment directory
- existing tests
- existing release scripts

Determine the actual current architecture.

DO NOT assume files exist merely because an earlier plan said they should exist.

Use repository state as ground truth.

Before modifying anything, produce an internal implementation inventory:

WEB:
- entrypoint
- build command
- output directory
- runtime configuration
- relay URL configuration

RELAY:
- entrypoint
- storage backend
- configuration
- HTTP endpoints
- WebSocket endpoint
- TLS assumptions

CRYPTO:
- key lifecycle
- protocol boundaries
- browser APIs used

STORAGE:
- IndexedDB schema
- encrypted record format
- persistence behavior

NETWORK:
- HTTP transport
- WebSocket transport
- queues
- ACK semantics
- reconnect semantics

UI:
- React entrypoint
- routing/state
- Space lifecycle
- notifications
- attachments

Then identify the safest Android integration architecture.

============================================================
3. ANDROID ARCHITECTURE DECISION
============================================================

Evaluate the existing codebase before choosing the Android technology.

Preferred goal:

MAXIMUM reuse of existing VEIL TypeScript protocol/network/application logic while providing real Android platform integration.

Possible architecture may include:

- Capacitor
- React Native
- another appropriate cross-platform architecture

Do NOT blindly choose one.

Evaluate:

- compatibility with existing React/TypeScript code
- cryptographic API compatibility
- WebSocket support
- secure persistent storage
- Android lifecycle
- background behavior
- notifications
- file/media access
- app startup
- offline operation
- APK generation
- long-term maintainability

If a hybrid architecture can safely reuse the existing application without becoming merely an insecure WebView wrapper, prefer it.

If native Android integration is required, isolate platform-specific code behind interfaces.

Create a documented decision:

docs/ANDROID_ARCHITECTURE.md

Include:

- chosen framework
- rationale
- shared code
- Android-only code
- storage adapter
- network adapter
- notification adapter
- lifecycle handling
- attachment handling
- security implications
- rejected alternatives

============================================================
4. ANDROID PROJECT
============================================================

Create a proper Android application.

Required:

- package/application identifier
- app name: VEIL
- launcher icon placeholder if necessary
- Android manifest
- release/debug build configurations
- minimum supported Android version based on actual dependency compatibility
- target SDK current appropriate version
- INTERNET permission
- secure network configuration
- notification permissions where required
- file/media permissions only where actually necessary

Do not request unnecessary permissions.

The application must launch into the real VEIL UI/application layer rather than a fake demonstration screen.

Required Android screens/workflows:

1. Lock Screen
2. Space selection
3. Create Space
4. Main conversation list
5. Direct conversation
6. Group conversation
7. Contacts
8. New Chat
9. New Group
10. Settings
11. Device management
12. Recovery
13. Attachment selection
14. Notification settings
15. Panic Lock

Reuse existing UI/application logic where safe.

============================================================
5. ANDROID STORAGE
============================================================

The browser uses IndexedDB.

Android must have an equivalent persistent storage adapter.

Do NOT store:

- passwords
- plaintext messages
- plaintext private keys
- plaintext Space Master Keys
- plaintext Storage Keys
- plaintext ratchet state

in ordinary unencrypted persistent storage.

Implement:

AndroidStorageAdapter

or equivalent platform adapter.

It must satisfy the existing storage abstraction.

Required behavior:

- encrypted Space envelopes
- encrypted application records
- encrypted queues
- encrypted ratchet state
- encrypted attachment metadata where applicable
- schema versioning
- migration support
- atomic writes where possible
- crash-safe recovery
- locked-space access rejection
- Space partition isolation

If Android secure storage is needed for small secrets, use the platform secure storage mechanism through a narrow adapter.

Document exactly what is stored where.

Create:

docs/ANDROID_STORAGE.md

============================================================
6. ANDROID NETWORKING
============================================================

Reuse the existing VEIL relay protocol.

Android must support:

- HTTPS
- WSS
- relay health checks
- mailbox creation
- envelope send
- envelope fetch
- envelope ACK
- WebSocket push
- heartbeat
- reconnect
- exponential backoff
- offline queueing
- duplicate suppression
- ACK-after-persistence

Production TLS MUST fail closed.

Never add:

- HTTP fallback
- ws:// fallback
- certificate verification bypass
- "accept all certificates"
- debug trust managers in release builds

Create a platform-independent network adapter if necessary.

Required configuration:

VEIL_RELAY_URL

Example:

https://relay.example.com

and:

wss://relay.example.com/v1/ws

Do not hard-code a private development server into production code.

============================================================
7. ANDROID APP LIFECYCLE
============================================================

This is critical.

Mobile applications are frequently:

- backgrounded
- suspended
- killed
- restarted
- disconnected
- moved between Wi-Fi and mobile data

Implement safe lifecycle handling.

When backgrounded:

- do not leave unnecessary plaintext UI state exposed
- preserve encrypted persistent state
- maintain appropriate connection behavior
- obey Android background execution rules

When the process is killed:

- persistent encrypted state must survive
- volatile keys must not be assumed to survive
- application must be capable of restoring state after unlock

When returning to foreground:

- reconnect
- reconcile queues
- fetch pending envelopes
- restore UI state only after the Space is unlocked

Test:

foreground → background → foreground

and:

foreground → force-stop → restart

============================================================
8. ANDROID NOTIFICATIONS
============================================================

Integrate with the existing notification privacy architecture.

Required modes:

- HIDDEN
- SENDER_ONLY
- FULL_OBFUSCATED

When Space is locked:

DO NOT expose:

- message body
- sensitive sender information
- plaintext preview

Respect Android notification permission requirements.

Do not put cryptographic secrets into notification extras.

Test:

- message while unlocked
- message while locked
- HIDDEN mode
- SENDER_ONLY mode
- FULL_OBFUSCATED mode
- notification tap
- notification after app restart

============================================================
9. ATTACHMENTS
============================================================

Integrate the existing encrypted attachment pipeline.

Android must support:

- image selection
- document selection
- encryption before relay transmission
- 64 KiB chunking
- authenticated encryption
- integrity validation
- download
- decryption only when authorized
- temporary file handling
- cleanup

Do not upload plaintext attachments to the relay.

Test:

Android → Web image

Web → Android image

Android → Android document

Corrupted attachment

Interrupted transfer

Resume/retry behavior if supported by the existing protocol

============================================================
10. CONTACTS & INVITATIONS
============================================================

Android must support existing:

veil://invite/...

invitation format.

Required:

- generate invitation
- display/share invitation
- receive invitation
- parse invitation
- verify signature
- reject expired invitation
- reject replay
- create contact
- verify safety number

Use Android share mechanisms where appropriate.

Do not leak private identity material through sharing intents.

============================================================
11. MULTI-SPACE SUPPORT
============================================================

Android must support multiple independent Spaces.

Test at minimum:

- Main Space
- Private Space
- Decoy Space

Each must have:

- independent SMK
- independent StorageKey
- independent identity
- independent mailbox
- independent queues
- independent conversation state

When switching Spaces:

1. wipe active UI message data
2. destroy old session state
3. stop old network subscriptions
4. clear volatile search state
5. revoke temporary attachment URLs/files
6. load new Space
7. unlock it
8. reconnect its mailbox

Never allow:

Space A → Space B data leakage.

============================================================
12. REAL RELAY DEPLOYMENT
============================================================

Now move beyond localhost.

The Phase 20 agent must support deployment of the existing relay to a real server.

Deployment must include:

- Linux server
- Node.js runtime
- persistent relay storage
- environment configuration
- firewall
- reverse proxy
- TLS
- WebSocket forwarding
- automatic restart
- log rotation
- backup strategy

Use existing deployment artifacts where possible.

Preferred reverse proxy:

Caddy OR Nginx

Do not create a competing deployment architecture unless necessary.

Production topology:

Internet
   |
   v
HTTPS/WSS
   |
Reverse Proxy
   |
VEIL Relay
   |
Persistent Relay Store

Document:

docs/LIVE_DEPLOYMENT.md

Include:

- server requirements
- DNS
- TLS
- relay configuration
- environment variables
- startup
- shutdown
- health checks
- WebSocket verification
- storage directory
- backup
- restore
- troubleshooting

============================================================
13. PRODUCTION WEB CLIENT
============================================================

Build the web client using the existing release system.

Requirements:

npm run build

must succeed.

Production configuration must point to the deployed relay.

The web client must be hosted through HTTPS.

Do not deploy the development Vite server as the production service.

Validate:

Desktop Chrome
Desktop Edge
Android Chrome

where practical.

============================================================
14. REAL DEVICE TEST MATRIX
============================================================

This is the most important part of Phase 20.

Automated tests alone DO NOT satisfy Phase 20.

Perform actual device testing.

Minimum matrix:

DEVICE A:
Desktop browser

DEVICE B:
Android phone

Then:

DEVICE A:
Android phone

DEVICE B:
Android phone

Then:

DEVICE A:
Android phone

DEVICE B:
Desktop browser

Required tests:

A. Web → Android
B. Android → Web
C. Android → Android
D. Direct messages
E. Group messages
F. Attachments
G. Invitation onboarding
H. Safety number verification
I. Offline delivery
J. Restart recovery
K. Multi-Space switching
L. Panic Lock
M. Notifications
N. WebSocket reconnect
O. Mobile data
P. Wi-Fi
Q. App backgrounding
R. App force-stop
S. Relay restart

============================================================
15. REAL-WORLD E2E TEST
============================================================

Perform this exact scenario.

CLIENT A:
Android phone

CLIENT B:
Desktop browser

STEP 1:
Install/open VEIL.

STEP 2:
Create:

Personal Main

STEP 3:
Create second Space:

Private

STEP 4:
Configure relay.

STEP 5:
Generate invitation from A.

STEP 6:
Transfer invitation to B.

STEP 7:
Accept invitation.

STEP 8:
Verify safety number.

STEP 9:
Send:

"Hello from Android."

STEP 10:
Verify B receives and decrypts it.

STEP 11:
B replies:

"Hello from desktop."

STEP 12:
Verify Android decrypts it.

STEP 13:
Send image from Android.

STEP 14:
Verify desktop decrypts and displays image.

STEP 15:
Close/kill Android app.

STEP 16:
Send another message from B.

STEP 17:
Restart Android.

STEP 18:
Unlock Space.

STEP 19:
Verify queued message arrives.

STEP 20:
Switch to Private Space.

STEP 21:
Verify Personal Main messages are inaccessible.

STEP 22:
Switch back.

STEP 23:
Verify Personal Main messages return after correct unlock.

STEP 24:
Trigger Panic Lock.

STEP 25:
Verify neutral lock screen.

STEP 26:
Verify sensitive UI state is gone.

STEP 27:
Unlock again.

STEP 28:
Verify encrypted persistent state remains recoverable.

This is a REAL acceptance test.

============================================================
16. REAL NETWORK FAILURE TESTING
============================================================

Test:

- relay offline
- Wi-Fi disconnected
- mobile data disconnected
- Wi-Fi → mobile transition
- mobile → Wi-Fi transition
- relay restart
- WebSocket disconnect
- temporary DNS failure
- HTTP timeout
- malformed relay response

Expected:

- no plaintext loss
- encrypted outbound queue survives
- no duplicate messages after reconciliation
- no permanent deadlock
- reconnect occurs
- ACK semantics remain correct

============================================================
17. ANDROID SECURITY HARDENING
============================================================

Release Android builds must:

- disable debug mode
- disable developer logging
- avoid plaintext logging
- reject non-TLS relay URLs
- use certificate validation
- avoid exported components unless required
- minimize permissions
- prevent accidental backup of sensitive plaintext data
- configure appropriate Android backup behavior
- clear temporary decrypted attachment files
- avoid sensitive data in intents
- avoid sensitive data in screenshots where practical
- avoid sensitive data in crash reports

Inspect AndroidManifest.xml carefully.

Search the final APK/bundle for:

- passwords
- private keys
- master keys
- test credentials
- relay development URLs
- API secrets
- debug tokens

============================================================
18. RELEASE APK
============================================================

Produce:

1. Debug APK for development testing.
2. Release APK for real-device testing.

Configure release signing appropriately.

DO NOT commit signing private keys.

Provide:

- APK path
- version
- package identifier
- SHA-256 checksum
- build timestamp
- build instructions

Create:

docs/ANDROID_RELEASE.md

============================================================
19. AUTOMATED TESTING
============================================================

Add tests only where they provide real value.

Required categories:

### Android Adapter Tests

- storage
- network
- notifications
- attachment handling
- lifecycle

### Cross-Platform Protocol Tests

Verify identical protocol behavior between:

- Web
- Android

### Integration Tests

- invitation
- direct messaging
- group messaging
- attachments
- offline queue
- restart
- multi-space

### Security Tests

- TLS fail closed
- no plaintext storage
- no secrets in bundle
- locked-space rejection
- Space isolation

DO NOT inflate the test count with meaningless tests.

Quality > test count.

============================================================
20. LIVE SMOKE TEST TOOLING
============================================================

Create scripts/tools where appropriate for:

- relay health check
- WebSocket connectivity check
- production configuration validation
- release APK checksum
- web production configuration validation

Possible scripts:

scripts/live-health-check.mjs
scripts/live-e2e-check.mjs
scripts/android-release-check.mjs

These must never contain production secrets.

============================================================
21. OBSERVABILITY WITHOUT TELEMETRY
============================================================

VEIL's privacy model must remain intact.

Do NOT introduce:

- Google Analytics
- Firebase Analytics
- Sentry telemetry
- third-party tracking
- message-content telemetry
- identity tracking

Operational server logs may contain only minimum necessary information.

Never log:

- passwords
- plaintext messages
- plaintext attachment content
- private keys
- Space Master Keys
- Storage Keys
- ratchet secrets
- invitation private material

Document the operational logging model.

============================================================
22. DOCUMENTATION
============================================================

Create/update:

docs/ANDROID_ARCHITECTURE.md
docs/ANDROID_STORAGE.md
docs/ANDROID_NETWORKING.md
docs/ANDROID_LIFECYCLE.md
docs/LIVE_DEPLOYMENT.md
docs/REAL_DEVICE_TESTING.md
docs/ANDROID_RELEASE.md
docs/CROSS_PLATFORM_COMPATIBILITY.md
docs/PHASE20_VALIDATION.md

Update:

docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/CHANGELOG.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md

Add appropriate ADRs for:

- Android architecture
- Android storage
- lifecycle strategy
- release signing
- live deployment

============================================================
23. VERSIONING
============================================================

DO NOT automatically change v1.0.0 into v1.1.0 merely because Phase 20 exists.

Phase 20 is primarily deployment/integration validation.

If source changes are required after GA, use an appropriate pre-release/build identifier until the live validation is complete.

Do not overwrite the existing v1.0.0 release artifacts.

============================================================
24. DEFINITION OF DONE
============================================================

Phase 20 is COMPLETE only when ALL of the following are true.

BUILD:

[ ] Web production build succeeds.

[ ] Android debug build succeeds.

[ ] Android release build succeeds.

[ ] Existing regression suite passes.

[ ] New Phase 20 tests pass.

RELAY:

[ ] Relay deployed to real server.

[ ] Persistent storage configured.

[ ] HTTPS works.

[ ] WSS works.

[ ] Health endpoint works.

[ ] WebSocket connection verified externally.

WEB:

[ ] Production web client is publicly reachable.

[ ] Production client connects to real relay.

ANDROID:

[ ] APK installs on real Android device.

[ ] App starts correctly.

[ ] Space creation works.

[ ] Space unlocking works.

[ ] Persistent storage works.

[ ] Notifications work.

[ ] Attachments work.

[ ] Offline queue works.

[ ] Restart recovery works.

[ ] Panic Lock works.

[ ] Multi-Space isolation works.

CROSS-PLATFORM:

[ ] Android → Web message works.

[ ] Web → Android message works.

[ ] Android → Android message works.

[ ] Group messaging works.

[ ] Attachment Android → Web works.

[ ] Attachment Web → Android works.

[ ] Invitation onboarding works.

[ ] Safety number verification works.

REAL NETWORK:

[ ] Wi-Fi test passed.

[ ] Mobile data test passed.

[ ] Offline test passed.

[ ] WebSocket reconnect passed.

[ ] Relay restart recovery passed.

SECURITY:

[ ] No plaintext secrets in Android APK.

[ ] No plaintext secrets in web bundle.

[ ] No plaintext messages in relay storage.

[ ] No sensitive production logs.

[ ] Production TLS fail-closed.

[ ] No certificate verification bypass.

[ ] No third-party telemetry.

RELEASE:

[ ] Release APK checksum generated.

[ ] Release web bundle generated.

[ ] Deployment documentation complete.

[ ] Android installation documentation complete.

[ ] Real-device test report complete.

[ ] Working tree clean.

[ ] Git commit created.

============================================================
25. FINAL REPORT FORMAT
============================================================

At completion, produce:

# PHASE 20 COMPLETE

## 1. Android Architecture

- framework
- package ID
- minimum Android version
- shared code
- platform-specific code

## 2. Live Infrastructure

- relay deployment status
- HTTPS status
- WSS status
- persistence status

DO NOT expose private credentials.

## 3. Web Deployment

- build status
- hosting status
- relay connectivity

## 4. Android Build

- debug APK
- release APK
- SHA-256 checksum
- version

## 5. Cross-Platform Verification

| Test | Result |
|---|---|
| Android → Web | PASS/FAIL |
| Web → Android | PASS/FAIL |
| Android → Android | PASS/FAIL |
| Direct E2EE | PASS/FAIL |
| Group E2EE | PASS/FAIL |
| Attachments | PASS/FAIL |
| Invitations | PASS/FAIL |
| Offline delivery | PASS/FAIL |
| Restart recovery | PASS/FAIL |
| Multi-Space | PASS/FAIL |
| Panic Lock | PASS/FAIL |
| Notifications | PASS/FAIL |

## 6. Real Network Verification

| Scenario | Result |
|---|---|
| Wi-Fi | PASS/FAIL |
| Mobile data | PASS/FAIL |
| Offline | PASS/FAIL |
| Relay restart | PASS/FAIL |
| WebSocket reconnect | PASS/FAIL |
| App force-stop | PASS/FAIL |

## 7. Security Verification

Report:

- APK secret scan
- Web bundle secret scan
- plaintext storage scan
- production TLS verification
- logging audit
- permission audit
- backup/privacy audit

## 8. Automated Tests

Report:

- baseline tests
- new tests
- total tests
- failures
- skipped tests

## 9. Known Limitations

Be honest.

Do NOT claim:

- "military-grade"
- "unbreakable"
- "formally proven secure"
- "independently audited"

unless independently verified evidence actually exists.

Distinguish:

- automated verification
- internal security testing
- real-device testing
- external audit

## 10. Release Artifacts

List:

- APK
- checksums
- web build
- relay deployment configuration
- documentation

## 11. Git

Report:

- commit hash
- working tree status

============================================================
CRITICAL FINAL INSTRUCTION
============================================================

DO NOT FAKE LIVE VALIDATION.

If you cannot access:

- a real Android build environment
- a real Android device/emulator
- a public server
- a public DNS name
- a real HTTPS/WSS endpoint

then DO NOT mark those items as PASS.

Instead report:

BLOCKED — requires real environment

and provide exact commands/instructions for completing the blocked validation manually.

The purpose of Phase 20 is to bridge the gap between:

"VEIL passes automated tests"

and:

"I installed VEIL on two real devices and actually exchanged encrypted messages through a real deployed relay."

Do not confuse those two achievements.

Do not modify the frozen cryptographic architecture simply to make the deployment easier.

Preserve the v1.0.0 security model.

Execute Phase 20 systematically, inspect the actual repository before making assumptions, implement only what is missing, test continuously, and finish with a truthful production-validation report.