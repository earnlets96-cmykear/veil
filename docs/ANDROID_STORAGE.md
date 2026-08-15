# Android Secure Storage Architecture

## 1. Storage Backend

On Android, persistent storage is backed by Chromium WebView's sandboxed IndexedDB storage engine (`veil_encrypted_vault`), running within the application's private data sandbox (`/data/data/chat.veil.app/`).

### Invariants
- **Plaintext Persistence Protection**: Every stored record is encrypted with the active Space's 32-byte HKDF StorageKey prior to persistent storage commit.
- **`allowBackup="false"`**: Android cloud backup is disabled in `AndroidManifest.xml`, ensuring encrypted blobs are not synced to third-party Google Drive backups.
- **Locked Space Inaccessibility**: Session keys are held purely in memory and zeroized on app lock or panic lock.
