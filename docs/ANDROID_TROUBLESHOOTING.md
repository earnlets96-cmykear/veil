# Android Troubleshooting Guide

## 1. Common Issues & Solutions

### A. "Cleartext HTTP traffic not permitted"
- **Cause**: Attempting to connect to an `http://` or `ws://` relay in production build.
- **Solution**: VEIL requires TLS 1.3 in production (`https://` and `wss://`). Ensure your reverse proxy (Caddy/Nginx) has valid SSL certificates.

### B. "ADB Device Unauthorized"
- **Cause**: USB Debugging prompt not accepted on phone.
- **Solution**: Reconnect USB cable, unlock device, and tap **Always allow from this computer**.

### C. "Capacitor Sync Out of Date"
- **Cause**: Modifications made to Web assets without syncing.
- **Solution**: Run `npm run build && npx cap sync android`.
