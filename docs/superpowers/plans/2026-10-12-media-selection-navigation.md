# VEIL Media Selection and Navigation Remediation Plan

## Findings to verify
- `MediaPickerModal` keeps selected files, URI membership, and provider metadata in separate mutable stores; async closure reads can race, and document-picker selections do not belong to the active category's `recentItems` list.
- Picker Send eagerly materializes every native `content://` item through `fileFromUri` before calling the message pipeline; the pipeline then materializes another full `Uint8Array` before worker encryption.
- `sendAttachments` performs block/contact/prekey lookups before inserting the optimistic timeline message, so send initiation is not immediate when those dependencies are slow.
- Sidebar tab taps update state synchronously while swipes use a transition; broad `useApp` context and latest-message lookup during list rendering may amplify upload-triggered rerenders. Measure before changing list behavior.

## Intended changes
1. Add a canonical, race-safe attachment-selection model and regression tests. Derive count, selected rows, and category highlights from it; preserve across category changes and picker cancellation.
2. Pass native selection tokens into the existing encrypted worker pipeline without eager full `File` creation. Read native chunks once at send time and avoid the intermediate `File` allocation. Keep source failures visible and retryable.
3. Ensure optimistic outgoing message creation precedes slow preflight/background work, then represent preparation, upload, sent, and failed states truthfully without duplicate sends.
4. Instrument/profile All, Unread, and Groups tap/swipe changes and rerenders. Only make measured, low-risk navigation improvements and cover both paths.
5. Run focused tests, full test suite, typecheck/build as environment permits; update project state/changelog/active task/handoff and commit per repository contract.

## Scope and constraints
- Preserve the established encryption, attachment wire format, retry/outbox, UI design, and swipe navigation.
- No security protocol or identity changes; do not send plaintext to the relay.
- Preserve unrelated `release/v1.0.0/manifest.json` edits.
- Android performance claims require a real device/release profile; automated tests are reported separately.

## Likely files
- `src/ui/components/media/MediaPickerModal.tsx`
- `src/media/NativeDeviceMediaBridge.ts` and Android `VeilDeviceMediaPlugin.kt`
- `src/ui/app/AppState.tsx`
- `src/ui/components/Sidebar.tsx`
- focused tests under `tests/`
- `docs/ai/{ACTIVE_TASK,CURRENT_STATE,CHANGELOG,HANDOFF}.md`
