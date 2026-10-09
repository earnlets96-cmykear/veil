# Threat Model: Full Preview Notifications and Inline Replies

## Scope

This review covers Android local notifications when the user selects **Full Preview**, inline replies, attachment session gating, and playback MIME selection. It does not change background Firebase push behavior, message encryption, attachment authorization, or the wire protocol.

## Notification and reply data flow

1. An authenticated, decrypted incoming message reaches the local `NotificationDispatcher`.
2. Only `FULL_OBFUSCATED` notifications with a conversation and Space identifier receive an inline Reply action. The OS notification shows the sender and the existing short preview.
3. Android marks the notification private so lock-screen presentation can redact its content. Background FCM notifications remain generic and have no reply action.
4. Android RemoteInput returns reply text to the explicit VEIL activity intent. The native plugin accepts the initial launch intent on cold start and later Activity intents, bounds the text, clears the one-shot intent extras and ClipData, and emits a retained in-memory Capacitor event so the JavaScript listener can receive it after startup.
5. If the app is cold-started or the Space is locked, the client keeps at most five replies in volatile memory for up to five minutes. It sends one only after the same Space is active; a different active Space causes the reply to be discarded.
6. The client sends through the existing encrypted `sendMessage` path. The reply is never placed in a new relay payload outside that path.
7. Locking the Space or changing notification privacy cancels active local notifications. The notification manager suppresses new alerts while locked.

## Attachment session and media controls

- Attachment and voice paths require a structurally valid cloud session before starting remote access. Failed session restoration stops at the UI boundary with a generic message; it does not bypass authorization or add credential logs.
- Voice playback uses an audio MIME type from valid cached or message metadata and falls back to `audio/webm` if old cache metadata is generic. The plaintext audio remains in the existing ephemeral Blob URL lifecycle.

## Threats and controls

- **Shoulder surfing / lock-screen exposure:** Full Preview is an explicit local setting; Android notification visibility is `PRIVATE`; locking the Space clears active notifications.
- **Cross-Space reply routing:** The local action binds conversation and Space IDs. The client rejects replies unless the same Space is active and unlocked.
- **Plaintext in logs or durable storage:** The reply path adds no file, database, telemetry, or logging writes. The native intent is cleared before forwarding it in memory; background push remains generic.
- **Privacy-mode changes:** Changing away from Full Preview clears active OS and browser notifications so an older preview does not remain visible under a more private selection.
- **Oversized or blank RemoteInput:** Native handling trims input, caps it at 10,000 characters, and drops blank replies.
- **Malformed intent or theme input:** Native handling requires the expected reply action and nonblank conversation/Space identifiers. Notification accent input accepts only a six-digit hex color; Android controls the notification surface and text styling.
- **Process restart / locked app:** Reply text is transient process memory only, bounded to five replies and five minutes. A process death may discard an unsent reply; the text must never replay from disk.

## Residual exposure and release gates

Full Preview intentionally reveals a short plaintext preview in the unlocked Android notification shade and uses the OS notification stack for transient reply input. OS memory inspection and user-configured notification mirroring remain outside the client’s control. RemoteInput lifecycle, notification clearing on lock, and same-Space rejection require physical Android validation. Independent security review, formal audit, and explicit dual sign-off are required before deployment under the post-RC security freeze.

## Regression coverage

`tests/phase128-notification-inline-reply.test.ts`, `tests/phase128-notification-dispatch.test.ts`, `tests/phase128-attachment-session-gate.test.ts`, `tests/phase128-voice-audio-mime.test.ts`, and `tests/phase124-native-notification-privacy.test.ts` cover the local reply route, privacy-mode gate, lock clearing, generic FCM contract, session failure, and generic audio MIME fallback.
