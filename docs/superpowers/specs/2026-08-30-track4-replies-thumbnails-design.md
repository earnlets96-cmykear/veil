# Track 4 Design Specification — Forensic Replies & Media Thumbnail Pipeline

**Document ID**: `docs/superpowers/specs/2026-08-30-track4-replies-thumbnails-design.md`  
**Date**: 2026-08-30  
**Status**: APPROVED & IMPLEMENTED  
**Scope**: Persistent Quoted Replies, Universal Swipe-to-Reply, Media Thumbnail Generation, Wire Safety

---

## 1. Actual Root Causes Identified

### A. Reply Disappearance & Attachment Type Loss After Send
- **Root Cause**: `activeReply` resolution in `AppState.tsx` previously hardcoded `attachmentType` to only `'file'` or `'voice'`, dropping `'image'`, `'video'`, and `'grouped'` media and leaving summary text blank for media replies.
- **Consequence**: Outgoing media replies either lost their quote reference or degraded into standalone unreferenced text upon transmission and persistence.

### B. Missing Reply Gestures and Actions on Media Bubbles
- **Root Cause**: `MessageBubble` swipe listeners and reply actions were attached only to visible text message bubbles, leaving photos, videos, voice notes, files, and multi-media albums without swipe gesture support in `ConversationView.tsx`.
- **Consequence**: Users could only swipe to reply to text messages; attempting to swipe photos or videos triggered either viewport drag or did nothing.

### C. Media Thumbnail Poster & Playback Coupling
- **Root Cause**: Video thumbnail Blob URLs were created without systematic object URL revocation on unmount or poster update, risking memory leaks while video poster generation was mixed with playback player logic.
- **Consequence**: Video thumbnails could leak memory in long chat sessions, or fail to render cleanly in offline/rehydrated states.

### D. Missing `msgId` in `sendAttachments`
- **Root Cause**: In `sendAttachments` (`src/ui/app/AppState.tsx`), `const msgId` was referenced in `pendingMsg` before explicit local declaration.
- **Consequence**: Could cause runtime reference issues in strict execution environments.

---

## 2. Affected Data Flow

### User Gesture to Persisted Quoted Reply
```
USER GESTURE (Horizontal swipe on any message type or context menu "Reply")
  │
  ▼
setReplyTarget(targetMsg)
  │
  ▼
MessageComposer renders ReplyPreview banner (Sender Name, Text / Media Type snippet, SVG Icon, Dismiss button)
  │
  ▼
User writes text or attaches media & sends
  │
  ▼
resolveReplyReference(targetMsg) ──► Produces protocol-safe ReplyReference { messageId, senderName, text, attachmentType }
  │
  ▼
Local UIMessage { id, conversationId, ..., replyTo: ReplyReference } persisted to EncryptedSpaceStore ('veil:ui:messages')
  │
  ▼
Wire Serialization (Double Ratchet encryptAndPackWireMessage)
  │  (Contains strictly { messageId, senderName, text, attachmentType }, ZERO blob: or DOM leaks)
  ▼
Recipient processInboundWirePayload(rawPayloadBase64) ──► Rehydrates replyTo into recipient UIMessage
  │
  ▼
ConversationView / MessageBubble renders persisted quote with tap-to-jump navigation
```

### Media Thumbnail Decryption & RAM Cache Flow
```
Recipient Inbound Attachment Wire Data
  │
  ▼
Authenticated CloudClient fetch (401 fail-closed protection)
  │
  ▼
Local XChaCha20-Poly1305 Decryption ──► Raw plaintext bytes in RAM
  │
  ▼
MediaCache.getOrFetch ──► Ephemeral Blob URL in RAM
  │
  ▼
MediaImage renders Image or extracts Video Thumbnail via offscreen canvas
  │
  ▼
Automatic URL.revokeObjectURL on unmount/replacement
```

---

## 3. Files Involved

- `src/ui/app/types.ts`: Export `ReplyReference` interface and typed `UIMessage.replyTo`.
- `src/ui/app/AppState.tsx`: Implement `resolveReplyReference`; ensure `msgId` and `replyTo` are handled in `sendMessage`, `sendAttachments`, and `sendVoiceMessage`.
- `src/ui/components/ConversationView.tsx`: Implement `ConversationMessageRow` with swipe-to-reply on all message types, quote preview rendering, and jump-to-message navigation.
- `src/ui/components/ui/MessageBubble.tsx`: Support `replyTo` quote preview and swipe gesture callbacks.
- `src/ui/components/ui/ReplyPreview.tsx`: Multi-media icons (`ImageIcon`, `VideoIcon`, `PaperclipIcon`, `MicIcon`) and snippet formatting.
- `src/ui/components/MessageComposer.tsx`: Quote banner integration with `resolveReplyReference`.
- `src/ui/components/media/MediaImage.tsx`: Decoupled video poster generation with automatic `URL.revokeObjectURL` cleanup.
- `src/attachments/thumbnailGenerator.ts`: Video canvas thumbnail extraction.

---

## 4. Invariants

1. **Protocol Safety**: `replyTo` on the wire strictly contains `{ messageId, senderName, text, attachmentType }`. It must NEVER contain `thumbnailUrl`, `blob:`, `previewUrl`, `localPreviewUrl`, DOM nodes, or MediaCache internals.
2. **Canonical Identity**: The replied-to message is identified strictly by its canonical `messageId`, never by text, timestamp, username, or array index.
3. **Fail-Closed Authorization**: All media uploads and downloads require authenticated sessions via `CloudClient`.
4. **Zero Unicode Emoji UI Icons**: All interface elements use clean SVG vector icon components.
5. **Memory Leak Prevention**: All ephemeral Blob URLs generated for video posters or thumbnails must be revoked on component unmount or poster update.

---

## 5. Acceptance Criteria

1. **Text Reply**: Swiping a text message left opens composer reply banner; sending renders quote inside message bubble; quote persists across reload.
2. **Media Reply**: Images, videos, files, voice notes, and grouped media albums support swipe-to-reply with accurate badges (`Photo`, `Video`, `Voice note`, `X Media Files`, or filename).
3. **Jump-to-Original**: Tapping a reply quote scrolls the original message into view and briefly highlights it; if deleted, displays graceful fallback without crashing.
4. **Thumbnail Performance**: Video and image thumbnails render with clean loading skeleton, smooth display, and zero browser broken-image icons.
5. **No Wire Leaks**: Serialized payloads contain zero local blob URLs or DOM objects.
