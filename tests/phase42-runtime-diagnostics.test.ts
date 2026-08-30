import { describe, it, expect, beforeEach } from 'vitest';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';

describe('Phase 42: Runtime Forensic Diagnostics & Secret Redaction Suite', () => {
  beforeEach(() => {
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();
  });

  it('records structured telemetry for all runtime categories', () => {
    RuntimeDiagnostics.media('thumbnailCreated', { attachmentId: 'att_01', mimeType: 'image/png', sizeBytes: 5000 });
    RuntimeDiagnostics.upload('uploadCompleted', { attachmentId: 'att_01', objectId: 'obj_01', uploadedBytes: 5050 });
    RuntimeDiagnostics.wire('wireDispatched', { msgId: 'msg_01', attachmentCount: 1, previewUrlPresent: false });
    RuntimeDiagnostics.receive('wireMessageReceived', { messageId: 'msg_01', attachmentCount: 1 });
    RuntimeDiagnostics.download('downloadCompleted', { objectId: 'obj_01', bytes: 5050 });
    RuntimeDiagnostics.decrypt('decryptionCompleted', { attachmentId: 'att_01', decryptedBytes: 5000, sha256Verified: true });
    RuntimeDiagnostics.video('metadataLoaded', { duration: 15.5, objectId: 'obj_01' });
    RuntimeDiagnostics.audio('seekRequested', { duration: 30, seekRequested: 50, targetTime: 15, actualCurrentTime: 15 });
    RuntimeDiagnostics.recovery('spaceRestoredSuccess', { spaceId: 'space_01', identityId: 'id_01' });

    const history = RuntimeDiagnostics.getHistory();
    expect(history.length).toBe(9);

    const categories = history.map((e) => e.category);
    expect(categories).toEqual([
      'MEDIA',
      'UPLOAD',
      'WIRE',
      'RECEIVE',
      'DOWNLOAD',
      'DECRYPT',
      'VIDEO',
      'AUDIO',
      'RECOVERY',
    ]);
  });

  it('strictly sanitizes and redacts all passwords, private keys, symmetric keys, and plaintext secrets', () => {
    RuntimeDiagnostics.recovery('testRedaction', {
      username: 'alice',
      password: 'SuperSecretPassword123!',
      masterKey: 'deadbeef00112233',
      signingPrivateKey: 'private_key_bytes',
      encryptionKey: 'symmetric_key_32_bytes',
      plaintextMessage: 'Confidential text here',
      publicInfo: 'safe_public_id',
    });

    const events = RuntimeDiagnostics.getHistory('RECOVERY');
    expect(events.length).toBe(1);

    const data = events[0].data;
    expect(data.username).toBe('alice');
    expect(data.publicInfo).toBe('safe_public_id');

    // All secrets must be redacted
    expect(data.password).toMatch(/^\[REDACTED/);
    expect(data.masterKey).toMatch(/^\[REDACTED/);
    expect(data.signingPrivateKey).toMatch(/^\[REDACTED/);
    expect(data.encryptionKey).toMatch(/^\[REDACTED/);
    expect(data.plaintextMessage).toMatch(/^\[REDACTED/);
  });
});
