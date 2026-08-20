# VEIL S3 Object Storage Integration & AWS SigV4 Architecture

## 1. Overview

VEIL Phase 29 integrates S3-compatible Object Storage for storing client-side AEAD-encrypted media, voice recordings, and large attachments.

---

## 2. Zero AWS SDK Dependency (Pure TypeScript SigV4)

VEIL implements pure TypeScript AWS Signature Version 4 HMAC-SHA256 calculations directly using `@noble/hashes` without heavy external AWS SDK dependencies.

### SigV4 Computation Pipeline:
```
1. Canonical Request:
   HTTPMethod + '\n' +
   CanonicalURI + '\n' +
   CanonicalQueryString + '\n' +
   CanonicalHeaders + '\n' +
   SignedHeaders + '\n' +
   HashedPayload (SHA256)

2. String to Sign:
   "AWS4-HMAC-SHA256" + '\n' +
   RequestDateTime + '\n' +
   CredentialScope (date/region/s3/aws4_request) + '\n' +
   HashedCanonicalRequest (SHA256)

3. Derived Signing Key:
   kSecret  = "AWS4" + SecretAccessKey
   kDate    = HMAC-SHA256(kSecret, DateStamp)
   kRegion  = HMAC-SHA256(kDate, Region)
   kService = HMAC-SHA256(kRegion, "s3")
   kSigning = HMAC-SHA256(kService, "aws4_request")

4. Signature:
   Signature = Hex(HMAC-SHA256(kSigning, StringToSign))
```

---

## 3. Storage Security & Access Control

- **Client-Side AEAD Pre-Encryption**: All objects uploaded to S3 are pre-encrypted with `XChaCha20-Poly1305` client-side.
- **Strict Authorization**: Cloud handler verifies requesting account session and Space membership before serving downloads.
- **Path Traversal Protection**: Key sanitization rejects `..`, absolute paths, and control characters.
