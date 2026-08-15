# Android Networking Architecture

## 1. Transport & TLS Enforcement

Android network communication adheres strictly to the VEIL blind relay protocol:
- **HTTPS (`/v1/mailboxes`, `/v1/send`, `/v1/fetch`, `/v1/ack`)** for REST operations.
- **WSS (`/v1/ws`)** for real-time bidirectional push notifications and live envelope synchronization.
- **Network Security Config**: Configured with `cleartextTrafficPermitted="false"`, enforcing TLS 1.3 for all endpoints.

---

## 2. Reconnection & Offline Strategy

- **Network Transition**: Automatically switches between Wi-Fi and Mobile Data (cellular) with exponential backoff (`100ms` $\rightarrow$ `5s`).
- **Offline Queue**: Encrypted outbound messages are queued locally in `EncryptedSpaceStore` and drained automatically upon socket re-establishment.
