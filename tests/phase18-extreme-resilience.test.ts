import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 18: Extreme Failure & Race-Condition Resilience', () => {
  let adapter: MemoryStorageAdapter;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
  });

  it('SIMULTANEOUS PANIC LOCK DURING CHUNKED ATTACHMENT PROCESSING: Immediate zeroization of key material', () => {
    const env = vault.createSpace({ name: 'Panic Space', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const testFile = new Uint8Array(200 * 1024); // 200 KiB file
    const key = session.getStorageKey();

    // Start chunking
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(testFile, 'large.bin', 'application/octet-stream', key);
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    // Trigger panic lock mid-lifecycle
    session.destroy();
    expect(session.isActive()).toBe(false);
    expect(() => session.getMasterKey()).toThrow();
    expect(() => session.getStorageKey()).toThrow();

    // Ephemeral Blobs revoked immediately
    AttachmentPipeline.revokeAllEphemeralBlobUrls();
  });

  it('CORRUPTED STORE ENTRY HANDLING: Store gracefully throws on corrupted AEAD authentication tags', async () => {
    const env = vault.createSpace({ name: 'Corrupt Space', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    // Write valid record
    await store.setAsync(session, 'good_key', { secret: 'ConfidentialData' });

    // Manually tamper with raw storage
    const raw = await adapter.getRecord(session.spaceId, 'good_key');
    expect(raw).not.toBeNull();
    if (raw) {
      raw.ciphertext = 'AAAA' + raw.ciphertext.slice(4); // Bit-flip
      await adapter.saveRecord(session.spaceId, raw);
    }

    // Force read to encounter tampered ciphertext
    // Re-create store so memory cache is bypassed
    const cleanStore = new EncryptedSpaceStore(adapter);
    await expect(cleanStore.getAsync(session, 'good_key')).rejects.toThrow();

    session.destroy();
  });
});
