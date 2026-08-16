# VEIL — Offline Queuing & Reconnection Resilience

## 1. Zero Message Loss Model

VEIL guarantees **zero message loss** across arbitrary network dropouts, offline periods, and process crashes using an **outbound and inbound disk queue model**.

```
[ Outbound Path ]
Composer -> Enqueue (StorageKey Encrypted) -> Attempt HTTP Dispatch
               |                                     |
               +--- [If Offline: Remain in DB] <----+ (On Error)
               |
               +---> Reconnect Trigger -> Drain Outbound Queue -> Relay ACK -> Delete Queue Record

[ Inbound Path ]
Relay -> Receive Inbound -> Write Inbound Record -> Send Relay ACK -> Decrypt -> Timeline
```

---

## 2. Inbound ACK-after-Persistence
To prevent message loss if an app crashes while decrypting or rendering an incoming message:
1. The raw opaque ciphertext envelope is received from WebSocket or HTTP.
2. The envelope is committed to encrypted disk storage.
3. Only after the disk write successfully resolves does the client send `POST /v1/envelopes/ack` to the relay.
4. The local Double Ratchet session decrypts and appends the message to conversation history.
5. If a crash occurs at step 4, the rehydration engine on the next boot sees the unacknowledged local record and re-runs decryption.
