import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const appState = fs.readFileSync(path.resolve('src/ui/app/AppState.tsx'), 'utf8');
const sendAttachments = appState.slice(appState.indexOf('const sendAttachments ='), appState.indexOf('const sendAttachment ='));
const retryFailedMessage = appState.slice(appState.indexOf('const retryFailedMessage ='), appState.indexOf('const editMessage ='));

describe('Phase 136 uploaded media retry', () => {
  it('reuses completed cloud uploads when only the encrypted message dispatch needs retrying', () => {
    expect(retryFailedMessage).toContain('retryUploadedAttachments: reusableUploads');
    expect(sendAttachments).toContain('const reusableUpload = options?.retryUploadedAttachments?.[idx]');
    expect(sendAttachments).toMatch(/if \(reusableUpload\?\.objectId\)[\s\S]*?activeAttachments\[idx\].*?state: 'SENT'[\s\S]*?continue;/);
  });

  it('does not mark a relayed message failed only because outbox cleanup failed', () => {
    const successPath = sendAttachments.slice(
      sendAttachments.indexOf("updateTimeline(activeAttachments, 'SENT_TO_RELAY')"),
      sendAttachments.indexOf("updateTimeline(activeAttachments, 'FAILED')", sendAttachments.indexOf("updateTimeline(activeAttachments, 'SENT_TO_RELAY')"))
    );
    expect(successPath).toMatch(/mediaOutbox\.removeMessage\(activeSession, msgId\)[\s\S]*?\.catch\(/);
  });
});
