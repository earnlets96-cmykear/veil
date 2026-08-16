Yep — based on the **actual Phase 17 completion report**, VEIL is now past the “does the architecture work?” stage. The next phase should **not** randomly add more cryptography or another fake milestone. It should turn VEIL into something a real person can actually install, use, update, and distribute.

Below is the **complete Phase 18 master prompt** I would give the coding agent.

---

# VEIL — PHASE 18 MASTER PROMPT

## Real Product Completion, Onboarding, UX Polish, Distribution & Release Candidate

You are the implementation agent for **VEIL**, a privacy-first, end-to-end encrypted messaging application.

VEIL has completed **Phases 0–17**.

Phase 17 established real-world deployment, self-hosting, real relay E2EE testing, restart recovery, security regression testing, dependency auditing, performance testing, and release artifacts.

Your job in Phase 18 is **NOT to redesign the cryptographic architecture**.

Your job is to transform the already-functional VEIL system into a **coherent, attractive, understandable, genuinely usable messaging product** suitable for real beta users.

---

# 0. ABSOLUTE RULE — TAKE OVER THE EXISTING PROJECT

Before writing code, inspect the repository.

Do NOT assume that files described in this prompt are missing.

Read:

```text
AGENTS.md
README.md

docs/ARCHITECTURE.md
docs/SYSTEM_SUMMARY.md
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
docs/RELAY_PROTOCOL.md
docs/RELAY_ARCHITECTURE.md
docs/RELAY_SECURITY.md
docs/RELAY_PRIVACY.md

docs/NETWORK_ARCHITECTURE.md
docs/CLIENT_RELAY_INTEGRATION.md
docs/OFFLINE_DELIVERY.md
docs/NETWORK_SECURITY.md

docs/UI_ARCHITECTURE.md
docs/UX_SECURITY.md

docs/CONTACT_ARCHITECTURE.md
docs/INVITATION_PROTOCOL.md
docs/MESSAGE_LIFECYCLE.md
docs/ATTACHMENT_ARCHITECTURE.md
docs/DEVICE_LINKING.md
docs/DATABASE_ARCHITECTURE.md
docs/NOTIFICATION_PRIVACY.md
docs/PRODUCTION_CONFIGURATION.md
docs/PRODUCTION_DEPLOYMENT.md

docs/DEPLOYMENT.md
docs/SELF_HOSTING.md
docs/SECURITY_AUDIT.md
docs/FAILURE_MODES.md
docs/COMPATIBILITY.md
docs/PERFORMANCE.md
docs/BACKUP_RECOVERY.md
docs/PRIVACY_DATA_FLOW.md
docs/RELEASE.md

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md
docs/ai/CHANGELOG.md
```

Then inspect the actual implementation under:

```text
src/
tests/
deployment/
prompts/
```

Determine the **actual repository state**, not the state described by this prompt.

If the repository differs from the documentation, treat the implementation and verified tests as ground truth and document the discrepancy.

---

# 1. CURRENT VERIFIED BASELINE

Phase 17 reports:

```text
141 test files
316 tests
0 failures
0 skipped

npm run build
SUCCESS

Git:
861de95

Working tree:
CLEAN
```

The system currently includes:

* Multi-Space architecture
* Credential-selected Space unlocking
* Decoy Spaces
* Argon2id password derivation
* XChaCha20-Poly1305
* HKDF
* Ed25519/X25519 identity architecture
* Double Ratchet E2EE
* Group encryption
* Encrypted IndexedDB persistence
* Schema migration framework
* Blind relay server
* HTTP + WebSocket transport
* Persistent relay storage
* Offline queueing
* Duplicate suppression
* Signed invitations
* Contacts
* Encrypted attachments
* Privacy-aware notifications
* Volatile search
* Device management
* Recovery
* Panic Lock
* React 19 UI
* Self-hosting deployment
* Docker packaging
* Caddy/Nginx configuration
* systemd deployment
* Production configuration
* Security regression tests
* Performance benchmarks

**DO NOT replace or weaken these systems.**

---

# 2. PHASE 18 OBJECTIVE

Phase 18 has five goals:

### A. Product UX

Make VEIL understandable to a new user within minutes.

### B. UI/UX Polish

Make the application visually attractive, simple, responsive and coherent.

### C. Real Messaging Workflow

Ensure the entire journey works naturally:

```text
Launch
 ↓
Create Space
 ↓
Understand Space concept
 ↓
Enter app
 ↓
Create/find contact
 ↓
Invite contact
 ↓
Verify identity
 ↓
Start chat
 ↓
Send message
 ↓
Receive message
 ↓
Send attachment
 ↓
Create group
 ↓
Manage devices
 ↓
Lock
 ↓
Unlock
```

### D. Distribution

Produce a proper beta/release package that users can actually run.

### E. Release Candidate Validation

Perform a final product-level audit rather than merely another unit-test milestone.

---

# 3. DO NOT CHANGE THE CRYPTOGRAPHIC CORE

The following are frozen unless a genuine security defect is discovered:

```text
src/crypto/
src/ratchet/
src/group/
src/recovery/
```

Do not:

* invent cryptographic primitives
* replace Argon2id
* replace XChaCha20-Poly1305
* weaken authentication
* store plaintext secrets
* bypass Space isolation
* disable TLS enforcement
* expose private keys
* expose passwords
* log message plaintext
* introduce analytics
* introduce advertising SDKs
* introduce unnecessary third-party telemetry

If a cryptographic defect is discovered:

1. STOP.
2. Document it.
3. Create a security issue/ADR.
4. Do not silently patch around it.

---

# 4. PRODUCT UX REDESIGN

VEIL must feel like a modern messaging application.

The design goal is:

> **Simple enough for a first-time user, powerful enough for a privacy-conscious technical user.**

Do NOT copy Telegram, Signal, SimpleX or another application visually.

Use those applications only as conceptual references.

---

# 5. PRIMARY NAVIGATION

Simplify the main application.

Desktop:

```text
┌────────────────────────────────────────────────────────────┐
│ VEIL                                      Space ▾   🔒     │
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│ Chats        │              Conversation                  │
│ Contacts     │                                             │
│ Groups       │                                             │
│              │                                             │
│              │                                             │
│──────────────│                                             │
│ Settings     │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

Mobile:

```text
┌──────────────────────┐
│ VEIL        🔒       │
├──────────────────────┤
│                      │
│    Conversation      │
│                      │
├──────────────────────┤
│ Chats Contacts       │
│ Groups Settings      │
└──────────────────────┘
```

Avoid excessive icons without labels.

A new user should not have to guess what an icon means.

---

# 6. SPACE UX

The Multi-Space architecture is one of VEIL's defining features.

However, it must not confuse users.

Explain Spaces in plain language.

Example:

> **Spaces keep different parts of your VEIL life separate.**
>
> You can create one for Personal, Work, Friends, or anything else.

Creation flow:

```text
Create a Space

Name
[ Personal                 ]

Password
[                         ]

Confirm password
[                         ]

☐ This is a decoy Space

[ Create Space ]
```

Add a concise security explanation.

Do NOT reveal sensitive internal cryptographic terminology unless the user asks for advanced information.

---

# 7. LOCK SCREEN

The lock screen must remain visually neutral.

It must not reveal:

* hidden Space names
* number of secret Spaces
* contacts
* conversations
* message previews
* private metadata

Avoid wording such as:

> "Unlock Secret Work"

Instead:

> **Unlock VEIL**

Password:

```text
[••••••••••••]

[ Unlock ]
```

Optional:

```text
Emergency Lock
```

---

# 8. ONBOARDING

Create a first-run onboarding flow.

Maximum:

**3–4 screens.**

### Screen 1

> Welcome to VEIL

Short explanation:

> Private messaging designed so your conversations stay encrypted from end to end.

### Screen 2

> Your Spaces

Explain the isolation concept.

### Screen 3

> Your messages are encrypted

Explain E2EE without overwhelming the user.

### Screen 4

> You're ready.

Create Space button.

Allow:

```text
Skip
```

The onboarding state itself must not reveal sensitive information.

Persist only a non-sensitive onboarding-completed flag.

---

# 9. EMPTY STATES

Every major screen must have a useful empty state.

Examples:

### Chats

> No conversations yet.
>
> Start a private conversation with someone you trust.

```text
[ New Chat ]
```

### Contacts

> Your contacts will appear here.

```text
[ Add Contact ]
```

### Groups

> Create a private group for friends, family or work.

```text
[ New Group ]
```

Do not make empty screens look broken.

---

# 10. CONTACT ONBOARDING

The contact flow must become extremely simple.

Primary action:

```text
Add Contact
```

Options:

```text
Scan QR
Paste Invitation
Share Invitation
```

After invitation acceptance:

```text
Alice
Pending verification

Safety Number
1234 5678 9012

[ Verify ]
```

Explain:

> Compare this number with your contact using another trusted channel.

After verification:

```text
✓ Verified
```

---

# 11. NEW CHAT FLOW

Make the flow:

```text
New Chat
 ↓
Select Contact
 ↓
Verification status
 ↓
Start Conversation
```

Avoid exposing internal:

* ratchet state
* mailbox capabilities
* key IDs
* cryptographic implementation details

Those belong in advanced diagnostics, not normal UX.

---

# 12. CHAT EXPERIENCE

Improve:

### Message bubbles

Must clearly distinguish:

* sent
* received
* pending
* failed
* delivered

### Composer

Support:

```text
Enter       → Send
Shift+Enter → New line
```

Attachment button:

```text
📎
```

Do not add unnecessary clutter.

---

# 13. MESSAGE STATUS

Make delivery status understandable.

Do not expose internal states like:

```text
SENT_TO_RELAY
```

directly to normal users.

Map technical states to friendly UI:

```text
Queued
Sending
Sent
Delivered
Failed
```

Provide technical details only in an optional diagnostic view.

---

# 14. ATTACHMENTS

Make attachment handling feel natural.

Before sending:

```text
photo.jpg
1.8 MB

🔒 Encrypted

[ Cancel ] [ Send ]
```

During transfer:

```text
Uploading
██████████░░ 78%
```

After receiving:

```text
🔒 Encrypted attachment

[ View ]
```

Never persist decrypted attachment contents unnecessarily.

Ensure Blob URLs are revoked after:

* use
* conversation destruction
* Space lock
* panic lock

---

# 15. GROUP UX

Group creation:

```text
New Group

Group name
[                   ]

Members
☑ Alice
☑ Bob
☐ Charlie

[ Create Group ]
```

Group settings:

```text
Group Info

Members
Encryption
Verification
Devices

[ Add Member ]
```

When membership changes, show:

> Group security updated.

Do not expose raw cryptographic epoch implementation unless advanced details are requested.

---

# 16. DEVICE MANAGEMENT

Create a simple interface:

```text
Devices

This device
✓ Active

Chrome — Windows
Active now

Android
Last seen 2 hours ago

[ Link New Device ]
```

For verification:

```text
Confirm device

Security code:

482 913

Compare the code on both devices.

[ Confirm ]
```

Revocation:

```text
Remove this device?

This will prevent it from accessing this Space.

[ Cancel ] [ Remove ]
```

---

# 17. SETTINGS REDESIGN

Organize settings:

```text
Settings

Account
├── Space
├── Devices
└── Recovery

Privacy
├── Notifications
├── Auto Lock
└── Search

Security
├── Verification
├── Panic Lock
└── Advanced

About
├── Version
├── Open Source
└── Security Information
```

Do not bury critical security controls.

---

# 18. SEARCH

Search should remain local and volatile.

Add:

```text
Search
```

with filters:

```text
All
People
Groups
Messages
```

Search results must disappear when the Space locks.

Never create a plaintext permanent search database.

---

# 19. NOTIFICATION UX

Implement privacy-aware notification presentation.

Examples:

### HIDDEN

> VEIL — New message

### SENDER_ONLY

> VEIL — Alice sent a message

### FULL_OBFUSCATED

> VEIL — New message from Alice

Never expose plaintext message contents when privacy mode prohibits it.

---

# 20. ERROR UX

Technical errors must not be dumped directly to users.

Bad:

```text
XChaCha20Poly1305 authentication failed: nonce length 24...
```

Good:

> We couldn't verify this message.

Advanced details can exist behind:

```text
Technical details
```

Never expose:

* passwords
* keys
* ciphertext
* capabilities
* internal secrets

---

# 21. OFFLINE UX

Clearly show connection state.

Example:

```text
● Online
```

or:

```text
○ Offline
Messages will be sent when connection returns.
```

Queued message:

```text
Sending when connection returns…
```

The application must remain useful while offline.

---

# 22. RESPONSIVE DESIGN

Support:

### Desktop

Minimum target:

```text
1280 × 720
```

### Tablet

### Mobile

Do not merely shrink desktop UI.

Create appropriate mobile layouts.

Test:

```text
320px
375px
390px
430px
768px
1024px
1280px
1440px+
```

---

# 23. ACCESSIBILITY

Ensure:

* keyboard navigation
* visible focus
* semantic buttons
* proper labels
* ARIA only when necessary
* modal focus trapping
* ESC closes appropriate dialogs
* sufficient contrast
* reduced-motion support

Add automated accessibility tests.

---

# 24. VISUAL DESIGN SYSTEM

Create a consistent VEIL visual language.

Use:

* restrained colors
* strong typography
* generous spacing
* clear hierarchy
* subtle animations
* consistent border radius
* consistent elevation
* consistent controls

Avoid:

* excessive gradients
* excessive glassmorphism
* giant animations
* clutter
* unexplained icons
* excessive neon cyber-security aesthetics

VEIL should look like a **real premium messaging product**, not a hacker dashboard.

---

# 25. MOTION DESIGN

Use subtle transitions for:

* opening conversations
* switching Spaces
* opening drawers
* sending messages
* attachment progress
* connection state changes

Respect:

```text
prefers-reduced-motion
```

---

# 26. PWA / INSTALLABILITY

If technically appropriate for the existing architecture, implement:

```text
manifest.webmanifest
service worker
icons
install metadata
```

The PWA must NEVER cache sensitive plaintext.

Service worker caching must be restricted to:

* application shell
* static assets
* non-sensitive resources

Never cache:

* messages
* decrypted attachments
* passwords
* private keys
* Space contents

Document this boundary.

---

# 27. RELEASE VERSIONING

Introduce a proper application version.

Use:

```text
Semantic Versioning
```

For example:

```text
0.18.0-beta.1
```

Do not call VEIL "production ready" merely because tests pass.

The product should be classified honestly as:

```text
Beta
```

until external testing validates it.

---

# 28. UPDATE / MIGRATION SAFETY

Ensure application updates do not silently destroy user data.

Test:

```text
old schema
 ↓
upgrade
 ↓
new schema
 ↓
messages preserved
 ↓
Spaces preserved
```

If migration fails:

```text
DO NOT destroy existing data.
```

Use fail-safe migration behavior.

---

# 29. RELEASE ARTIFACTS

Create:

```text
release/
```

containing appropriate artifacts such as:

```text
VEIL-client-build/
VEIL-relay/
checksums.txt
RELEASE_NOTES.md
```

Do not include secrets.

Generate SHA-256 checksums.

Document reproducibility expectations.

---

# 30. SECURITY RELEASE CHECK

Create:

```text
docs/RELEASE_SECURITY_CHECKLIST.md
```

Verify:

### Secrets

* no passwords
* no private keys
* no tokens
* no capabilities
* no test credentials

### Logging

* no plaintext messages
* no cryptographic secrets
* no sensitive Space names

### Storage

* no plaintext messages
* no plaintext master keys
* no plaintext passwords

### Network

* TLS enforced
* WSS enforced
* invalid certificates rejected
* relay cannot decrypt messages

### UI

* lock clears sensitive state
* Space switching clears previous Space
* panic lock clears volatile state

### Dependencies

* no telemetry
* no unnecessary tracking
* no suspicious dependencies

---

# 31. PRODUCT TELEMETRY POLICY

VEIL must ship with:

```text
NO ANALYTICS
NO TRACKING
NO ADVERTISING
NO TELEMETRY BY DEFAULT
```

If diagnostics are ever added later, they must be:

* explicit
* opt-in
* privacy-preserving
* documented

Do not add telemetry in Phase 18.

---

# 32. TESTING

Add comprehensive tests.

At minimum:

```text
tests/phase18-onboarding.test.ts
tests/phase18-space-ux.test.ts
tests/phase18-contact-flow.test.ts
tests/phase18-chat-ux.test.ts
tests/phase18-attachment-ux.test.ts
tests/phase18-group-ux.test.ts
tests/phase18-device-ux.test.ts
tests/phase18-settings.test.ts
tests/phase18-responsive-ui.test.ts
tests/phase18-accessibility.test.ts
tests/phase18-error-handling.test.ts
tests/phase18-offline-ux.test.ts
tests/phase18-pwa-security.test.ts
tests/phase18-release-artifacts.test.ts
tests/phase18-migration-safety.test.ts
tests/phase18-security-regression.test.ts
```

Test actual behavior rather than merely checking that files exist.

---

# 33. REAL USER JOURNEY TEST

Create one complete automated integration scenario:

```text
Fresh installation
        ↓
First launch
        ↓
Onboarding
        ↓
Create Personal Space
        ↓
Restart
        ↓
Unlock
        ↓
Create Contact
        ↓
Generate Invitation
        ↓
Second client accepts
        ↓
Verify identity
        ↓
Start Chat
        ↓
Send message
        ↓
Receive message
        ↓
Reply
        ↓
Send attachment
        ↓
Create Group
        ↓
Add contact
        ↓
Send group message
        ↓
Go offline
        ↓
Send message
        ↓
Restart
        ↓
Reconnect
        ↓
Message delivered
        ↓
Lock Space
        ↓
Verify plaintext UI state cleared
        ↓
Unlock
        ↓
Verify data still exists
```

This is the most important Phase 18 integration test.

---

# 34. PERFORMANCE

Do not sacrifice application responsiveness.

Target:

```text
Initial UI render < 2 seconds on a normal desktop
Conversation switching < 100 ms
Local search < 20 ms for 1,000 indexed records
Message composer interaction effectively instantaneous
No unnecessary full-app React rerenders
```

Profile before optimizing.

Do not weaken cryptography to meet performance targets.

---

# 35. BROWSER COMPATIBILITY

Test the actual browser APIs used by VEIL.

Target:

```text
Chrome/Chromium
Firefox
Edge
Safari where practical
```

Document unsupported features honestly.

---

# 36. DOCUMENTATION

Create:

```text
docs/USER_GUIDE.md
docs/FAQ.md
docs/PRIVACY_GUIDE.md
docs/TROUBLESHOOTING.md
docs/BETA_TESTING.md
docs/RELEASE_SECURITY_CHECKLIST.md
docs/UX_GUIDELINES.md
```

The user guide must explain:

* creating Spaces
* unlocking
* creating contacts
* invitations
* verification
* messaging
* attachments
* groups
* devices
* recovery
* locking
* panic lock
* self-hosted relay configuration

Use simple language.

---

# 37. SELF-HOSTING UX

Make relay setup understandable.

Document:

```text
1. Install relay
2. Configure domain
3. Configure TLS
4. Start relay
5. Configure client
6. Test connection
```

Provide a simple health-check command.

Example:

```bash
npm run relay:health
```

if appropriate to the existing architecture.

Do not require users to understand internal protocol implementation.

---

# 38. DEMO / DEVELOPMENT MODE

Create a clearly isolated development/demo mode if one does not already exist.

It may provide:

* test Spaces
* test users
* local relay
* deterministic demo data

But:

**DEMO MODE MUST NEVER BE ENABLED IN PRODUCTION BUILDS.**

Do not ship fake security behavior as real security.

---

# 39. PRIVACY CLAIMS

Review every user-facing security claim.

Do NOT say:

> "Completely anonymous."

Instead use precise language:

> "VEIL encrypts message contents end to end. Your relay operator cannot decrypt your messages."

Also clearly explain:

> Network operators and relay infrastructure may still observe connection metadata such as IP addresses unless additional network privacy mechanisms are used.

Never promise impossible anonymity.

---

# 40. AI CONTINUITY

Update:

```text
docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/HANDOFF.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
```

Add appropriate ADRs.

The next AI agent must be able to continue without reconstructing the project from scratch.

`HANDOFF.md` must include:

```text
Phase completed
Current architecture
Files changed
Tests added
Tests passed
Build result
Git commit
Known limitations
Remaining work
Next recommended phase
```

---

# 41. GIT DISCIPLINE

Before implementation:

```bash
git status
git log -5 --oneline
```

During implementation:

Make coherent commits.

At completion:

```bash
npm test
npm run build
git diff
git status
```

The working tree must be clean.

Create a final commit:

```text
feat(phase-18): complete product UX, release packaging, and beta hardening
```

---

# 42. FINAL ACCEPTANCE CRITERIA

Phase 18 is complete ONLY if all of the following are true.

### Product

* [ ] First-time user can understand VEIL
* [ ] Onboarding works
* [ ] Space creation works
* [ ] Space switching works
* [ ] Contact creation works
* [ ] Invitation flow works
* [ ] Verification works
* [ ] 1-to-1 messaging works
* [ ] Groups work
* [ ] Attachments work
* [ ] Device management works
* [ ] Recovery works
* [ ] Offline messaging works
* [ ] Panic Lock works

### UX

* [ ] UI is coherent
* [ ] UI is attractive
* [ ] UI is responsive
* [ ] UI is accessible
* [ ] Empty states are polished
* [ ] Error messages are understandable
* [ ] Technical complexity is hidden from ordinary users

### Security

* [ ] Cryptographic core unchanged
* [ ] No plaintext secrets introduced
* [ ] No plaintext messages persisted
* [ ] No telemetry
* [ ] TLS remains fail-closed
* [ ] Space isolation remains intact
* [ ] Lock wipes sensitive state
* [ ] Panic Lock remains functional

### Storage

* [ ] Existing Spaces survive upgrades
* [ ] Messages survive restart
* [ ] Migration failures do not destroy data
* [ ] No plaintext storage introduced

### Distribution

* [ ] Production client builds
* [ ] Relay builds
* [ ] Release artifacts generated
* [ ] Checksums generated
* [ ] Deployment documentation works
* [ ] Self-hosting instructions work

### Testing

* [ ] Existing 316 tests still pass
* [ ] New Phase 18 tests pass
* [ ] Full end-to-end user journey passes
* [ ] Production build succeeds
* [ ] No skipped security tests
* [ ] No fake tests that only assert file existence

---

# 43. IMPORTANT — DO NOT DECLARE SUCCESS PREMATURELY

Passing tests does NOT automatically mean:

> "VEIL is production-ready."

At the end, classify the result honestly as one of:

```text
BETA READY
```

or

```text
RELEASE CANDIDATE
```

or

```text
NOT READY
```

based on the actual evidence.

If something prevents release, explicitly state it.

---

# 44. FINAL REPORT

When finished, provide:

## PHASE 18 COMPLETE

### 1. Product Changes

List all major UX/product changes.

### 2. Architecture Changes

List modified/new subsystems.

### 3. Security Impact

Explain what changed and what remained frozen.

### 4. Release Artifacts

List generated artifacts.

### 5. Tests

Report:

```text
Test files:
Tests:
Passed:
Failed:
Skipped:
```

### 6. Build

Report exact result.

### 7. Performance

Report measured results.

### 8. Browser Compatibility

Report tested browsers.

### 9. Git

Report:

```text
Commit:
Working tree:
```

### 10. Known Limitations

Be brutally honest.

### 11. Release Classification

Choose:

```text
BETA READY
RELEASE CANDIDATE
NOT READY
```

### 12. NEXT PHASE

Recommend the next phase based on **actual remaining engineering work**, not an arbitrary phase number.

---

# FINAL PRINCIPLE

VEIL is no longer being built as a cryptographic prototype.

It is being finished as a **real product**.

Prioritize:

**security → correctness → privacy → usability → simplicity → performance → aesthetics**

Never sacrifice the first three for the last four.

And most importantly:

> **Do not add complexity merely because the project has reached another phase. If something is already correctly implemented, integrate it and polish it rather than rebuilding it.**

**BEGIN PHASE 18.**
