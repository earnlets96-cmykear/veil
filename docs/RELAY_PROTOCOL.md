# RELAY_PROTOCOL.md — VEIL Relay Transport Protocol v1

## 1. Overview & Trust Model

The VEIL Relay Transport Protocol (`v1`) defines the HTTP and WebSocket interaction between VEIL clients and untrusted blind relay servers.

The relay server acts as a store-and-forward routing intermediary with **zero knowledge** of message contents, contacts, group memberships, or user identities.

---

## 2. HTTP Endpoints

All requests and responses use `Content-Type: application/json`.

### `GET /healthz`
Returns server operational health.
- **Status**: `200 OK`
- **Response**:
  ```json
  {
    "status": "ok",
    "protocolVersion": "v1",
    "uptimeSeconds": 1420
  }
  ```

### `GET /readyz`
Returns server storage and subsystem readiness.
- **Status**: `200 OK`
- **Response**:
  ```json
  {
    "status": "ready",
    "store": "ok"
  }
  ```

### `POST /v1/mailboxes`
Allocates a new opaque blind mailbox.
- **Request Body**:
  ```json
  {
    "ttlSeconds": 2592000
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "protocolVersion": "v1",
    "mailboxId": "a1f9e8... (64 hex characters / 256 bits)",
    "capabilityToken": "e4b2d1... (64 hex characters / 256 bits)",
    "expiresAt": 1755432000000
  }
  ```
- *Note*: The `capabilityToken` is returned **only once**. The server stores `SHA-256(capabilityToken)` for one-way verification and never logs the token.

### `POST /v1/envelopes`
Submits an opaque ciphertext envelope to a target mailbox.
- **Request Body**:
  ```json
  {
    "mailboxId": "a1f9e8...",
    "payload": "Base64-encoded encrypted envelope (Max 64 KiB)",
    "ttlSeconds": 604800
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "protocolVersion": "v1",
    "envelopeId": "f7d3a2... (32 hex characters / 128 bits)",
    "mailboxId": "a1f9e8...",
    "expiresAt": 1755432000000,
    "sizeBytes": 1024
  }
  ```

### `POST /v1/envelopes/fetch`
Retrieves pending envelopes for a mailbox (requires capability authentication).
- **Request Body**:
  ```json
  {
    "mailboxId": "a1f9e8...",
    "capabilityToken": "e4b2d1...",
    "limit": 50
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "protocolVersion": "v1",
    "mailboxId": "a1f9e8...",
    "envelopes": [
      {
        "protocolVersion": "v1",
        "envelopeId": "f7d3a2...",
        "mailboxId": "a1f9e8...",
        "payload": "Base64-encoded ciphertext...",
        "createdAt": 1754827200000,
        "expiresAt": 1755432000000,
        "sizeBytes": 1024
      }
    ],
    "hasMore": false
  }
  ```

### `POST /v1/envelopes/ack`
Acknowledges and permanently deletes processed envelopes from the mailbox.
- **Request Body**:
  ```json
  {
    "mailboxId": "a1f9e8...",
    "capabilityToken": "e4b2d1...",
    "envelopeIds": ["f7d3a2..."]
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "protocolVersion": "v1",
    "mailboxId": "a1f9e8...",
    "acknowledgedCount": 1
  }
  ```

---

## 3. WebSocket Real-Time Channel (`/v1/ws`)

Clients connect via WebSocket for real-time envelope push notifications.

### Authentication Message (Client -> Server)
```json
{
  "type": "auth",
  "mailboxId": "a1f9e8...",
  "capabilityToken": "e4b2d1..."
}
```
**Server Response**:
```json
{
  "type": "authenticated",
  "mailboxId": "a1f9e8..."
}
```

### Real-Time Envelope Delivery (Server -> Client)
```json
{
  "type": "envelope",
  "envelope": {
    "protocolVersion": "v1",
    "envelopeId": "f7d3a2...",
    "mailboxId": "a1f9e8...",
    "payload": "Base64-encoded ciphertext...",
    "createdAt": 1754827200000,
    "expiresAt": 1755432000000,
    "sizeBytes": 1024
  }
}
```

### Heartbeat (Client -> Server / Server -> Client)
```json
{ "type": "ping" }
```
```json
{ "type": "pong" }
```

---

## 4. Standardized Error Response Format

Errors are returned with appropriate HTTP status codes:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid capability token for requested mailbox",
    "status": 401
  }
}
```
Supported Error Codes:
- `BAD_REQUEST` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `PAYLOAD_TOO_LARGE` (413)
- `RATE_LIMITED` (429)
- `STORAGE_UNAVAILABLE` (503)
- `INTERNAL_ERROR` (500)
