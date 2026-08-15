# Android Security & Storage Boundaries

## 1. Storage Boundaries on Android

| Location | Content | Security Guarantee |
| :--- | :--- | :--- |
| **`/data/data/chat.veil.app/app_webview/IndexedDB/`** | `veil_encrypted_vault` | Authenticated AEAD Ciphertext (Encrypted with Space StorageKey) |
| **Volatile Process Heap** | `SpaceMasterKey`, active ratchet state | Synchronously zeroized on App Lock or Panic Lock |
| **Android SharedPreferences** | None | Prohibited by policy; no keys stored |
| **Cloud Backup (Google Drive)** | None | Prohibited by `android:allowBackup="false"` |

---

## 2. Panic Lock Execution

Tapping Panic Lock immediately triggers synchronous memory destruction:
1. `session.destroy()` wipes active SMK and StorageKey.
2. WebSockets are terminated.
3. Temporary Blob URLs for attachments are revoked.
4. UI resets to neutral lock screen.
