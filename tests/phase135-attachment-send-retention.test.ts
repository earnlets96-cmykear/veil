import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { attachmentSendFailureMessage } from '../src/attachments/attachmentSendError.ts';

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('Phase 135: Attachment send selection retention', () => {
  it('explains auth, file-read, and connection failures without showing raw errors', () => {
    expect(attachmentSendFailureMessage(new Error('Cloud authentication is unavailable'))).toContain('Reopen and unlock this Space');
    expect(attachmentSendFailureMessage(new Error('Unable to read selected media chunk'))).toContain('select it again');
    expect(attachmentSendFailureMessage(new Error('Unable to connect to storage at https://private.example'))).toContain('Check your connection');
    expect(attachmentSendFailureMessage(new Error('Unable to connect to storage at https://private.example'))).not.toContain('private.example');
  });

  it('waits for media sends before clearing the selected files and closing the picker', () => {
    const picker = source('../src/ui/components/media/MediaPickerModal.tsx');
    const confirm = picker.slice(picker.indexOf('const handleConfirmSend'), picker.indexOf('const formatFileSize'));

    expect(confirm).toMatch(/await\s+onSend\(/);
    expect(confirm.indexOf('await onSend(')).toBeLessThan(confirm.indexOf('setSelectedFiles([])'));
    expect(confirm.indexOf('await onSend(')).toBeLessThan(confirm.indexOf('onClose()'));
    expect(picker).toContain('role="alert"');
  });

  it('retains staged files until attachment send setup succeeds', () => {
    const composer = source('../src/ui/components/MessageComposer.tsx');
    const confirm = composer.slice(composer.indexOf('const handleConfirmSendFiles'), composer.indexOf('// Handle send from In-App Media Picker'));

    expect(confirm).toMatch(/await\s+sendAttachment\(/);
    expect(confirm).toMatch(/await\s+sendAttachments\(/);
    expect(confirm.indexOf('await sendAttachment(')).toBeLessThan(confirm.indexOf('setStagedFiles(null)'));
    expect(confirm.indexOf('await sendAttachments(')).toBeLessThan(confirm.indexOf('setStagedFiles(null)'));
    expect(confirm).toContain('setStagedFiles(null)');
  });

  it('waits for media-picker attachment sends and surfaces setup errors', () => {
    const composer = source('../src/ui/components/MessageComposer.tsx');
    const send = composer.slice(composer.indexOf('const handleMediaPickerSend'), composer.indexOf('// Emoji insertion'));

    expect(send).toMatch(/await\s+sendAttachment\(/);
    expect(send).toMatch(/await\s+sendAttachments\(/);
    expect(send).not.toContain('catch');
  });

  it('marks native media selected without reading video bytes until Send is pressed', () => {
    const picker = source('../src/ui/components/media/MediaPickerModal.tsx');
    const stage = picker.slice(picker.indexOf('const stageDeviceItems'), picker.indexOf('const toggleDeviceItem'));
    const confirm = picker.slice(picker.indexOf('const handleConfirmSend'), picker.indexOf('const formatFileSize'));

    expect(stage).toContain('createSelectionPlaceholder(item)');
    expect(stage).not.toContain('fileFromUri');
    expect(confirm).toContain('await deviceMedia.fileFromUri(uri)');
    expect(confirm).toContain('await onSend(');
  });

  it('ignores stale recent-media queries after the person switches picker tabs', () => {
    const picker = source('../src/ui/components/media/MediaPickerModal.tsx');
    const load = picker.slice(picker.indexOf('const openRecent'), picker.indexOf('const loadMoreRecent'));

    expect(load).toContain('const requestId = ++recentRequestIdRef.current');
    expect(load).toContain('if (requestId !== recentRequestIdRef.current) return');
  });

  it('keeps the picker send promise pending until background upload reports success or failure', () => {
    const appState = source('../src/ui/app/AppState.tsx');
    const send = appState.slice(appState.indexOf('const sendAttachments ='), appState.indexOf('const sendAttachment ='));
    const worker = send.slice(send.indexOf('// 3. Perform bounded encryption'));

    expect(worker).toMatch(/await\s+\(async\s*\(\)\s*=>/);
    expect(worker).toContain("activeAttachments.find((attachment) => attachment.state === 'FAILED')?.error");
    expect(worker).toMatch(/throw new Error\(failureReason/);
  });
});
