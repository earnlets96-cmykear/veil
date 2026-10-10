# Attachment Send Feedback and Picker Responsiveness

Date: 2026-10-11

## Evidence

- `MediaPickerModal.handleConfirmSend` awaits `onSend` through encrypted upload and relay dispatch, and only then closes; the chat already has an optimistic `UPLOADING` message behind the sheet.
- Native URI-backed selections are read to completion in 1 MiB bridge chunks before `onSend` starts, while the sheet only changes its button to the generic `Sending…` label.
- `MediaPickerModal` subscribes to the entire AppContext only to call `markFilePickerActive`, although `NativeDeviceMediaBridge.notifyPickerActive` already dispatches to the AppState listener registered for that purpose. This can rerender the picker during unrelated app state changes.
- Both grid and file rows repeatedly materialize `Array.from(stagedUris)` for each item to calculate a selected index.

## Planned changes

1. Add test-first coverage for picker lifecycle: retain selection and show read errors before optimistic send begins; close after the optimistic message is inserted; let upload progress/failure appear in the chat and preserve its Retry path.
2. Report native file-read progress while converting selected URIs, then pass an upload-start callback through the picker/composer to the attachment-send pipeline. Fire it only after the outgoing UPLOADING message is committed to app state.
3. Remove the picker’s broad AppContext subscription and rely on the existing NativeDeviceMediaBridge picker lifecycle listener. Precompute the selected URI-to-order map once per selection change.
4. Run attachment, picker, media, send/retry, and performance regressions, typecheck, and inspect the diff. Do not alter encryption, authentication, message wire format, or upload retry rules.

## Validation limits

- Verify tests and a production web build; physical Android upload duration and scroll/frame pacing require a device.
- Keep unrelated dirty workspace files untouched.

## Results

- `npx vitest run` on the 12 attachment, media picker, media worker, upload concurrency, transfer security, outbox, and scroll regression files: 65 passed.
- `npx tsc --noEmit`: passed.
- `npx vite build --outDir <external workspace output>`: passed. Existing warnings remain for mixed static/dynamic imports and the main JavaScript chunk exceeding 500 kB.
- `git diff --check`: passed; Git printed line-ending normalization notices for existing working-copy files.
- Physical Android upload duration and picker frame pacing remain unverified because these require a device.
