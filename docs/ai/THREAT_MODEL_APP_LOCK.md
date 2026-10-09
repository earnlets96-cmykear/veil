# App Lock Lifecycle Threat Review

**Date:** 2026-10-09  
**Status:** Reviewed for implementation; independent security audit and dual sign-off remain required before deployment.

## Scope

This review covers local App Lock timing when VEIL is backgrounded, inactive, resumed after WebView suspension, or notified that the Android screen turned off. It does not change PIN verification, cryptography, Space isolation, message formats, or the relay.

## Threat and invariant

An unlocked Space may remain visible to someone who gains access to the device after the user leaves VEIL, stops interacting, turns the screen off, or returns after Android suspended the WebView. If App Lock is enabled and the configured delay has elapsed, VEIL must transition to its existing locked state before it renders private Space content on resume. A fresh process must start behind the lock screen whenever App Lock is enabled.

An observer with access to device-local application storage may see the selected delay and a pending screen-off elapsed-time marker. These values contain no PIN, credential, identity, message, or key material. This feature does not protect against a compromised OS, a malicious process with the same application privileges, forced extraction of process memory, or an attacker who can use the device before a configured delay expires.

## Event handling

- **Leave/background:** Record a monotonic in-process timestamp. Lock immediately for a zero delay; otherwise compare elapsed time on resume against the persisted leave-app delay. A process restart is covered by the startup lock gate rather than by trusting an old wall-clock value.
- **Foreground inactivity:** Observe only that pointer, key, or touch activity occurred. Do not inspect, serialize, or log event contents. Reset one timer for the active unlocked session; clear it on lock, Space change, and provider cleanup.
- **Android screen off:** While the native plugin is alive, a dynamically registered receiver stores only `SystemClock.elapsedRealtime()` in private app preferences. On resume, consume the marker once and compare its elapsed duration to the selected screen-off delay before exposing the session. A timestamp from a prior boot is invalid; the startup lock gate remains authoritative after process/device restart.
- **Picker exceptions:** Existing file/gallery picker lifecycle guards continue to suppress app-background locking while a picker owns foreground control. Screen-off behavior must not bypass those guards for an active picker transition.
- **Native listener lifecycle:** Register the receiver with plugin lifecycle and unregister it when the plugin is destroyed. Missing plugin support or listener failure is treated as unsupported; it must not imply that a screen-off event was observed.

## Limits and failure behavior

Android may suspend or kill the process before JavaScript observes lifecycle transitions. The native elapsed-time marker helps only after the app resumes in the same boot and while the receiver was registered when the screen-off event occurred. A force-stopped app cannot execute a receiver until launched again; when launched, VEIL must still show the startup lock before private content. Reboot resets the monotonic clock, so a stale marker must be discarded and cannot suppress the startup lock.

Storage write failure must leave the last persisted setting selected in the UI and report that the change was not saved. Corrupt/unknown timing values are normalized to a safe finite default. Runtime code must use the same validated delay values as the settings UI. Never log activity content, PINs, tokens, or registration/provider payloads.

## Required adversarial regressions

- A finite delay locks at its exact boundary and stays unlocked immediately before it; `never` does not lock due to that event.
- A persisted setting write failure restores the last stored selection.
- Picker transitions preserve the existing session exception.
- A pending screen-off marker is consumed once, invalid prior-boot timestamps are ignored, and plugin absence does not fabricate a screen-off event.
- App Lock enabled at startup remains locked before Space UI can render; disabling App Lock cancels pending inactivity work.
- Existing PIN collision, brute-force lockout, credential rejection, and multi-Space isolation tests continue to pass.

## Release gate

This is a security-sensitive local authentication lifecycle change under the post-RC freeze. Before production deployment, require an independent security audit, explicit dual sign-off, and physical Android validation of screen-off, process suspension/death, picker behavior, resume, and Space switching.
