# PHASE 21 MASTER PROMPT
# VEIL — REAL-DEVICE AND LIVE-PRODUCTION VALIDATION
# Objective: Turn the already-completed VEIL v1.0.0 system into a genuinely installable,
# live-testable Android application communicating with a real deployed relay.

You are continuing development of VEIL.

DO NOT restart the project.
DO NOT redesign the architecture.
DO NOT rewrite completed cryptographic primitives.
DO NOT create fake implementations merely to satisfy tests.

VEIL has completed Phases 0–20.

The current repository is considered the canonical implementation.

Current known state:

- VEIL v1.0.0 GA
- Multi-Space cryptographic isolation
- Credential-selected Space unlocking
- Argon2id key derivation
- XChaCha20-Poly1305 authenticated encryption
- Ed25519 identity/signing
- X25519 key agreement
- HKDF domain separation
- Double Ratchet 1-to-1 E2EE
- Group ratchet/state machine
- Encrypted IndexedDB persistence
- Blind persistent relay server
- HTTP + WebSocket relay transport
- Persistent offline queues
- ACK-after-persistence semantics
- Contact/invitation system
- Signed veil:// invitations
- Encrypted attachments
- Privacy-preserving notifications
- Volatile local search
- Production configuration
- React UI
- Capacitor Android container
- Android manifest/network security configuration
- Live diagnostic scripts
- Self-hosting/deployment configuration
- Release manifests/checksums
- Extensive automated test coverage

Last known Phase 20 state:

- 156 test files
- 339 tests
- 100% pass
- Production web build succeeds
- Android manifest audit passes
- Git commit: 44d663f
- Working tree clean

IMPORTANT:

Phase 21 is NOT primarily a feature-development phase.

Its purpose is to establish whether a REAL PERSON can:

1. Build the Android application.
2. Install it on a physical Android device.
3. Start a real VEIL relay server.
4. Connect Android to that relay.
5. Connect the Web client to that same relay.
6. Create real Spaces.
7. Exchange real invitations.
8. Establish real E2EE sessions.
9. Exchange real encrypted messages.
10. Exchange real encrypted attachments.
11. Go offline and recover.
12. Kill/restart the applications and recover state.
13. Verify notifications and deep links.
14. Verify panic locking.
15. Verify Space isolation.
16. Produce a release APK/AAB that can actually be installed.

==================================================
0. ABSOLUTE RULE — NO FAKE VERIFICATION
==================================================

This is the most important requirement of Phase 21.

NEVER claim that a physical Android device test passed unless the test actually ran against a physical/emulated Android environment.

NEVER claim that a live relay test passed merely because a mock server passed.

NEVER create a test whose only purpose is to simulate successful real-device behavior and then call it "live validation."

Clearly distinguish:

- UNIT TESTED
- INTEGRATION TESTED
- EMULATOR VERIFIED
- PHYSICAL DEVICE VERIFIED
- LIVE RELAY VERIFIED
- NOT VERIFIED

If the coding environment does not have:

- Android SDK
- Java/JDK
- Gradle
- Android emulator
- ADB
- physical Android device
- publicly reachable relay
- DNS/TLS endpoint

then DO NOT pretend those things exist.

Instead:

1. Build everything that can be built locally.
2. Create deterministic validation scripts.
3. Detect missing external infrastructure.
4. Report exactly what remains to be manually executed.
5. Provide exact commands for the user to execute.
6. Mark those tests as pending rather than passing.

==================================================
1. FIRST TASK — REPOSITORY RECONNAISSANCE
==================================================

Before modifying anything, inspect the existing repository.

Read:

- package.json
- package-lock.json
- capacitor.config.*
- index.html
- src/
- android/
- scripts/
- tests/
- deployment/
- docs/
- release/
- README.md
- docs/ai/ACTIVE_TASK.md
- docs/ai/CURRENT_STATE.md
- docs/ai/CHANGELOG.md
- docs/ai/DECISIONS.md
- docs/ai/HANDOFF.md

Determine:

A. How the Android project is currently configured.
B. Whether Capacitor is correctly initialized.
C. Whether the Android project is already synchronized.
D. How the web application is built.
E. How the relay is started.
F. How production configuration is loaded.
G. What URL the Android client currently uses for the relay.
H. Whether the WebSocket endpoint is correctly derived.
I. Whether deep links are actually wired into the application.
J. Whether Android storage is truly persistent.
K. Whether notifications are actually implemented for Android.
L. Whether attachment storage works on Android.
M. Whether the current UI is usable on a phone-sized display.
N. Whether there are hardcoded localhost URLs.
O. Whether development/test mocks accidentally enter production builds.

Do NOT modify code until this reconnaissance is complete.

Create:

docs/PHASE21_BASELINE.md

containing:

- current architecture
- current Android status
- current relay status
- current build commands
- current known blockers
- exact missing pieces
- baseline test/build results

==================================================
2. ANDROID BUILD PIPELINE
==================================================

Make the Android project reproducibly buildable.

Required commands should eventually include something equivalent to:

npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug

and for release:

./gradlew assembleRelease

On Windows, provide the appropriate:

gradlew.bat

commands.

Do not assume Linux-only execution.

Verify:

- Android project compiles.
- Java/Kotlin compilation succeeds.
- Capacitor dependencies resolve.
- Web assets are copied correctly.
- Application package ID is correct.
- Application version is synchronized with v1.0.0.
- Android minSdk/targetSdk are sane for the existing project.
- INTERNET permission exists.
- cleartext traffic remains disabled.
- backup policy remains disabled as intended.
- deep-link intent filters remain present.
- no debug-only network configuration leaks into release.

Create:

scripts/android-build-check.mjs

It must inspect the resulting Android build and report:

- APK exists
- APK size
- package/application ID
- version name
- version code
- debug/release status
- dangerous permissions
- cleartext configuration
- backup configuration
- exported activities
- deep-link declarations

Do NOT falsely report signature verification if no signing key is available.

==================================================
3. DEBUG APK + RELEASE APK
==================================================

Produce two distinct artifacts:

A. Debug APK for immediate physical-device testing.

B. Release APK for final deployment testing.

If signing credentials are unavailable:

- generate an unsigned release artifact if technically possible
- explicitly state it is unsigned
- provide exact instructions for signing it
- NEVER fabricate a release signature

If the project already contains a safe release-signing mechanism, inspect it before changing it.

NEVER commit:

- keystores
- private signing keys
- passwords
- signing credentials

Add appropriate .gitignore protections.

Create:

docs/ANDROID_BUILD.md

with exact:

- Windows build commands
- Linux/macOS commands
- ADB installation commands
- APK installation commands
- uninstall commands
- logcat commands
- clean build commands
- release signing instructions

==================================================
4. PHYSICAL DEVICE INSTALLATION WORKFLOW
==================================================

Implement/document the actual workflow:

Developer machine
       |
       | USB / ADB
       v
Android device
       |
       | HTTPS/WSS
       v
VEIL Relay
       |
       v
Other VEIL clients

The app must NOT require:

- Android Studio at runtime
- localhost relay on the phone
- insecure HTTP
- manually modified source code

Provide a configuration mechanism for the production relay URL.

Example:

VITE_RELAY_BASE_URL=https://relay.example.com

or whatever configuration mechanism the existing architecture supports.

Do not invent a new configuration system if one already exists.

Verify that production Android builds do not accidentally point to:

- localhost
- 127.0.0.1
- 10.0.2.2
- development relay
- test relay

unless explicitly configured for development.

Create:

scripts/android-runtime-config-check.mjs

which scans the production web bundle and Android configuration for forbidden development endpoints.

==================================================
5. LIVE RELAY DEPLOYMENT
==================================================

Use the existing Phase 17 deployment architecture.

Do NOT redesign the relay.

The relay must be deployable using the existing:

- Node relay CLI
- persistent file-backed relay store
- Caddy configuration
- Nginx configuration
- Docker configuration
- systemd configuration

The production deployment must provide:

HTTPS
WSS

with TLS.

Required health endpoints:

GET /healthz
GET /readyz

Verify:

- HTTPS certificate is valid.
- WSS connection succeeds.
- relay mailbox creation succeeds.
- envelope posting succeeds.
- envelope fetch succeeds.
- ACK succeeds.
- TTL behavior remains intact.
- persistent relay storage works.
- server restart does not corrupt state.

Create:

scripts/phase21-live-relay-check.mjs

It must:

1. Accept relay URL through environment/config.
2. Check HTTPS.
3. Check health.
4. Check readiness.
5. Create a test mailbox.
6. Test capability authentication.
7. Send a test envelope.
8. Fetch it.
9. ACK it.
10. Verify deletion.
11. Test WSS connectivity if available.
12. Report latency.
13. Exit non-zero on failure.

Never hardcode a real domain.

==================================================
6. WEB ↔ ANDROID CROSS-PLATFORM TEST
==================================================

This is the most important application-level test.

Test:

CLIENT A = Web browser
CLIENT B = Android application

Both connect to the SAME live relay.

Flow:

1. Start Web client.
2. Start Android client.
3. Create Space A on Web.
4. Create Space B on Android.
5. Generate invitation from Web.
6. Transfer invitation to Android.
7. Android imports invitation.
8. Verify signature.
9. Verify identity.
10. Establish direct E2EE session.
11. Send message Web → Android.
12. Android decrypts.
13. Android sends reply.
14. Web decrypts.
15. Verify message contents exactly.
16. Verify relay never receives plaintext.
17. Verify ACK occurs only after persistence.
18. Verify delivery status progression.

Expected lifecycle:

QUEUED
→ SENDING
→ SENT_TO_RELAY
→ DELIVERED_TO_RECIPIENT

Do not alter the E2EE protocol merely to make this test pass.

Create:

tests/phase21-cross-platform-live.test.ts

This test may use a configurable live endpoint.

If no live endpoint exists:

- mark live section as SKIPPED/NOT VERIFIED
- still execute all deterministic portions
- provide manual instructions

Do NOT convert it into a fake localhost mock and call it live.

==================================================
7. ANDROID ↔ ANDROID TEST
==================================================

Two independent Android clients must be tested.

Device A:
- Space A
- identity A

Device B:
- Space B
- identity B

Use the same relay.

Test:

Invitation
→ onboarding
→ identity verification
→ E2EE session
→ message A→B
→ message B→A

Then:

- attachment A→B
- attachment B→A
- offline A
- message sent while A/B offline
- reconnect
- queue drain
- ACK
- duplicate suppression

If two physical devices are unavailable, document:

DEVICE-TO-DEVICE: NOT VERIFIED

Do not fake the result.

==================================================
8. ANDROID LIFECYCLE VALIDATION
==================================================

Test:

A. Background app.

B. Foreground app.

C. Activity recreation.

D. Screen rotation if supported.

E. Process death.

F. Force-stop.

G. Relaunch.

H. Device reboot.

I. Network disconnect.

J. Network reconnect.

After each lifecycle transition verify:

- Space envelope remains recoverable.
- Encrypted records remain recoverable.
- Ratchet state remains consistent.
- Queued messages remain available.
- No plaintext secrets appear in logs.
- Locked Spaces remain locked.
- session keys are not improperly persisted.

IMPORTANT:

Never persist raw session secrets merely to survive Android process death.

Use the existing secure encrypted persistence architecture.

==================================================
9. ANDROID STORAGE VALIDATION
==================================================

Verify Android does NOT place sensitive plaintext into:

- SharedPreferences
- unencrypted files
- SQLite plaintext
- WebView localStorage
- WebView IndexedDB without the intended encryption boundary
- external storage
- cache files
- URLs
- logs

Determine exactly where Capacitor/WebView storage resides.

Document the actual boundary.

Create:

docs/ANDROID_SECURITY_STORAGE.md

Include:

- persistent storage locations
- encrypted vs unencrypted data
- key lifecycle
- lock behavior
- panic lock behavior
- Android backup behavior
- app uninstall behavior
- cache behavior
- WebView considerations

If Android's underlying WebView/OS behavior introduces a security limitation, document it instead of claiming perfect guarantees.

==================================================
10. NOTIFICATIONS
==================================================

Verify Android notification behavior.

Required:

- notification permission requested appropriately.
- HIDDEN mode produces no identifying notification content.
- SENDER_ONLY does not reveal message contents.
- FULL_OBFUSCATED follows the existing privacy policy.
- locked Space suppresses sensitive notification content.
- notification tap does not expose plaintext before unlock.

Test:

message arrives
→ notification
→ tap notification
→ app opens
→ Space remains locked if appropriate
→ user unlocks
→ conversation becomes visible

Do not bypass the existing privacy model.

==================================================
11. VEIL INVITATION DEEP LINK
==================================================

Test:

veil://invite/...

from:

- browser
- Android share
- messaging application
- copied clipboard

Android should launch VEIL and route the invitation to the correct onboarding flow.

Verify:

- malformed invitation rejected.
- expired invitation rejected.
- invalid signature rejected.
- replay rejected.
- valid invitation accepted.

Never trust deep-link data before cryptographic verification.

==================================================
12. ATTACHMENT VALIDATION
==================================================

Test real Android files.

At minimum:

- small text file
- image
- larger file

Flow:

Android
→ chunk
→ encrypt
→ send
→ relay
→ receive
→ authenticate
→ reassemble
→ decrypt
→ verify SHA-256
→ display/save

Verify:

- no plaintext attachment is uploaded to relay.
- interrupted transfer can recover if architecture supports it.
- corrupted chunk fails authentication.
- corrupted complete file fails SHA-256.
- temporary Blob/file references are cleaned up on lock.
- attachment processing respects Space boundaries.

Do NOT introduce a second encryption implementation.

==================================================
13. OFFLINE MODE
==================================================

Test:

1. Android online.
2. Establish conversation.
3. Disable network.
4. Send message.
5. Verify message is persisted in encrypted outbound queue.
6. Kill app.
7. Relaunch.
8. Restore network.
9. Verify message is transmitted.
10. Receiver decrypts it.
11. ACK occurs.
12. Queue entry is removed/reconciled.

Repeat with:

- multiple messages
- attachments if supported
- relay unavailable
- temporary WebSocket failure
- HTTP failure

Verify exponential backoff remains bounded.

==================================================
14. MULTI-SPACE ADVERSARIAL DEVICE TEST
==================================================

On Android:

Create:

Space A
Space B
Space C

Perform:

- conversations in A
- conversations in B
- conversations in C
- attachments in A
- search in B
- notifications in C

Rapidly switch:

A → B → C → A → C → B

Verify:

- no message body crosses Spaces.
- no contact crosses Spaces.
- no search result crosses Spaces.
- no network mailbox crosses Spaces.
- no notification leaks another Space.
- no attachment crosses Spaces.
- previous Space memory is wiped according to the existing architecture.

Test lock/panic during active network activity.

==================================================
15. PANIC LOCK
==================================================

Test Panic Lock under:

A. idle state
B. message send
C. message receive
D. attachment encryption
E. attachment decryption
F. WebSocket connected
G. offline queue pending
H. notification pending
I. Space switching

Expected behavior:

- session keys destroyed
- volatile message state removed
- search index purged
- attachment temporary references revoked
- WebSocket subscriptions closed
- network operations terminated safely
- UI returns to neutral lock screen
- no plaintext remains in visible UI
- no sensitive notification is generated

Do not claim literal hardware-level RAM sanitization beyond what the runtime actually guarantees.

Use accurate security language.

==================================================
16. REAL-DEVICE LOGGING AUDIT
==================================================

Create a diagnostic procedure using:

adb logcat

Scan for:

- passwords
- passphrases
- private keys
- master keys
- message bodies
- invitation capabilities
- attachment plaintext
- decrypted content
- access tokens
- mailbox capabilities

The audit must distinguish:

- expected non-sensitive operational logs
- sensitive leaks

Production builds should minimize or disable verbose debugging.

Create:

scripts/android-log-audit.mjs

Accept a captured log file.

Exit non-zero if configured secret patterns are detected.

==================================================
17. ANDROID RELEASE SECURITY AUDIT
==================================================

Extend:

scripts/android-release-check.mjs

to inspect:

- manifest
- permissions
- cleartext traffic
- exported components
- deep links
- backup configuration
- debug flags
- development endpoints
- release/debug signing state
- version
- package ID

Where possible inspect APK contents.

Do NOT claim APK signature verification if the environment lacks signing material.

==================================================
18. LIVE DIAGNOSTIC DASHBOARD / REPORT
==================================================

Create:

scripts/phase21-report.mjs

It should aggregate:

- web build
- Android build
- relay health
- relay latency
- HTTPS
- WSS
- APK presence
- manifest audit
- configuration audit
- automated tests
- live test status
- device status if detectable

Output a clear report:

PASS
FAIL
NOT VERIFIED
BLOCKED

Never turn unavailable infrastructure into PASS.

==================================================
19. AUTOMATED TEST SUITES
==================================================

Add tests such as:

tests/phase21-build-validation.test.ts
tests/phase21-runtime-config.test.ts
tests/phase21-android-security.test.ts
tests/phase21-deeplink.test.ts
tests/phase21-notification-privacy.test.ts
tests/phase21-storage-boundary.test.ts
tests/phase21-attachment-live.test.ts
tests/phase21-offline-recovery.test.ts
tests/phase21-cross-platform-live.test.ts
tests/phase21-panic-lock-live.test.ts

Tests that require a physical device or external server MUST detect their environment.

Never make CI falsely pass by silently substituting mocks.

Use explicit environment variables such as:

VEIL_LIVE_RELAY_URL
VEIL_LIVE_TEST_ENABLED
VEIL_ANDROID_DEVICE_REQUIRED

Use the project's existing configuration conventions where applicable.

==================================================
20. DO NOT BREAK THE FROZEN CRYPTOGRAPHIC CORE
==================================================

The following remain frozen unless a genuine correctness/security defect is discovered:

src/crypto/
src/ratchet/
src/group/
src/recovery/

Do not:

- replace crypto libraries
- change protocol serialization
- weaken authentication
- disable AEAD verification
- weaken TLS
- store raw keys for convenience
- bypass invitation verification
- bypass capability authentication
- disable Space isolation

If a Phase 21 integration problem originates from one of these areas:

STOP.

Document the issue.

Do not patch around it with an insecure workaround.

==================================================
21. DEPENDENCY DISCIPLINE
==================================================

Do not add dependencies unless necessary.

Before adding one:

1. Explain why existing dependencies cannot solve the problem.
2. Check whether an existing project dependency already provides the functionality.
3. Verify license compatibility.
4. Verify maintenance/security posture.
5. Add only the minimum dependency.

Do not add telemetry, analytics, tracking SDKs, ad SDKs, or unnecessary cloud services.

==================================================
22. DOCUMENTATION
==================================================

Create/update:

docs/PHASE21_REAL_DEVICE_VALIDATION.md
docs/ANDROID_BUILD.md
docs/ANDROID_SECURITY_STORAGE.md
docs/LIVE_PRODUCTION_TESTING.md
docs/CROSS_PLATFORM_LIVE_TESTING.md
docs/ANDROID_TROUBLESHOOTING.md
docs/RELEASE_INSTALLATION.md

Documentation must include exact commands.

Include separate instructions for:

Windows
Linux/macOS

At minimum explain:

- installing prerequisites
- building web
- syncing Capacitor
- building APK
- connecting ADB
- enabling USB debugging
- installing APK
- capturing logcat
- starting relay
- configuring relay URL
- testing HTTPS
- testing WSS
- creating two accounts/Spaces
- invitation transfer
- messaging
- attachment testing
- offline testing
- panic testing
- uninstall/reinstall
- release build

==================================================
23. RELEASE ARTIFACTS
==================================================

Create a release directory such as:

release/v1.0.0/

Do NOT overwrite existing release artifacts unnecessarily.

Android artifacts should include:

- debug APK
- release APK if available
- SHA-256 checksums
- build metadata
- version metadata
- manifest/security report

Never include:

- signing keys
- passwords
- credentials
- relay secrets
- private keys

Create:

release/v1.0.0/android/

==================================================
24. FINAL VALIDATION MATRIX
==================================================

Produce a matrix like:

| Test | Automated | Emulator | Physical Device | Live Relay | Status |
|------|-----------|----------|-----------------|------------|--------|
| Android build | PASS | — | — | — | PASS |
| APK install | — | — | REQUIRED | — | ... |
| HTTPS relay | PASS | — | — | REQUIRED | ... |
| WSS relay | PASS | — | — | REQUIRED | ... |
| Web → Android | — | POSSIBLE | REQUIRED | REQUIRED | ... |
| Android → Web | — | POSSIBLE | REQUIRED | REQUIRED | ... |
| Android → Android | — | POSSIBLE | REQUIRED | REQUIRED | ... |
| Attachments | PASS | POSSIBLE | REQUIRED | REQUIRED | ... |
| Offline recovery | PASS | POSSIBLE | REQUIRED | REQUIRED | ... |
| Notifications | PASS | POSSIBLE | REQUIRED | — | ... |
| Deep links | PASS | POSSIBLE | REQUIRED | — | ... |
| Panic lock | PASS | POSSIBLE | REQUIRED | — | ... |
| Multi-Space isolation | PASS | POSSIBLE | REQUIRED | — | ... |
| Logcat audit | PASS | — | REQUIRED | — | ... |

Use:

PASS
FAIL
NOT VERIFIED
BLOCKED

Do not use ambiguous words such as "production ready" if required physical tests have not occurred.

==================================================
25. FINAL SECURITY REVIEW
==================================================

Before completion, explicitly answer:

1. Can the Android APK actually be installed?
2. Can Android connect to a real HTTPS relay?
3. Can Android establish WSS?
4. Can Android exchange E2EE messages with Web?
5. Can two Android devices communicate?
6. Do attachments work on real Android?
7. Does offline persistence survive process death?
8. Does panic lock work under active operations?
9. Are notifications privacy-preserving?
10. Do veil:// invitations work?
11. Is multi-Space isolation preserved?
12. Are sensitive values absent from logcat?
13. Are release artifacts free from secrets?
14. Is the production configuration free from localhost/dev endpoints?
15. Which tests were actually executed?
16. Which tests remain unverified because hardware/infrastructure was unavailable?

==================================================
26. GIT / AI CONTINUITY
==================================================

Update:

docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
docs/ai/HANDOFF.md

Add appropriate ADRs for Phase 21 decisions.

DO NOT fabricate a commit hash.

At completion:

- run git status
- report whether working tree is clean
- create a commit ONLY if project conventions permit and all validation is complete
- report the actual commit hash

==================================================
27. FINAL COMMANDS
==================================================

Run as many of these as the environment supports:

npm test
npm run build
npx cap sync android

Android build:

cd android
gradlew.bat assembleDebug
gradlew.bat assembleRelease

or the appropriate Unix equivalent.

Run:

node scripts/android-build-check.mjs
node scripts/android-runtime-config-check.mjs
node scripts/android-release-check.mjs
node scripts/phase21-report.mjs

If configured:

VEIL_LIVE_RELAY_URL=https://... node scripts/phase21-live-relay-check.mjs

Do NOT claim success for commands that could not execute.

==================================================
28. FINAL PHASE 21 OUTPUT
==================================================

At the end, provide a concise but complete report:

# PHASE 21 COMPLETE

## 1. Implementation
List actual files created/modified.

## 2. Android
- package ID
- version
- debug APK
- release APK
- build result
- signing status

## 3. Relay
- endpoint tested
- HTTPS result
- WSS result
- health result
- latency

Do NOT expose secrets.

## 4. Cross-Platform
- Web → Android
- Android → Web
- Android → Android

Clearly label physical/live verification.

## 5. Lifecycle
- background
- process death
- restart
- offline
- reconnect
- reboot

## 6. Security
- manifest
- storage
- logcat
- TLS
- deep links
- notifications
- attachments
- Space isolation
- panic lock

## 7. Tests

Report exact numbers:

- test files
- tests
- failures
- skipped
- build time

## 8. Release Artifacts

List:

- APK paths
- checksums
- reports

## 9. Verification Matrix

PASS / FAIL / NOT VERIFIED / BLOCKED.

## 10. Known Limitations

Be honest.

## 11. Git

Actual commit hash and working-tree status.

==================================================
FINAL PRINCIPLE
==================================================

The goal of Phase 21 is NOT to produce another impressive-looking implementation report.

The goal is:

"I installed VEIL on an Android phone, connected it to a real relay, connected another VEIL client, exchanged actual encrypted messages, transferred an actual encrypted attachment, went offline, restarted the app, recovered the state, and verified the security boundaries."

If the environment cannot perform that final real-world validation, say exactly what is missing and provide the shortest possible path for the user to perform it manually.

NEVER manufacture evidence.

BEGIN PHASE 21.