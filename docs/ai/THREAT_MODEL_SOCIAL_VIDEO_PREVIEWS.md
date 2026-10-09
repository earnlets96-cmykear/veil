# Threat Model: Social Video Sharing and Previews

**Status:** Accepted for implementation under ADR-130. Independent review, formal security audit, explicit dual sign-off, and Android device validation are required before deployment.

## Scope

Support Android's native text share intent for public TikTok video and Instagram post/Reel URLs. Send the link as an existing end-to-end encrypted text message. In a conversation, a user may explicitly load a provider preview and play it in an embedded player. Links pasted into the VEIL composer use the same renderer.

This feature does not download the source video, rewrite message payloads, or add a relay-side metadata proxy.

## Assets and boundaries

- **Message and pending share text:** the bounded incoming Android text and outgoing normalized URL exist in process memory until dismissal or the existing E2EE send path encrypts the URL; ciphertext only at the relay and in durable message storage.
- **Preview and player:** third-party public content loaded by the recipient's device from the identified platform. TikTok/Instagram and the thumbnail CDN can observe the device IP, request time, and requested post URL after the user chooses to load the preview.
- **Space state:** pending share text and preview state must be process-memory-only and scoped to the currently unlocked Space. Locking or switching Spaces clears preview cache and removes active provider frames.
- **Untrusted inputs:** Android intent text, user-pasted URLs, provider JSON, thumbnail URLs, and embedded player content.

## Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| A crafted URL causes arbitrary navigation, script execution, or an unexpected third-party request | Parse HTTPS URLs with exact provider host/path allowlists; reject userinfo, custom ports, non-video paths, and unknown hosts. Never follow a user URL from the VEIL relay. |
| Share intent text is sent to the wrong person or sent without user awareness | Show a recipient chooser and the normalized link, require a second explicit Send action, and route through the existing conversation `sendMessage` function. Do not send automatically to whichever chat happens to be open. |
| The provider response injects markup or script into VEIL's origin | Validate response size and fields; do not use `dangerouslySetInnerHTML`; only construct fixed provider URLs from validated IDs; keep the provider player in a sandboxed cross-origin iframe. |
| A provider URL redirects to an unexpected host or leaks data through referrers | Only request fixed provider API URLs built from validated canonical links; do not resolve short links by opening them directly. Use `referrerPolicy="no-referrer"` on embeds and thumbnails where supported. |
| A hidden preview leaks which messages the user received or viewed | Do no preview request until the user taps **Load preview**. Use no speculative prefetch, background refresh, or auto-play. |
| Provider metadata or a thumbnail remains visible after Space lock | Clear the VEIL-owned metadata cache and remove the conversation/player UI on lock or Space switch. VEIL does not copy thumbnail bytes into app storage; the Android WebView and remote provider control their own HTTP caches, which VEIL cannot guarantee to purge. |
| Oversized or malformed provider responses cause excessive memory use | Bound response bytes, metadata field lengths, request duration, and cache entries; use lazy image/iframe loading and let the user open a player explicitly. Fail closed to the original-link action when no safe embed URL is available. |
| Unavailable/private/restricted content appears broken or VEIL appears to endorse it | Show an explicit unavailable state and a user-controlled **Open original** fallback. Do not scrape a normal provider webpage when official embed metadata is unavailable. |

## Deliberate privacy trade-off

The user's tap explicitly authorizes the recipient device to contact the platform to load that specific preview. The platform and any image CDN still learn the device IP, the requested public post URL, and timing. VEIL does not promise anonymity from the platform while this feature is used. Provider access remains optional per message and is not routed through VEIL infrastructure.

## Required adversarial verification

- Reject lookalike domains, non-HTTPS URLs, credentialed URLs, non-video paths, malformed short links, and unsafe schemes.
- Reject malformed, oversized, timed-out, or wrong-host oEmbed responses and thumbnail URLs.
- Verify no request occurs before the explicit load action and that failed/removed/private content leaves a safe original-link fallback.
- Verify provider content is isolated from the VEIL document and autoplay is disabled.
- Verify pending share text requires recipient selection and confirmation, is not logged or persisted, and is hidden/cleared across lock and Space transitions.
- Verify provider cache bounds, duplicate-request coalescing, and cleanup on Space lock; document that platform-controlled HTTP cache eviction is outside VEIL's control.
- Run Android cold-start, warm-start, locked-state, cancellation, and provider playback checks on-device.

## Release gate

No deployment until an independent security review, formal audit, explicit dual sign-off, and physical Android validation are recorded. Any later expansion of provider hosts, background preview fetches, persistent thumbnail storage, or relay-side resolution requires a new threat review and ADR.
