# Threat Model: Social Video Sharing and Previews

**Status:** Accepted for implementation under ADR-130. Independent review, formal security audit, explicit dual sign-off, and Android device validation are required before deployment.

## Scope

Support Android's native text share intent for public TikTok video and Instagram post/Reel URLs. Send the link as an existing end-to-end encrypted text message. In a conversation, load provider metadata and a thumbnail when a supported preview card is within 120 CSS pixels of the visible viewport; require a separate user tap to play in the embedded player. Links pasted into the VEIL composer use the same renderer.

This feature does not download the source video, rewrite message payloads, or add a relay-side metadata proxy.

## Assets and boundaries

- **Message and pending share text:** the bounded incoming Android text and outgoing normalized URL exist in process memory until dismissal or the existing E2EE send path encrypts the URL; ciphertext only at the relay and in durable message storage.
- **Preview and player:** third-party public content loaded by the recipient's device from the identified platform. TikTok/Instagram and the thumbnail CDN can observe the device IP, request time, and requested post URL when a supported preview card scrolls near the visible viewport. The preview card indicates its provider. Playback still requires an explicit tap.
- **Space state:** pending share text and preview state must be process-memory-only and scoped to the currently unlocked Space. Locking or switching Spaces clears preview cache and removes active provider frames.
- **Untrusted inputs:** Android intent text, user-pasted URLs, provider JSON, thumbnail URLs, and embedded player content.

## Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| A crafted URL causes arbitrary navigation, script execution, or an unexpected third-party request | Parse HTTPS URLs with exact provider host/path allowlists; reject userinfo, custom ports, non-video paths, and unknown hosts. Never follow a user URL from the VEIL relay. |
| Share intent text is sent to the wrong person or sent without user awareness | Show a recipient chooser and the normalized link, require a second explicit Send action, and route through the existing conversation `sendMessage` function. Do not send automatically to whichever chat happens to be open. |
| The provider response injects markup or script into VEIL's origin | Validate response size and fields; do not use `dangerouslySetInnerHTML`; only construct fixed provider URLs from validated IDs; keep the provider player in a sandboxed cross-origin iframe. |
| A provider URL redirects to an unexpected host or leaks data through referrers | Only request fixed provider API URLs built from validated canonical links; do not resolve short links by opening them directly. Use `referrerPolicy="no-referrer"` on embeds and thumbnails where supported. |
| Automatic metadata loading reveals which supported messages are being viewed | Defer provider requests until the preview is within 120 CSS pixels of the visible viewport; show the provider attribution; do not prefetch offscreen messages, refresh in the background, or auto-play. The provider can infer that the user is viewing a conversation containing that public link. |
| Provider metadata or a thumbnail remains visible after Space lock | Clear the VEIL-owned metadata cache and remove the conversation/player UI on lock or Space switch. VEIL does not copy thumbnail bytes into app storage; the Android WebView and remote provider control their own HTTP caches, which VEIL cannot guarantee to purge. |
| Oversized or malformed provider responses cause excessive memory use | Bound response bytes, metadata field lengths, request duration, and cache entries; lazy-load the thumbnail and mount the iframe only after an explicit Play in VEIL action. Fail closed to the original-link action when no safe embed URL is available. |
| Provider playback fails, stalls before readiness, or sends forged error messages | Accept TikTok player events only from the exact TikTok origin and active iframe window. Show recovery on a provider error or if TikTok does not report `onPlayerReady` within 15 seconds; offer Retry and Open original. Keep playback inside a cross-origin iframe sandbox and do not autoplay. |
| Unavailable/private/restricted content appears broken or VEIL appears to endorse it | Show an explicit unavailable state and a user-controlled **Open original** fallback. Do not scrape a normal provider webpage when official embed metadata is unavailable. |

## Deliberate privacy trade-off

The user requested automatic in-view thumbnails. When a supported message scrolls within 120 CSS pixels of the visible viewport, the recipient device contacts the platform's fixed oEmbed endpoint and may load the provider-hosted thumbnail. The platform and image CDN learn the device IP, requested public post URL, and timing. VEIL does not promise anonymity from the platform while this feature is used. The user can avoid this egress by not opening the conversation or by keeping that message offscreen. Playback remains optional per message and is not routed through VEIL infrastructure.

## Required adversarial verification

- Reject lookalike domains, non-HTTPS URLs, credentialed URLs, non-video paths, malformed short links, and unsafe schemes.
- Reject malformed, oversized, timed-out, or wrong-host oEmbed responses and thumbnail URLs.
- Verify offscreen messages do not request metadata, in-view messages issue bounded/coalesced requests, and failed/removed/private content leaves a safe original-link fallback.
- Verify provider content is isolated from the VEIL document, TikTok events are source/origin-checked, a missing `onPlayerReady` produces recovery, and autoplay is disabled.
- Verify pending share text requires recipient selection and confirmation, is not logged or persisted, and is hidden/cleared across lock and Space transitions.
- Verify provider cache bounds, duplicate-request coalescing, and cleanup on Space lock; document that platform-controlled HTTP cache eviction is outside VEIL's control.
- Run Android cold-start, warm-start, locked-state, cancellation, and provider playback checks on-device.

## Release gate

No deployment until an independent security review, formal audit, explicit dual sign-off, and physical Android validation are recorded. Any later expansion of provider hosts, offscreen/background preview fetches, persistent thumbnail storage, or relay-side resolution requires a new threat review and ADR.
