import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('Phase 135: Attachment send selection retention', () => {
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
});
