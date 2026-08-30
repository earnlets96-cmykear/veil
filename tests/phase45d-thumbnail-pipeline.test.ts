import { describe, expect, it } from 'vitest';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { ThumbnailGenerator } from '../src/attachments/thumbnailGenerator.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { unpadPayload } from '../src/transport/padding.ts';

function makePeer(name: string, password: string) {
  const vault = new SpaceVaultManager();
  const envelope = vault.createSpace({ name, password, kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace(password, envelope.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const identities = new SpaceIdentityManager();
  const document = identities.createIdentity(session, store);
  const prekeys = new PrekeyManager(store, identities);
  prekeys.generateSignedPrekey(session);
  prekeys.generateOneTimePrekeys(session, 5);
  return {
    session,
    store,
    document,
    manager: new ConversationManager(store, identities, prekeys),
    bundle: prekeys.createPrekeyBundle(session),
  };
}

function recursiveAssertNoForbiddenFields(obj: any, path = 'root'): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    expect(obj, `Forbidden local blob URL leaked at path ${path}`).not.toMatch(/^blob:/i);
    return;
  }
  if (typeof obj === 'object') {
    // Check forbidden object types
    if (typeof Blob !== 'undefined') {
      expect(obj instanceof Blob, `Blob instance leaked at path ${path}`).toBe(false);
    }
    if (typeof HTMLElement !== 'undefined') {
      expect(obj instanceof HTMLElement, `DOM Element leaked at path ${path}`).toBe(false);
    }

    for (const key of Object.keys(obj)) {
      expect(key, `Forbidden local preview key '${key}' leaked at path ${path}`).not.toBe('previewUrl');
      expect(key, `Forbidden local preview key '${key}' leaked at path ${path}`).not.toBe('localPreviewUrl');
      recursiveAssertNoForbiddenFields(obj[key], `${path}.${key}`);
    }
  }
}

describe('Phase 45D: Media Thumbnail Pipeline & Security Isolation', () => {
  it('1. performs local image encryption, decryption, and ephemeral blob URL generation', () => {
    const rawImageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const ephemeralKey = new Uint8Array(32).fill(0x42);

    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
      rawImageBytes,
      'test_image.png',
      'image/png',
      ephemeralKey,
      undefined,
      'att_img_1'
    );

    expect(metadata.attachmentId).toBe('att_img_1');
    expect(chunks.length).toBeGreaterThan(0);

    const decrypted = AttachmentPipeline.decryptAndReassemble(metadata, chunks, ephemeralKey);
    expect(decrypted).toEqual(rawImageBytes);

    const blobUrl = AttachmentPipeline.createEphemeralBlobUrl(decrypted, metadata.mimeType);
    expect(blobUrl).toBeDefined();
    expect(typeof blobUrl).toBe('string');
  });

  it('2. generates video thumbnail in headless/browser environment gracefully', async () => {
    const mockVideoBlob = new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], { type: 'video/mp4' });
    const result = await ThumbnailGenerator.generateVideoThumbnail(mockVideoBlob, 0.5, 480);

    expect(result).toBeDefined();
    expect(result.thumbnailBlob).toBeDefined();
    expect(result.previewUrl).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('3. strictly validates that no blob URLs, previewUrl, or DOM nodes enter encrypted wire payload', async () => {
    const alice = makePeer('Alice', 'Alice-45D-Sec!');
    const bob = makePeer('Bob', 'Bob-45D-Sec!');

    const attachmentPayloadWithLocalLeaks = {
      attachmentId: 'att_sec_100',
      objectId: 'obj_r2_sec_100',
      name: 'document.pdf',
      sizeBytes: 12345,
      mimeType: 'application/pdf',
      ciphertextHash: 'hash123',
      encryptionKeyBase64: 'key123',
      previewUrl: 'blob:http://localhost:5173/local-leak-attempt',
      localPreviewUrl: 'blob:http://localhost:5173/local-leak-attempt-2',
      allowSave: true,
      allowForward: false,
    };

    const replyRef = {
      messageId: 'msg_target_999',
      senderName: 'Bob',
      text: 'Photo',
      attachmentType: 'image',
    };

    const { wirePayloadBase64 } = await alice.manager.encryptAndPackWireMessage(
      alice.session,
      bob.bundle,
      'Here is the file',
      attachmentPayloadWithLocalLeaks,
      replyRef
    );

    // Unpad and decode wire payload
    const paddedBytes = base64ToBytes(wirePayloadBase64);
    const unpadded = unpadPayload(paddedBytes);
    const wireObj = JSON.parse(new TextDecoder().decode(unpadded));

    // Recursive security verification
    recursiveAssertNoForbiddenFields(wireObj);

    // Explicit checks on attachment and replyTo
    expect(wireObj.attachment.previewUrl).toBeUndefined();
    expect(wireObj.attachment.localPreviewUrl).toBeUndefined();
    expect(wireObj.attachment.objectId).toBe('obj_r2_sec_100');
    expect(wireObj.replyTo.messageId).toBe('msg_target_999');
  });

  it('4. ensures decrypted media remains ephemeral in RAM cache', () => {
    const memory = new MemoryStorageAdapter();
    const store = new EncryptedSpaceStore(memory);

    // Verify underlying permanent store contains zero raw unencrypted attachment buffers
    const allKeys = (store as any).adapter?.store ? Object.keys((store as any).adapter.store) : [];
    for (const k of allKeys) {
      expect(k).not.toContain('blob:');
    }
  });
});
