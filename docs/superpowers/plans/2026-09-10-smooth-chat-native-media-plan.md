# Smooth Chat and Native Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a responsive chat composer, Telegram-style attachment sheet with in-app Recent media, correct Android gallery saving, and bounded media/render work.

**Architecture:** A dedicated `VeilDeviceMedia` Capacitor plugin owns Android permission, MediaStore query/read/save, and scoped document/camera intents. TypeScript owns UI staging, worker scheduling, and converts only explicitly selected native media into existing `File` send inputs. Existing encryption begins only at `sendAttachment(s)` and remains untouched.

**Tech Stack:** React 19, TypeScript, Capacitor 8, Android Kotlin/MediaStore, Vitest, existing VEIL attachment pipeline.

---

### Task 1: Device-media bridge contract and permission tests

**Files:**
- Create: `src/media/NativeDeviceMediaBridge.ts`
- Create: `tests/phase74-device-media-bridge.test.ts`

- [ ] **Step 1: Write failing tests** for native detection, Recent permission request only on explicit call, pagination normalization, and web fallback returning unavailable rather than requesting permission.
- [ ] **Step 2: Run** `npx vitest run tests/phase74-device-media-bridge.test.ts` and observe the missing bridge failure.
- [ ] **Step 3: Implement** a typed bridge registration with narrow APIs: `requestRecentMediaPermission`, `listRecentMedia`, `readMedia`, `pickDocuments`, `captureMedia`, and `saveToGallery`.
- [ ] **Step 4: Run the test** and confirm it passes.

### Task 2: Android MediaStore plugin

**Files:**
- Create: `android/app/src/main/java/chat/veil/app/VeilDeviceMediaPlugin.kt`
- Modify: `android/app/src/main/java/chat/veil/app/MainActivity.java`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Test: `tests/phase74-device-media-bridge.test.ts`

- [ ] **Step 1: Extend the bridge test** with MediaStore read/write result mapping and denied permission behavior.
- [ ] **Step 2: Verify it fails** against the unimplemented plugin contract.
- [ ] **Step 3: Implement** Android 13+ granular read permissions and Android 14 selected-media permission handling only from `requestRecentMediaPermission`; use MediaStore queries limited to 60 items; read only a supplied URI; use `ACTION_OPEN_DOCUMENT` for files and `ACTION_IMAGE_CAPTURE`/`ACTION_VIDEO_CAPTURE` for capture; save image/video using `MediaStore` with `IS_PENDING` set/unset.
- [ ] **Step 4: Register plugin** in `MainActivity`; do not add `MANAGE_EXTERNAL_STORAGE` or broad storage permission.
- [ ] **Step 5: Run focused tests** and Android compile/unit checks.

### Task 3: Gallery save routing

**Files:**
- Modify: `src/ui/utils/fileSaver.ts`
- Create: `tests/phase74-gallery-save.test.ts`

- [ ] **Step 1: Write failing tests** showing native image/video saves route through `VeilDeviceMedia.saveToGallery`, request access only at save time, and preserve a document/share fallback after a bridge failure.
- [ ] **Step 2: Run** `npx vitest run tests/phase74-gallery-save.test.ts` and observe failure.
- [ ] **Step 3: Implement** bridge-first save behavior; remove reliance on `Directory.ExternalStorage` for gallery visibility; keep browser download and non-media file behavior.
- [ ] **Step 4: Run the test** and confirm it passes.

### Task 4: Telegram-style Recent attachment sheet

**Files:**
- Modify: `src/ui/components/media/MediaPickerModal.tsx`
- Modify: `src/ui/components/MessageComposer.tsx`
- Modify: `src/styles/veil-components.css`
- Create: `tests/phase74-media-picker.test.tsx`

- [ ] **Step 1: Write failing tests** for opening Recent, explicit permission request, loading a bounded in-app grid, selected-media staging, denied permission recovery, scoped Browse Files, and no selection loss on picker cancellation.
- [ ] **Step 2: Run** `npx vitest run tests/phase74-media-picker.test.tsx` and observe failure.
- [ ] **Step 3: Implement** an anchored bottom sheet with action row (Recent, Camera, Files, Voice), thumbnail grid, selection order, caption, a selected-item tray, and a permission explanation/retry state. Preserve the existing encrypted send call boundary.
- [ ] **Step 4: Implement** encrypted local app-state recent-document metadata that stores no file bytes or ungranted URI access.
- [ ] **Step 5: Run focused picker tests** and verify.

### Task 5: Composer and chat responsiveness

**Files:**
- Modify: `src/ui/components/MessageComposer.tsx`
- Modify: `src/ui/components/ConversationView.tsx`
- Modify: `src/ui/components/ui/VoiceNoteCard.tsx` as needed
- Create: `src/ui/utils/frameThrottler.ts`
- Create: `tests/phase74-chat-responsiveness.test.ts`

- [ ] **Step 1: Write failing tests** for frame-coalesced progress updates and stable composer structure during attachment/recording state transitions.
- [ ] **Step 2: Run** `npx vitest run tests/phase74-chat-responsiveness.test.ts` and observe failure.
- [ ] **Step 3: Implement** animation-frame coalescing for transfer/playback progress and localized subscriptions so hot progress state does not rebuild message rows. Preserve message-window rendering and existing reply gestures.
- [ ] **Step 4: Run the test** and existing voice/conversation/reply tests.

### Task 6: Bounded media work

**Files:**
- Modify: `src/ui/utils/mediaCache.ts`
- Modify: `src/ui/components/media/MediaImage.tsx`
- Create: `src/ui/utils/mediaTaskQueue.ts`
- Create: `tests/phase74-media-scheduling.test.ts`

- [ ] **Step 1: Write failing tests** for bounded concurrency, cancellation on consumer release, and one shared in-flight load per attachment.
- [ ] **Step 2: Run** `npx vitest run tests/phase74-media-scheduling.test.ts` and observe failure.
- [ ] **Step 3: Implement** a bounded cancellable task queue for thumbnails/fetch/decrypt consumers, preserving cache and attachment integrity behavior. Do not change AEAD or hash code.
- [ ] **Step 4: Run the test** and existing media integrity/download suites.

### Task 7: Documentation, verification, and local commit

**Files:**
- Modify: `docs/ai/CURRENT_STATE.md`
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CHANGELOG.md`

- [ ] **Step 1: Run all new focused tests plus legacy voice/media/conversation tests.**
- [ ] **Step 2: Run** `npm run build`, `npx cap sync android`, and Android unit/build verification.
- [ ] **Step 3: Run the Impeccable detector once on changed UI files.**
- [ ] **Step 4: Update continuity documents with exact evidence and commit locally.** Do not push or merge. Physical Android verification remains user-owned.
