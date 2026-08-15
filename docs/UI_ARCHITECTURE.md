# UI_ARCHITECTURE.md — VEIL React Application Architecture & Presentation Layer

## 1. Architectural Overview

VEIL's user interface is built in **React 19 + TypeScript** using tokenized Vanilla CSS (`src/styles/veil-design-system.css`).

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                     │
│                                                             │
│  ┌───────────────┐     ┌─────────────────────────────────┐  │
│  │  LockScreen   │ ──► │  Authenticated Dashboard (App)  │  │
│  └───────────────┘     └────────────────┬────────────────┘  │
│                                         │                   │
│                        ┌────────────────┴────────────────┐  │
│                        │             Sidebar             │  │
│                        │  - Space Status Badge           │  │
│                        │  - Search & Category Filter     │  │
│                        │  - Conversation List & Previews │  │
│                        │  - +Chat / +Group / Settings    │  │
│                        └────────────────┬────────────────┘  │
│                                         │                   │
│                        ┌────────────────┴────────────────┐  │
│                        │        ConversationView         │  │
│                        │  - Peer / Group Security Header │  │
│                        │  - Message Timeline & Status    │  │
│                        │  - MessageComposer Input        │  │
│                        └────────────────┬────────────────┘  │
└─────────────────────────────────────────┼───────────────────┘
                                          │
┌─────────────────────────────────────────▼───────────────────┐
│                    APPLICATION STATE LAYER                  │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   SessionController   │       │   React AppProvider   │  │
│  │ (Auth/Lock/Auto-Lock) │       │  (AppState Reactive)  │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
└──────────────┼───────────────────────────────┼──────────────┘
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 CORE CRYPTOGRAPHIC / ENGINE LAYER           │
│  SpaceVaultManager • EncryptedSpaceStore • DoubleRatchet    │
│    GroupManager • SpaceIdentityManager • NetworkManager     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Security Boundaries & State Lifecycle

1. **Short-Lived Presentation Plaintext**: Decrypted message bodies and conversation previews exist in React memory only while the Space is unlocked.
2. **Complete Space Switching Purge**: When switching Spaces, `SessionController.switchSpace()` halts network listeners, wipes in-memory messages and conversations, destroys the `SpaceSession`, and loads the target partition.
3. **Panic Lock Immediate Wipe**: Calling Panic Lock zeroizes volatile keys, halts network sockets, and returns immediately to the neutral lock screen.
4. **No Plaintext Persistence**: Plaintext messages, private keys, passwords, and Master Keys NEVER enter `localStorage`, unencrypted IndexedDB, URLs, or console logs.
