# Production Connection Recovery & Relay Reconnection

## 1. Authoritative Production Configuration
VEIL enforces a single authoritative endpoint for production relay routing:

```typescript
export const PRODUCTION_RELAY_URL = 'https://relay.veil.chat';
export const PRODUCTION_RELAY_WS_URL = 'wss://relay.veil.chat/v1/ws';
```

Config validation ensures that in production mode, TLS (`https://` and `wss://`) is strictly enforced.

## 2. Exponential Backoff & Jitter Algorithm
To protect the relay server from thundering herd problems when many mobile clients reconnect simultaneously after an outage, VEIL uses exponential backoff with uniform random jitter:

$$\text{Delay}_n = \min\left(\text{initialDelay} \times \text{multiplier}^{n-1} + \text{jitter}, \text{maxDelay}\right)$$

Parameters:
- `initialRetryDelayMs`: 1,000 ms (1s)
- `retryBackoffMultiplier`: 2.0 (2s, 4s, 8s, 16s...)
- `maxRetryDelayMs`: 30,000 ms (30s maximum)
- `jitter`: 0 to 500 ms uniform random delay
- `maxRetries`: 10 attempts before transitioning to explicit `error` state.

## 3. Immediate Reconnection Triggers
Backoff timers are bypassed and immediate reconnection (`reconnectNow()`) is triggered when:
1. Native `online` browser/device event fires.
2. User clicks the `[Retry Now]` action in error modals or connection banners.
3. User unlocks a Space or switches active Spaces.
