# Android Networking & WebView Lifecycle Guide

## 1. WebView & Android Network Constraints
On Android (via Capacitor / Chrome WebView), network connections behave differently than in desktop browser tabs:
1. **Aggressive Background Suspension**: The Android OS can suspend TCP sockets and timers when the application is backgrounded or when battery optimization triggers.
2. **Network State Switching**: Seamless transitions between Wi-Fi and Cellular (LTE/5G) drop existing WebSocket connections.
3. **Capacitor Lifecycle Events**: The app receives native `appStateChange`, `online`, and `offline` events.

## 2. VEIL Multi-Tier Transport Architecture

```
                 +--------------------------+
                 |       AppProvider        |
                 |  (Native Online Handler) |
                 +------------+-------------+
                              |
                     +--------v--------+
                     |  NetworkManager |
                     +---+---------+---+
                         |         |
           +-------------+         +-------------+
           |                                     |
+----------v-----------+             +-----------v-----------+
|  WebSocketTransport  |             |     HttpTransport     |
|   (Push envelopes)   |             | (Polling & Rest Fall) |
+----------------------+             +-----------------------+
```

### A. Dual Connection Strategy (Push + Degraded Fallback)
1. **Primary**: Real-time bidirectional WebSocket connection to `/v1/ws`. Heartbeats sent every 30 seconds.
2. **Secondary**: HTTP long-polling catch-up every 3000ms if WebSocket is disconnected or in degraded state.
3. **Recovery**: Native `window.addEventListener('online')` triggers `netManager.reconnect(activeSession)` immediately resetting backoff retries.

### B. Outbound Envelope Queueing
- Messages sent while offline or degraded are enqueued in `EncryptedSpaceStore` (IndexedDB).
- `NetworkManager.flushOutboundQueue()` executes automatically upon successful HTTP sync or WebSocket reconnection.
- Zero message loss during intermittent cellular handoffs.
