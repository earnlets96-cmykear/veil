# GROUP_PROTOCOL.md — VEIL Group Messaging Protocol Specification

## 1. Executive Summary

VEIL implements **Sender Keys with Epoch Ratcheting**, a cryptographically proven, scalable multi-party end-to-end encryption scheme based on the Signal Sender Keys protocol and Matrix Megolm concepts, combined with pairwise **Double Ratchet (X3DH)** pairwise control channels and **Ed25519** cryptographically signed group state transitions.

---

## 2. Protocol Selection & Rationale

| Requirement | Evaluation & Technical Decision |
| :--- | :--- |
| **Scalability** | Pairwise Double Ratchet for every group message requires $O(N)$ encryptions and $O(N)$ ciphertexts per message. **Sender Keys** reduce message encryption to $O(1)$ computation and transmission complexity. |
| **Asynchronous Operation** | VEIL operates over untrusted blind mailboxes. Group members may be offline during message transmission. Sender Keys allow members to decrypt broadcast ciphertexts as soon as they receive the sender's current chain state. |
| **Forward Secrecy on Departure** | When a member leaves or is removed, remaining members advance the **Epoch** ($Epoch_{k+1}$), reset their Sender Keys, and distribute fresh sender keys exclusively to active remaining members via pairwise 1-to-1 Double Ratchet channels. The removed member never learns $Epoch_{k+1}$ keys. |
| **History Protection on Arrival** | When a new member joins, they only receive the current Sender Key ratchet state (or from the current message sequence forward). Because symmetric KDF chains are one-way (HMAC-SHA256), the new member cannot reverse the chain to decrypt past messages. |
| **Sender Authentication** | Senders sign their encrypted message payload and AAD header (`groupId`, `epoch`, `senderIdentityId`, `sequenceNum`) with their permanent Ed25519 identity key, preventing sender impersonation or header tampering. |

---

## 3. Cryptographic Primitives

- **Symmetric Chain KDF**: `HMAC-SHA256` with domain-separated constants.
- **Message AEAD**: `XChaCha20-Poly1305` with random 24-byte nonces and canonical AAD binding.
- **Epoch Master Derivation**: `HKDF-SHA256(ikm=groupMasterSecret, salt=epoch, info="veil-v1-group-epoch", length=32)`.
- **Sender Signatures**: `Ed25519` signature over `SHA-256(canonicalPayload)`.
- **Identity & Key Agreement**: `@noble/curves` (`ed25519`, `x25519`).

---

## 4. State Models & Epoch Lifecycle

### 4.1. Group State Model

```typescript
export type GroupRole = 'CREATOR' | 'ADMIN' | 'MEMBER';

export interface GroupMember {
  identityId: string;
  signingPublicKey: string; // Base64 Ed25519
  role: GroupRole;
  joinedAtEpoch: number;
  addedBy: string;
}

export interface GroupState {
  groupId: string;
  version: 1;
  epoch: number;
  encryptedMetadata: string; // Base64 encrypted name, avatar, description
  metadataNonce: string;
  members: Record<string, GroupMember>;
  actionHistory: GroupAction[];
  updatedAt: number;
}
```

### 4.2. Epoch Transitions & Key Rotation

1. **Group Genesis (Epoch 1)**:
   - Creator generates a cryptographically random 32-byte `groupId` (UUID/hex).
   - Creator initializes `GroupState` with `creator` role and signed `CreateGroup` action.
   - Creator derives initial Sender Key and distributes `SenderKeyDistributionMessage` to invited members over 1-to-1 Double Ratchet channels.

2. **Member Addition (Epoch $k \to k$ or $k+1$)**:
   - An authorized Admin/Creator signs an `AddMember` action.
   - The admin sends the group state and the members' current Sender Key distributions to the new member over a 1-to-1 Double Ratchet channel.
   - The new member cannot reverse the one-way HMAC chain to decrypt prior messages.

3. **Member Removal (Epoch $k \to k+1$)**:
   - An authorized Admin/Creator signs a `RemoveMember` action.
   - All remaining members increment their local epoch counter to $k+1$.
   - Every remaining member generates a **fresh random Sender Key** for Epoch $k+1$.
   - Each remaining member distributes their new Sender Key to all other *active* members via pairwise Double Ratchet channels.
   - The removed member is excluded from key distribution and has zero knowledge of Epoch $k+1$ keys.

---

## 5. Sender Key Ratchet State Machine

Each group participant maintains:
1. **Outbound Sender Chain**:
   - `chainKey`: Current 32-byte symmetric chain key.
   - `sequenceNum`: Monotonically increasing message counter.
   - Stepped forward via `kdfSenderChainStep(chainKey)` on every sent message.
2. **Inbound Receiver Chains** (one per peer member):
   - `senderIdentityId`: Peer's Ed25519 identity ID.
   - `chainKey`: Peer's current chain key.
   - `lastSequenceNum`: Highest processed sequence number.
   - `skippedMessageKeys`: Map of `(senderId, sequenceNum) -> messageKey` for out-of-order delivery handling (capped at `MAX_SKIPPED_KEYS = 500`).

```
                    ChainKey_i
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
   HMAC(CONSTANT_STEP)          HMAC(CONSTANT_MSG)
         │                             │
         ▼                             ▼
    ChainKey_{i+1}                MessageKey_i
                                       │
                                       ▼
                             XChaCha20-Poly1305 Encrypt/Decrypt
```

---

## 6. Authenticated Associated Data (AAD) Binding

Every group message encrypts its plaintext payload and authenticates the following canonical header bytes:
```json
{
  "version": 1,
  "groupId": "<groupId>",
  "epoch": 2,
  "senderIdentityId": "<senderIdentityId>",
  "sequenceNum": 4
}
```
Any modification to the group ID, epoch, sender ID, or sequence number causes AEAD authentication failure during Poly1305 tag verification.

---

## 7. Security Invariants & Attack Mitigations

1. **Replay Attack Mitigation**:
   - Receivers record `(senderIdentityId, epoch, sequenceNum)` tuples in a bounded LRU/set.
   - Any replayed message ciphertext with an already-consumed sequence number is rejected immediately.
2. **Rollback & Stale State Mitigation**:
   - Group state epoch increments are strictly monotonically increasing ($Epoch_{new} = Epoch_{current} + 1$).
   - State actions from unauthorized senders or lower epochs are rejected.
3. **Malicious Server Mitigation**:
   - Untrusted relay servers receive only blind ciphertext envelopes.
   - The server cannot forge group actions (lacks Ed25519 admin private keys) and cannot decrypt messages (lacks Sender Keys).
4. **Memory Hygiene**:
   - Single-use message keys are zeroized immediately after encryption or decryption.
