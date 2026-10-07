# Background Push Threat Model

## Scope

Android-only, opt-in background message alerts using Firebase Cloud Messaging (FCM). The app uses a data-only high-priority message. User-visible text/media/voice sends include a one-bit `notifyRecipient` hint; the relay does not send push for read receipts or other control envelopes. The relay never puts message content, sender names, mailbox IDs, conversation IDs, or message IDs in the FCM payload. The Android service renders fixed text: “VEIL — New encrypted message received”. Opening VEIL performs the normal capability-authenticated mailbox sync; push is only a wake/alert signal.

## Data and trust boundaries

| Component | Receives | Must not receive |
| --- | --- | --- |
| VEIL Android client | FCM registration token; encrypted mailbox envelopes after unlock | — |
| VEIL relay | FCM token, one opaque mailbox association, message-arrival timing, one-bit user-visible notification hint, opaque encrypted envelope | Message plaintext, sender identity, group name, media key, notification preview |
| Google FCM | App/project identifier, FCM token, generic `kind=message` wake payload, send timing, relay network metadata | Mailbox ID, message or sender content, conversation identity |

The relay enforces one mailbox association per FCM token. Registering the same device token for another Space moves the association; it does not create a second simultaneous mapping. Device alerts therefore follow one Space at a time on that app installation.

## Threats and mitigations

- **Provider or relay observes push traffic:** FCM can correlate the app installation and push timing. The relay learns which encrypted envelopes were marked as user-visible for notification. These metadata disclosures are documented and the FCM choice is opt-in. Users can disable push; local notifications remain available while VEIL is running.
- **Sensitive content reaches lock screen/provider:** Push payload is data-only and carries no message-specific identifiers or text. The native handler ignores any supplied content and renders a constant generic alert.
- **Unauthorized token registration:** Registration and removal require the target mailbox's 256-bit capability. Invalid capabilities are rejected; mailbox expiry deletes token mappings; a mailbox is limited to eight stored tokens.
- **Token theft from relay storage:** A stolen token can be used to target generic alerts, but cannot fetch envelopes without the mailbox capability. The database stores the FCM token in plaintext because FCM requires the original token for delivery. Relay database access therefore exposes the token-to-current-mailbox association.
- **Provider outages or invalid tokens:** Envelope persistence and message-send success do not depend on FCM. Invalid registration tokens are removed; other provider failures are silent and do not log tokens or provider bodies.
- **Duplicate or forged alert content:** Native code only handles the fixed `kind=message` event and creates one replaceable notification. It never displays remote-supplied text.
- **Silent notification mode conflict:** The client refuses registration in `SILENT_COUNTER` mode and unregisters background push when that mode is selected.

## Residual risks and limitations

- FCM is a third-party dependency and can observe delivery timing and installation tokens. This is an explicit opt-in exception to VEIL's zero-third-party-service default.
- Push delivery is best-effort and depends on Google Play services, network access, Android power policy, valid Firebase credentials, and the user's notification permission. Android force-stop blocks push until the user opens VEIL again.
- The relay learns which one mailbox is currently associated with the device token. Registration changes can reveal that the active push destination changed, though no other Space is linked concurrently in the token table.
- A generic push does not prove that a message was delivered or read. The encrypted mailbox remains authoritative.

## Required security gates

This changes metadata handling after the release-candidate freeze. Before production deployment, complete an independent security review, explicit dual sign-off, and Android device tests for app backgrounding, process death, permission denial, token rotation, Space switching, silent mode, and server restarts. Never deploy a service-account private key in the Android package or source control.
