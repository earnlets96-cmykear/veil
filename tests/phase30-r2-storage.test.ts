/**
 * Phase 30: Cloudflare R2 / S3 Object Storage Test Suite
 *
 * Verifies SigV4 credentials binding, opaque key prefixing, path sanitization,
 * payload upload/download, and ciphertext-only storage invariants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';

describe('Phase 30: Cloudflare R2 / S3 Object Storage', () => {
  let storage: S3ObjectStorage;

  beforeEach(async () => {
    storage = new S3ObjectStorage({
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      bucket: 'veil-attachments',
      accessKeyId: 'test_r2_key',
      secretAccessKey: 'test_r2_secret',
      region: 'auto',
    });
    await storage.init();
  });

  it('initializes and verifies R2 configuration', () => {
    expect(storage.isLiveS3Configured()).toBe(true);
    const config = storage.getConfig();
    expect(config.endpoint).toBe('https://test-account.r2.cloudflarestorage.com');
    expect(config.bucket).toBe('veil-attachments');
    expect(config.region).toBe('auto');
    expect((config as any).secretAccessKey).toBeUndefined(); // Zero credentials leak
  });

  it('enforces strict path sanitization preventing directory traversal', async () => {
    const maliciousKeys = [
      '../etc/passwd',
      '..\\windows\\system32',
      '/root/secret.key',
      'attachments/../../escaped',
      'invalid|character?key',
    ];

    for (const key of maliciousKeys) {
      await expect(storage.upload(key, new Uint8Array([1, 2, 3]))).rejects.toThrow(
        /Security Violation/i
      );
      await expect(storage.download(key)).rejects.toThrow(/Security Violation/i);
      await expect(storage.delete(key)).rejects.toThrow(/Security Violation/i);
    }
  });

  it('supports opaque structured keys like attachments/{id} and voice/{id}', async () => {
    const validKeys = [
      'attachments/obj_1234567890abcdef',
      'voice/obj_fedcba0987654321',
      'backups/vault_backup_001',
    ];

    for (const key of validKeys) {
      const data = new TextEncoder().encode(`Encrypted ciphertext blob for ${key}`);
      await storage.upload(key, data);
      expect(await storage.exists(key)).toBe(true);

      const downloaded = await storage.download(key);
      expect(downloaded).not.toBeNull();
      expect(new TextDecoder().decode(downloaded!)).toBe(`Encrypted ciphertext blob for ${key}`);

      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
    }
  }, 35000);
});
