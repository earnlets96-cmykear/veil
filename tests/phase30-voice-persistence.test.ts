import { describe, it, expect } from 'vitest';
import { SpaceVault } from '../src/spaces/vault.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 30: Voice Messaging & AEAD Cloud Persistence', () => {
  it('encrypts voice note, uploads to R2/S3 storage, and decrypts successfully', async () => {
    const store = new MemoryStorageAdapter();
    const vault = new SpaceVault(store);
    const envelope = vault.createSpace({
      name: 'Voice Space',
      password: 'secure-voice-pass',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });
    const session = vault.unlockSpace('secure-voice-pass', envelope.spaceId);

    const storage = new S3ObjectStorage();
    await storage.init();

    // 1. Generate synthetic audio PCM samples
    const mockAudio = new Uint8Array(8192);
    for (let i = 0; i < mockAudio.length; i++) mockAudio[i] = (i * 7) % 256;

    // 2. Encrypt audio using ephemeral AEAD key and authenticated space context
    const ephemeralKey = randomBytes(32);
    const aad = new TextEncoder().encode(`VEIL-VOICE-v1|spaceId:${session.spaceId}`);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(
      ephemeralKey,
      mockAudio,
      aad
    );

    expect(ciphertext).toBeDefined();
    expect(nonce).toBeDefined();

    // 3. Upload encrypted payload to Cloudflare R2 / S3
    const objectKey = `voice/obj_${Date.now()}`;
    await storage.upload(objectKey, ciphertext);

    // 4. Download encrypted payload
    const downloadedCiphertext = await storage.download(objectKey);
    expect(downloadedCiphertext).not.toBeNull();

    // 5. Decrypt downloaded voice note
    const decryptedAudio = decryptXChaCha20Poly1305(
      ephemeralKey,
      nonce,
      downloadedCiphertext!,
      aad
    );

    expect(decryptedAudio).toEqual(mockAudio);
    await storage.close();
  });
});
