# Cross-Platform Live Testing Runbook

## 1. Physical Device & Desktop E2EE Testing

### Setup
1. **Device A (Physical Android Phone)**: Install `app-debug.apk`.
2. **Device B (Desktop Web)**: Open production build in Google Chrome / Firefox (`http://localhost:5173` or hosted URL).
3. Ensure both point to the same VEIL Relay Server (`https://relay.yourdomain.com`).

### 10-Step Operational Flow
1. **Create Spaces**: Android creates "Personal Main", Desktop creates "Desktop Work".
2. **Generate Invitation**: Desktop clicks **Add Contact $\rightarrow$ Generate Invitation**.
3. **Scan / Import Invitation**: Android scans QR or pastes `veil://invite/...`.
4. **Safety Number Verification**: Compare 6-digit Safety Number on both screens.
5. **Send Message A $\rightarrow$ B**: Type "Hello from Android"; verify instant arrival and decryption on Desktop.
6. **Send Message B $\rightarrow$ A**: Type "Reply from Desktop"; verify instant arrival on Android.
7. **Send Attachment**: Upload image on Android; verify decrypted display on Desktop.
8. **Offline Test**: Enable Airplane Mode on Android $\rightarrow$ send message $\rightarrow$ disable Airplane Mode $\rightarrow$ verify message flushes and delivers.
9. **App Restart**: Force-stop Android app $\rightarrow$ relaunch $\rightarrow$ unlock Space $\rightarrow$ verify all messages intact.
10. **Panic Lock**: Tap **Panic Lock** on Android $\rightarrow$ confirm instant reset to neutral lock screen.
