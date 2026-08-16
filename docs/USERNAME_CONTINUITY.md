# VEIL — Username Continuity & Identity Preservation

## 1. Principle of Identity Stability

In centralized messaging systems, usernames and user accounts are tightly coupled. If an account is renamed, identifiers can break.

In VEIL:
1. Every user is permanently identified by their **Ed25519 public identity key** (`identityId`).
2. A **`username`** is an untrusted, mutable label published to the directory.
3. Updating a username creates a new `SignedProfileDocument` signed by the user's private key.
4. The relay directory updates the mapping atomically.
5. All local chat histories, Double Ratchet sessions, and address book references remain indexed strictly by `identityId`.

---

## 2. Invariants
- **No Split Conversations**: A peer renaming their handle does not create a new conversation thread.
- **No Ratchet Reset**: Cryptographic ratchet keys and forward secrecy chains are preserved across username updates.
- **Authentication**: A username update must be signed by the existing Ed25519 identity key, preventing handle hijacking.
