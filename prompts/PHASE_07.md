# VEIL — PHASE 7

## Privacy UX, Panic Lock, Decoy Spaces & Human-Centered Security

```text
============================================================
VEIL — PHASE 7
PRIVACY UX, PANIC LOCK, DECOY ACCESS & HUMAN-CENTERED SECURITY
============================================================

MISSION

You are implementing PHASE 7 of VEIL.

Phase 7 transforms VEIL's cryptographic privacy architecture into a
usable, understandable, and carefully designed privacy UX.

Phase 1 established:
- Cryptographic Spaces
- credential-selected unlocking
- encrypted local storage

Phase 2 established:
- independent Space identities
- identity isolation

Phase 3 established:
- privacy-preserving transport
- blind mailbox architecture
- metadata minimization

Phase 4 established:
- 1-to-1 E2EE
- Double Ratchet

Phase 5 established:
- group E2EE
- membership security
- encrypted media

Phase 6 established:
- multi-device
- device linking
- device verification
- device revocation
- recovery

Phase 7 adds:

- simple privacy-first UX
- multiple Space credentials
- decoy Spaces
- panic lock
- quick lock
- hidden Space access
- privacy indicators
- secure onboarding
- understandable security controls
- privacy-preserving notifications
- local privacy controls
- anti-disclosure UX
- human-centered threat modeling

============================================================
0. CRITICAL SECURITY PRINCIPLE
============================================================

VEIL MUST NEVER CLAIM THAT A "PANIC PASSWORD" OR "DECOY SPACE"
PROVIDES PERFECT PLAUSIBLE DENIABILITY.

The application can attempt to reduce visible evidence and provide
credential-selected Spaces.

It cannot guarantee protection against an adversary who has:

- unrestricted forensic access to the device
- complete filesystem snapshots
- compromised operating system
- memory acquisition
- malware
- physical control of the hardware
- server-side traffic analysis
- coercive access to external accounts

All such limitations must be documented.

============================================================
1. TAKEOVER PROCEDURE
============================================================

Before modifying anything, read:

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
docs/DEVICE_MODEL.md
docs/RECOVERY_MODEL.md

Then read:

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md
docs/ai/CHANGELOG.md

Inspect Phase 1–6 implementation.

Run:

npm test

Do not start Phase 7 implementation until previous phases pass.

============================================================
2. PHASE 7 DESIGN GOAL
============================================================

VEIL should feel like:

"An extremely simple modern messenger."

NOT:

"A complicated security application."

The security should mostly happen underneath the UI.

The user should NOT need to understand:

- Argon2id
- HKDF
- Double Ratchet
- MLS
- X25519
- Ed25519
- key epochs
- blind mailbox tokens

to use VEIL safely.

============================================================
3. UX PRINCIPLE
============================================================

PRIMARY RULE:

PRIVACY SHOULD BE SIMPLE.

Do not expose technical cryptography unless the user asks for it.

Avoid overwhelming screens such as:

"X25519 identity key verified using protocol version 1.4."

Instead:

"Verified"

with an optional:

"Security details"

section.

============================================================
4. APPLICATION ENTRY SCREEN
============================================================

Design a clean entry screen.

The app must support credential-selected Spaces.

Conceptually:

             VEIL

       Enter your password

       [ • • • • • • • • ]

              Unlock

Do NOT automatically display:

- list of Spaces
- Space names
- number of Spaces
- hidden Spaces
- recent conversations
- account identity

before authentication.

The existence of multiple Spaces must not be unnecessarily disclosed.

============================================================
5. MULTIPLE PASSWORDS
============================================================

VEIL's core feature:

Different credentials can unlock different Spaces.

Example:

Password A
   ↓
Main Space

Password B
   ↓
Private Space

Password C
   ↓
Decoy Space

The login interface should not reveal which password corresponds to
which Space.

Incorrect credentials should produce a generic response.

Do NOT display:

"Wrong private password."

Use a generic:

"Unable to unlock."

============================================================
6. SPACE DISCOVERY
============================================================

After unlocking a Space:

The user sees only the currently unlocked Space.

Do not show:

- other Space names
- other Space avatars
- other Space notification counts
- other Space messages
- other Space contacts

unless the user explicitly enters a management flow that is permitted
by the security model.

============================================================
7. SPACE SWITCHING
============================================================

Do not make switching Spaces require displaying a visible list of all
Spaces.

Possible UX:

Lock current Space

        ↓

Return to generic unlock screen

        ↓

Enter another credential

        ↓

Different Space opens

This preserves the core credential-selected architecture.

============================================================
8. SPACE NAMES
============================================================

A Space may have a name internally.

However:

Before unlocking:

Space names must not be exposed.

After unlocking:

Only the active Space name should be shown.

Do not create a global:

"Spaces"

screen that reveals:

Main
Private
Secret
Decoy

unless explicitly requested and authorized.

============================================================
9. DECOY SPACE
============================================================

VEIL may support a decoy Space.

A decoy Space is a legitimate encrypted Space.

It must not be:

"Fake UI with fake messages."

It should be a real functional Space.

It may contain:

- real chats
- real groups
- real contacts
- real settings

The architecture must NOT depend on pretending the decoy is fake.

============================================================
10. DECOY CREDENTIAL
============================================================

The decoy credential must behave like a normal credential.

Entering it should:

- derive the appropriate key
- unlock the corresponding Space
- load its encrypted state

Do NOT implement:

if password == "1234"
    show fake account

Hard-coded decoy passwords are prohibited.

============================================================
11. DECOY SPACE ISOLATION
============================================================

The decoy Space must be cryptographically independent.

Verify:

SMK_Main != SMK_Private
SMK_Private != SMK_Decoy
SMK_Main != SMK_Decoy

No Space may decrypt another Space's data.

============================================================
12. PANIC LOCK
============================================================

Implement:

panicLock()

The panic lock immediately attempts to:

- lock active Space
- destroy active sessions
- wipe volatile cryptographic material
- clear sensitive UI state
- cancel sensitive operations where possible
- return to generic unlock screen

It must NOT claim perfect secure deletion.

============================================================
13. PANIC LOCK TRIGGERS
============================================================

Support configurable triggers.

Potential triggers:

- dedicated UI button
- lock shortcut
- device/system lock event
- inactivity timeout

Do NOT implement dangerous or unreliable automatic triggers without
documenting their limitations.

Avoid accidental panic activation.

============================================================
14. QUICK LOCK
============================================================

Implement a simpler:

Lock

action.

Difference:

LOCK:

Normal security operation.

PANIC LOCK:

Aggressive immediate privacy operation.

The user should understand the difference.

============================================================
15. PANIC LOCK UX
============================================================

The panic control should not be accidentally triggered.

Possible UI:

Long press → Lock

or

Long press → Panic Lock

The exact UX must be validated for usability.

Do NOT use hidden gestures that users cannot discover.

============================================================
16. PANIC LOCK + MULTI-DEVICE
============================================================

Panic Lock is primarily local.

Do not automatically:

- revoke all devices
- delete the Space
- delete remote messages
- delete server data

unless explicitly configured as a separate operation.

Local panic locking must not silently become account destruction.

============================================================
17. REMOTE DEVICE REVOCATION
============================================================

Keep this separate:

Local Panic Lock

vs.

Remote Device Revocation

Example:

Phone lost:

Laptop
  ↓
Devices
  ↓
Phone
  ↓
Revoke

This is a Phase 6 security function.

Phase 7 should expose it through understandable UX.

============================================================
18. PRIVACY MODE
============================================================

Introduce a simple privacy mode.

Potential controls:

Privacy Mode
- Hide message previews
- Hide sender names
- Hide media previews
- Blur sensitive content
- Auto-lock
- Disable screenshots where platform supports it

Do not claim screenshot prevention is universally enforceable.

============================================================
19. NOTIFICATION PRIVACY
============================================================

Default notifications should avoid exposing message content.

Avoid:

"John: I'm meeting you at the secret location at 7."

Prefer:

"New message"

or an equally generic notification.

Allow the user to choose:

High privacy
Balanced
Convenient

But explain the tradeoff.

============================================================
20. NOTIFICATION SPACE ISOLATION
============================================================

Notifications from different Spaces must not accidentally reveal:

- Space name
- private contact
- private group
- message content

A locked Space must not continue displaying sensitive content.

============================================================
21. LOCKED-STATE UI
============================================================

When a Space locks:

Clear from UI:

- conversation content
- contact information
- media previews
- search results
- drafts where appropriate
- clipboard-sensitive data where practical

Do not merely hide the screen visually while leaving sensitive data
available to UI components.

============================================================
22. SCREENSHOT PROTECTION
============================================================

Where platform capabilities permit:

Provide optional screenshot/screen-recording restrictions.

Document:

- platform limitations
- OS differences
- external-camera limitations

Do not claim:

"Screenshots are impossible."

============================================================
23. APP SWITCHER PRIVACY
============================================================

When the app goes into the background:

Avoid exposing sensitive conversation previews in the OS task switcher.

Use platform-supported privacy mechanisms.

Test:

- Android
- desktop
- supported future platforms

according to the actual project targets.

============================================================
24. CLIPBOARD PRIVACY
============================================================

Sensitive copied content can remain in clipboard history.

Implement appropriate privacy behavior where platform APIs allow it.

Examples:

- warn when copying sensitive information
- clear VEIL-managed clipboard content where practical
- never automatically assume clipboard control is absolute

Document OS limitations.

============================================================
25. SCREEN CONTENT CLEARING
============================================================

When locked:

UI must transition to a neutral state.

Do not leave:

- decrypted images
- chat text
- usernames
- private group names

in visible UI layers.

============================================================
26. AUTO-LOCK
============================================================

Implement configurable auto-lock:

Off
1 minute
5 minutes
15 minutes
30 minutes

Potentially:

On app background
On screen lock
On device idle

The exact options must depend on platform capability.

============================================================
27. AUTO-LOCK + ACTIVE OPERATIONS
============================================================

Do not corrupt cryptographic operations during auto-lock.

If media is uploading:

Locking may:

- pause operation
- continue encrypted transfer without exposing plaintext
- or safely cancel it

depending on architecture.

Document behavior.

============================================================
28. HIDDEN CONTENT SEARCH
============================================================

Search must operate only within the currently unlocked Space.

A search in Main Space must never reveal:

Private Space content.

Likewise:

Private Space search must not reveal Main Space content.

============================================================
29. GLOBAL SEARCH PROHIBITED
============================================================

Do not implement a global plaintext search across all Spaces.

This could create a major privacy boundary violation.

============================================================
30. CONTACT UX
============================================================

Contacts should be represented simply.

Avoid exposing unnecessary identity metadata.

Use:

Name
Avatar
Verification status

with optional security details.

============================================================
31. SAFETY / VERIFICATION UX
============================================================

For identity verification:

Default:

"Verified"

Advanced:

"Security details"

The user can inspect:

- identity fingerprint
- device verification
- key changes
- verification history

Do not force cryptographic terminology into normal conversation UI.

============================================================
32. IDENTITY CHANGE WARNING
============================================================

If a contact's cryptographic identity changes:

DO NOT silently hide it.

Display a clear warning.

Example:

"Security information changed for this contact."

Then provide:

Review

The user can inspect the affected device/key.

============================================================
33. GROUP SECURITY UX
============================================================

Group security should be understandable.

If a member is added/removed:

show an appropriate system event.

Example:

"Alex joined the group."

"Alex was removed from the group."

Do not expose raw cryptographic epoch numbers.

Advanced users may inspect security details.

============================================================
34. DEVICE MANAGEMENT UX
============================================================

Create:

Settings
  ↓
Devices

Display:

This device
Laptop
Tablet

Each device:

- name
- verification status
- approximate last activity if appropriate
- revoke option

Do not expose unnecessary network metadata.

============================================================
35. RECOVERY UX
============================================================

Recovery must be understandable.

Example:

Settings
  ↓
Security
  ↓
Recovery

Show:

Recovery enabled

or:

Recovery not configured

If not configured:

"Without recovery, losing all authorized devices may make your encrypted
data permanently inaccessible."

Do not pressure the user into weakening privacy.

============================================================
36. RECOVERY SECRET DISPLAY
============================================================

If the recovery credential is displayed:

- show it only after authentication
- require deliberate confirmation
- discourage screenshots
- provide copy functionality carefully
- explain that anyone possessing it may gain recovery access

Never log it.

============================================================
37. RECOVERY CONFIRMATION
============================================================

Require the user to confirm they stored the recovery credential.

Do not simply display:

"Done."

Require a meaningful verification step.

============================================================
38. DECOY + SETTINGS
============================================================

Settings opened from a Decoy Space must show only that Space's settings.

Do not expose:

- hidden Spaces
- private device relationships
- hidden recovery metadata
- private contacts

unless explicitly part of the currently authorized Space.

============================================================
39. NO "SECRET SPACE" LABELS
============================================================

Avoid terminology such as:

"Secret Space"

"Hidden Account"

"Real Account"

in the UI.

These labels themselves create disclosure risk.

Use neutral terminology:

Spaces

or

profiles

depending on the final UX.

============================================================
40. SPACE CREATION UX
============================================================

Creating a Space should be simple.

Example:

Settings
  ↓
Spaces
  ↓
Create Space

Fields:

Space name
Password
Confirm password

Optional:

Decoy / alternate Space configuration

Do not expose internal cryptographic terminology.

============================================================
41. PASSWORD STRENGTH
============================================================

Provide useful password guidance.

Do not rely solely on:

"Password strength: 93%"

Prefer practical guidance.

Warn about:

- reused passwords
- short passwords
- predictable passwords

Do not transmit passwords to a server for strength analysis.

============================================================
42. PASSWORD CHANGE UX
============================================================

Changing a Space password:

Old password
New password
Confirm

After success:

"Password changed."

Do not display key derivation information.

The operation must preserve the Space cryptographic identity according
to Phase 1's architecture.

============================================================
43. DECOY PASSWORD SAFETY
============================================================

Do not encourage users to create obvious decoy passwords.

Do not provide:

"Use 1234 for your decoy."

The decoy should be a genuine independent Space.

============================================================
44. LOCK SCREEN PRIVACY
============================================================

The lock screen should reveal minimal information.

Do not display:

- Space name
- avatar tied to private identity
- number of messages
- private contact names

unless explicitly chosen by the user and consistent with the threat
model.

============================================================
45. ACCESSIBILITY
============================================================

Privacy UX must remain accessible.

Support:

- keyboard navigation
- screen readers where appropriate
- large text
- high contrast
- touch accessibility
- clear focus states

Do not use visual hiding as the only way to communicate security state.

============================================================
46. ERROR MESSAGES
============================================================

Avoid information disclosure.

Bad:

"Private Space password incorrect."

Better:

"Unable to unlock."

Bad:

"Space does not exist."

Better:

"Unable to unlock."

Errors must not reveal which credential maps to which Space.

============================================================
47. TIMING CONSIDERATIONS
============================================================

Credential handling must avoid obvious differences that reveal:

- which Space exists
- whether a credential is valid
- how many Spaces exist

Where practical, avoid unnecessary timing distinctions.

Document limitations.

============================================================
48. PRIVACY-FIRST ONBOARDING
============================================================

First launch should explain:

VEIL protects your conversations with encryption.

VEIL cannot protect you from a fully compromised device.

Your passwords are important.

Recovery is optional and has tradeoffs.

Do not overwhelm the user.

============================================================
49. SECURITY EDUCATION
============================================================

Create optional:

"How VEIL protects you"

Explain:

- encryption
- Spaces
- device security
- verification
- recovery
- limitations

Use simple language.

============================================================
50. NO SECURITY THEATER
============================================================

Do NOT add:

- fake "military-grade" labels
- fake encryption animations
- meaningless padlock everywhere
- "100% anonymous" claims
- "unhackable" claims
- fake security percentages

Every security indicator must correspond to a real property.

============================================================
51. UI DESIGN PRINCIPLE
============================================================

VEIL should specifically address the usability problem identified with
privacy-focused messengers such as SimpleX:

DO NOT make privacy features obscure the basic messaging experience.

The main chat interface should be immediately understandable.

Primary navigation should make sense to a new user.

The user should understand within seconds:

- how to start a chat
- how to open a conversation
- how to send a message
- how to create a group
- how to access settings

Advanced privacy controls should be secondary.

============================================================
52. MAIN NAVIGATION
============================================================

Use a familiar messaging structure.

Possible:

Chats
Contacts
Settings

or an equivalent simple structure.

Do not create a navigation hierarchy filled with cryptographic concepts.

============================================================
53. CHAT SCREEN
============================================================

The chat screen should prioritize:

- messages
- message composer
- attachments
- voice controls if already supported
- conversation identity

Security status should be subtle.

Example:

Verified ✓

rather than:

"Double Ratchet session: epoch 483..."

============================================================
54. NEW CHAT FLOW
============================================================

New Chat

      ↓

Search / enter contact identifier

      ↓

Select contact

      ↓

Conversation

Make the process understandable without explaining the cryptographic
protocol.

============================================================
55. GROUP CREATION UX
============================================================

New Group

      ↓

Select members

      ↓

Group name

      ↓

Create

The cryptographic membership protocol runs underneath.

============================================================
56. MEDIA UX
============================================================

Attachments should feel normal.

The user should not have to manually:

- encrypt files
- generate keys
- upload ciphertext
- manage media keys

VEIL performs this automatically.

============================================================
57. SECURITY DETAILS SCREEN
============================================================

Provide an advanced security screen.

Example:

Conversation
   ↓
Security

Shows:

End-to-end encrypted
Verified
Devices
Security information

Advanced users may inspect technical information.

============================================================
58. SPACE SECURITY SCREEN
============================================================

Provide:

Space
  ↓
Security

Show:

- Space locked/unlocked state
- password change
- auto-lock
- recovery
- devices
- panic lock
- privacy settings

Do not reveal other Space identities.

============================================================
59. DECOY SPACE BEHAVIOR
============================================================

Decoy Space must behave like a legitimate Space.

It must support normal:

- messaging
- groups
- media
- settings
- device management

Do not create an obviously inferior fake environment.

============================================================
60. DECOY SPACE NOTIFICATION POLICY
============================================================

Decoy Space notifications must not expose the existence of another
Space.

If notifications are enabled:

they must appear indistinguishable from normal notifications.

============================================================
61. DECOY SPACE SERVER BEHAVIOR
============================================================

Do not create an obvious server-side marker such as:

space_type = "secret"

unless the threat model explicitly permits it.

Minimize server knowledge of Space semantics.

============================================================
62. LOCAL METADATA
============================================================

Review local metadata.

Do not unnecessarily store:

- Space names globally
- chat previews globally
- private contact indexes globally
- decrypted thumbnails globally
- cross-Space search indexes

============================================================
63. APP ANALYTICS
============================================================

DO NOT add analytics.

DO NOT add telemetry.

DO NOT add advertising SDKs.

DO NOT add behavioral tracking.

If future diagnostics are considered:

they must be explicitly opt-in and privacy reviewed.

============================================================
64. CRASH REPORTING
============================================================

Do not automatically upload crash dumps containing:

- plaintext messages
- media
- passwords
- keys
- contact data

If crash reporting is ever introduced, it must be privacy reviewed.

============================================================
65. LOCAL LOGGING
============================================================

Production logging must avoid sensitive data.

Provide appropriate development diagnostics without leaking:

- passwords
- keys
- message text
- media
- private contact information

============================================================
66. PRIVACY UX TESTING
============================================================

Test the application as a completely new user.

A new user should be able to:

1. create a Space
2. unlock it
3. start a chat
4. create a group
5. send a message
6. attach media
7. lock the Space
8. unlock it again

without reading cryptographic documentation.

============================================================
67. CONFUSION TESTING
============================================================

Explicitly test:

"What would a first-time user misunderstand?"

Look for:

- confusing terminology
- hidden actions
- unclear buttons
- unnecessary technical information
- ambiguous lock behavior
- unclear Space behavior
- confusing device verification

Fix these issues without weakening security.

============================================================
68. PRIVACY UX TESTS
============================================================

Create:

tests/privacy-ui.test.ts
tests/space-ux.test.ts
tests/panic-lock.test.ts
tests/decoy-space.test.ts
tests/notification-privacy.test.ts
tests/locked-state.test.ts
tests/privacy-settings.test.ts
tests/security-indicators.test.ts
tests/error-disclosure.test.ts

============================================================
69. PANIC LOCK TESTS
============================================================

Verify:

[ ] active Space becomes locked

[ ] active session destroyed

[ ] sensitive UI state cleared

[ ] cryptographic session material wiped where practical

[ ] sensitive media previews removed

[ ] sensitive chat content removed from visible UI

[ ] app returns to neutral unlock state

[ ] no hidden Space information appears

[ ] panic lock does not accidentally delete the Space

[ ] panic lock does not silently revoke every device

============================================================
70. DECOY TESTS
============================================================

Verify:

[ ] decoy Space has independent SMK

[ ] decoy password unlocks only decoy Space

[ ] main password unlocks only main Space

[ ] private password unlocks only private Space

[ ] wrong password produces generic failure

[ ] Space names are not globally exposed

[ ] decoy Space functions normally

[ ] decoy Space does not reveal hidden Spaces

[ ] cross-Space search is impossible

[ ] cross-Space storage access is rejected

============================================================
71. NOTIFICATION TESTS
============================================================

Verify:

[ ] locked Space does not expose message content

[ ] notification preview is configurable

[ ] private Space name is not exposed unintentionally

[ ] private contact name is not exposed unintentionally

[ ] notification state is cleared appropriately after locking

============================================================
72. APP BACKGROUND TESTS
============================================================

Verify:

[ ] sensitive content is protected in app switcher

[ ] background transition clears protected UI where appropriate

[ ] auto-lock works

[ ] unlocking restores the correct Space

[ ] switching Spaces does not leak prior Space content

============================================================
73. CROSS-SPACE UI TESTS
============================================================

Create:

Main
Private
Decoy

Verify:

Main UI cannot display Private data.

Private UI cannot display Main data.

Decoy UI cannot display Main/Private data.

Search indexes remain isolated.

Notification state remains isolated.

Cached thumbnails remain isolated.

============================================================
74. THREAT MODEL UPDATE
============================================================

Update:

docs/THREAT_MODEL.md

Add:

- casual observer
- unlocked-device observer
- lock-screen observer
- app-switcher observer
- notification observer
- coercive observer
- stolen-device attacker
- malicious application
- compromised OS
- forensic attacker

Clearly state:

WHAT PANIC LOCK CAN DO.

WHAT PANIC LOCK CANNOT DO.

WHAT DECOY SPACES CAN DO.

WHAT DECOY SPACES CANNOT GUARANTEE.

============================================================
75. PRIVACY DOCUMENTATION
============================================================

Update:

docs/PRIVACY.md

Explain the complete user-visible privacy model.

Include:

- Spaces
- credential-selected unlocking
- device privacy
- notification privacy
- metadata
- media
- groups
- recovery
- limitations

============================================================
76. KNOWN LIMITATIONS
============================================================

Update:

docs/KNOWN_LIMITATIONS.md

Explicitly document:

- JavaScript memory limitations
- OS-level screenshots
- malware
- compromised device
- forensic recovery
- notification OS behavior
- clipboard limitations
- traffic analysis
- server-visible metadata
- decoy limitations
- coercion limitations
- remote deletion limitations

============================================================
77. SECURITY LANGUAGE
============================================================

Review ALL user-facing security text.

Remove unsupported claims such as:

"100% anonymous"

"completely invisible"

"untraceable"

"unhackable"

"military-grade"

"forensic-proof"

Replace them with accurate descriptions.

============================================================
78. AI CONTINUITY
============================================================

Update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
docs/ai/HANDOFF.md

HANDOFF.md must include:

- privacy UX architecture
- Space switching model
- decoy Space model
- panic lock behavior
- notification privacy
- app-switcher privacy
- auto-lock
- security indicators
- recovery UX
- device UX
- known limitations
- privacy audit results
- usability findings
- exact Phase 8 requirements

============================================================
79. NO UNRELATED WORK
============================================================

DO NOT implement:

- anonymous networking infrastructure
- Tor integration
- voice/video calls
- public social discovery
- advertisements
- analytics
- telemetry
- cryptocurrency
- payment systems
- unrelated protocol changes

Do not rewrite the cryptographic architecture unless a Phase 7
security issue requires it.

============================================================
80. DEFINITION OF DONE
============================================================

Phase 7 is complete ONLY when:

CORE UX

[ ] first launch is understandable
[ ] Space unlock is simple
[ ] chat UX is intuitive
[ ] group creation is intuitive
[ ] media UX is intuitive
[ ] settings are understandable

SPACES

[ ] multiple credentials work
[ ] current Space is isolated
[ ] other Spaces are not unnecessarily disclosed
[ ] cross-Space search impossible
[ ] cross-Space cache leakage prevented

DECOY

[ ] decoy Space implemented
[ ] decoy credential implemented
[ ] decoy Space cryptographically independent
[ ] decoy Space behaves normally
[ ] decoy does not reveal other Spaces

PANIC

[ ] quick lock implemented
[ ] panic lock implemented
[ ] sensitive UI cleared
[ ] session state destroyed
[ ] no accidental deletion
[ ] limitations documented

PRIVACY UX

[ ] notification privacy
[ ] app-switcher privacy
[ ] clipboard handling
[ ] screenshot protections where supported
[ ] auto-lock
[ ] locked-state UI
[ ] privacy mode

SECURITY UX

[ ] identity verification understandable
[ ] identity changes visible
[ ] device management understandable
[ ] recovery understandable
[ ] security details available

SECURITY

[ ] no analytics
[ ] no telemetry
[ ] no sensitive logging
[ ] no unsupported security claims
[ ] malicious UX cases tested

TESTING

[ ] all Phase 1 tests pass
[ ] all Phase 2 tests pass
[ ] all Phase 3 tests pass
[ ] all Phase 4 tests pass
[ ] all Phase 5 tests pass
[ ] all Phase 6 tests pass
[ ] Phase 7 tests pass

DOCUMENTATION

[ ] threat model updated
[ ] privacy model updated
[ ] limitations updated
[ ] AI continuity updated

REPOSITORY

[ ] no secrets committed
[ ] full test suite passes
[ ] Git diff reviewed
[ ] working tree clean
[ ] Phase 7 commit created

============================================================
81. FINAL STOP CONDITION
============================================================

STOP AFTER PHASE 7.

DO NOT IMPLEMENT PHASE 8.

The repository must be left ready for:

PHASE 8 —
METADATA MINIMIZATION, TRAFFIC ANALYSIS RESISTANCE
AND PRIVACY-PRESERVING NETWORK BEHAVIOR

============================================================
FINAL PRINCIPLES
============================================================

PRIVACY MUST NOT MAKE THE APP CONFUSING.

SECURITY SHOULD HAPPEN UNDER THE UI.

DO NOT EXPOSE HIDDEN SPACES UNNECESSARILY.

DO NOT MAKE DECOY SPACES OBVIOUSLY FAKE.

DO NOT CLAIM PERFECT PLAUSIBLE DENIABILITY.

PANIC LOCK IS NOT A MAGIC FORENSIC ERASE BUTTON.

DO NOT CLAIM SECURE DELETION THAT THE PLATFORM CANNOT GUARANTEE.

DO NOT LEAK PRIVATE CONTENT THROUGH NOTIFICATIONS.

DO NOT LEAK PRIVATE CONTENT THROUGH APP-SWITCHER PREVIEWS.

DO NOT CREATE GLOBAL SEARCH ACROSS SPACES.

DO NOT ADD ANALYTICS OR TELEMETRY.

DO NOT USE SECURITY THEATER.

EVERY SECURITY INDICATOR MUST REPRESENT A REAL PROPERTY.

KEEP THE NORMAL CHAT EXPERIENCE SIMPLE.

ADVANCED SECURITY DETAILS SHOULD BE OPTIONAL.

PRESERVE ALL SECURITY PROPERTIES FROM PHASES 1–6.

STOP WHEN PHASE 7 IS COMPLETE.
```

### One important architectural change in this phase

This phase is deliberately **not just "add a panic button."**

It turns VEIL's original idea into an actual UX model:

```text
                    VEIL
                      │
              ┌───────┴───────┐
              │               │
         Credential A     Credential B
              │               │
          MAIN SPACE       PRIVATE SPACE
              │               │
         normal chats     private chats
              │               │
              └───────┬───────┘
                      │
                Generic Lock
                      │
                ┌─────┴─────┐
                │           │
             unlock      panic lock
                │           │
                ▼           ▼
             Space       neutral state
```

And the **really important UX decision** is that a new user shouldn't have to understand any of this. They should see something closer to a normal messenger, while the cryptographic machinery, Space isolation, device verification, and privacy controls operate underneath.

That directly addresses your earlier concern about apps like SimpleX: **VEIL's privacy model can be sophisticated without making the basic chat experience feel like a cybersecurity dashboard.**
