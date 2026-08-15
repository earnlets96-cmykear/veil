import { describe, it, expect } from 'vitest';
import { InMemoryMediaRelay } from '../src/media/mediaStorage.ts';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { getRandomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Media Authorization & Capability Token Tests', () => {
  it('should enforce capability authorization on upload, download, and delete', async () => {
    const relay = new InMemoryMediaRelay();
    const plaintext = getRandomBytes(1024 * 10);
    const pkg = MediaEncryptor.encryptMedia(plaintext, { filename: 'test.png', mimeType: 'image/png', sizeBytes: plaintext.length });

    const validToken = 'cap_token_auth_12345';
    const invalidToken = 'cap_token_evil_99999';

    // 1. Upload without capability token -> REJECTED
    await expect(relay.uploadMedia(pkg.mediaId, pkg.chunks, '')).rejects.toThrow(/missing capability/);

    // 2. Upload with valid token -> SUCCESS
    const uploaded = await relay.uploadMedia(pkg.mediaId, pkg.chunks, validToken);
    expect(uploaded).toBe(true);

    // 3. Download with invalid token -> REJECTED
    await expect(relay.downloadMedia(pkg.mediaId, invalidToken)).rejects.toThrow(/unauthorized capability/);

    // 4. Download with valid token -> SUCCESS
    const downloaded = await relay.downloadMedia(pkg.mediaId, validToken);
    expect(downloaded).not.toBeNull();
    expect(downloaded!.length).toBe(pkg.chunks.length);

    // 5. Delete with invalid token -> REJECTED
    await expect(relay.deleteMedia(pkg.mediaId, invalidToken)).rejects.toThrow(/unauthorized capability/);

    // 6. Delete with valid token -> SUCCESS
    const deleted = await relay.deleteMedia(pkg.mediaId, validToken);
    expect(deleted).toBe(true);

    // 7. Download after deletion -> returns null
    const afterDelete = await relay.downloadMedia(pkg.mediaId, validToken);
    expect(afterDelete).toBeNull();
  });
});
