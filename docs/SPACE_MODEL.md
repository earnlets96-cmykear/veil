# SPACE_MODEL.md — Multi-Space Architecture & Isolation Model

## 1. Concept & Rationale

VEIL's signature capability is the **Multi-Space Model**.

A single client device can contain multiple **Spaces** (e.g. Main Space, Work Space, Private Space, optional Decoy Space).

Spaces are **not** mere UI profile switches. Each Space is a cryptographically isolated vault containing its own:
- Cryptographic Identity (Ed25519 & X25519)
- Encryption Keys & Ratchet States
- Contact Lists
- Conversation Histories & Groups
- Cached Media & Attachments
- Privacy & Notification Configurations

```mermaid
graph TD
    Device["Single VEIL Client Application"]
    
    subgraph SpacesContainer["Cryptographically Isolated Space Boundaries"]
        Space1["Main Space<br/>• Identity A<br/>• Contacts A<br/>• Chats A"]
        Space2["Work Space<br/>• Identity B<br/>• Contacts B<br/>• Chats B"]
        Space3["Private Space<br/>• Identity C<br/>• Contacts C<br/>• Chats C"]
    end
    
    Device --> Space1
    Device --> Space2
    Device --> Space3
```

---

## 2. Credential-Selected Unlocking

The user unlocks VEIL using a single password input. The specific password entered deterministically determines which Space is unlocked.

```mermaid
sequenceDiagram
    actor User
    participant Client as VEIL Client UI
    participant Vault as Space Vault Manager
    participant Disk as Encrypted Local Storage

    User->>Client: Enters Password
    Client->>Vault: attemptUnlock(password)
    Vault->>Disk: Load all candidate SpaceHeaderEnvelopes
    loop For each candidate envelope
        Vault->>Vault: candidateKEK = Argon2id(password, envelope.salt)
        Vault->>Vault: AEAD_Decrypt(envelope.encryptedMasterKey, candidateKEK)
    end
    alt Match Found (Envelope X decrypts successfully)
        Vault->>Vault: Load SpaceMasterKey_X into secure memory
        Vault->>Vault: Expand subkeys (Storage, Identity, Ratchets)
        Vault-->>Client: Returns Unlocked SpaceSession (Space X)
        Client-->>User: Displays Space X Chats View
    else No Match
        Vault-->>Client: Generic "Invalid Credential" error
        Client-->>User: Rejects unlock attempt
    end
```

---

## 3. Cryptographic Space Isolation Guarantees

1. **No Shared Root Secret**: Unlocking Space A yields `SMK_A`. It provides zero mathematical ability to decrypt Space B or Space C.
2. **Independent Databases**: Local database records are encrypted with `StorageKey = HKDF(SMK)`. Since `SMK_B` remains encrypted under Space B's KEK, Space B records cannot be read by Space A.
3. **Decoy Space Coercion Resistance**: If an emergency decoy password is entered, VEIL unlocks the Decoy Space seamlessly without prompting or indicating the presence of other protected Spaces.
4. **Panic Lock Memory Zeroing**: Triggering Panic Lock immediately wipes all active SMK and subkey memory buffers and returns to the locked screen.
