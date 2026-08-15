# VEIL Release Installation & Setup

## 1. Web Client Installation
- Static assets located in `dist/`. Host behind Caddy, Nginx, or any standard static web server with HTTPS.

---

## 2. Android Client Installation
- Install `app-release-unsigned.apk` or `app-debug.apk` via ADB:
```bash
adb install -r app-debug.apk
```

---

## 3. Relay Server Installation
```bash
npm install
npm run relay
```
- See `docs/SELF_HOSTING.md` and `docs/LIVE_DEPLOYMENT.md` for production reverse proxy configuration.
