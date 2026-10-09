# Web Composer Enter-to-Send Design

## Goal

Make the VEIL web message composer send a non-empty message when the user presses Enter, and insert a line break when the user presses Shift+Enter.

## Scope and behavior

- In desktop browsers wider than 768px, plain Enter prevents the textarea's default newline and invokes the existing send handler.
- In mobile layouts and Capacitor native apps, plain Enter keeps the textarea's normal newline behavior.
- Shift+Enter remains a newline wherever the keyboard provides that modifier.
- Shift+Enter is left to the textarea's normal newline behavior.
- Keep the visible Send button and all existing send, edit, reply, and attachment flows unchanged.
- Empty or whitespace-only drafts remain unsent through the existing `handleSend` guard.

## Implementation and verification

Update `MessageComposer`'s existing keydown handler and add focused regression coverage for desktop browser Enter-to-send and mobile/native newline behavior. Run the focused test and TypeScript check. No message protocol or cryptographic behavior changes.
