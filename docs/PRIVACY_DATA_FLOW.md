# VEIL Privacy & Data Flow Lifecycle

## 1. Complete Data Flow

```
[ User Input (Plaintext) ]
            │
            ▼ (Volatile React state)
[ Encrypted in Client Memory (Double Ratchet / Group Ratchet) ]
            │
            ├─────────────────────────────────────────┐
            ▼ (Local Storage)                         ▼ (Network)
[ IndexedDB Encrypted Record ]               [ Opaque Base64 Envelope ]
(Key: Space-Derived StorageKey)              (Blind Mailbox ID)
                                                      │
                                                      ▼ (WSS)
                                             [ Untrusted Blind Relay ]
                                             (Storage: Transient File Store)
                                                      │
                                                      ▼ (Push / Poll)
                                             [ Recipient Client ]
                                                      │
                                                      ▼ (Double Ratchet Decrypt)
                                             [ Recipient Local Storage ]
```

---

## 2. Privacy Boundaries

1. **Relay Blindness**: Relays observe only mailbox identifiers and ciphertext sizes (mitigated by size-padding classes).
2. **Device Isolation**: Private keys never leave the client device memory.
3. **Plausible Deniability**: Neutral lock screen does not disclose Space existence.
