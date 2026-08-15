# VEIL Platform & Browser Compatibility

## 1. Supported Client Environments

| Browser / Environment | Version | Support Level | Required Features |
| :--- | :--- | :--- | :--- |
| **Chromium-based** (Chrome, Edge, Brave) | 100+ | Fully Supported | IndexedDB, WebCrypto, WebSocket, ES Modules |
| **Firefox** | 100+ | Fully Supported | IndexedDB, WebCrypto, WebSocket, ES Modules |
| **Safari / WebKit** | 15.4+ | Fully Supported | IndexedDB, WebCrypto, WebSocket, ES Modules |
| **Mobile Browsers** (iOS Safari, Android Chrome) | Modern | Fully Supported | Responsive viewport layout, touch events |

---

## 2. Server Runtime Requirements

- **Node.js**: v20.0.0 or higher
- **Operating Systems**: Linux (Debian, Ubuntu, Alpine, RHEL), macOS, Windows Server
- **Memory Requirement**: 256 MB minimum, 512 MB recommended for 10,000+ active mailboxes.
