# VEIL Notifications and App Lock Settings Design

**Date:** 2026-10-09
**Status:** Proposed; initial scope approved by the user, awaiting review of this written specification.
**Surface:** Existing VEIL Settings screens and the Android notification shade.

## Goal

Make notification preferences understandable and make the App Lock controls correspond to behavior the app actually enforces. Preserve VEIL's existing visual language, Android conventions, and privacy guarantees.

## Repository findings

- `SettingsModal` combines local notification permission, a test action, background push opt-in, and privacy modes. The privacy mode options currently do not clearly say that they govern local alerts while VEIL is active; Android FCM alerts remain generic.
- Android FCM sends only `kind=message`. The native service ignores remote copy and displays a fixed VEIL alert with private lock-screen visibility. Do not add sender or message previews to FCM.
- Background push is opt-in and registration is Space-capability authenticated. One device token follows one Space at a time. The UI should state this plainly.
- `AppLockSettingsView` persists separate values for app exit, app background, screen off, and inactivity. Runtime code reads the legacy shared `autoLockInterval` instead; the screen-off values have no native event integration.
- The Security page has a second inactivity selector that changes component state only and does not persist or drive the lock runtime.
- The current controls already use VEIL's dark card surfaces, semantic theme tokens, and accent color. UI Pro Max's generic marketing-page recommendation does not match this existing product surface; retain VEIL's incumbent settings style and use its accessibility guidance.

## Proposed experience

### Notifications settings

Organize the page into three clearly labeled sections:

1. **Device permission** — show the current Android/browser permission state, an action to request permission, a settings shortcut when permission is denied, and a test action that is disabled until permission is granted. Announce success and failure feedback to assistive technology.
2. **While VEIL is open** — label privacy modes as applying to local notifications while the app is active. Explain accurately what each choice exposes: message preview, sender only, generic alert, or no notification. Keep the existing choices and defaults.
3. **Background alerts (Android)** — show whether registration completed for the active Space on this device; provide enable/disable actions, loading/error feedback, and a short explanation that FCM alerts stay generic and only one Space receives this device's background alerts at a time. Hide this section on unsupported platforms.

Keep the Android card recognizable as VEIL. Retain a generic title/body and private lock-screen visibility. Improve the channel label and explanatory copy for clarity without adding message-specific content or changing the FCM payload.

### App Lock settings

Use one source of truth for the visible settings and the lock runtime. Consolidate the overlapping “After exiting app” and “After background” controls into a single **When you leave VEIL** delay. Keep separate controls for **While using VEIL** inactivity and **When screen turns off**. Preserve the current available delay choices where they fit the behavior.

- Leaving VEIL: lock immediately or when the selected delay has elapsed, including when VEIL resumes after process suspension or restart.
- Inactivity: reset a foreground inactivity timer on genuine user activity and lock when its selected delay elapses.
- Screen off: on Android, process a native screen-off signal and ensure a pending lock is honored on resume if the WebView was suspended. On other platforms, hide the Android-only control or identify its platform limitation.
- Lock Now and PIN setup/change remain available. Disabling App Lock remains possible only under existing PIN/security rules.
- Remove or replace the disconnected duplicate inactivity selector in the Security page so users do not encounter a second, nonfunctional control.

Use semantic controls with visible focus, keyboard operation, at least 44px touch targets, and live announcements for save/status feedback. Preserve the current neutral card hierarchy, typography, and semantic colors. Keep motion limited to state feedback and honor reduced-motion preferences.

## Privacy and security constraints

- Keep FCM data-only payloads generic. Do not include sender, group, message text, mailbox, conversation, or message identifiers in the push or Android alert.
- Local notification previews remain governed by the user's selected local privacy mode and must be described as visible to the device notification system.
- Push remains opt-in, Android-only, and associated with one Space per device token.
- Preserve existing picker lifecycle guards, capability checks, silent-counter behavior, and key zeroization on lock.
- Do not change message, identity, or cryptographic wire formats.

## Error and status behavior

- Permission denied: explain that Android/browser settings must be changed and expose the native settings shortcut where supported.
- Firebase or relay registration failure: keep background alerts off, show a concise actionable error, and allow retry. Do not display or log tokens, credentials, or provider response bodies.
- App Lock setting updates: reflect only persisted values; on persistence failure, restore the last saved selection and report failure.
- App restart or process death: evaluate lock state before exposing the unlocked app UI.

## Verification plan

- Add focused regressions proving each visible App Lock setting is persisted and consumed by its matching lifecycle event, including process resume, user inactivity, Android screen off, picker transitions, and disabled App Lock.
- Add settings tests for permission states, background push loading/success/failure, privacy-mode descriptions, and platform visibility.
- Keep adversarial push assertions that the relay payload and native notification never expose message or identity content.
- Run relevant App Lock, notification, typecheck, and Android build checks. Validate on Android hardware for notification permission, screen off, background/resume, process death, and Space switching.

## Governance and release gates

App Lock runtime behavior is security-sensitive under VEIL's post-RC freeze. Before implementation, update the threat review and record an ADR covering event timing, process suspension, screen-off handling, and lock-before-render guarantees. Add adversarial regressions. Local implementation and build verification do not authorize production rollout: independent security audit and explicit dual sign-off remain required before deployment.

## Alternatives considered

- **Visual-only settings refresh:** smaller, but leaves the persisted App Lock values disconnected from enforcement.
- **Notification inbox/history and per-chat push rules:** broader product work that adds local notification metadata and does not address the identified App Lock defect.
- **Recommended:** repair the existing Settings surfaces and connect their controls to the runtime while preserving generic FCM delivery.
