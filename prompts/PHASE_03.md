VERSION: 1.0

============================================================
MISSION
============================================================

You are now executing PHASE 3 of VEIL.

Phase 1 established:

Password
    ↓
KEK
    ↓
Encrypted Space Master Key
    ↓
Space-specific encrypted storage

Phase 2 established:

Space
    ↓
Independent cryptographic identity
    ├── Signing Identity
    └── Key-Agreement Identity

Phase 3 establishes the NETWORK TRANSPORT FOUNDATION.

The objective is to allow independent VEIL Spaces to communicate
through an untrusted transport infrastructure while minimizing the
metadata exposed to that infrastructure.

The transport layer MUST NOT require the server to know:

- the user's real identity
- phone number
- email address
- physical address
- device identifier
- Space name
- plaintext message contents
- plaintext contact list
- plaintext relationship graph

The server should act primarily as a blind delivery mechanism.

============================================================
CORE PRINCIPLE
============================================================

The server is NOT trusted.

Treat the transport infrastructure as:

"honest-but-curious at best"

and potentially:

- compromised
- logged
- subpoenaed
- malicious
- monitored
- breached

The server must not be given unnecessary information merely because
it would make implementation easier.

============================================================
CRITICAL SECURITY BOUNDARY
============================================================

PHASE 3 DOES NOT IMPLEMENT FULL MESSAGING.

Do NOT implement:

- chat UI
- message history
- Double Ratchet
- group messaging
- media messaging
- contact synchronization
- push notification identity
- multi-device synchronization

Those belong to later phases.

Phase 3 builds the secure transport substrate on which those features
will operate.

============================================================
IMPORTANT LIMITATION
============================================================

VEIL cannot honestly promise "complete anonymity" merely because
messages are encrypted.

Encryption protects CONTENT.

Metadata can still reveal:

- when a device communicates
- how often it communicates
- packet sizes
- connection timing
- IP addresses
- server access patterns
- traffic volume
- online/offline patterns

Phase 3 therefore focuses on reducing unnecessary metadata exposure.

Document what VEIL DOES and DOES NOT protect against.

Never claim:

"anonymous"

"untraceable"

"undetectable"

or

"metadata-free"

unless a specific property has actually been implemented and tested.

============================================================
PART 1 — TAKEOVER VERIFICATION
============================================================

Before changing code:

Read:

AGENTS.md

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md
docs/ai/CHANGELOG.md

Read:

docs/ARCHITECTURE.md
docs/THREAT_MODEL.md
docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/IDENTITY_MODEL.md
docs/CRYPTOGRAPHY.md
docs/SECURITY.md
docs/KNOWN_LIMITATIONS.md

Inspect Phase 1 and Phase 2.

Run:

npm test

All previous tests MUST pass before Phase 3 begins.

============================================================
PART 2 — TRANSPORT THREAT MODEL
============================================================

Explicitly model the transport server as untrusted.

Assume the server can observe:

- client IP
- connection time
- connection duration
- request size
- response size
- frequency
- destination mailbox identifier
- connection metadata
- account/session metadata

Assume the server cannot automatically read:

- E2EE plaintext
- Space private keys
- identity private keys
- message plaintext
- private contact information

unless another vulnerability exists.

Document this trust boundary.

============================================================
PART 3 — TRANSPORT ARCHITECTURE
============================================================

The architecture should conceptually become:

SPACE
  │
  ▼
Identity
  │
  ▼
Local Encryption Layer
  │
  ▼
Transport Encryption
  │
  ▼
Blind Mailbox
  │
  ▼
Untrusted Server
  │
  ▼
Blind Mailbox
  │
  ▼
Recipient

The server should primarily answer:

"Do I have encrypted data for this mailbox?"

rather than:

"This user sent a message to this other user."

============================================================
PART 4 — BLIND MAILBOX MODEL

Implement a mailbox abstraction.

Conceptually:

Mailbox

{
mailboxId,
encryptedPayload,
expiration,
sizeClass
}

The mailbox MUST NOT contain:

plaintext identity
plaintext username
phone number
email
Space name
plaintext message
plaintext contact relationship

The mailbox identifier must not directly encode personal information.

============================================================
PART 5 — MAILBOX IDENTIFIERS

Generate mailbox identifiers using cryptographically secure randomness
or another explicitly documented privacy-preserving construction.

Do NOT derive mailbox IDs from:

email
phone number
username
device ID
identity public key directly

unless a later protocol explicitly requires such a construction.

Avoid unnecessarily stable identifiers.

Document the linkability implications of mailbox identifiers.

============================================================
PART 6 — SERVER API

Create a minimal transport protocol.

Possible operations:

CREATE_MAILBOX

POST_ENVELOPE

FETCH_ENVELOPES

DELETE_ENVELOPE

MAILBOX_STATUS

The exact names may differ.

The server API must remain deliberately minimal.

Do not create endpoints such as:

GET_USER_PROFILE

GET_CONTACTS

GET_USER_IDENTITY

GET_CHAT_HISTORY

SEARCH_USERS

unless explicitly required by a later architecture.

The transport server should not become a social graph database.

============================================================
PART 7 — ENVELOPE MODEL

Transport payloads must be opaque to the server.

Conceptually:

TransportEnvelope

{
version,
mailboxToken,
envelopeId,
payload,
expiration,
sizeClass
}

The payload must be encrypted before reaching the server.

The server must treat payload as opaque bytes.

============================================================
PART 8 — PAYLOAD ENCRYPTION

Do not invent a second messaging encryption system in Phase 3.

Phase 3 may use a temporary authenticated encryption construction for
transport testing.

Clearly label it:

PHASE 3 TRANSPORT PROTECTION

NOT

FINAL MESSAGE E2EE.

Final message encryption belongs to Phase 4.

This prevents the temporary transport mechanism from accidentally
becoming VEIL's permanent messaging protocol.

============================================================
PART 9 — TRANSPORT AUTHENTICATION

The server must not receive the Space's private signing key.

If client authentication is required:

use an established cryptographic authentication mechanism.

Do not send:

password
SMK
private identity key
raw encryption key

to the server.

The client should prove authorization without revealing private
cryptographic material.

============================================================
PART 10 — IDENTITY SEPARATION

The transport server must not automatically receive every identity
property stored locally.

Separate:

LOCAL IDENTITY

from

NETWORK IDENTITY

from

MAILBOX IDENTITY

Example:

Local Space Identity
│
├── local cryptographic identity
│
└── network mailbox credential
│
▼
Blind mailbox

Do not assume:

Identity Public Key

Mailbox Identifier

That would create unnecessary linkability.

============================================================
PART 11 — MAILBOX TOKENS

Introduce opaque mailbox access tokens.

Conceptually:

Mailbox Identifier
│
▼
Mailbox Capability
│
▼
Server access

The server should not need a traditional username/password account
for mailbox access.

Capabilities should be:

random
high entropy
unguessable
revocable where possible
protected from accidental logging

Do not place secrets in URLs if they can accidentally appear in
browser/proxy/server logs.

Prefer authenticated request mechanisms appropriate to the transport.

============================================================
PART 12 — TOKEN HASHING

If mailbox capabilities must be stored server-side:

Do not store raw long-lived mailbox secrets unless the architecture
explicitly requires it.

Prefer storing a verifier derived from the capability using an
appropriate cryptographic construction.

Document:

client-held secret

versus

server-held verifier.

A database compromise should not automatically grant access to every
mailbox.

============================================================
PART 13 — REPLAY PROTECTION

Transport envelopes need replay resistance.

Every envelope should contain an identifier or nonce mechanism that
prevents unintended duplicate processing.

The server/client must distinguish:

new envelope

from

already processed envelope

Do not rely solely on timestamps.

============================================================
PART 14 — DUPLICATE DELIVERY

The system should tolerate:

duplicate envelopes
repeated fetches
retry after network failure
reconnects
delayed delivery

A network retry must not accidentally create multiple logical messages
once Phase 4 is built.

Phase 3 should therefore define:

envelopeId

and

idempotent delivery semantics.

============================================================
PART 15 — MESSAGE ORDERING

Do NOT attempt to implement final message ordering yet.

However, define whether the transport guarantees:

no ordering
best-effort ordering
server ordering
client ordering

For Phase 3:

assume transport order is NOT trustworthy.

Phase 4's E2EE protocol must eventually handle ordering itself.

============================================================
PART 16 — EXPIRATION / TTL

Support server-side envelope expiration.

Example:

expiration timestamp

After expiration:

payload is unavailable.

However:

DO NOT claim this guarantees deletion from:

backups
server logs
snapshots
filesystem remnants
infrastructure caches

Document this explicitly.

============================================================
PART 17 — RETENTION MINIMIZATION

The server should retain as little data as practical.

Avoid permanent:

message history
identity history
connection history
contact history

Phase 3 should define:

minimum mailbox retention

and

automatic expiration.

============================================================
PART 18 — SIZE NORMALIZATION

Traffic analysis can reveal information from payload size.

Introduce transport size classes.

Example:

SMALL
MEDIUM
LARGE

Messages are padded into defined classes rather than transmitting their
exact plaintext/encrypted length where practical.

Do NOT attempt perfect traffic-analysis resistance yet.

The purpose is to establish an extensible padding architecture.

============================================================
PART 19 — PADDING

Implement a deterministic padding policy based on size classes.

Example:

payload size
↓
next supported class
↓
random/structured padding
↓
transport

The receiver removes padding.

Padding MUST NOT weaken authenticated encryption.

Padding must be included inside the authenticated encrypted payload
where appropriate.

============================================================
PART 20 — TIMING

Do not claim protection against timing analysis.

However, avoid unnecessary protocol behavior that reveals:

whether a mailbox belongs to a real person
whether a recipient exists
whether a particular identity is registered

Where practical, normalize error behavior.

============================================================
PART 21 — MAILBOX ENUMERATION

An attacker must not be able to cheaply enumerate valid mailboxes.

Do not expose:

"mailbox exists"

versus

"mailbox does not exist"

through dramatically different responses.

Use generic errors and rate limiting.

Do not create a public mailbox search API.

============================================================
PART 22 — RATE LIMITING

The transport server should implement basic abuse protection.

Rate limiting MUST NOT require the server to know the user's real
identity.

Possible dimensions:

mailbox capability
connection/session
IP
request frequency

Document the privacy tradeoff of IP-based controls.

Do not build a surveillance system disguised as rate limiting.

============================================================
PART 23 — IP ADDRESS LIMITATIONS

Phase 3 must explicitly document:

A normal client/server connection reveals the client's network address
to the server.

Therefore VEIL's Phase 3 transport is NOT anonymous against the server
with respect to IP address.

Do NOT pretend otherwise.

Future phases may explore privacy networks or relay architectures.

Do not implement Tor/onion routing automatically in Phase 3 unless
explicitly required.

============================================================
PART 24 — CONNECTION MODEL

Design the client transport abstraction so that future relay/privacy
layers can be added without rewriting the application protocol.

Conceptually:

Application
↓
VEIL Transport API
↓
Transport Adapter
↓
Direct HTTPS / future relay / privacy network

Do not hard-code the entire application to one network implementation.

============================================================
PART 25 — HTTPS / TLS

The production transport must use authenticated secure transport.

Do not implement custom TLS.

Use established platform/network libraries.

The application-layer encrypted payload must remain encrypted even when
transported over TLS.

Reason:

TLS protects the connection.

Application-layer encryption protects the payload from the server.

============================================================
PART 26 — SERVER KNOWLEDGE MODEL

Create a formal table in docs/METADATA_MODEL.md.

Example:

Data	Server sees?	Required?
Client IP	Yes in direct mode	Transport
Connection time	Potentially	Transport
Mailbox token	Yes	Delivery
Message plaintext	No	Never
Space password	No	Never
SMK	No	Never
Private identity key	No	Never
Contact list	No	Never
Space name	No	Never
Exact message size	Minimized	Transport
Message timing	Potentially	Transport

The table must reflect the ACTUAL implementation.

============================================================
PART 27 — LOCAL OUTBOX

Implement a local encrypted outbox abstraction.

Conceptually:

Space
↓
Encrypted Outbox
↓
Transport Envelope
↓
Server

The outbox must belong to the Space.

Private Space must not be able to read Main Space's outbox.

============================================================
PART 28 — LOCAL INBOX

Implement an encrypted local inbox abstraction.

Incoming opaque envelopes should be stored inside the appropriate
Space's protected storage.

The server must never decide which local Space receives plaintext.

============================================================
PART 29 — TRANSPORT STATE

Store transport state per Space.

Examples:

mailbox identifier
mailbox capability
last fetch cursor
pending envelopes
expiration state

These values must not accidentally be shared between Spaces.

============================================================
PART 30 — CROSS-SPACE TRANSPORT TESTING

Create:

Main Space

Private Space

Decoy Space

Each must have:

separate mailbox
separate capability
separate transport state
separate encrypted outbox
separate encrypted inbox

Verify:

Main cannot read Private transport secrets.

Private cannot read Main transport secrets.

Main cannot post into Private mailbox using Main credentials.

Private cannot fetch Main mailbox using Private credentials.

============================================================
PART 31 — SERVER COMPROMISE SIMULATION

Create tests that simulate a malicious server database containing:

mailbox IDs
mailbox capability verifiers
encrypted envelopes
timestamps
size classes

Verify that the server database does NOT contain:

passwords
SMKs
private identity keys
plaintext messages
plaintext contacts

Where possible, demonstrate that stolen server-side data cannot decrypt
payloads.

============================================================
PART 32 — MALICIOUS SERVER TESTING

Simulate a server that:

modifies an envelope
truncates an envelope
duplicates an envelope
reorders envelopes
deletes an envelope
returns stale envelopes
returns random bytes
returns another mailbox's envelope

The client must fail safely or handle the condition according to the
documented transport semantics.

============================================================
PART 33 — SERVER RESPONSE AUTHENTICATION

Do not blindly trust server responses.

Where transport protocol requires authenticated server state, define
appropriate integrity/authentication mechanisms.

Do not invent cryptographic authentication.

============================================================
PART 34 — ENDPOINT PRIVACY

Avoid endpoint designs that reveal unnecessary identity information.

Bad:

POST /users/dagmawi/private-space/messages

Better conceptual model:

POST /mailbox/{opaque-token}/envelopes

The server should not need to know what the mailbox represents.

============================================================
PART 35 — TRANSPORT API

Create a client abstraction such as:

TransportClient

createMailbox()

postEnvelope()

fetchEnvelopes()

acknowledgeEnvelope()

deleteEnvelope()

closeMailbox()

The exact API may differ.

The abstraction must not expose server-specific implementation details
to the rest of VEIL.

============================================================
PART 36 — MOCK SERVER

For Phase 3 development:

Create a local/mock untrusted transport server.

It must intentionally behave as though it knows nothing about VEIL
identity semantics.

The mock server should store only opaque transport data.

It should NOT contain cryptographic private keys.

This allows adversarial testing without deploying infrastructure.

============================================================
PART 37 — NO PRODUCTION SERVER DEPLOYMENT

Do NOT require paid infrastructure.

Phase 3 must be fully testable locally.

The architecture should remain compatible with:

local development
free/open-source server hosting
future self-hosting
future privacy relays

Do not introduce paid cloud dependencies.

============================================================
PART 38 — NETWORK FAILURE TESTING

Test:

offline mode
reconnect
timeout
connection reset
duplicate request
server unavailable
partial response
corrupted response
retry
delayed response

The client must not lose encrypted local data merely because the
network failed.

============================================================
PART 39 — SECRET HANDLING

Never log:

mailbox capabilities
private keys
passwords
SMKs
plaintext payloads
session secrets

Be especially careful with HTTP debugging tools.

Test production logging configuration.

============================================================
PART 40 — METADATA DOCUMENTATION

Update:

docs/METADATA_MODEL.md

docs/PRIVACY.md

docs/THREAT_MODEL.md

docs/ARCHITECTURE.md

Document:

what server sees
what server cannot see
direct connection limitations
mailbox model
capability model
size padding
TTL
replay protection
rate limiting
IP exposure
future relay architecture
============================================================
PART 41 — PHASE 3 CRYPTOGRAPHY BOUNDARY

Do not create the final VEIL message encryption protocol here.

Phase 3 transport encryption is NOT the final E2EE system.

The final protocol will be established in Phase 4 using the identity
architecture from Phase 2 and a formally defined ratcheting protocol.

Any temporary Phase 3 encryption must be clearly marked as transport
protection.

============================================================
PART 42 — TEST SUITE

Create:

tests/transport-mailbox.test.ts

tests/transport-authentication.test.ts

tests/transport-isolation.test.ts

tests/transport-tampering.test.ts

tests/transport-replay.test.ts

tests/transport-padding.test.ts

tests/transport-expiration.test.ts

tests/transport-failure.test.ts

tests/malicious-server.test.ts

tests/metadata-exposure.test.ts

============================================================
PART 43 — REQUIRED TESTS

Mailbox:

[ ] mailbox creation

[ ] unique mailbox identifiers

[ ] capability generation

[ ] capability verification

[ ] unauthorized mailbox access fails

[ ] mailbox deletion

Transport:

[ ] envelope upload

[ ] envelope retrieval

[ ] envelope acknowledgement

[ ] duplicate handling

[ ] retry handling

[ ] expiration

Isolation:

[ ] Main mailbox isolated

[ ] Private mailbox isolated

[ ] Decoy mailbox isolated

[ ] transport state isolated

Security:

[ ] server cannot decrypt payload

[ ] server compromise simulation passes

[ ] tampering detected

[ ] corrupted payload rejected

[ ] wrong mailbox rejected

[ ] replay handled

Metadata:

[ ] no plaintext message in server storage

[ ] no private key in server storage

[ ] no password in server storage

[ ] no SMK in server storage

[ ] no unnecessary identity metadata

Padding:

[ ] size classes work

[ ] padding survives transport

[ ] padding removed correctly

[ ] malformed padding fails safely

Network:

[ ] offline

[ ] reconnect

[ ] timeout

[ ] server unavailable

[ ] partial response

[ ] retry

============================================================
PART 44 — ADVERSARIAL METADATA TEST

Perform a codebase audit asking:

"If I were the server, what can I learn?"

Document every answer.

Then ask:

"Can I learn which VEIL Space belongs to which real person?"

If the answer is yes, document exactly why.

Do not hide the limitation.

============================================================
PART 45 — PRIVACY CLAIM REVIEW

Before completion, review every privacy-related statement in the
repository.

Remove unsupported claims such as:

"anonymous"

"untraceable"

"metadata-free"

"undetectable"

"zero metadata"

"perfect privacy"

Replace them with precise claims.

Example:

"Message content is protected from the transport server by
application-layer encryption."

is acceptable.

"The server cannot identify users."

is NOT acceptable unless actually demonstrated.

============================================================
PART 46 — DOCUMENTATION UPDATES

Update:

docs/ARCHITECTURE.md
docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/THREAT_MODEL.md
docs/SECURITY.md
docs/KNOWN_LIMITATIONS.md

Update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
docs/ai/HANDOFF.md

Record all architecture decisions as ADRs.

============================================================
PART 47 — DEFINITION OF DONE

Phase 3 is complete only when:

[ ] Phase 1 passes

[ ] Phase 2 passes

[ ] Blind mailbox model implemented

[ ] Opaque mailbox IDs implemented

[ ] Capability authentication implemented

[ ] Server does not receive Space passwords

[ ] Server does not receive SMKs

[ ] Server does not receive private identity keys

[ ] Server does not receive plaintext messages

[ ] Local outbox implemented

[ ] Local inbox implemented

[ ] Transport state isolated per Space

[ ] Transport envelopes versioned

[ ] Replay protection implemented

[ ] Duplicate handling implemented

[ ] TTL/expiration implemented

[ ] Size classes implemented

[ ] Padding implemented

[ ] Malicious server tests pass

[ ] Cross-Space transport attacks fail

[ ] Server compromise simulation passes

[ ] Tampering tests pass

[ ] Corruption tests pass

[ ] Network failure tests pass

[ ] Logging audit passes

[ ] Metadata model documented

[ ] IP limitations documented

[ ] No unsupported anonymity claims remain

[ ] No paid infrastructure required

[ ] Mock server works locally

[ ] Full test suite passes

[ ] Git diff reviewed

[ ] No secrets committed

[ ] AI continuity files updated

[ ] Meaningful Git commit created

[ ] Working tree clean

============================================================
FINAL STOP CONDITION

STOP after Phase 3.

DO NOT implement:

Double Ratchet
message conversations
contact system
groups
media
message UI
multi-device
push notifications
final E2EE protocol

The repository must be left ready for:

PHASE 4 — E2EE 1-to-1 Messaging & Double Ratchet.

THE SERVER IS UNTRUSTED.

THE MAILBOX IS BLIND.

THE SPACE IS THE SECURITY BOUNDARY.

THE IDENTITY IS CRYPTOGRAPHIC.

THE TRANSPORT MUST NOT BECOME THE IDENTITY SYSTEM.



### The architecture after Phase 3


You now have a pretty important separation:


```text
                 VEIL
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
       MAIN     PRIVATE    DECOY
       SPACE     SPACE      SPACE
          │        │          │
          ▼        ▼          ▼
      Identity  Identity   Identity
          │        │          │
          ▼        ▼          ▼
      Mailbox A Mailbox B Mailbox C
          │        │          │
          └────────┼──────────┘
                   │
                   ▼
            UNTRUSTED SERVER

The server basically becomes a delivery post office, not the owner of the accounts.

And there's an important reason I kept Double Ratchet out of Phase 3. Phase 4 is where we need to carefully combine the Phase 2 identities with a real 1-to-1 E2EE protocol. That's a much more consequential step than simply throwing encrypted blobs at a server.

One thing I'd strongly recommend before running Phase 3: have the coding agent first produce a short architecture review of the Phase 1 + Phase 2 implementation and compare it against this Phase 3 specification. Don't let it blindly start coding just because the prompt says "implement." With a security project, "I followed the prompt" is not the same thing as "I understood the existing system."