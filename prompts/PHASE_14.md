# VEIL — PHASE 14
# PRODUCTION APPLICATION SHELL, REAL MESSAGING UI & CLIENT INTEGRATION

You are continuing development of the existing VEIL project.

IMPORTANT:
VEIL Phases 0–13 have already been implemented and verified.
DO NOT rebuild the project from scratch.
DO NOT replace existing architecture.
DO NOT create fake/mock messaging infrastructure.
DO NOT invent APIs when an existing implementation can be used.
DO NOT modify the frozen cryptographic/security core merely to make UI integration easier.

Your job is to turn the existing VEIL security/networking foundation into a genuinely usable messaging application.

============================================================
0. MANDATORY TAKEOVER PROCEDURE
============================================================

Before writing ANY code:

1. Read:
   - AGENTS.md
   - README.md
   - docs/ARCHITECTURE.md
   - docs/THREAT_MODEL.md
   - docs/CRYPTOGRAPHY.md
   - docs/KEY_HIERARCHY.md
   - docs/SPACE_MODEL.md
   - docs/IDENTITY_MODEL.md
   - docs/METADATA_MODEL.md
   - docs/PRIVACY.md
   - docs/SECURITY.md
   - docs/KNOWN_LIMITATIONS.md

2. Read ALL relevant AI continuity files:
   - docs/ai/PROJECT_CONTEXT.md
   - docs/ai/CURRENT_STATE.md
   - docs/ai/ACTIVE_TASK.md
   - docs/ai/HANDOFF.md
   - docs/ai/DECISIONS.md
   - docs/ai/SECURITY_RULES.md
   - docs/ai/CHANGELOG.md

3. Read the actual source code before designing integration:
   - src/crypto/
   - src/spaces/
   - src/ratchet/
   - src/group/
   - src/recovery/
   - src/storage/
   - src/server/
   - src/network/

4. Inspect:
   - package.json
   - tsconfig.json
   - vite configuration
   - existing entry points
   - existing CSS/design system
   - existing test configuration

5. Inspect the existing public APIs.

DO NOT ASSUME that the architecture described in documentation exactly matches
the implementation.

The source code is the implementation authority.

6. Run the existing test suite BEFORE making modifications:

   npm test

7. Run:

   npm run build

Record the baseline results.

If anything is already failing:
- identify it,
- determine whether it is pre-existing,
- do NOT silently rewrite unrelated code.

============================================================
1. PHASE 14 OBJECTIVE
============================================================

Build the real VEIL client application shell and messaging interface.

The finished application must allow a user to interact with the existing:

    Space system
    ↓
    Identity system
    ↓
    E2EE / Double Ratchet
    ↓
    Group system
    ↓
    Encrypted IndexedDB
    ↓
    NetworkManager
    ↓
    HTTP/WebSocket transport
    ↓
    VEIL Relay

The UI must be a REAL client.

It must NOT simulate:

- message sending
- message receiving
- delivery status
- online status
- groups
- devices
- encryption
- mailbox state
- Spaces
- recovery
- network connectivity

Use the actual underlying implementation.

============================================================
2. SECURITY FREEZE
============================================================

The following subsystems are considered FROZEN unless an integration bug
makes a minimal compatibility change absolutely necessary:

    src/crypto/
    src/spaces/
    src/ratchet/
    src/group/
    src/recovery/

DO NOT:

- replace cryptographic primitives
- implement new cryptography
- weaken authentication
- expose master keys to React state
- store passwords in UI state longer than absolutely necessary
- log plaintext messages
- log passwords
- log private keys
- log session keys
- expose StorageKey/SMK/KEK to browser console
- bypass SpaceSession authorization
- bypass NetworkManager
- write plaintext messages directly to IndexedDB
- use localStorage for secrets
- use sessionStorage for secrets
- create a second parallel storage system
- create a second parallel networking system

The UI is an untrusted presentation layer.

Sensitive cryptographic material must remain inside the appropriate service/session
boundaries.

============================================================
3. PRODUCT VISION
============================================================

VEIL is a privacy-focused messaging application.

Its defining UX concept is:

    ONE APPLICATION
        +
    MULTIPLE INDEPENDENT SPACES
        +
    DIFFERENT CREDENTIALS
        =
    DIFFERENT APP WORLDS

Example:

    Password A → Personal Space
    Password B → Work Space
    Password C → Private/Decoy Space

A person opening VEIL should NOT need to understand cryptography.

The application should feel:

    simple
    modern
    calm
    fast
    obvious
    attractive
    privacy-conscious

Do NOT copy Telegram or SimpleX visually.

Borrow familiar messaging conventions where useful, but design VEIL's own
identity.

A new user should understand the primary workflow within seconds.

============================================================
4. UX PRINCIPLE — HIDE THE COMPLEXITY
============================================================

The underlying architecture is extremely sophisticated.

The UI must not be.

Do NOT expose unnecessary terminology such as:

    Argon2id
    XChaCha20
    HKDF
    SMK
    KEK
    Double Ratchet
    Sender Key
    epoch
    mailbox capability
    envelope
    relay token

unless the user explicitly enters an advanced/security information screen.

Instead show:

    "Encrypted"
    "Verified"
    "Connected"
    "Waiting for delivery"
    "Private"
    "Device verified"

Security information can exist behind:

    Conversation → Security
    Contact → Verify
    Settings → Privacy & Security

============================================================
5. APPLICATION STRUCTURE
============================================================

Build the following application shell:

    App
    ├── LockScreen
    └── AuthenticatedApp
         ├── Sidebar
         │    ├── SpaceSwitcher
         │    ├── Search
         │    ├── Chats
         │    ├── Groups
         │    └── Settings
         │
         └── MainContent
              ├── EmptyState
              ├── ConversationView
              ├── GroupView
              ├── ContactView
              └── SettingsView

Desktop layout:

    ┌───────────────────────────────────────────────────┐
    │ VEIL                                            │
    ├──────────────┬────────────────────────────────────┤
    │ Space        │ Conversation                       │
    │              │                                    │
    │ Personal     │ Bob                     🔒        │
    │              │                                    │
    │ Chats        │ Hello                              │
    │ Groups       │                         Hey        │
    │              │                                    │
    │              │                                    │
    │              │ ───────────────────────────────── │
    │              │ Message...                    ➤   │
    └──────────────┴────────────────────────────────────┘

Mobile:

    ┌──────────────────────┐
    │ Bob              🔒  │
    ├──────────────────────┤
    │                      │
    │ messages             │
    │                      │
    │                      │
    ├──────────────────────┤
    │ Message...        ➤  │
    └──────────────────────┘

The UI must be responsive.

============================================================
6. TECHNOLOGY
============================================================

Use the existing project stack.

Prefer:

    React
    TypeScript
    existing Vite setup
    existing CSS/design system

Do NOT introduce a massive UI framework unless the project already uses one
or there is a compelling architectural reason.

Minimize dependencies.

Do not add paid services.

Do not introduce cloud-hosted UI infrastructure.

Everything must remain locally developable and free.

============================================================
7. UI DESIGN SYSTEM
============================================================

Create or refine:

    src/ui/
    src/styles/

Use the existing design system if present.

The design should be:

- clean
- modern
- minimal
- highly readable
- responsive
- keyboard accessible
- touch friendly
- visually distinctive

Avoid:

- excessive gradients
- unnecessary glassmorphism
- clutter
- huge icons
- confusing nested menus
- technical terminology
- excessive animations

VEIL should look like a serious privacy application, not a crypto dashboard.

============================================================
8. CORE COMPONENTS
============================================================

Create the appropriate components, but adapt names/structure to the existing
project if equivalent components already exist.

Recommended structure:

src/ui/
├── App.tsx
├── app/
│   ├── AppRouter.tsx
│   ├── AppState.ts
│   └── sessionController.ts
│
├── components/
│   ├── LockScreen.tsx
│   ├── SpaceSwitcher.tsx
│   ├── Sidebar.tsx
│   ├── ConversationList.tsx
│   ├── ConversationItem.tsx
│   ├── ConversationView.tsx
│   ├── MessageList.tsx
│   ├── MessageBubble.tsx
│   ├── MessageComposer.tsx
│   ├── ContactHeader.tsx
│   ├── GroupHeader.tsx
│   ├── NewChatDialog.tsx
│   ├── NewGroupDialog.tsx
│   ├── ContactDetails.tsx
│   ├── GroupDetails.tsx
│   ├── SecurityDetails.tsx
│   ├── SettingsView.tsx
│   ├── DeviceManager.tsx
│   ├── RecoveryView.tsx
│   ├── PanicLockButton.tsx
│   └── NotificationIndicator.tsx
│
└── hooks/
    ├── useSpace.ts
    ├── useConversation.ts
    ├── useNetwork.ts
    ├── useMessages.ts
    └── useAutoLock.ts

Do not blindly create all of these files.

Reuse existing implementations where appropriate.

============================================================
9. LOCK SCREEN
============================================================

The initial application screen should be a neutral VEIL unlock screen.

It must NOT reveal all existing Spaces.

This is important for the multi-Space privacy model.

The user should be able to enter a credential and let the underlying
SpaceVaultManager determine which Space it unlocks.

Example:

    VEIL

    Enter password

    [____________________]

             Unlock

    [ Emergency Lock ]

Do NOT display:

    "Personal Space"
    "Secret Work"
    "Private Space"

before authentication unless the existing security model explicitly permits
that behavior.

Wrong credentials should produce a generic failure message.

Do not reveal whether a particular Space exists.

============================================================
10. SPACE EXPERIENCE
============================================================

After unlocking:

Show the active Space.

Example:

    Personal

    ● Secure

Allow:

    Switch Space
    Lock Space
    Create Space
    Change Space password
    Delete Space

Switching Spaces must:

1. destroy/lock the previous Space session,
2. clear sensitive UI state,
3. load the new Space,
4. reload its conversations,
5. reload its network state.

Never allow one Space's conversation data to remain visible after switching.

Test this aggressively.

============================================================
11. CONVERSATION LIST
============================================================

Show:

- contact/group name
- avatar or generated identity mark
- last message preview
- timestamp
- unread count
- delivery/network indicator where appropriate

Important:

The last-message preview is plaintext UI state only while the Space is unlocked.

On lock:

    purge conversation previews
    purge message bodies
    purge sensitive UI state

Do not persist plaintext previews outside the encrypted storage layer.

============================================================
12. NEW CHAT
============================================================

Implement a real New Chat flow.

Possible flow:

    New Chat
        ↓
    Contact identifier / identity exchange
        ↓
    Validate identity
        ↓
    Establish conversation
        ↓
    Conversation appears in chat list

Use the actual identity/conversation APIs.

If the existing backend does not yet expose a required operation:

STOP and inspect the architecture.

Do NOT create a fake contact system simply to make the UI appear functional.

Document the missing integration boundary.

============================================================
13. MESSAGE COMPOSER
============================================================

Implement:

- text input
- send button
- Enter to send
- Shift+Enter newline
- disabled state when locked/offline as appropriate
- sending state
- delivery state
- failed state
- retry

Message flow:

    User types
       ↓
    UI
       ↓
    Conversation service
       ↓
    Existing E2EE engine
       ↓
    NetworkManager
       ↓
    Relay
       ↓
    Recipient

Never:

    UI → Relay directly

Never:

    UI → plaintext storage

============================================================
14. MESSAGE STATES
============================================================

Represent real states from the underlying implementation.

For example:

    Sending
    Sent
    Delivered
    Failed
    Pending / Offline

Do not claim "Delivered" merely because the HTTP request succeeded.

Use actual delivery/ACK state.

If the backend only provides a more limited state model, accurately reflect that.

Do not invent stronger guarantees than the protocol provides.

============================================================
15. REAL-TIME RECEIVING
============================================================

Integrate WebSocket delivery through the existing NetworkManager.

Incoming flow:

    WebSocket
       ↓
    NetworkManager
       ↓
    E2EE engine
       ↓
    Conversation state
       ↓
    UI

The UI must react to:

- incoming messages
- delivery updates
- connection changes
- reconnecting
- offline state
- failures

No polling implementation should be introduced if the existing WebSocket
transport already provides the required functionality.

============================================================
16. OFFLINE MODE
============================================================

VEIL must remain usable when the network disappears.

Display a subtle state such as:

    Offline

or:

    Reconnecting…

Messages composed while offline should use the existing persistent outbound
queue.

Do not build a second offline queue in React.

When connection returns:

    NetworkManager drains queue
    ↓
    actual E2EE message transmission
    ↓
    real delivery state update

============================================================
17. GROUP UI
============================================================

Implement the real group workflow supported by the existing group subsystem.

Include:

- Create Group
- Group name
- Group description if supported
- Member list
- Add member
- Remove member
- Roles
- Group security state
- Group fingerprint/security information
- Epoch/security-change indicator where supported

When membership changes, show a clear human-readable security event:

    "A member was removed. Group security was updated."

Do not expose raw cryptographic state unless requested.

Use actual GroupManager/GroupStateManager APIs.

============================================================
18. CONTACT / IDENTITY UI
============================================================

Create a simple contact details screen.

Show:

    Name
    Identity status
    Verification status
    Devices if available
    Security information

Provide:

    Verify Contact

Use the existing identity/safety-number implementation.

Example:

    Bob

    ✓ Identity verified

    Security
    ─────────
    Safety number
    [Show]

Do not expose private identity keys.

============================================================
19. SECURITY VERIFICATION UX
============================================================

Create a friendly verification workflow.

Example:

    Verify Bob

    Compare these numbers on both devices.

       482 193
       771 402

    [They match]

The UI should explain why verification matters without overwhelming the user.

Never describe verification as successful unless the actual verification state
has been established.

============================================================
20. MEDIA UI
============================================================

If the existing encrypted media subsystem from earlier phases supports it,
integrate it.

Support appropriate:

- image
- document
- attachment

The UI should show:

    🔒 Encrypted attachment

and a preview where safe.

Never store plaintext media in localStorage or unencrypted IndexedDB.

Use the existing encrypted storage/media APIs.

If media encryption APIs are not actually implemented, DO NOT fake media
encryption.

Document the missing capability instead.

============================================================
21. SETTINGS
============================================================

Implement a clean Settings screen.

Sections:

    Account / Space
    Privacy
    Security
    Notifications
    Devices
    Recovery
    About

Privacy:

    Notification privacy
    Auto-lock
    Privacy screen options if supported

Security:

    Change password
    Panic lock
    Verification settings

Devices:

    Linked devices
    Revoke device

Recovery:

    Backup
    Restore

About:

    VEIL version
    Protocol version
    Security architecture summary

Do not expose sensitive cryptographic internals by default.

============================================================
22. PANIC LOCK
============================================================

Panic Lock must connect to the EXISTING panic/lock functionality.

When activated:

1. destroy active SpaceSession,
2. clear sensitive application state,
3. clear message bodies from React state,
4. clear conversation previews,
5. clear selected conversation,
6. clear attachment previews,
7. close sensitive dialogs,
8. disconnect relevant active networking state if required,
9. return to neutral unlock screen.

Do not claim memory has been perfectly erased.

Follow the project's documented best-effort memory hygiene model.

Panic Lock must be fast and visually obvious.

============================================================
23. AUTO-LOCK
============================================================

Integrate with the existing lock/session architecture.

Support the configured values already defined by VEIL.

Examples:

    1 minute
    5 minutes
    15 minutes
    1 hour
    Never

Reset inactivity timer on meaningful user interaction.

When auto-lock occurs:

    same security behavior as manual lock

Do not merely navigate to another page.

============================================================
24. NOTIFICATION PRIVACY
============================================================

Do NOT show plaintext message content in browser notifications by default.

Respect the project's notification privacy levels.

Examples:

    "New message"

or:

    "New message from Bob"

rather than:

    "Bob: Meet me at 7"

unless the user explicitly chooses the appropriate privacy level.

Do not leak message plaintext through document titles, logs, URLs, or browser
notification payloads.

============================================================
25. SEARCH
============================================================

Implement conversation search where the existing storage/message architecture
supports it.

IMPORTANT:

Search must not require creating a plaintext global message database.

Search should operate against decrypted data only while the relevant Space is
unlocked, or use an explicitly encrypted/search-safe mechanism already present.

If full encrypted search is not currently implemented:

- implement safe in-memory search for the active unlocked Space,
- do not create plaintext persistent indexes.

============================================================
26. ACCESSIBILITY
============================================================

The application must support:

- keyboard navigation
- visible focus states
- semantic buttons
- labels for inputs
- reasonable ARIA attributes
- screen-reader-friendly controls
- sufficient contrast
- touch-friendly targets

Do not make accessibility an afterthought.

============================================================
27. RESPONSIVE DESIGN
============================================================

Desktop:

    Sidebar + conversation

Tablet:

    Adaptive sidebar

Mobile:

    Conversation-first interface

Use:

    back navigation
    mobile drawer
    bottom navigation where appropriate

Do not simply shrink the desktop interface.

============================================================
28. PERFORMANCE
============================================================

Avoid rendering the entire conversation history unnecessarily.

Use virtualization or pagination if the existing architecture allows it.

Do not decrypt thousands of messages simultaneously merely because they exist.

Only load what the UI needs.

Avoid:

- unnecessary React rerenders
- duplicated message state
- duplicated network subscriptions
- duplicate WebSocket connections
- duplicate IndexedDB listeners

Ensure components clean up subscriptions on unmount.

============================================================
29. STATE MANAGEMENT
============================================================

Do not introduce a huge global state framework unless necessary.

Separate:

    UI state
    Session state
    Conversation state
    Network state

Sensitive state should have the shortest possible lifetime.

Never store:

    passwords
    master keys
    private keys
    raw session keys

in persistent UI state.

Do not place cryptographic secrets into URL parameters.

============================================================
30. ERROR HANDLING
============================================================

Every user-facing error must be understandable.

Bad:

    XChaCha20Poly1305AuthenticationError

Good:

    "We couldn't decrypt this message."

Bad:

    ERR_MAILBOX_CAPABILITY_HASH_MISMATCH

Good:

    "This conversation is temporarily unavailable."

Technical details may be logged internally according to the existing privacy
logging rules, but never expose secrets.

Do not leak whether a hidden Space exists.

============================================================
31. EMPTY STATES
============================================================

Design polished empty states.

Examples:

No conversations:

    "Your conversations will appear here."

No selected conversation:

    "Select a conversation to start messaging."

No groups:

    "Create your first private group."

Offline:

    "You're offline. Messages will be sent when you reconnect."

Make them helpful, not decorative clutter.

============================================================
32. SECURITY-CRITICAL UI TESTS
============================================================

Add tests covering at minimum:

1. Locked application reveals no message body.
2. Locked application reveals no conversation previews.
3. Switching Spaces clears previous Space UI state.
4. Space A messages cannot appear in Space B.
5. Panic Lock clears active conversation.
6. Panic Lock returns to neutral unlock screen.
7. Auto-lock clears sensitive UI state.
8. Wrong credential does not reveal Space existence.
9. UI never writes plaintext messages to IndexedDB.
10. UI never writes passwords to localStorage.
11. UI does not log plaintext messages.
12. UI does not log cryptographic keys.
13. Incoming network message reaches the correct conversation.
14. Duplicate network delivery does not duplicate UI messages.
15. Offline outbound messages use the existing queue.
16. Reconnection does not create duplicate subscriptions.
17. Delivery status reflects actual NetworkManager state.
18. Group membership changes update the UI.
19. Contact verification reflects actual identity state.
20. Media attachments do not bypass encrypted storage.

============================================================
33. INTEGRATION TESTS
============================================================

Add a genuine UI-to-backend integration test.

Test:

    Alice Space
       ↓
    Alice UI
       ↓
    Alice ConversationManager
       ↓
    Double Ratchet
       ↓
    NetworkManager
       ↓
    Phase 12 Relay
       ↓
    Bob NetworkManager
       ↓
    Bob ConversationManager
       ↓
    Bob UI

Verify:

    Alice types message
    Alice sends
    Relay receives opaque envelope
    Bob receives
    Bob decrypts
    Bob UI renders plaintext
    Bob ACKs
    Alice receives delivery state

Then verify Bob replies.

No mocked relay should be used for the primary end-to-end test.

============================================================
34. VISUAL QUALITY REQUIREMENT
============================================================

This is not merely an engineering scaffold.

The application must LOOK finished.

Create:

- polished spacing
- coherent typography
- consistent icons
- clear hierarchy
- attractive message bubbles
- subtle animations
- smooth transitions
- responsive layouts
- useful hover states
- useful loading states
- useful error states

Animations must never delay security actions such as:

    Lock
    Panic Lock
    Logout

Security actions happen immediately.

============================================================
35. NO PLACEHOLDER UI
============================================================

Do NOT leave things such as:

    "TODO"
    "Coming soon"
    "Mock"
    "Demo message"
    "Fake user"
    "Simulated delivery"

in production UI.

If a backend capability genuinely doesn't exist:

1. do not fake it,
2. document it,
3. expose only what is actually supported.

============================================================
36. TESTING REQUIREMENTS
============================================================

Before completion:

Run:

    npm test

Run:

    npm run build

Run the application:

    npm run dev

Perform a manual end-to-end test.

At minimum:

1. Start VEIL.
2. Unlock a Space.
3. Create a second Space.
4. Lock.
5. Unlock the second Space using its credential.
6. Confirm first Space data is absent.
7. Return to first Space.
8. Create/start a real conversation.
9. Send a real E2EE message.
10. Receive it on the second client.
11. Reply.
12. Disconnect network.
13. Send another message.
14. Reconnect.
15. Verify queue delivery.
16. Reload browser.
17. Verify encrypted persistence.
18. Lock.
19. Verify plaintext disappears from UI.
20. Trigger Panic Lock.
21. Verify neutral unlock screen.
22. Verify no previous conversation remains visible.

============================================================
37. SECURITY REGRESSION
============================================================

Run the entire existing test suite.

The Phase 14 implementation must NOT break:

- cryptographic tests
- Space isolation
- Double Ratchet
- group security
- recovery
- storage encryption
- relay security
- networking
- offline persistence
- duplicate handling

Existing tests are mandatory.

Do not "fix" failing security tests by weakening assertions.

============================================================
38. DOCUMENTATION
============================================================

Create/update:

    docs/UI_ARCHITECTURE.md
    docs/UX_SECURITY.md
    docs/ai/DECISIONS.md
    docs/ai/ACTIVE_TASK.md
    docs/ai/CURRENT_STATE.md
    docs/ai/CHANGELOG.md
    docs/ai/HANDOFF.md

Document:

- UI architecture
- state boundaries
- security-sensitive UI rules
- Space switching behavior
- lock/panic behavior
- networking integration
- message lifecycle
- accessibility decisions
- responsive design
- known limitations

Add appropriate ADRs.

============================================================
39. GIT DISCIPLINE
============================================================

Do not commit unrelated changes.

Before completion:

    git status

Review:

    git diff

Ensure no:

- secrets
- passwords
- private keys
- test credentials
- plaintext message dumps
- debugging logs

are committed.

Only create the Phase 14 commit after all tests pass.

Recommended commit:

    feat(ui): implement production messaging application shell

============================================================
40. COMPLETION REPORT
============================================================

When finished, report:

### Implementation
- files created
- files modified
- major UI features

### Integration
- Space integration
- E2EE integration
- Group integration
- Storage integration
- Network integration
- Recovery integration

### Security
- lock behavior
- panic behavior
- Space isolation
- plaintext persistence protections
- logging protections

### Testing
- baseline test count
- final test count
- failures
- skipped tests
- build result

### Manual Verification
- desktop
- mobile
- messaging
- offline mode
- restart persistence
- Space switching
- panic lock

### Git
- commit hash
- working tree state

### Known Limitations
Be explicit about anything not actually implemented.

============================================================
41. DEFINITION OF DONE
============================================================

Phase 14 is COMPLETE only if:

[ ] Real React application is functional.
[ ] Existing VEIL backend is actually used.
[ ] No fake messaging is present.
[ ] Spaces can be unlocked and switched.
[ ] Space switching clears previous UI state.
[ ] Real E2EE messages can be sent.
[ ] Real E2EE messages can be received.
[ ] Delivery states come from the actual networking layer.
[ ] Offline queue works through NetworkManager.
[ ] Groups use the actual group subsystem.
[ ] Identity verification uses the actual identity subsystem.
[ ] IndexedDB persistence continues working.
[ ] Lock clears sensitive UI state.
[ ] Panic Lock works.
[ ] Auto-lock works.
[ ] No plaintext secrets are persisted.
[ ] No secrets are logged.
[ ] Responsive mobile UI exists.
[ ] Accessibility basics are implemented.
[ ] Existing tests remain green.
[ ] New UI/security tests pass.
[ ] Production build passes.
[ ] Manual end-to-end messaging works.
[ ] Documentation is updated.
[ ] Git working tree is clean.

DO NOT declare Phase 14 complete merely because:
- React compiles,
- screens render,
- buttons exist,
- tests are mocked,
- or the UI looks good.

The actual VEIL networking, storage, identity, E2EE, Space, and group systems
must be connected to the UI.

============================================================
FINAL PRINCIPLE
============================================================

The previous 13 phases built the security engine.

Phase 14 turns that engine into VEIL.

Do not simplify the security architecture to make the UI easier.

Instead:

        BUILD THE UI AROUND THE SECURITY ARCHITECTURE.

The user should experience:

        "This is a simple, beautiful messenger."

while underneath:

        Spaces
        + encrypted storage
        + E2EE
        + Double Ratchet
        + groups
        + recovery
        + privacy-preserving relay
        + offline persistence
        + isolated credentials

continue operating exactly as designed.

Begin with the takeover procedure.
Do not code before inspecting the existing implementation.