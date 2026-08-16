# VEIL — Android Real-Device Operation & Validation Guide

## 1. Architecture on Android
VEIL runs on Android as a Capacitor application embedding the high-performance, single-page React frontend alongside SQLite/IndexedDB encrypted storage and TLS WebSocket background synchronization.

---

## 2. Real-Device Setup & Requirements
- **Android Target**: Android 10+ (API level 29+)
- **Storage**: Hardware-backed or app-private sandboxed IndexedDB / SQLite partition.
- **Network**: Fail-closed HTTPS / WSS relay transport.

---

## 3. Real-Device Verification Checklist

| Scenario | Procedure | Expected Invariant |
| :--- | :--- | :--- |
| **Cold Start** | Launch app from killed state | Prompts for Space passphrase; zero memory secrets prior to unlock |
| **Passphrase Unlock** | Enter Space passphrase | Rehydrates encrypted partition; starts WebSocket listener |
| **Backgrounding** | Switch to another app | WebSocket stays connected or catches up via HTTP on resume |
| **Process Kill** | Force stop via Android Settings | Ephemeral Master Keys wiped; storage remains AES/Argon2id encrypted |
| **Network Transition** | Toggle Wi-Fi to Mobile Data | Auto-reconnect with exponential backoff; drains outbound queue |
| **Back Button** | Press Android hardware back | Closes open conversation and returns to Sidebar view |
| **Panic Lock** | Tap Panic Lock button | Instant memory zeroization; redirects to lock screen |
