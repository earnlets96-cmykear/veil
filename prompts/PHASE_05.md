You are implementing PHASE 5 of VEIL.

DO NOT start coding immediately.

First read the repository and understand the existing implementation.

============================================================
1. PHASE 5 MISSION
============================================================

Phase 5 extends VEIL from secure 1-to-1 messaging into:

- secure group conversations
- authenticated group membership
- group key management
- member addition/removal
- group message encryption
- encrypted media
- encrypted media metadata
- secure media upload/download
- group/media security testing

The core security principle is:

THE SERVER IS UNTRUSTED.

The server must never possess:

- plaintext group messages
- plaintext media
- media encryption keys
- group encryption secrets
- Space Master Keys
- Space passwords
- private identity keys

Phase 5 must integrate with the existing:

Phase 1 → Multi-Space cryptographic isolation
Phase 2 → Independent Space identities
Phase 3 → Privacy-preserving transport
Phase 4 → 1-to-1 E2EE / Double Ratchet

Do NOT break any previous phase.

============================================================
2. MANDATORY TAKEOVER PROCEDURE
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

Then read:

docs/ai/PROJECT_CONTEXT.md
docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/HANDOFF.md
docs/ai/DECISIONS.md
docs/ai/SECURITY_RULES.md
docs/ai/CHANGELOG.md

Then inspect ALL Phase 1–4 source code.

Run:

npm test

Do not begin Phase 5 implementation if existing tests fail.

If tests fail because of an existing unrelated issue:

1. document it
2. determine whether Phase 5 is affected
3. do not silently modify unrelated behavior

============================================================
3. IMPORTANT — DO NOT INVENT GROUP CRYPTOGRAPHY
============================================================

Group E2EE is more complicated than 1-to-1 E2EE.

DO NOT create an ad-hoc group encryption protocol.

Do not implement:

"one permanent AES key shared by everyone."

Do not implement:

"encrypt the same group key separately for every member forever."

Do not invent custom group ratcheting.

First investigate established group E2EE standards/protocols.

Strongly evaluate:

MLS — Messaging Layer Security

or another mature, standardized group E2EE construction if technically
more appropriate for VEIL's implementation environment.

Create:

docs/GROUP_PROTOCOL.md

BEFORE implementing the group cryptographic layer.

The document must explain:

- selected protocol
- why it was selected
- protocol version
- security properties
- membership model
- epoch model
- key rotation
- member removal
- member addition
- concurrent changes
- stale state
- rollback protection
- limitations
- implementation dependencies

If the chosen protocol cannot be implemented safely with the current
stack, STOP and document the blocker instead of inventing a replacement.

============================================================
4. GROUP SECURITY REQUIREMENTS
============================================================

VEIL groups must provide:

- authenticated membership
- authenticated group state
- encrypted group messages
- sender authentication
- membership-change authentication
- forward secrecy appropriate to the selected group protocol
- post-compromise recovery properties appropriate to the selected protocol
- replay protection
- stale-state protection
- rollback protection

Default history policy:

NEW MEMBER:

Can decrypt future messages.

Cannot automatically decrypt historical messages.

REMOVED MEMBER:

Cannot decrypt future messages.

Can retain messages/media they legitimately received before removal.

Document this explicitly.

============================================================
5. GROUP IDENTITY
============================================================

Create a cryptographically unique group identifier.

It must NOT be derived from:

- group name
- creator name
- username
- phone number
- email
- timestamp alone

The group ID must not expose user identity.

Implement appropriate versioning.

============================================================
6. GROUP DATA MODEL
============================================================

Create a formal group model.

At minimum support:

Group

- groupId
- protocolVersion
- epoch
- encrypted metadata
- membership state
- role state
- cryptographic state
- local synchronization state

Do not expose cryptographic secrets through ordinary application objects.

Do not serialize secrets into logs.

============================================================
7. SPACE BOUNDARY
============================================================

Every group belongs to exactly one Space.

Example:

MAIN SPACE

    Group A
    Group B


PRIVATE SPACE

    Group C


DECOY SPACE

    Group D

A group in one Space must NEVER be able to access:

- another Space's group keys
- another Space's group state
- another Space's messages
- another Space's media keys
- another Space's media

Reuse the Phase 1 storage isolation architecture.

============================================================
8. GROUP CREATION
============================================================

Implement:

createGroup()

Requirements:

- generate unique group ID
- initialize group cryptographic state
- establish creator membership
- establish initial epoch
- assign creator role
- persist encrypted group state
- prepare secure invitations

Do not expose group secrets to the transport server.

============================================================
9. GROUP ROLES
============================================================

Implement a clear role model.

At minimum:

MEMBER
ADMIN
CREATOR

Define:

- who can add members
- who can remove members
- who can promote
- who can demote
- whether creator privileges can transfer
- what happens when creator leaves

Do not trust client-supplied fields such as:

isAdmin=true

Every privileged operation must be authenticated cryptographically.

============================================================
10. GROUP INVITATIONS
============================================================

Implement secure invitations.

An invitation must cryptographically bind the appropriate:

- group identity
- protocol version
- inviter identity
- intended recipient
- current group state/join material
- authenticity information

Use existing VEIL E2EE mechanisms when appropriate.

Never transmit raw group secrets over an unauthenticated channel.

============================================================
11. MEMBER ADDITION
============================================================

Implement:

addMember()

Adding a member must cause the appropriate cryptographic state transition.

Example:

Epoch 1

Alice
Bob

        +

Charlie

        ↓

Epoch 2

Alice
Bob
Charlie

The selected group protocol must determine the exact key-management
operation.

Do not manually distribute a permanent group key.

============================================================
12. MEMBER REMOVAL
============================================================

Implement:

removeMember()

Example:

Epoch 2

Alice
Bob
Charlie

Remove Bob

        ↓

Epoch 3

Alice
Charlie

Bob must not possess the cryptographic state necessary to decrypt
future group messages.

The server must not be able to forge the membership transition.

============================================================
13. LEAVE GROUP
============================================================

Implement:

leaveGroup()

A voluntary departure must create the appropriate authenticated
membership transition.

The leaving member must not receive future group content.

============================================================
14. REJOINING
============================================================

If a previously removed member rejoins:

DO NOT reuse the old membership state.

Example:

Bob membership A

        ↓

removed

        ↓

membership invalidated

        ↓

new invitation

        ↓

Bob membership B

The new membership must receive fresh cryptographic state.

============================================================
15. GROUP EPOCHS
============================================================

Every cryptographic group state must have an epoch/version.

Example:

Epoch 1
Epoch 2
Epoch 3
...

Messages must be associated with the correct group state.

Prevent unauthorized rollback.

Example attack:

Client currently knows Epoch 5.

Malicious server sends Epoch 2.

The client must not silently revert to Epoch 2.

============================================================
16. CONCURRENT MEMBERSHIP CHANGES
============================================================

Test concurrent operations.

Example:

Alice adds Bob.

Charlie removes Dave.

Bob adds Eve.

Operations may arrive in different orders.

The selected group protocol must safely handle concurrent changes.

Do not assume the server is trustworthy merely because it serializes
requests.

============================================================
17. GROUP MESSAGE ENCRYPTION
============================================================

Implement group message encryption using the selected established group
protocol.

Do NOT use a permanent static group AES key.

Conceptually:

Authenticated Group State
        ↓
Current Epoch
        ↓
Protocol-derived message protection
        ↓
AEAD
        ↓
Encrypted Message

Messages must contain appropriate authenticated context.

============================================================
18. GROUP SENDER AUTHENTICATION
============================================================

A recipient must cryptographically determine which group member sent a
message.

Do not trust:

senderName
senderUsername
senderId

as authentication.

The sender identity must be cryptographically bound to the message.

============================================================
19. GROUP MESSAGE REPLAY
============================================================

Implement protection against replay.

Test:

- duplicate message
- old message
- replayed membership update
- replayed admin operation
- replayed media message

A captured ciphertext must not silently become a new logical message.

============================================================
20. OUT-OF-ORDER DELIVERY
============================================================

The transport may deliver:

Message 1
Message 3
Message 2

The group protocol must safely process this according to its state
machine.

Do not invent custom cryptographic ordering logic.

============================================================
21. GROUP STORAGE
============================================================

Store group data encrypted inside the appropriate Space.

The local database must not contain plaintext:

- group cryptographic secrets
- membership secrets
- private identity keys
- message encryption keys

Use the existing encrypted Space storage architecture.

============================================================
22. GROUP METADATA PRIVACY
============================================================

Separate cryptographic membership state from UI metadata.

Possible metadata:

- group name
- avatar
- description

Minimize server-visible information.

Do not assume the server needs:

- plaintext member list
- plaintext group name
- plaintext group history
- member relationship information

Document exactly what remains observable.

============================================================
23. MALICIOUS SERVER MODEL
============================================================

Treat the server as actively malicious.

Test a server that:

- modifies ciphertext
- deletes messages
- duplicates messages
- reorders messages
- replays messages
- sends stale group state
- sends another group's state
- modifies membership updates
- modifies media
- replaces media
- truncates media

The client must fail safely.

============================================================
24. ENCRYPTED MEDIA
============================================================

Phase 5 introduces:

- images
- videos
- audio
- documents

NEVER upload plaintext media.

Required pipeline:

plaintext media

        ↓

fresh random media key

        ↓

authenticated encryption

        ↓

encrypted media object

        ↓

server

The server receives ciphertext only.

============================================================
25. UNIQUE MEDIA KEYS
============================================================

Every media object receives an independent random encryption key.

Example:

Image A → Key A

Image B → Key B

Video C → Key C

Do not reuse one key for:

- entire group
- entire account
- entire conversation
- all media

============================================================
26. MEDIA KEY DELIVERY
============================================================

The media key must travel through the E2EE message.

Conceptually:

Encrypted group message:

{
    mediaObjectReference,
    mediaEncryptionKey,
    encryptedMetadata
}

The server must never receive the media encryption key in plaintext.

============================================================
27. MEDIA OBJECT IDENTIFIERS
============================================================

Media IDs must be opaque and unpredictable.

Do not derive media IDs from:

- filename
- username
- group name
- phone number
- timestamp alone

Avoid predictable sequential public IDs.

============================================================
28. MEDIA AUTHORIZATION
============================================================

Do not create:

public permanent media URLs.

Knowing an object identifier must not automatically provide plaintext
access.

The server should require appropriate authorization for media retrieval.

============================================================
29. MEDIA URL SECURITY
============================================================

NEVER place decryption keys in:

- URL query parameters
- URL fragments
- filenames
- public object names

Do not implement:

/media/123?key=SECRET

Keys belong inside the E2EE-protected message.

============================================================
30. MEDIA INTEGRITY
============================================================

Media encryption must authenticate integrity.

Detect:

- modified media
- truncated media
- corrupted media
- wrong key
- wrong object
- substituted media

Do not render media as trusted content before verification.

============================================================
31. LARGE MEDIA
============================================================

Do not load arbitrarily large files completely into memory.

For large files implement an appropriate streaming/chunking design.

If chunking is used, authenticate:

- media ID
- chunk index
- total chunk count where appropriate
- protocol version
- relevant authenticated context

Prevent:

- chunk swapping
- chunk duplication
- chunk reordering
- cross-file chunk substitution

Do not invent an insecure custom chunk cipher.

============================================================
32. THUMBNAILS
============================================================

Thumbnails are sensitive media.

Never upload plaintext thumbnails to the server.

Either:

- encrypt thumbnails independently

OR

- generate thumbnails locally after verified decryption.

============================================================
33. FILENAMES AND MEDIA METADATA
============================================================

Original filenames may contain sensitive information.

Protect:

- filename
- MIME type
- dimensions
- duration
- captions
- descriptions

where practical.

Server-visible metadata must be minimized.

============================================================
34. MIME SECURITY
============================================================

Never blindly trust server-provided MIME types.

Treat received files as untrusted input.

Do not automatically execute downloaded documents.

Validate media formats locally where practical.

============================================================
35. MEDIA SIZE PRIVACY
============================================================

Do not falsely claim media size is hidden.

If the server sees encrypted object size, document that leakage.

Integrate with the existing Phase 3 size/privacy architecture where
appropriate.

============================================================
36. MEDIA DOWNLOAD
============================================================

Implement:

requestMedia()

downloadEncryptedMedia()

verifyMedia()

decryptMedia()

The media key comes from the E2EE message.

The server must never obtain the decryption key.

============================================================
37. MEDIA FAILURE RECOVERY
============================================================

Support:

- interrupted uploads
- interrupted downloads
- retry
- corrupted download
- server failure
- duplicate upload
- partial transfer

Do not allow incomplete ciphertext to be treated as valid plaintext.

============================================================
38. GROUP + MEDIA INTEGRATION
============================================================

Test:

Alice creates group.

Alice adds Bob.

Alice adds Charlie.

Charlie sends an image.

Bob receives the encrypted message.

Bob obtains the media key through E2EE.

Bob downloads encrypted media.

Bob verifies media integrity.

Bob decrypts media.

Server never receives:

plaintext image

or

media key.

============================================================
39. MEMBER REMOVAL + MEDIA
============================================================

Critical test:

Alice
Bob
Charlie

Bob is removed.

Then Alice sends Media B.

Bob must not obtain the cryptographic state required for Media B.

Bob may retain Media A if he legitimately received it before removal.

This is expected behavior.

============================================================
40. NEW MEMBER + HISTORY
============================================================

Alice and Bob have an existing conversation.

Charlie joins later.

Charlie must NOT automatically decrypt old messages.

Unless a future explicit secure history-sharing feature is implemented:

new member = future messages only.

============================================================
41. CROSS-GROUP ISOLATION
============================================================

Create:

Group A
Group B
Group C

Verify:

Group A cannot decrypt Group B messages.

Group B cannot decrypt Group C media.

Group C cannot access Group A membership state.

============================================================
42. CROSS-SPACE ISOLATION
============================================================

Create:

Main Space → Group A

Private Space → Group B

Decoy Space → Group C

Verify complete cryptographic isolation.

No Space can access another Space's:

- groups
- group state
- group keys
- messages
- media
- media keys

============================================================
43. CRASH RECOVERY
============================================================

Test crashes during:

- group creation
- member addition
- member removal
- group message
- media upload
- media download
- state persistence

A crash must not silently corrupt cryptographic state.

Use atomic persistence where required.

============================================================
44. SECURITY LOGGING
============================================================

Audit every new log statement.

NEVER log:

- passwords
- Space Master Keys
- group secrets
- private keys
- media keys
- plaintext messages
- plaintext media
- invitation secrets

Error messages must not leak sensitive data.

============================================================
45. FUZZ TESTING
============================================================

Fuzz:

- group state
- membership updates
- invitations
- group messages
- epoch values
- role operations
- media metadata
- media ciphertext
- media chunks

Malformed input must not:

- crash the client
- bypass authorization
- corrupt cryptographic state
- expose secrets

============================================================
46. REQUIRED TEST FILES
============================================================

Create:

tests/group-protocol.test.ts
tests/group-creation.test.ts
tests/group-membership.test.ts
tests/group-add-remove.test.ts
tests/group-epochs.test.ts
tests/group-replay.test.ts
tests/group-ordering.test.ts
tests/group-state.test.ts
tests/group-rollback.test.ts
tests/group-malicious-server.test.ts
tests/group-isolation.test.ts

tests/media-encryption.test.ts
tests/media-integrity.test.ts
tests/media-chunking.test.ts
tests/media-authorization.test.ts
tests/media-replay.test.ts
tests/media-corruption.test.ts
tests/group-media.test.ts
tests/group-crash-recovery.test.ts
tests/group-fuzz.test.ts

============================================================
47. REQUIRED SECURITY TESTS
============================================================

Verify:

[ ] Group A and Group B have independent cryptographic state.

[ ] Unauthorized member cannot read another group.

[ ] Removed member cannot decrypt future messages.

[ ] New member cannot decrypt historical messages.

[ ] Rejoined member receives fresh state.

[ ] Forged membership update is rejected.

[ ] Forged admin operation is rejected.

[ ] Modified ciphertext is rejected.

[ ] Replay is rejected.

[ ] Rollback is rejected.

[ ] Stale state is handled safely.

[ ] Cross-Space access is rejected.

[ ] Group message sender is authenticated.

============================================================
48. REQUIRED MEDIA TESTS
============================================================

Verify:

[ ] image encryption

[ ] video encryption

[ ] audio encryption

[ ] document encryption

[ ] random media keys

[ ] different media have different keys

[ ] plaintext media never reaches server

[ ] media keys never reach server

[ ] modified media rejected

[ ] truncated media rejected

[ ] wrong key rejected

[ ] substituted media rejected

[ ] chunk reordering detected

[ ] chunk duplication detected

[ ] interrupted transfer handled

[ ] encrypted thumbnail

[ ] protected filename metadata

============================================================
49. END-TO-END TEST
============================================================

Create:

Alice
Bob
Charlie

Create:

VEIL Test Group

Perform:

1. Alice creates group.
2. Alice adds Bob.
3. Alice adds Charlie.
4. Alice sends text.
5. Bob replies.
6. Charlie sends an image.
7. Bob downloads and decrypts the image.
8. Remove Bob.
9. Charlie sends another image.
10. Verify Bob cannot decrypt the second image.
11. Verify Alice can decrypt it.
12. Verify Charlie can decrypt it.
13. Verify server cannot decrypt either image.

============================================================
50. PERFORMANCE TESTING
============================================================

Measure:

- group creation
- member addition
- member removal
- message encryption
- message decryption
- media encryption
- media decryption
- upload
- download
- group state synchronization

Do not weaken cryptographic security for performance.

============================================================
51. PROTOCOL VERSIONING
============================================================

Group protocol state must have explicit versions.

Unknown versions:

REJECT SAFELY.

Never silently downgrade.

Do not introduce insecure fallback behavior.

============================================================
52. DOCUMENTATION
============================================================

Create/update:

docs/GROUP_PROTOCOL.md
docs/MEDIA_SECURITY.md

Update:

docs/ARCHITECTURE.md
docs/CRYPTOGRAPHY.md
docs/IDENTITY_MODEL.md
docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/SECURITY.md
docs/THREAT_MODEL.md
docs/KNOWN_LIMITATIONS.md

Documentation must distinguish:

DESIGN INTENT

from

IMPLEMENTED SECURITY PROPERTY.

Never claim:

"secure"

"anonymous"

"untraceable"

"audited"

unless the repository contains evidence supporting the exact claim.

============================================================
53. AI CONTINUITY
============================================================

Update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
docs/ai/HANDOFF.md

HANDOFF.md must explain:

- selected group protocol
- group architecture
- epoch model
- membership model
- role model
- removal semantics
- message encryption
- media encryption
- media key delivery
- media authorization
- crash recovery
- test results
- known limitations
- remaining security concerns
- exact requirements for Phase 6

============================================================
54. NO UNRELATED WORK
============================================================

Do NOT implement:

- multi-device
- device linking
- account recovery
- phone verification
- voice calls
- video calls
- public groups
- group discovery
- advanced anonymity network
- final push infrastructure
- disappearing-message UX
- unrelated UI redesign

Keep the scope of Phase 5 controlled.

============================================================
55. DEFINITION OF DONE
============================================================

Phase 5 is complete ONLY when:

[ ] Phase 1 tests pass
[ ] Phase 2 tests pass
[ ] Phase 3 tests pass
[ ] Phase 4 tests pass

[ ] group protocol selected
[ ] group protocol documented
[ ] group creation works
[ ] group identity works
[ ] epochs work
[ ] authenticated membership works
[ ] member addition works
[ ] member removal works
[ ] leave group works
[ ] role authorization works
[ ] unauthorized operations rejected
[ ] group messages encrypted
[ ] sender authenticated
[ ] replay protection works
[ ] out-of-order handling works
[ ] stale-state handling works
[ ] rollback protection works

[ ] new members cannot automatically decrypt history
[ ] removed members cannot decrypt future content

[ ] group state encrypted at rest
[ ] crash recovery works
[ ] cross-group isolation works
[ ] cross-Space isolation works

[ ] media encryption works
[ ] per-media keys work
[ ] media keys delivered through E2EE
[ ] server cannot decrypt media
[ ] media integrity works
[ ] media authorization works
[ ] large files handled safely
[ ] chunk integrity works where applicable
[ ] thumbnails protected
[ ] filename metadata protected

[ ] malicious-server tests pass
[ ] fuzz tests pass
[ ] security logging audit passes
[ ] privacy audit completed
[ ] documentation updated
[ ] AI continuity updated

[ ] no secrets committed
[ ] full test suite passes
[ ] Git diff reviewed
[ ] working tree clean
[ ] Phase 5 commit created

============================================================
56. FINAL STOP CONDITION
============================================================

STOP after completing Phase 5.

Do NOT begin Phase 6.

The repository must be left ready for:

PHASE 6 —
MULTI-DEVICE, DEVICE LINKING & RECOVERY

============================================================
FINAL SECURITY PRINCIPLES
============================================================

DO NOT INVENT GROUP CRYPTOGRAPHY.

GROUP MEMBERSHIP IS CRYPTOGRAPHIC STATE.

MEMBER REMOVAL MUST PROTECT FUTURE CONTENT.

NEW MEMBERS MUST NOT AUTOMATICALLY RECEIVE HISTORY.

MEDIA MUST BE ENCRYPTED BEFORE UPLOAD.

MEDIA KEYS MUST TRAVEL THROUGH E2EE.

THE SERVER STORES CIPHERTEXT.

THE SERVER IS NOT THE GROUP AUTHORITY.

DO NOT TRUST CLIENT-SUPPLIED ROLES.

DO NOT TRUST SERVER-SUPPLIED GROUP STATE.

DO NOT PUT DECRYPTION KEYS IN URLS.

DO NOT LOG CRYPTOGRAPHIC SECRETS.

DO NOT CROSS SPACE BOUNDARIES.

DO NOT CLAIM SECURITY PROPERTIES THAT HAVE NOT BEEN VERIFIED.

STOP WHEN PHASE 5 IS COMPLETE.