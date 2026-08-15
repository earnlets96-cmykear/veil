# Android Lifecycle & Memory Management

## 1. App State Progression

```
[ Active / Foreground ] ──> [ Background / Screen Off ] ──> [ Process Killed / Memory Pressure ]
         │                               │                                    │
         ▼                               ▼                                    ▼
 Full UI & Push Socket          Socket Suspended                     Volatile Memory Zeroed
                                No Plaintext Leaked                  Restorable upon Re-unlock
```

---

## 2. Panic Lock & Emergency Reset

When the user taps **Panic Lock** (or enters a panic trigger):
1. Active `SpaceSession` instances are synchronously wiped and destroyed.
2. WebSockets are immediately severed.
3. Decrypted ephemeral attachment Blobs are revoked via `AttachmentPipeline.revokeAllEphemeralBlobUrls()`.
4. UI resets to neutral lock screen.
