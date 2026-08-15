# ARCHITECTURE.md — VEIL System Architecture

## 1. System Overview

VEIL is an end-to-end encrypted, multi-space messaging system engineered with zero-trust server transport, cryptographic isolation between local user environments (Spaces), and a streamlined, mainstream-grade user experience.

```mermaid
graph TB
    subgraph UI_Layer["User Experience Layer (React / Vanilla CSS)"]
        ChatUI["Chats & Messages View"]
        ContactsUI["Contacts & Identity View"]
        SettingsUI["Space & Privacy Settings"]
        UnlockUI["Credential-Selected Unlock Screen"]
    end

    subgraph App_Core["VEIL Application Core"]
        SpaceManager["Space Vault Manager"]
        IdentityManager["Identity & Key Manager"]
        MessagingEngine["Messaging Engine (Double Ratchet)"]
        MediaVault["Encrypted Media Manager"]
        TransportCoordinator["Transport Coordinator"]
    end

    subgraph Crypto_Core["Cryptographic Subsystem (Audited Standards)"]
        KDF["Argon2id KDF"]
        AEAD["XChaCha20-Poly1305 / AES-256-GCM"]
        Curves["Ed25519 (Sign) & X25519 (DH)"]
        Ratchet["Double Ratchet State Machine"]
    end

    subgraph Storage_Layer["Local Storage Boundary"]
        EncryptedDB["Encrypted Space Store (Per-Space Partition)"]
        HeaderStore["Space Header Envelopes (Ciphertext Only)"]
    end

    subgraph Network_Boundary["Network Transport Boundary"]
        TransportInterface["ITransportAdapter"]
        RelayTransport["WebSocket / HTTP Blind Relay"]
        FutureTransport["Optional Tor / Mixnet / Direct Transport"]
    end

    UI_Layer --> App_Core
    App_Core --> Crypto_Core
    App_Core --> Storage_Layer
    App_Core --> Network_Boundary
```

---

## 2. Layered Component Architecture

### Layer 1: Cryptographic Core (`src/crypto/`)
- Pure, deterministic, audited cryptographic primitives.
- Standard interfaces for:
  - `Argon2id` password key derivation.
  - `AEAD` authenticated encryption/decryption (XChaCha20-Poly1305 / AES-256-GCM).
  - `Ed25519` keypair generation, message signing, and signature verification.
  - `X25519` key agreement (Diffie-Hellman scalar multiplication).
  - `HKDF-SHA256` domain-separated key expansion.
  - Secure memory zeroization (`zeroize(buffer)`).

### Layer 2: Space Vault Subsystem (`src/spaces/`)
- Manages Space metadata envelopes, credential unlocking, active session lifecycle, and cryptographic isolation.
- Enforces that no Space Master Key (SMK) is derived or held in memory for locked Spaces.
- Implements auto-lock, panic lock, and memory wiping routines.

### Layer 3: Identity & Contact Subsystem (`src/identity/`)
- Manages per-Space public/private keypairs (`SpaceIdentity`).
- Handles contact card serialization, safety number generation, and identity verification.
- Guarantees zero cross-space linkage.

### Layer 4: Messaging & Ratchet Subsystem (`src/messaging/`)
- Implements the Double Ratchet protocol (Diffie-Hellman ratchet + symmetric KDF ratchets) for post-compromise security and forward secrecy.
- Manages prekey bundles (Identity Key, Signed Prekey, One-Time Prekeys).
- Handles out-of-order message buffering and replay attack mitigation.

### Layer 5: Transport Subsystem (`src/transport/`)
- Implements `ITransportAdapter` abstraction.
- Interacts with untrusted relay servers using blind mailbox tokens (`HMAC-SHA256(RecipientPrekey, Token)`).
- Decouples client network logic from specific relay implementations.

### Layer 6: User Interface (`src/ui/`)
- Modern, clean, responsive UI with zero external paid framework dependencies.
- Complete separation of UI states per active Space.
- Strictly adheres to the VEIL Design System (`src/styles/`).

---

## 3. Data Flow: One-to-One Message Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Space A)
    participant AliceApp as Alice Client Core
    participant Relay as Untrusted Relay Server
    participant BobApp as Bob Client Core
    actor Bob as Bob (Space B)

    Alice->>AliceApp: Types "Hello Bob" and taps Send
    AliceApp->>AliceApp: Encrypts plaintext via active Double Ratchet session<br/>Output: Ciphertext + Ratchet Header
    AliceApp->>AliceApp: Derives blind routing token HMAC(BobPrekey, SessionID)
    AliceApp->>Relay: POST /messages/send { mailboxToken, encryptedEnvelope }
    Note over Relay: Relay sees blind mailbox token<br/>& encrypted blob only (Zero Plaintext)
    Relay->>BobApp: PUSH / WebSocket delivery to Bob's mailbox
    BobApp->>BobApp: Verifies recipient token & loads Ratchet session
    BobApp->>BobApp: Decrypts message envelope via Double Ratchet<br/>Advances DH ratchet state
    BobApp->>Bob: Displays "Hello Bob" in Space B chat view
```
