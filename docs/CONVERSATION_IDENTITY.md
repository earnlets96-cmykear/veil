# VEIL — Canonical Conversation Identity Model

## 1. Identity Hierarchy & Decoupling Invariants

In VEIL, identities, human-readable handles, routing mailboxes, and conversation histories are strictly decoupled according to the following mathematical hierarchy:

$$\text{Space ID} \longrightarrow \text{Contact ID} \equiv \text{Identity ID} \longrightarrow \text{Mailbox ID} \longrightarrow \text{Conversation} \longrightarrow \text{Messages}$$

```
+-------------------------------------------------------------+
| Space ID (Local Encrypted Partition)                        |
|   +---------------------------------------------------------+
|   | Contact ID == Identity ID (Permanent Ed25519 Public Key)|
|   |   +-----------------------------------------------------+
|   |   | Username (@alice - Human handle, Mutable)           |
|   |   | Mailbox ID (Blind Relay Token, Rotatable)           |
|   |   | Conversation ID == Peer Identity ID                 |
|   |   |   +-------------------------------------------------+
|   |   |   | Double Ratchet Session (Keys & Chains)          |
|   |   |   | Message History (Padded, Chronological)         |
|   |   |   +-------------------------------------------------+
+---+---+-----------------------------------------------------+
```

---

## 2. Identifier Distinction Matrix

| Identifier | Domain | Mutability | Cryptographic Role | Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `spaceId` | Local client partition | Immutable | Binds master key & storage encryption | Zero cross-Space access |
| `identityId` | Global identity | Immutable | Ed25519 identity key fingerprint | Unique conversation anchor |
| `username` | Global directory | Mutable | Human-friendly directory search | Handle changes preserve identity |
| `mailboxId` | Relay transport | Rotatable | Opaque envelope delivery bucket | Decoupled from user identity |
| `conversationId` | Messaging domain | Immutable | Maps strictly to `peerIdentityId` | Never splits on rename |
| `messageId` | Message domain | Immutable | Unique message UUID | De-duplication and ACK tracking |

---

## 3. Preservation Across Username Changes
When a user updates their username (e.g. from `@alice_old` to `@alice_new`):
1. The Ed25519 `identityId` and signing key remain identical.
2. The Double Ratchet root key and chain states are preserved without reset.
3. The conversation thread in the peer's client remains under `conversationId = identityId`.
4. The directory entry is updated atomically using a signed update payload.
