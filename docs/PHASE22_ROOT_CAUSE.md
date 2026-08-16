# PHASE 22 ROOT CAUSE ANALYSIS & REAL-DEVICE DELIVERY REPAIR

## 1. Original Symptom
During the first physical real-device testing of VEIL between two phones:
- Phone 2 successfully discovered and added Phone 1 via invitation/contact import.
- Phone 2 displayed Phone 1's profile and initiated a chat.
- Phone 2 composed and sent a message ("HELLO FROM PHONE 2").
- **FAILURE**: Phone 1 **never received the message** from Phone 2. The message stayed queued/undelivered on Phone 2.

---

## 2. Deterministic Reproduction Procedure
1. Initialize Phone 1 client: Unlock Space 1, initialize `SpaceIdentityManager` (generating Ed25519 identity keypair and `doc1`), allocate blind relay mailbox `mb1`, generate Signed Prekeys and One-Time Prekeys pool.
2. Export Phone 1 invitation via `AppState.exportMyInvitation()`.
3. Initialize Phone 2 client: Unlock Space 2, initialize `SpaceIdentityManager` (generating `doc2`), allocate blind relay mailbox `mb2`.
4. Import Phone 1 invitation on Phone 2 via `AppState.addContactFromInvitation()`.
5. Open conversation on Phone 2 and invoke `AppState.sendMessage(conversationId, "HELLO FROM PHONE 2")`.
6. Observe relay network egress and Phone 1 incoming WebSocket/HTTP sync:
   - Phone 2 transmitted HTTP POST to `/v1/envelopes` with `mailboxId: doc1.identityId`.
   - Relay returned `404 NOT_FOUND` because no mailbox was named `doc1.identityId` (Phone 1's blind mailbox ID is a random 256-bit hex token `mb1`).
   - Phone 2 caught 404 and marked outbound queue status as `QUEUED`.
   - Phone 1's WebSocket listener remained idle; HTTP sync fetched 0 envelopes.

---

## 3. Actual Failure Point & Root Cause
The failure was caused by four interlocking architectural omissions in the client layer:

1. **Mailbox Disconnect in Invitations (`src/contacts/invitationManager.ts`)**:
   `InvitationManager.createInvitation` only serialized static identity fields (`identityId`, `signingPublicKey`, `keyAgreementPublicKey`, `fingerprint`). The Space's allocated relay `mailboxId` was never included in the signed invitation or stored in the recipient's `Contact` record.
2. **Missing PrekeyBundle in Invitations (`src/contacts/types.ts`)**:
   Invitations did not package the public `PrekeyBundle` needed for asynchronous X3DH key agreement and Double Ratchet session initialization.
3. **Improper Mailbox Addressing in UI Dispatch (`src/ui/app/AppState.tsx`)**:
   `AppState.sendMessage` passed `conversationId` (which was the peer's `identityId`) directly to `netManager.sendEnvelope(activeSession, conversationId, payload)`. Because the relay assigns random 256-bit opaque mailbox IDs, addressing by `identityId` caused an immediate `404 NOT_FOUND` on the relay.
4. **E2EE Double Ratchet Wire Disconnect in Application Shell (`src/ui/app/AppState.tsx`)**:
   `AppState.tsx` was dispatching raw JSON strings without utilizing `ConversationManager` or the Double Ratchet engine. Furthermore, on inbound receipt, messages were indexed by `parsed.conversationId` (which was the recipient's ID on the sender's device) rather than the authenticated `senderIdentityId`.

---

## 4. Why Existing Automated Tests Missed It
Previous unit and integration tests (such as `phase21-cross-platform-live.test.ts`, `phase17-real-relay-e2e.test.ts`, and `system-e2e-orchestration.test.ts`) manually allocated mailboxes in the test setup and explicitly passed `mbB.mailboxId` into `netA.sendEnvelope(sessionA, mbB.mailboxId, payload)` and hardcoded `docA` into `convBob.receiveMessage(sessionBob, docA, payload)`. 

The automated tests tested the isolated cryptographic and network functions with manually connected parameters, but did not test the full end-to-end UI onboarding flow where `exportMyInvitation -> addContactFromInvitation -> sendMessage` dynamically resolves the recipient's `mailboxId` and `PrekeyBundle`.

---

## 5. Code Changes Implemented

### A. Contact & Invitation Layer
- **`src/contacts/types.ts`**: Added `mailboxId?: string` and `prekeyBundle?: PrekeyBundle` to `InvitationPayload` and `Contact`.
- **`src/contacts/invitationManager.ts`**: Updated `createInvitation` to accept, include, and sign `mailboxId` and `prekeyBundle` with Ed25519. Updated `verifyAndParseInvitation` to verify signatures over these fields to prevent tampering.
- **`src/contacts/contactManager.ts`**: Updated `addContactFromInvitation` to store `mailboxId` and `prekeyBundle` on the persisted `Contact` record.

### B. E2EE Messaging Engine
- **`src/messaging/conversationManager.ts`**:
  - Made `transportClient` optional in the constructor.
  - Implemented `encryptAndPackWireMessage(session, peerBundle, text, attachment)`: Encrypts plaintext via Double Ratchet (`ratchetEncrypt`), bundles with authenticated `senderDocument`, size-pads the payload (`padPayload`), and serializes Base64 wire envelopes.
  - Implemented `processInboundWirePayload(session, rawPayloadBase64)`: Unpads wire bytes, initializes recipient session via `receiveX3DH` if initial handshake, decrypts via Double Ratchet (`ratchetDecrypt`), saves updated ratchet state, and records the message under `senderIdentityId`.

### C. Application State & UI Orchestration
- **`src/ui/app/AppState.tsx`**:
  - Initialized `PrekeyManager` and `ConversationManager` singletons.
  - `loadSpaceData`: Ensures mailbox and prekey pool are created; feeds incoming network envelopes to `convManager.processInboundWirePayload` and dynamically maps decrypted messages to sender conversations.
  - `exportMyInvitation`: Packages active Space's `mailboxId` and `PrekeyBundle` into signed invitations.
  - `sendMessage`: Resolves recipient `mailboxId` and `prekeyBundle` from `contacts`, encrypts via `convManager.encryptAndPackWireMessage`, and submits to relay.

---

## 6. Before vs. After Delivery Flow

### Before (Defective Flow)
```
Phone 2 -> sendMessage(Phone 1 ID)
  -> HTTP POST /v1/envelopes (mailboxId: "id_...")
  -> Relay returns 404 NOT_FOUND (Mailbox not found)
  -> Phone 2 outbound queue marks QUEUED
  -> Phone 1 never receives message
```

### After (Repaired Flow)
```
Phone 1: exportMyInvitation() -> includes mb1 (random hex) + PrekeyBundle
Phone 2: addContactFromInvitation() -> stores Contact(id_1, mb1, PrekeyBundle)
Phone 2: sendMessage() -> Double Ratchet encrypts text -> padPayload -> netManager.sendEnvelope(mb1, ciphertext)
  -> Relay accepts envelope into mb1 queue (201 Created)
  -> Relay pushes via WebSocket to Phone 1 (or Phone 1 fetches via HTTP sync)
  -> Phone 1 enqueues in local encrypted inbound queue
  -> Phone 1 ACKs envelope to Relay (Relay deletes envelope)
  -> Phone 1 decrypts via Double Ratchet / receiveX3DH
  -> Phone 1 updates ratchet state and stores message under Phone 2 conversation
  -> Phone 1 renders message in conversation timeline
```

---

## 7. Security Implications & Regression Verification
- **Zero Plaintext Leakage**: All messages sent over the relay are size-padded authenticated AEAD ciphertexts (`XChaCha20-Poly1305` Double Ratchet).
- **Zero Secret Exposure**: Relay server sees only opaque 256-bit blind mailbox IDs and ciphertexts; zero passwords, private keys, or plaintexts.
- **Fail-Closed Verification**: Tampered invitations with forged `mailboxId` or `prekeyBundle` are rejected by Ed25519 signature checks.
- **10 New Phase 22 Regression Suites**: 100% clean pass across all 172 test files (358 tests).
