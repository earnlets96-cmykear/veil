# Object Storage: Cloudflare R2 Architecture

## 1. Overview
Cloudflare R2 provides S3-compatible, globally distributed object storage for encrypted message attachments, encrypted voice recordings, and encrypted space backup archives.

---

## 2. Key Structure & Organization

All objects in Cloudflare R2 are stored under opaque, prefix-structured keys to protect metadata:

```
veil-attachments/
├── attachments/
│   ├── obj_0192a83b4c5d6e7f...   (Encrypted document / image chunk)
├── voice/
│   ├── obj_8923fd48ac1209be...   (Encrypted voice audio note)
└── backups/
    ├── bak_4910ce3a8821bc09...   (Encrypted Space backup archive)
```

---

## 3. Configuration & Compatibility

The `S3ObjectStorage` adapter supports standard S3 and Cloudflare R2 environment variable bindings:

| Variable | Description | Example |
|---|---|---|
| `R2_ENDPOINT` | Cloudflare R2 account endpoint | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Dedicated bucket name | `veil-attachments` |
| `R2_ACCESS_KEY_ID` | R2 API token access key ID | `9b3f...` |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret access key | `82ab...` |
| `R2_REGION` | R2 region (default `auto`) | `auto` |

---

## 4. Multi-Tenant Access Authorization

1. **Upload**: Client requests attachment creation via `POST /v1/cloud/attachments/create`, specifying authenticated `spaceId`, `ciphertextSize`, and optional `recipientAccountId` or `conversationId`. An opaque `objectId` is generated.
2. **Download**: Client requests `GET /v1/cloud/attachments/download/:objectId`. The server checks:
   - Is requester the uploader (`accountId === record.accountId`)?
   - Is requester in `record.encryptedMetadata.recipientAccountId` or `allowedAccounts`?
   - If yes, ciphertext blob is streamed with AEAD integrity verification.
   - If no, server returns `404 Not Found` (never leaking existence).
