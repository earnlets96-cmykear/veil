import { describe, it, expect } from 'vitest';
import { toWireAttachment, toWireAttachments, assertWireSafe } from '../src/attachments/types.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { randomBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { initiateX3DH } from '../src/ratchet/x3dh.ts';

describe('Phase 41: Wire Payload Isolation & Defensive Serializer Boundary', () => {
  it('toWireAttachment strictly strips previewUrl, localPreviewUrl, and non-protocol properties', () => {
    const localAttachment = {
      attachmentId: 'att_test_123',
      objectId: 'obj_cloud_456',
      name: 'vacation.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1048576,
      chunkCount: 16,
      chunkSize: 65536,
      sha256Hash: 'a'.repeat(64),
      ciphertextHash: 'b'.repeat(64),
      encryptionKeyBase64: bytesToBase64(randomBytes(32)),
      previewUrl: 'blob:http://localhost:5173/bad-sender-memory-url-1',
      localPreviewUrl: 'blob:http://localhost:5173/bad-sender-memory-url-2',
      state: 'UPLOADING',
      error: 'temporary upload error',
      progressPercent: 45,
      allowSave: true,
      allowForward: false,
    };

    const wire = toWireAttachment(localAttachment);

    // Assert protocol-safe fields exist
    expect(wire.attachmentId).toBe('att_test_123');
    expect(wire.objectId).toBe('obj_cloud_456');
    expect(wire.name).toBe('vacation.jpg');
    expect(wire.mimeType).toBe('image/jpeg');
    expect(wire.sizeBytes).toBe(1048576);
    expect(wire.chunkCount).toBe(16);
    expect(wire.chunkSize).toBe(65536);
    expect(wire.sha256Hash).toBe('a'.repeat(64));
    expect(wire.ciphertextHash).toBe('b'.repeat(64));
    expect(wire.allowSave).toBe(true);
    expect(wire.allowForward).toBe(false);

    // Assert local UI state is completely omitted
    expect((wire as any).previewUrl).toBeUndefined();
    expect((wire as any).localPreviewUrl).toBeUndefined();
    expect((wire as any).state).toBeUndefined();
    expect((wire as any).error).toBeUndefined();
    expect((wire as any).progressPercent).toBeUndefined();

    // Stringified wire attachment must not contain 'blob:'
    expect(JSON.stringify(wire).includes('blob:')).toBe(false);
  });

  it('assertWireSafe throws if a blob URL or previewUrl accidentally enters wire payload', () => {
    const invalidPayload = {
      version: 1,
      attachment: {
        attachmentId: 'att_123',
        previewUrl: 'blob:http://localhost:5173/abc',
      },
    };

    expect(() => assertWireSafe(invalidPayload)).toThrow(/Wire payload violation.*previewUrl/);

    const blobUrlPayload = {
      version: 1,
      url: 'blob:http://localhost:5173/direct-blob',
    };

    expect(() => assertWireSafe(blobUrlPayload)).toThrow(/Wire payload violation.*blob URL/);
  });

  it('encryptAndPackWireMessage serializes attachments cleanly without blob: URLs', async () => {
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const prekeyMgr = new PrekeyManager(store, idMgr);
    const convMgr = new ConversationManager(store, idMgr, prekeyMgr);

    const sessionA = new SpaceSession('space_a', 'Space A', false, randomBytes(32));
    const sessionB = new SpaceSession('space_b', 'Space B', false, randomBytes(32));

    idMgr.createIdentity(sessionA, store, 'Alice');
    idMgr.createIdentity(sessionB, store, 'Bob');

    const bobPrekeyBundle = prekeyMgr.createPrekeyBundle(sessionB);

    const localAtt = {
      attachmentId: 'att_wire_test',
      objectId: 'obj_wire_test',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 50000,
      chunkCount: 1,
      chunkSize: 65536,
      sha256Hash: 'c'.repeat(64),
      encryptionKeyBase64: bytesToBase64(randomBytes(32)),
      previewUrl: 'blob:http://localhost:5173/should-not-cross-wire',
    };

    const { wirePayloadBase64 } = await convMgr.encryptAndPackWireMessage(
      sessionA,
      bobPrekeyBundle,
      'Test message',
      localAtt
    );

    expect(wirePayloadBase64).toBeDefined();
    // Decode base64 and verify raw wire JSON lacks 'blob:'
    const wireStr = Buffer.from(wirePayloadBase64, 'base64').toString('utf8');
    expect(wireStr.includes('blob:')).toBe(false);
    expect(wireStr.includes('should-not-cross-wire')).toBe(false);
  });
});
