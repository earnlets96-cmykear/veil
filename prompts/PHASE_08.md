Absolutely. Phase 8 is where VEIL starts attacking one of the hardest privacy problems: **metadata**. The messages can be perfectly E2EE and VEIL can still leak useful information through *who connects, when, how often, how much data, and which devices are online*.

Below is the full agent-ready prompt.

# VEIL — PHASE 8

## Metadata Minimization, Traffic Analysis Resistance & Privacy-Preserving Network Behavior

```text
============================================================
VEIL — PHASE 8
METADATA MINIMIZATION & TRAFFIC ANALYSIS RESISTANCE
============================================================

MISSION

You are implementing PHASE 8 of VEIL.

Phase 8 improves VEIL's network privacy.

The goal is NOT merely to encrypt message contents.

The goal is to minimize what the VEIL infrastructure, network observers,
and other parties can learn from:

- connection patterns
- timing
- message size
- delivery behavior
- mailbox activity
- device presence
- push notifications
- upload/download behavior
- retry behavior
- synchronization behavior
- server-side identifiers
- traffic volume

The objective is:

"Encrypt the message AND minimize the information surrounding the message."

============================================================
0. SECURITY WARNING
============================================================

DO NOT CLAIM THAT VEIL PROVIDES PERFECT ANONYMITY.

Metadata resistance is probabilistic and depends on:

- network environment
- operating system
- transport implementation
- server deployment
- network observer capability
- timing
- message frequency
- device behavior
- application lifecycle
- user behavior

A sufficiently powerful global observer may still perform traffic
analysis.

All limitations MUST be documented.

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

Also read:

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

Inspect all Phase 1–7 implementations.

Run:

npm test

DO NOT begin Phase 8 implementation until the previous phases pass.

============================================================
2. CORE PRINCIPLE
============================================================

VEIL must distinguish:

CONTENT PRIVACY

from

METADATA PRIVACY.

E2EE protects:

"What did they say?"

Metadata minimization attempts to reduce:

"Who is talking?"

"When?"

"How often?"

"How much?"

"Which device?"

"Which mailbox?"

"Is this person online?"

============================================================
3. CURRENT ARCHITECTURE AUDIT
============================================================

Before writing code, identify every location where metadata can leak.

Audit:

- server API
- mailbox identifiers
- connection identifiers
- device identifiers
- message IDs
- timestamps
- sequence numbers
- retry IDs
- delivery receipts
- push tokens
- WebSocket connections
- HTTP requests
- media uploads
- media downloads
- synchronization
- device linking
- recovery
- group operations
- presence
- typing indicators
- read receipts
- notification behavior
- error responses
- logs

Create:

docs/METADATA_AUDIT.md

Document:

Source
↓
Metadata exposed
↓
Who can observe it
↓
Why it exists
↓
Whether it can be minimized
↓
Remaining limitation

============================================================
4. METADATA CLASSIFICATION
============================================================

Classify metadata into:

CATEGORY A — MUST NOT LEAK

Examples:

- plaintext message contents
- plaintext media
- passwords
- cryptographic keys
- private Space relationships

CATEGORY B — MINIMIZE

Examples:

- exact message timestamps
- message size
- mailbox identifiers
- device identifiers
- connection duration
- delivery timing

CATEGORY C — OPERATIONALLY NECESSARY

Examples:

- encrypted routing token
- encrypted mailbox reference
- protocol version
- encrypted packet framing

Every Category C item must have a documented reason.

============================================================
5. SERVER KNOWLEDGE MODEL
============================================================

Update:

docs/METADATA_MODEL.md

Explicitly define what the server can know.

Aim for the server to know as little as practical.

The server should NOT need to know:

- plaintext identity
- plaintext messages
- Space names
- Space passwords
- message contents
- contact lists
- conversation contents

============================================================
6. BLIND MAILBOX REVIEW
============================================================

Review Phase 3's mailbox architecture.

Verify mailbox identifiers are:

- opaque
- high entropy
- non-semantic
- unrelated to usernames
- unrelated to Space names
- unrelated to contact identifiers

Never use:

user123
john@example.com
space-private
phone-number

as mailbox identifiers.

============================================================
7. MAILBOX TOKEN ROTATION
============================================================

Design a mechanism for rotating mailbox access tokens.

The goal:

Compromise of one token should not permanently expose future mailbox
access.

Consider:

- token epochs
- authenticated token rotation
- overlapping validity periods
- safe revocation

Do not break offline delivery.

============================================================
8. SERVER-SIDE IDENTIFIERS
============================================================

Audit:

- user IDs
- device IDs
- mailbox IDs
- message IDs
- upload IDs
- download IDs

Avoid identifiers that allow unnecessary correlation.

Do not expose sequential IDs such as:

1
2
3
4

Prefer cryptographically random opaque identifiers where appropriate.

============================================================
9. MESSAGE SIZE LEAKAGE
============================================================

Message lengths can reveal information.

Example:

"yes"

and

"a long explanation containing 500 words"

produce different traffic sizes.

Implement a protocol-level strategy for reducing message-size leakage.

Potential technique:

PADDED ENVELOPES

Messages are placed into standardized size classes.

For example:

small
medium
large
etc.

Do not use arbitrary padding without defining protocol boundaries.

============================================================
10. PADDING DESIGN
============================================================

Create:

src/privacy/padding.ts

Implement:

padMessage()
unpadMessage()

Requirements:

- deterministic size classes
- authenticated before decryption
- no plaintext metadata
- bounded maximum size
- no ambiguity between padding and plaintext

Padding MUST happen before transport encryption.

============================================================
11. PADDING SECURITY
============================================================

Do not create unlimited padding.

Prevent:

- memory exhaustion
- bandwidth abuse
- oversized packets

Define:

MAX_MESSAGE_SIZE
MAX_PADDED_SIZE

Reject malformed padding safely.

============================================================
12. TRAFFIC BURSTS
============================================================

Even with padded messages, timing may reveal communication events.

Example:

Message sent
↓
Immediate packet
↓
Server forwards packet

An observer can infer:

"Someone just sent a message."

Design a realistic strategy for reducing timing leakage.

Potential techniques may include:

- batching
- randomized delay
- scheduled polling
- cover traffic
- connection pooling

Do NOT implement all of them blindly.

Measure usability impact.

============================================================
13. RANDOMIZED DELIVERY DELAYS
============================================================

Where appropriate, introduce bounded randomization.

Example:

Message becomes available
↓
delivery scheduling
↓
randomized bounded delay
↓
recipient retrieval

Do NOT make normal chat unusably slow.

Security improvements must be measurable.

============================================================
14. BATCHING
============================================================

Investigate batching multiple encrypted envelopes into a transport
operation.

Example:

Packet contains:

Envelope A
Envelope B
Envelope C

An observer should have less ability to infer one packet = one message.

Do not allow batching to introduce message-order or integrity problems.

============================================================
15. COVER TRAFFIC
============================================================

Evaluate optional cover traffic.

Cover traffic means sending encrypted-looking traffic even when the user
is not actively sending messages.

IMPORTANT:

Do NOT make cover traffic mandatory by default if it causes:

- excessive battery usage
- excessive bandwidth
- excessive server cost

Implement as a privacy-level option if appropriate.

============================================================
16. PRIVACY LEVELS
============================================================

Introduce:

Privacy Level

Possible:

STANDARD
BALANCED
HIGH

Example:

STANDARD
- normal polling
- minimal padding
- minimal overhead

BALANCED
- stronger padding
- timing randomization
- less predictable polling

HIGH
- stronger traffic shaping
- optional cover traffic
- stronger batching

Exact implementation must be based on measured feasibility.

============================================================
17. DO NOT FAKE SECURITY
============================================================

A setting called:

"Maximum anonymity"

means nothing unless the underlying network behavior actually changes.

Every privacy mode must have documented technical behavior.

============================================================
18. POLLING VS PUSH
============================================================

Audit current message delivery.

Push notifications can reveal:

- that a message exists
- timing
- possibly application activity

Design a privacy-preserving push architecture.

Push notifications should contain minimal information.

Ideally:

"Wake the application."

rather than:

"John sent you a message."

============================================================
19. PUSH PAYLOAD
============================================================

Never put plaintext message content into push payloads.

Never put:

- sender name
- Space name
- message preview
- group name

into push payloads unless explicitly justified.

Prefer opaque wake-up signals.

============================================================
20. PUSH TOKEN PRIVACY
============================================================

Audit push registration.

Ensure push tokens are not unnecessarily linkable to:

- plaintext identity
- Space
- contacts
- message contents

Document what the platform provider can still observe.

============================================================
21. PRESENCE
============================================================

Review online/offline presence.

Presence is metadata.

Avoid broadcasting:

"User is online"

to everyone by default.

Consider:

- no global presence
- coarse presence
- optional presence
- last-seen disabled by default

============================================================
22. LAST SEEN
============================================================

Do not expose exact last-seen timestamps by default.

If supported:

use privacy controls.

Potential options:

Nobody
Contacts
Selected contacts

Exact behavior must be clearly documented.

============================================================
23. TYPING INDICATORS
============================================================

Typing indicators leak:

- who is actively composing
- when they are composing
- conversation activity

Implement them as optional.

Potential privacy setting:

Typing indicators:
ON / OFF

If enabled, consider rate limiting and coalescing events.

============================================================
24. READ RECEIPTS
============================================================

Read receipts leak interaction timing.

Implement:

Read receipts:
ON / OFF

Avoid sending exact unnecessary timing information.

Do not require read receipts for normal operation.

============================================================
25. DELIVERY RECEIPTS
============================================================

Delivery receipts can reveal device activity.

Audit:

- when generated
- what identifiers they contain
- who receives them
- whether they are linkable

Use opaque encrypted receipt information.

============================================================
26. MESSAGE TIMESTAMPS
============================================================

User-visible timestamps are not necessarily the same as transport
timestamps.

Separate:

USER TIMESTAMP

from

NETWORK TIMESTAMP.

Do not expose unnecessary server timestamps to users.

============================================================
27. SERVER TIMESTAMP MINIMIZATION
============================================================

Where exact timestamps are not operationally required:

avoid exposing them.

Document:

- server storage timestamp
- delivery timestamp
- local receive timestamp
- user-visible timestamp

============================================================
28. MESSAGE ORDERING
============================================================

Do not rely on server timestamps as the primary security mechanism for
message ordering.

Use the cryptographic messaging protocols established in earlier phases.

Metadata minimization must not break:

- ordering
- replay protection
- ratchet state
- group epochs

============================================================
29. CONNECTION BEHAVIOR
============================================================

Audit persistent connections.

A permanently open connection can reveal:

- online state
- connection duration
- IP address
- activity timing

Determine the appropriate strategy per platform.

============================================================
30. CONNECTION RANDOMIZATION
============================================================

Where practical, avoid deterministic connection schedules.

Do not reconnect every exact N seconds.

Use bounded jitter.

Do not create reconnect storms.

============================================================
31. IP ADDRESS MODEL
============================================================

Document what VEIL's server can see.

At minimum:

- source IP may be visible to the server
- network provider may observe destination
- VPN/Tor use changes this model
- VEIL cannot magically hide IP addresses from the network

Do not claim:

"VEIL hides your IP."

============================================================
32. OPTIONAL PROXY SUPPORT
============================================================

Evaluate support for standard proxy configurations.

Do not implement custom anonymity protocols without a strong reason.

If proxy support exists:

- document limitations
- avoid claiming anonymity guarantees
- ensure E2EE remains intact

============================================================
33. TOR / ANONYMITY NETWORKS
============================================================

DO NOT make Tor mandatory in Phase 8.

Investigate compatibility only.

Create:

docs/ANONYMITY_NETWORKS.md

Explain:

- Tor
- VPN
- proxy
- direct connection

and their tradeoffs.

If implementation is attempted, isolate it behind a clean transport
abstraction.

============================================================
34. TRANSPORT ABSTRACTION
============================================================

Create or refine:

src/transport/

Potential interface:

Transport
├── connect()
├── send()
├── receive()
├── close()
└── status()

Privacy behavior must be independent of the cryptographic messaging
layer.

============================================================
35. ENCRYPTED TRANSPORT ENVELOPES
============================================================

Review transport envelopes.

Ensure they contain only the minimum routing metadata necessary.

Example conceptual structure:

TransportEnvelope
{
    version
    opaqueDestination
    sequence
    encryptedPayload
    authenticationData
}

Do not include:

username
Space name
sender name
group name
message type in plaintext

unless operationally required.

============================================================
36. MESSAGE TYPE LEAKAGE
============================================================

Audit whether observers can distinguish:

- text message
- image
- video
- voice message
- reaction
- typing
- read receipt
- group event

through packet structure.

Where practical, normalize encrypted envelope structures.

============================================================
37. MEDIA TRAFFIC
============================================================

Media sizes are especially revealing.

Audit:

- image upload sizes
- video upload sizes
- download sizes
- thumbnails
- progressive loading

Ensure media remains encrypted before upload.

============================================================
38. MEDIA PADDING
============================================================

Investigate media padding.

Do not blindly pad every large video to enormous sizes.

Use reasonable size classes.

Document bandwidth tradeoffs.

============================================================
39. THUMBNAIL PRIVACY
============================================================

Ensure thumbnails do not leak plaintext.

Review:

- local cache
- server cache
- CDN
- notification preview
- image preview
- OS media indexing

No plaintext thumbnail should leave the encrypted storage boundary
without explicit user-facing justification.

============================================================
40. CDN REVIEW
============================================================

If media uses a CDN:

audit whether the CDN can correlate:

- user
- media
- timing
- download requests

Prefer opaque encrypted media objects.

Do not rely on CDN secrecy.

============================================================
41. SERVER LOGGING
============================================================

Audit server logs.

The server should NOT log:

- message contents
- decrypted identities
- Space names
- passwords
- encryption keys

Minimize:

- IP addresses
- request timestamps
- mailbox identifiers
- connection IDs

Where logs are operationally necessary:

define retention limits.

============================================================
42. LOG RETENTION
============================================================

Create:

docs/SERVER_PRIVACY.md

Define:

What is logged
Why
Retention
Access
Deletion

Use the minimum operational retention possible.

============================================================
43. ERROR RESPONSE PRIVACY
============================================================

Server errors can become metadata channels.

Do not return different responses that unnecessarily reveal:

- mailbox existence
- user existence
- message existence
- device existence

Prefer generic responses where practical.

============================================================
44. RATE LIMITING
============================================================

Rate limiting must not become an identity oracle.

Avoid obvious:

"This mailbox exists."

vs

"This mailbox does not exist."

Use privacy-preserving rate-limit architecture where practical.

============================================================
45. MESSAGE RETRY
============================================================

Retry behavior can reveal network conditions.

Audit:

- retry intervals
- retry counts
- retry identifiers
- server acknowledgements

Use bounded jitter.

Prevent retry storms.

============================================================
46. OFFLINE MODE
============================================================

Offline operation must preserve the Space boundaries.

A device may queue encrypted messages locally.

Queued data must remain:

- encrypted
- Space-isolated
- unavailable while locked

============================================================
47. SYNCHRONIZATION
============================================================

Audit multi-device synchronization from Phase 6.

Sync traffic can reveal:

- which device is active
- when messages change
- volume of activity
- device relationships

Minimize unnecessary metadata.

============================================================
48. DEVICE PRESENCE
============================================================

Do not expose:

"John's iPhone is online."

unless required.

Device-level presence should remain private.

============================================================
49. MULTI-DEVICE TRAFFIC
============================================================

Where practical, avoid making it obvious which device originated a
specific message.

Use encrypted protocol-level device handling.

Do not expose device IDs unnecessarily.

============================================================
50. GROUP METADATA
============================================================

Audit group operations.

Observers should not unnecessarily learn:

- group name
- group membership
- member changes
- group activity volume

The server should receive only what the group protocol requires.

============================================================
51. GROUP EVENT PADDING
============================================================

Review whether:

join
leave
remove
rename
permission changes

produce distinguishable traffic.

Where practical, normalize event envelopes.

============================================================
52. CONTACT DISCOVERY
============================================================

Contact discovery is a major metadata risk.

DO NOT upload a plaintext address book.

If contact discovery exists:

- document exactly what the server sees
- minimize identifiers
- use privacy-preserving mechanisms
- avoid permanent contact correlation

============================================================
53. SEARCH
============================================================

Server-side global search is prohibited unless there is a privacy-safe
design.

Prefer local encrypted search for user-owned data.

============================================================
54. TRAFFIC ANALYSIS TEST HARNESS
============================================================

Create:

tests/metadata-analysis.test.ts

Build test utilities that record:

- packet sizes
- timing
- direction
- request count
- connection count
- retries

The purpose is to identify obvious correlations.

============================================================
55. SIZE ANALYSIS
============================================================

Generate messages:

"hi"

"hello"

"this is a medium message"

large message

and compare:

plaintext size
↓
encrypted size
↓
transport size

Verify padding reduces direct size correlation.

============================================================
56. TIMING ANALYSIS
============================================================

Generate controlled message sequences.

Compare:

message event
↓
network event

Measure timing distributions.

The goal is not "zero correlation."

The goal is to reduce deterministic correlation where practical.

============================================================
57. BURST ANALYSIS
============================================================

Simulate:

1 message
5 messages
20 messages
100 messages

Measure whether packet bursts reveal exact message counts.

Document findings.

============================================================
58. ID CORRELATION TEST
============================================================

Ensure identifiers cannot trivially correlate:

message
→ mailbox
→ device
→ user

unless the protocol explicitly requires the relationship.

============================================================
59. CROSS-SPACE METADATA TEST
============================================================

Create:

Main
Private
Decoy

Generate identical traffic patterns.

Verify that server-side structures do not explicitly reveal:

"This is the private Space."

============================================================
60. SERVER OBSERVER MODEL
============================================================

Create a test observer representing an honest-but-curious server.

It may see:

- encrypted packets
- routing tokens
- timestamps
- sizes
- connections

It must NOT be able to recover:

- message contents
- plaintext identity
- Space names
- passwords
- cryptographic keys

============================================================
61. NETWORK OBSERVER MODEL
============================================================

Create a simulated passive observer.

It may observe:

- packet timing
- packet direction
- packet size
- destination
- connection behavior

Measure what information remains.

============================================================
62. GLOBAL OBSERVER LIMITATION
============================================================

Document explicitly:

A sufficiently powerful global passive observer may correlate traffic
despite padding and timing defenses.

VEIL does not guarantee protection against a global traffic-analysis
adversary.

============================================================
63. PRIVACY BUDGET
============================================================

Do not optimize privacy without measuring cost.

For each privacy feature record:

Privacy gain
Battery cost
Bandwidth cost
Latency cost
Server cost
UX cost

============================================================
64. BANDWIDTH BENCHMARK
============================================================

Measure:

Normal message
vs
padded message

Normal media
vs
padded media

Normal polling
vs
privacy mode

Document overhead.

============================================================
65. LATENCY BENCHMARK
============================================================

Measure:

message send → delivery

for:

STANDARD
BALANCED
HIGH

Do not accept unnecessary multi-second delays for normal messaging.

============================================================
66. BATTERY BENCHMARK
============================================================

Where applicable:

measure background activity.

High privacy mode must not silently create excessive battery drain.

============================================================
67. PRIVACY SETTINGS
============================================================

Add appropriate settings:

Privacy
├── Read receipts
├── Typing indicators
├── Last seen
├── Message previews
├── Traffic privacy
├── Auto-lock
└── Notification privacy

Avoid exposing 50 cryptographic toggles.

============================================================
68. TRAFFIC PRIVACY SETTING
============================================================

Provide a simple explanation.

Example:

Traffic Privacy

Standard
Normal performance.

Balanced
Reduces timing and size patterns with moderate overhead.

High
Uses stronger traffic-shaping techniques and may use more bandwidth,
battery, and latency.

Do NOT call this:

"Anonymous Mode."

============================================================
69. DEFAULT MODE
============================================================

Choose a privacy-preserving default that remains usable.

Do not optimize only for:

maximum privacy

at the cost of:

terrible messaging performance.

Document the decision in:

docs/ai/DECISIONS.md

============================================================
70. SERVER API AUDIT
============================================================

Review every endpoint.

For each endpoint record:

- request fields
- response fields
- identifiers
- timestamps
- authentication metadata
- logging
- correlation potential

Create:

docs/API_METADATA_AUDIT.md

============================================================
71. DATABASE AUDIT
============================================================

Review server-side database schemas.

Identify:

- user IDs
- mailbox IDs
- device IDs
- timestamps
- message IDs
- IP addresses
- push tokens
- upload metadata

Remove unnecessary fields.

============================================================
72. DATABASE RETENTION
============================================================

Define retention policy.

Data should not remain forever simply because:

"storage is cheap."

Minimize retention.

============================================================
73. SERVER ACCESS CONTROL
============================================================

Document who can access metadata.

Separate:

- operational access
- administrator access
- debugging access

Use least privilege.

============================================================
74. METADATA ENCRYPTION
============================================================

Where metadata must exist server-side:

encrypt it if feasible.

However:

DO NOT claim encryption makes metadata invisible if the server must still
use it for routing.

Encryption is not magic.

============================================================
75. RANDOM IDENTIFIERS
============================================================

Use cryptographically secure random identifiers.

Audit all generated IDs.

They must not be:

- predictable
- sequential
- timestamp-derived
- user-derived

unless explicitly required.

============================================================
76. REPLAY PROTECTION
============================================================

Metadata minimization must not weaken replay protection.

All transport envelopes must preserve:

- authentication
- freshness
- replay detection
- ordering where required

============================================================
77. ANTI-CORRELATION DESIGN
============================================================

Review whether the same identifier appears across layers.

Example bad architecture:

User ID
↓
Mailbox ID
↓
Message ID
↓
Media ID

all directly linked.

Reduce unnecessary correlation.

============================================================
78. ENCRYPTED BATCH IDENTIFIERS
============================================================

Where batching is used:

do not expose a plaintext list of message IDs.

Use encrypted authenticated batch structures.

============================================================
79. CONNECTION POOLING
============================================================

Evaluate connection reuse.

Avoid:

one connection = one message.

Where practical, use connection pooling or multiplexing.

Document correlation risks.

============================================================
80. RESOURCE LIMITS
============================================================

All privacy mechanisms must have hard limits.

Define:

MAX_PACKET_SIZE
MAX_BATCH_SIZE
MAX_PADDING
MAX_QUEUE_SIZE
MAX_RETRY_COUNT

Prevent memory and bandwidth attacks.

============================================================
81. DENIAL-OF-SERVICE CONSIDERATIONS
============================================================

Padding and cover traffic can increase attack surfaces.

Test:

- oversized padding requests
- batch flooding
- fake delivery receipts
- connection exhaustion
- retry amplification
- mailbox flooding

============================================================
82. NO AMPLIFICATION
============================================================

One small attacker request must not cause:

100MB server response
or
1000 downstream packets

unless properly authenticated and rate limited.

============================================================
83. SECURE DEFAULTS
============================================================

Default:

- no plaintext push content
- no analytics
- no telemetry
- minimal presence
- read receipts configurable
- typing indicators configurable
- message preview privacy enabled
- privacy-preserving IDs
- padded message envelopes where feasible

============================================================
84. DOCUMENTATION
============================================================

Update:

docs/METADATA_MODEL.md
docs/PRIVACY.md
docs/THREAT_MODEL.md
docs/ARCHITECTURE.md
docs/KNOWN_LIMITATIONS.md
docs/SERVER_PRIVACY.md

Add:

docs/METADATA_AUDIT.md
docs/API_METADATA_AUDIT.md
docs/ANONYMITY_NETWORKS.md

============================================================
85. TEST FILES
============================================================

Create or update:

tests/metadata-analysis.test.ts
tests/message-padding.test.ts
tests/timing-privacy.test.ts
tests/identifier-privacy.test.ts
tests/push-privacy.test.ts
tests/presence-privacy.test.ts
tests/transport-privacy.test.ts
tests/media-metadata.test.ts
tests/server-metadata.test.ts
tests/cross-space-metadata.test.ts
tests/privacy-levels.test.ts
tests/resource-limit.test.ts

============================================================
86. REQUIRED SECURITY TESTS
============================================================

Verify:

[ ] no plaintext message content in transport logs

[ ] no password in logs

[ ] no cryptographic key in logs

[ ] no Space name in server transport metadata

[ ] no sequential message identifiers

[ ] random mailbox identifiers

[ ] random device identifiers

[ ] no plaintext push message

[ ] no plaintext notification preview by default

[ ] no cross-Space identifiers

[ ] no cross-Space search

[ ] no unnecessary server timestamps

[ ] no unnecessary IP retention

[ ] no analytics

[ ] no telemetry

============================================================
87. PADDING TESTS
============================================================

Verify:

[ ] padding authenticates correctly

[ ] malformed padding rejected

[ ] oversized padding rejected

[ ] truncated padded message rejected

[ ] random padded ciphertext rejected

[ ] plaintext recovered exactly

[ ] multiple messages use expected size classes

============================================================
88. TIMING TESTS
============================================================

Verify:

[ ] no deterministic polling interval where avoidable

[ ] retry jitter works

[ ] batching works

[ ] delivery remains usable

[ ] high privacy mode increases resistance to simple timing correlation

============================================================
89. PUSH TESTS
============================================================

Verify:

[ ] push payload contains no message content

[ ] push payload contains no private Space name

[ ] push payload contains no contact name

[ ] push token is not unnecessarily linked to plaintext identity

[ ] locked Space does not reveal message preview

============================================================
90. PRESENCE TESTS
============================================================

Verify:

[ ] online status is not globally exposed by default

[ ] last seen is configurable

[ ] typing indicators are configurable

[ ] read receipts are configurable

============================================================
91. SERVER OBSERVER TEST
============================================================

Create a simulated server observer.

Given:

- encrypted packets
- mailbox tokens
- message IDs
- timing
- size

the observer must NOT recover:

- plaintext
- password
- Space name
- message contents

============================================================
92. TRAFFIC OBSERVER TEST
============================================================

Create a passive observer.

Verify the system reduces:

- direct message-size correlation
- deterministic timing correlation
- message-count inference

Document remaining leakage.

============================================================
93. PERFORMANCE REGRESSION
============================================================

Run:

npm test

and performance benchmarks.

Phase 8 must not cause unacceptable regressions in:

- message latency
- message throughput
- memory usage
- battery behavior
- media upload/download

============================================================
94. SECURITY REVIEW
============================================================

Perform an adversarial review.

Ask:

"If I cannot decrypt the message, what can I still learn?"

Then attempt to answer:

- who is talking?
- when?
- how often?
- how much?
- which device?
- which mailbox?
- whether someone is online?
- whether a message was delivered?
- whether a message was read?
- whether a file was uploaded?

Minimize each answer where practical.

============================================================
95. FALSE POSITIVE REVIEW
============================================================

Do not classify every piece of metadata as a vulnerability.

Some metadata is operationally necessary.

For every retained metadata field:

document:

WHY IT EXISTS.

============================================================
96. DOCUMENT REMAINING LEAKAGE
============================================================

At the end of Phase 8 create:

docs/METADATA_REMAINING_LEAKAGE.md

Include:

Leak
Observer
Severity
Why it remains
Potential future mitigation

Be honest.

============================================================
97. AI CONTINUITY
============================================================

Update:

docs/ai/CURRENT_STATE.md
docs/ai/ACTIVE_TASK.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
docs/ai/HANDOFF.md

HANDOFF.md MUST contain:

- metadata architecture
- server knowledge model
- transport model
- padding design
- timing mitigation
- batching
- push privacy
- presence privacy
- traffic privacy levels
- anonymity network research
- performance benchmarks
- remaining metadata leakage
- security findings
- exact Phase 9 requirements

============================================================
98. NO UNRELATED WORK
============================================================

DO NOT implement:

- cryptocurrency
- advertising
- analytics
- telemetry
- unrelated UI redesign
- new messaging protocols
- custom cryptographic primitives
- surveillance features
- invasive tracking

Do not rewrite Phase 4/5 cryptographic messaging protocols unless a
Phase 8 metadata issue demonstrably requires it.

============================================================
99. DEFINITION OF DONE
============================================================

Phase 8 is complete ONLY when:

ARCHITECTURE

[ ] metadata sources audited
[ ] server knowledge documented
[ ] transport metadata minimized
[ ] identifiers audited
[ ] mailbox tokens audited
[ ] device identifiers audited

TRAFFIC

[ ] message padding implemented where justified
[ ] timing behavior reviewed
[ ] batching evaluated
[ ] retry jitter implemented
[ ] connection behavior reviewed
[ ] privacy levels implemented or explicitly rejected with rationale

PUSH

[ ] plaintext push content eliminated
[ ] notification privacy preserved
[ ] push token architecture reviewed

PRESENCE

[ ] presence minimized
[ ] last seen configurable
[ ] typing indicators configurable
[ ] read receipts configurable

MEDIA

[ ] media metadata audited
[ ] thumbnail leakage reviewed
[ ] CDN behavior reviewed
[ ] media padding evaluated

SERVER

[ ] server logging minimized
[ ] retention policy documented
[ ] database metadata audited
[ ] error responses reviewed
[ ] rate limiting reviewed

TESTING

[ ] metadata observer tests pass
[ ] traffic analysis tests pass
[ ] padding tests pass
[ ] identifier tests pass
[ ] push privacy tests pass
[ ] cross-Space metadata tests pass
[ ] resource-limit tests pass
[ ] all previous Phase 1–7 tests pass

PERFORMANCE

[ ] latency measured
[ ] bandwidth measured
[ ] memory measured
[ ] battery implications documented

DOCUMENTATION

[ ] METADATA_AUDIT.md
[ ] API_METADATA_AUDIT.md
[ ] SERVER_PRIVACY.md
[ ] ANONYMITY_NETWORKS.md
[ ] METADATA_REMAINING_LEAKAGE.md
[ ] THREAT_MODEL.md updated
[ ] PRIVACY.md updated
[ ] KNOWN_LIMITATIONS.md updated

REPOSITORY

[ ] no secrets committed
[ ] no plaintext credentials
[ ] no sensitive logs
[ ] full test suite passes
[ ] Git diff reviewed
[ ] working tree clean
[ ] atomic Phase 8 commit created

============================================================
100. FINAL STOP CONDITION
============================================================

STOP AFTER PHASE 8.

DO NOT IMPLEMENT PHASE 9.

The repository must be ready for:

PHASE 9 —
ADVERSARIAL SECURITY AUDIT,
PROTOCOL REVIEW,
THREAT MODEL VALIDATION,
AND PENETRATION TESTING.

============================================================
FINAL PRINCIPLES
============================================================

E2EE PROTECTS CONTENT.

METADATA MINIMIZATION REDUCES CONTEXT.

DO NOT CLAIM PERFECT ANONYMITY.

DO NOT CLAIM PERFECT TRAFFIC ANALYSIS RESISTANCE.

DO NOT CLAIM IP ADDRESS ANONYMITY.

DO NOT CLAIM FORENSIC INVISIBILITY.

MINIMIZE SERVER KNOWLEDGE.

MINIMIZE IDENTIFIER CORRELATION.

MINIMIZE TIMING CORRELATION.

MINIMIZE SIZE CORRELATION.

MINIMIZE PRESENCE LEAKAGE.

MINIMIZE NOTIFICATION LEAKAGE.

MINIMIZE DEVICE CORRELATION.

DO NOT SACRIFICE CORE MESSAGE RELIABILITY WITHOUT JUSTIFICATION.

MEASURE PRIVACY COSTS.

DOCUMENT REMAINING LEAKAGE.

SECURITY CLAIMS MUST MATCH IMPLEMENTATION.

STOP WHEN PHASE 8 IS COMPLETE.
```

### The architectural upgrade this phase introduces

The important shift is this:

```text
                    BEFORE PHASE 8

User
 │
 ▼
Encrypted Message
 │
 ▼
Server
 │
 ▼
Recipient
```

The content is protected, but an observer may still notice:

```text
13:02  ─────  1 packet
13:04  ─────  1 packet
13:05  ─────  8 packets
13:05  ─────  large upload
```

Phase 8 moves VEIL toward:

```text
                 VEIL PRIVACY LAYER

             ┌───────────────────────┐
             │   Message Encryption  │
             ├───────────────────────┤
             │   Size Padding        │
             ├───────────────────────┤
             │   Batching             │
             ├───────────────────────┤
             │   Timing Jitter        │
             ├───────────────────────┤
             │   Opaque IDs           │
             ├───────────────────────┤
             │   Blind Mailboxes      │
             ├───────────────────────┤
             │   Push Minimization    │
             ├───────────────────────┤
             │   Presence Privacy     │
             └───────────────────────┘
                        │
                        ▼
                 Privacy Transport
                        │
                        ▼
                     Server
```

And one **very important improvement** over the earlier architecture is that Phase 8 forces the AI agent to **measure the privacy improvements instead of blindly adding "anonymous" features**. That's important because padding, cover traffic, random delays, etc. can easily turn a nice messenger into a battery-burning, laggy science experiment that *claims* to be private.
