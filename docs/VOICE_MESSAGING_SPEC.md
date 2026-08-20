# VEIL End-to-End Encrypted Voice Messaging Specification

## 1. Overview

VEIL allows users to record and send voice messages with end-to-end cryptographic privacy. Voice notes are never sent in raw audio format to any relay or cloud storage service.

---

## 2. Audio Capture & Codec Negotiation

The `VoiceRecorder` module uses the HTML5 `MediaRecorder` API with preferred codec negotiation:
1. `audio/webm;codecs=opus` (Modern browsers)
2. `audio/mp4` / `audio/aac` (Safari / iOS)
3. `audio/ogg;codecs=opus` (Fallback)

---

## 3. Cryptographic Pipeline

```
[ Microphone Input ] ──> [ Raw Audio PCM / Opus Bytes ]
                                  │
                                  ▼
                     [ Generate Ephemeral Key K (32B) ]
                                  │
                                  ▼
                   XChaCha20-Poly1305 Encrypt (Audio, K, Nonce)
                                  │
                                  ▼
                         [ Audio Ciphertext ]
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       [ S3 Object Storage ]             [ Double Ratchet Message ]
       (Stores Encrypted Blob)           (Carries Key K + Nonce + ObjectId)
```

---

## 4. Playback Lifecycle

1. Recipient receives wire message and decrypts Double Ratchet payload.
2. Extracts `objectId`, `encryptionKeyBase64`, and `nonceBase64`.
3. Downloads ciphertext blob from S3.
4. Decrypts locally using `decryptXChaCha20Poly1305`.
5. Creates ephemeral `URL.createObjectURL(blob)` for playback.
6. Revokes object URL when playback finishes or Space locks.
