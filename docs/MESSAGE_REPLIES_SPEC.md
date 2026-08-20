# VEIL Message Replies & Quoted Context Specification

## 1. Overview

VEIL Phase 29 adds message replying and quoted message context natively inside the End-to-End Encrypted Double Ratchet wire format.

---

## 2. Wire Protocol Schema

```typescript
export interface WireReplyMetadata {
  messageId: string;       // ID of referenced message
  senderName?: string;     // Display name or username of original sender
  text: string;            // Text snippet or summary (max 200 chars)
  attachmentType?: string; // 'voice' | 'file' | undefined
}

export interface WirePayload {
  version: 1;
  deliveryId: string;
  senderIdentityId: string;
  senderDocument: IdentityDocument;
  senderMailboxId?: string;
  ratchetMessage: RatchetMessage;
  attachment?: WireAttachment;
  replyTo?: WireReplyMetadata;
  voice?: WireVoiceMetadata;
}
```

---

## 3. UI Interaction & Navigation

- **Composer Quote Banner**: Shows "Replying to @sender: snippet" above input with cancel `✕`.
- **Bubble Render**: Displays quoted snippet with colored accent border.
- **Click to Jump**: Clicking the quote header scrolls smoothly to the referenced message ID (`#msg-${messageId}`) and briefly highlights it.
