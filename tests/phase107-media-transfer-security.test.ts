import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { base64ToBytes } from '../src/crypto/utils.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { prepareMediaUpload } from '../src/attachments/mediaTransfer.ts';

describe('outgoing media encryption boundary', () => {
  it('prepares ciphertext that decrypts only with its generated media key', async () => {
    const plaintext = new Uint8Array([10, 20, 30, 40]);
    const prepared = await prepareMediaUpload(plaintext, {
      name: 'sample.bin',
      mimeType: 'application/octet-stream',
      attachmentId: 'att_test_01',
    });
    const chunks = JSON.parse(new TextDecoder().decode(prepared.ciphertext));
    const metadata = {
      attachmentId: prepared.attachment.attachmentId,
      name: prepared.attachment.name,
      mimeType: prepared.attachment.mimeType,
      sizeBytes: prepared.attachment.sizeBytes,
      chunkCount: prepared.attachment.chunkCount!,
      chunkSize: prepared.attachment.chunkSize!,
      sha256Hash: prepared.attachment.sha256Hash!,
    };

    expect(Array.from(prepared.ciphertext)).not.toEqual(Array.from(plaintext));
    expect(prepared.attachment.encryptionKeyBase64).not.toBe('');
    expect(await AttachmentPipeline.decryptProgressiveAsync(metadata, chunks, base64ToBytes(prepared.attachment.encryptionKeyBase64))).toEqual(plaintext);
    await expect(AttachmentPipeline.decryptProgressiveAsync(metadata, chunks, new Uint8Array(32))).rejects.toThrow();
  });

  it('encrypts attachment bytes before upload and includes decryption metadata', () => {
    const fullSource = fs.readFileSync(path.resolve(__dirname, '../src/ui/app/AppState.tsx'), 'utf8');
    const source = fullSource.slice(fullSource.indexOf('const sendAttachments ='), fullSource.indexOf('const sendAttachment ='));
    expect(source).toContain('prepareMediaUpload');
    expect(source.indexOf('await mediaOutbox.enqueue')).toBeGreaterThan(-1);
    expect(source.indexOf('await mediaOutbox.enqueue')).toBeLessThan(source.indexOf('cloudClient.createAttachment'));
    expect(source).not.toContain('uploadAttachment(objectId, fileBytes');
    expect(source).not.toContain("encryptionKeyBase64: ''");
  });

  it('uses a prepared encrypted transfer for outgoing voice notes', () => {
    const fullSource = fs.readFileSync(path.resolve(__dirname, '../src/attachments/voiceRecorder.ts'), 'utf8');
    const source = fullSource.slice(fullSource.indexOf('public static async uploadVoiceNote'), fullSource.indexOf('public static async encryptAndUploadVoiceNote'));
    expect(source).toContain('prepareMediaUpload');
    expect(source).not.toContain('uploadAttachment(attachment.objectId, audioBytes');
  });

  it('restores retry bytes from the encrypted outbox after memory cache is gone', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/ui/app/AppState.tsx'), 'utf8');
    const retry = source.slice(source.indexOf('const retryFailedMessage ='), source.indexOf('const editMessage ='));
    expect(retry).toContain('restoreOutboxFile');
    expect(source).toContain('mediaOutbox.getCiphertext');
    expect(source).toContain('decryptProgressiveAsync');
    expect(source).toContain('await retryFailedMessage(item.conversationId, messageId)');
  });
});
