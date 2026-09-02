# ACTIVE_TASK.md — Active Work Tracker

## Active Phase: PHASE 53 (Forensic Fix: Video Upload Pipeline & Seen/Read Double-Check Architecture)
- **Status**: **COMPLETE & VERIFIED 100%**
- **Branch**: `main`

### Completed Tasks
- [x] Forensic reproduction of video upload failures against live production Render server (`https://veil-rga0.onrender.com`).
- [x] Forensic investigation into seen/read double check failure (uncovered cryptographic peer identity mismatch, conversation perspective bug, and unreadCount guard flaw).
- [x] Replaced rigid 15s S3 timeout in `s3ObjectStorage.ts` with 180s timeout for Cloudflare R2 uploads.
- [x] Implemented direct binary streaming upload (`/v1/cloud/attachments/upload-raw`) and download (`/v1/cloud/attachments/download-raw/:objectId`) in `cloudHandler.ts` and `cloudClient.ts` to eliminate double base64 expansion.
- [x] Implemented multi-tier MIME detection with magic byte sniffing in `src/attachments/mimeUtils.ts`.
- [x] Updated `AttachmentPreviewModal.tsx` and `AppState.tsx` with dynamic upload/download timeouts and robust MIME detection.
- [x] Fixed peer identity validation and conversation key resolution in `ReadReceiptManager.processInboundReceipt`.
- [x] Fixed read receipt trigger in `ConversationView.tsx` and `selectConversation` to fire whenever viewing active conversations with inbound messages.
- [x] Added continuous cloud snapshot synchronization on read receipt receipt to persist `READ` double-check state across reloads and fresh devices.
- [x] Created dedicated automated regression test suite `tests/phase53-video-upload.test.ts` (6 tests passing).
- [x] Created dedicated automated regression test suite `tests/phase53-read-receipts.test.ts` (7 tests passing).
- [x] Verified live production Render server (`scratch/verify_phase53_prod.mjs`) with real video upload/download and seen/read receipt exchange.
- [x] Verified web build (`npm run build`).
- [x] Synced Capacitor and compiled native Android APK (`gradlew.bat assembleDebug` BUILD SUCCESSFUL in 20s).
- [x] Updated project documentation (`CURRENT_STATE.md`, `ACTIVE_TASK.md`, `CHANGELOG.md`).
