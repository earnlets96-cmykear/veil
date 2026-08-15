# API_METADATA_AUDIT.md — Server API Metadata Audit & Surface Minimization

## 1. Scope & Objective

Audit of all endpoints exposed by VEIL transport adapters (`ITransportAdapter`) and blob storage adapters (`IMediaStorageAdapter`) to verify minimal information exposure.

---

## 2. Endpoint Metadata Inspection

### 1. `POST /mailbox/create`
- **Request Parameters**: `{ mailboxId: string (32-byte hex), verifier: string (Base64 SHA-256) }`
- **Response**: `{ success: boolean }`
- **Metadata Retained**: Blind `mailboxId` and one-way capability `verifier`.
- **Eliminated Data**: No user identity, no device public key, no IP correlation table, no Space name.

### 2. `POST /envelope/post`
- **Request Parameters**: `{ envelopeId: string, mailboxId: string, payload: string, expiresAt: number }`
- **Response**: `{ success: boolean }`
- **Metadata Retained**: Opaque `envelopeId` and expiration timestamp.
- **Eliminated Data**: Sender identity is completely absent from headers. Payload is end-to-end encrypted and size-bucket padded.

### 3. `GET /mailbox/fetch`
- **Request Parameters**: `{ mailboxId: string, capability: string, limit?: number }`
- **Response**: `TransportEnvelope[]`
- **Metadata Retained**: None (retrieved envelopes are purged upon acknowledgment).
- **Eliminated Data**: Zero search index, zero correlation to external contacts.

### 4. `POST /media/upload` & `GET /media/download`
- **Request Parameters**: `{ mediaId: string, capability: string, chunkIndex: number, ciphertext: string }`
- **Response**: `EncryptedMediaChunk`
- **Metadata Retained**: Opaque 32-byte `mediaId` and ciphertext chunks.
- **Eliminated Data**: Zero MIME types in plaintext headers, zero plaintext filenames, zero media dimensions or durations.
