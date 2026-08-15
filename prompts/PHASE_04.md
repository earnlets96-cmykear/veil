VERSION: 1.0

============================================================
MISSION
============================================================

You are now executing PHASE 4 of VEIL.

Phase 1 established:

Password
    ↓
KEK
    ↓
Encrypted Space Master Key
    ↓
Space-specific storage

Phase 2 established:

Space
    ↓
Independent cryptographic identity
    ├── Signing Identity
    └── Key-Agreement Identity

Phase 3 established:

Space
    ↓
Blind Mailbox
    ↓
Opaque Transport
    ↓
Untrusted Server

Phase 4 now establishes:

REAL 1-TO-1 END-TO-END ENCRYPTED MESSAGING.

The objective is:

Alice Space
    ↓
Alice Identity
    ↓
Secure Session
    ↓
Double Ratchet
    ↓
Encrypted Message
    ↓
Untrusted Transport
    ↓
Encrypted Message
    ↓
Double Ratchet
    ↓
Bob Identity
    ↓
Bob Space

The transport server MUST NOT be capable of decrypting messages.

============================================================
CRITICAL SECURITY RULE
============================================================

DO NOT INVENT A NEW E2EE PROTOCOL.

Do not design a custom replacement for:

- Double Ratchet
- X3DH
- PQXDH
- authenticated key exchange
- message key derivation
- ratcheting
- skipped-message handling

Use established protocol designs and maintained cryptographic
implementations where appropriate.

If a protocol component must be implemented because no suitable
library exists, isolate it, document it rigorously, and test it
against known vectors/specifications.

============================================================
PHASE BOUNDARY
============================================================

PHASE 4 IMPLEMENTS:

- 1-to-1 conversations
- authenticated session establishment
- pre-key architecture
- Double Ratchet
- forward secrecy
- post-compromise recovery properties
- encrypted message envelopes
- message sending
- message receiving
- offline message delivery
- skipped messages
- out-of-order messages
- encrypted local message storage

PHASE 4 DOES NOT IMPLEMENT:

- groups
- group E2EE
- media encryption
- multi-device synchronization
- account recovery
- push notifications
- anonymous relay networks
- advanced traffic-analysis defenses
- disappearing-message UX
- voice/video calls

Those belong to later phases.

============================================================
PART 1 — TAKEOVER VERIFICATION
============================================================

Before modifying code:

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
docs/CRYPTOGRAPHY.md
docs/KEY_HIERARCHY.md
docs/SPACE_MODEL.md
docs/IDENTITY_MODEL.md
docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/SECURITY.md
docs/KNOWN_LIMITATIONS.md

Inspect Phase 1, Phase 2 and Phase 3 implementations.

Run:

npm test

ALL previous tests MUST pass before Phase 4 starts.

============================================================
PART 2 — PROTOCOL SELECTION
============================================================

Before writing the E2EE implementation, determine the exact protocol
construction.

The architecture must answer:

1. How does Alice establish a session with Bob while Bob is offline?
2. How are prekeys published?
3. How are prekeys consumed?
4. How are identity keys authenticated?
5. How is the initial shared secret created?
6. How is the Double Ratchet initialized?
7. How are message keys derived?
8. How are sending and receiving chains separated?
9. How are skipped messages handled?
10. How does the protocol recover after compromise?

Document the exact protocol construction.

DO NOT begin implementation until this protocol design is documented.

============================================================
PART 3 — INITIAL KEY AGREEMENT
============================================================

The initial session establishment MUST provide:

- authentication
- confidentiality
- forward secrecy
- resistance to man-in-the-middle attacks when identity verification
  is performed correctly

The initial key agreement should use the identity architecture from
Phase 2.

Do not send the Space password.

Do not send the Space Master Key.

Do not send private identity keys.

============================================================
PART 4 — IDENTITY AUTHENTICATION
============================================================

A user must be able to determine:

"I am establishing a session with THIS cryptographic identity."

The protocol must bind the session to the peer's identity.

At minimum:

Alice knows Bob's identity public information.

Bob knows Alice's identity public information.

The protocol must prevent an attacker from silently replacing the
identity during session establishment.

============================================================
PART 5 — PREKEY ARCHITECTURE
============================================================

Implement an asynchronous prekey system.

Bob should be able to publish sufficient public material so that Alice
can establish an encrypted session while Bob is offline.

Conceptually:

Bob Space
    │
    ├── Identity Key
    ├── Signed Prekey
    └── One-Time Prekeys
            │
            ▼
       Blind Server
            │
            ▼
          Alice

The server stores public prekey material.

Private prekeys NEVER leave Bob's Space.

============================================================
PART 6 — PREKEY TYPES
============================================================

Clearly distinguish:

IDENTITY KEY

SIGNED PREKEY

ONE-TIME PREKEY

Each has a different purpose.

Do not reuse one key for every purpose.

Signed prekeys must be authenticated by the appropriate identity key.

One-time prekeys should be consumed once where possible.

============================================================
PART 7 — PREKEY STORAGE
============================================================

Private prekeys must be encrypted inside the appropriate Space.

They must not be stored:

- plaintext on disk
- in transport storage
- on the server
- in logs
- in public identity documents

Server-visible prekey material must contain public information only.

============================================================
PART 8 — ONE-TIME PREKEY CONSUMPTION
============================================================

Implement safe one-time prekey consumption.

The system must handle:

- simultaneous session attempts
- duplicate requests
- failed session initialization
- server retries
- server returning the same prekey
- exhausted prekey pool

Do not assume network delivery is reliable.

A one-time prekey must not accidentally be reused for multiple sessions
because of a race condition.

============================================================
PART 9 — SESSION INITIALIZATION
============================================================

Implement:

initializeSession(peerIdentity, prekeyBundle)

The result must establish:

- root key
- sending chain
- receiving chain
- ratchet state
- peer identity binding
- protocol version

The session state must be protected inside the local Space.

============================================================
PART 10 — DOUBLE RATCHET
============================================================

Implement the Double Ratchet state according to the selected established
protocol specification.

Conceptually:

Root Key
   │
   ├───────────────┐
   ▼               ▼
Sending Chain   Receiving Chain
   │               │
   ▼               ▼
Message Keys    Message Keys

Each message must derive a fresh message key.

Do not use:

one static AES/XChaCha key for the entire conversation.

============================================================
PART 11 — ROOT KEY RATCHETING

When a DH ratchet step occurs:

current root key
+
new DH shared secret
↓
new root key
+
new chain key

Old root key material must no longer be needed after the transition
where practical.

Document the exact KDF construction.

============================================================
PART 12 — CHAIN KEY RATCHETING

Every message must advance the appropriate sending or receiving chain.

Conceptually:

Chain Key N
↓
Message Key N

then:

Chain Key N+1

Never reuse a message key.

Tests MUST detect accidental key reuse.

============================================================
PART 13 — MESSAGE ENCRYPTION

Use authenticated encryption.

The message payload must include authenticated associated data binding
the ciphertext to the appropriate protocol context.

The exact construction must be documented.

Do not invent a custom MAC-then-encrypt construction.

Do not use unauthenticated encryption.

============================================================
PART 14 — MESSAGE HEADER

The encrypted message requires a protocol header sufficient for the
recipient to determine how to process the message.

The header may contain information such as:

protocol version
ratchet public key
message number
previous-chain length

The exact fields must follow the selected protocol design.

Do not expose unnecessary plaintext metadata.

============================================================
PART 15 — HEADER AUTHENTICATION

Any security-sensitive header information must be authenticated.

An attacker must not be able to modify:

ratchet public key
message number
previous-chain length
protocol version

without detection.

Use the protocol's authenticated header mechanism.

============================================================
PART 16 — OUT-OF-ORDER MESSAGES

The network does not guarantee message ordering.

The Double Ratchet implementation MUST support:

Message 1
Message 3
Message 2

without losing Message 2 or corrupting the session.

Implement skipped-message-key storage.

============================================================
PART 17 — SKIPPED MESSAGE KEYS

Maintain a bounded skipped-message-key structure.

It must:

support legitimate delayed messages
prevent unlimited memory growth
expire stale keys
avoid duplicate processing
delete a skipped key after successful use

Do not store unlimited skipped message keys.

============================================================
PART 18 — DUPLICATE MESSAGES

If the same encrypted message is delivered twice:

First delivery:
→ decrypt/process

Second delivery:
→ MUST NOT produce a second logical message.

Implement message/envelope deduplication.

============================================================
PART 19 — MESSAGE REPLAY

A captured old message must not be accepted as a new message.

Test:

capture ciphertext

deliver once

deliver again

The second delivery must be rejected or ignored according to the
protocol semantics.

============================================================
PART 20 — FORWARD SECRECY

Implement tests demonstrating the intended forward-secrecy property.

After ratcheting forward:

compromise of CURRENT state

must not automatically reveal previously discarded message keys.

Do not claim mathematical proof from a unit test.

Document the protocol's security property and assumptions.

============================================================
PART 21 — POST-COMPROMISE RECOVERY

The Double Ratchet should provide recovery after a later DH ratchet
step, assuming the attacker no longer controls the endpoint.

Document:

what compromise reveals

what it does not reveal

when recovery occurs

what assumptions are required.

Do not claim protection while the endpoint remains fully compromised.

============================================================
PART 22 — SESSION PERSISTENCE

Persist encrypted session state locally.

Session state may include:

root key
sending chain state
receiving chain state
ratchet keys
message counters
skipped message keys
protocol version
peer identity binding

It MUST be encrypted inside the Space.

Never persist plaintext session keys.

============================================================
PART 23 — SESSION LOCKING

When the Space locks:

session secrets must become inaccessible.

When the Space unlocks:

session state can be restored from encrypted local storage.

When a session is destroyed:

best-effort zeroization must occur.

Document JavaScript/V8 memory limitations.

============================================================
PART 24 — MESSAGE STORAGE

Messages must be encrypted at rest using the Space's local storage
architecture.

Conceptually:

Incoming E2EE ciphertext
↓
decrypt
↓
plaintext
↓
Space encrypted storage

The server must never receive the local plaintext representation.

The local database must not store plaintext messages unless explicitly
required by a temporary processing buffer.

============================================================
PART 25 — MESSAGE IDENTITY

Every logical message needs a unique identifier.

The ID must support:

deduplication
local indexing
retry handling
delivery tracking

Do not use a predictable sequential global ID.

Do not make message IDs directly reveal:

sender identity
receiver identity
timestamp

unless required.

============================================================
PART 26 — DELIVERY STATES

Define:

QUEUED

SENT_TO_TRANSPORT

DELIVERED_TO_RECIPIENT

DECRYPTED

READ

However, Phase 4 should only implement states required by the protocol.

Do not create a server-visible "read receipt" system unless explicitly
designed for privacy.

Read receipts can leak communication behavior.

If implemented, they must themselves be encrypted protocol messages.

============================================================
PART 27 — OFFLINE MESSAGING

Alice must be able to send while Bob is offline.

Conceptually:

Alice
↓
E2EE message
↓
Blind mailbox
↓
Bob later connects
↓
Encrypted message retrieved
↓
Double Ratchet decrypts





[ ] Forward-secrecy behavior tested


[ ] Post-compromise recovery tested


[ ] Identity changes detected


[ ] Fingerprint verification integrated


[ ] Malicious server tests pass


[ ] MITM tests pass


[ ] Protocol vector tests pass


[ ] Fuzz tests pass


[ ] No private keys reach server


[ ] No plaintext messages reach server


[ ] No passwords reach server


[ ] No SMKs reach server


[ ] No global contact directory created


[ ] No public identity search created


[ ] Metadata limitations documented


[ ] No unsupported security claims remain


[ ] Full test suite passes


[ ] Git diff reviewed


[ ] No secrets committed


[ ] Documentation updated


[ ] AI continuity updated


[ ] Meaningful Git commit created


[ ] Working tree clean


============================================================
FINAL STOP CONDITION
============================================================


STOP.


Do NOT implement Phase 5.


Do NOT implement:


- groups
- group key management
- media
- multi-device
- recovery
- push notifications
- voice calls
- video calls
- advanced anonymity networks


Leave the repository ready for:


PHASE 5 — GROUPS & ENCRYPTED MEDIA.


THE SERVER NEVER GETS THE MESSAGE PLAINTEXT.


THE SERVER NEVER GETS PRIVATE KEYS.


THE IDENTITY AUTHENTICATES THE PEER.


THE RATCHET PROTECTS THE SESSION.


EVERY MESSAGE GETS FRESH KEY MATERIAL.


NEVER INVENT CRYPTOGRAPHY.
Where VEIL now stands

After Phase 4, the architecture becomes much more interesting:

                         VEIL
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        MAIN            PRIVATE           DECOY
        SPACE            SPACE             SPACE
          │                │                │
       Identity A       Identity B       Identity C
          │                │                │
          ▼                ▼                ▼
       Session A        Session B        Session C
          │
          ▼
    ┌───────────────┐
    │ Double Ratchet│
    └───────┬───────┘
            │
            ▼
     Fresh Message Key
            │
            ▼
     AEAD Encrypted Message
            │
            ▼
       Blind Mailbox
            │
            ▼
      UNTRUSTED SERVER
            │
            ▼
       Blind Mailbox
            │
            ▼
      Recipient Session
            │
            ▼
      Double Ratchet
            │
            ▼
          Plaintext
One especially important thing

Phase 4 should not be allowed to "simplify" Double Ratchet.

An AI coding agent may be tempted to produce something like:

shared secret
     ↓
SHA-256
     ↓
AES key
     ↓
encrypt message

and call it "Double Ratchet."

That is not acceptable.

The agent should be required to demonstrate the actual ratchet state transitions, skipped-message handling, DH ratchet, key erasure, persistence behavior, and preferably compatibility with independent test vectors/reference implementations.

That's why this phase is deliberately much more demanding than Phase 3.

Once Phase 4 is genuinely working, VEIL has the core of an actual private messenger. Phase 5 can then tackle the ugly part that comes after 1-to-1 messaging: groups, encrypted media, and the problem of managing many participants without turning the server into a map of everyone's relationships.