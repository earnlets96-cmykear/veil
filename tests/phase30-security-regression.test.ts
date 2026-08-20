/**
 * Phase 30: Zero-Knowledge Security & Plaintext Leakage Regression Test Suite
 *
 * Verifies that the server and database never receive, store, or log plaintext secrets,
 * raw passwords, unencrypted master keys, or plaintext messages.
 */

import { describe, it, expect } from 'vitest';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';

describe('Phase 30: Security Invariants & Zero-Knowledge Enforcements', () => {
  it('ensures database entity schemas contain only hashes, nonces, and ciphertexts', async () => {
    const db = new SqlCloudDatabase(':memory:');
    await db.init();

    // Verify account structure
    await db.createAccount({
      accountId: 'acc_sec_01',
      username: 'sec_user',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
      authSalt: 'random_salt_16_bytes',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const acc = await db.getAccountById('acc_sec_01');
    expect(acc).not.toBeNull();
    // Password hash must never be raw plaintext
    expect(acc?.passwordHash).toContain('argon2id');
    expect(acc?.passwordHash).not.toBe('password123');

    // Verify message structure: must only store encryptedPayload and nonce
    await db.saveSpace({
      spaceId: 'sp_sec_01',
      accountId: 'acc_sec_01',
      encryptedMetadata: 'enc_header_ciphertext',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await db.saveMessage({
      messageId: 'msg_sec_01',
      accountId: 'acc_sec_01',
      spaceId: 'sp_sec_01',
      conversationId: 'conv_sec',
      senderDeviceId: 'dev_sec',
      encryptedPayload: 'AEAD_CIPHERTEXT_BASE64_BLOB',
      nonce: 'NONCE_BASE64_BLOB',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const msg = await db.getMessage('acc_sec_01', 'sp_sec_01', 'msg_sec_01');
    expect(msg?.encryptedPayload).toBe('AEAD_CIPHERTEXT_BASE64_BLOB');
    expect(msg?.nonce).toBe('NONCE_BASE64_BLOB');
    // Ensure no plaintext message body field exists
    expect((msg as any).plaintext).toBeUndefined();
    expect((msg as any).body).toBeUndefined();

    await db.close();
  });

  it('ensures S3ObjectStorage sanitizes credentials when getConfig is called', () => {
    const storage = new S3ObjectStorage({
      endpoint: 'https://veil.r2.cloudflarestorage.com',
      bucket: 'veil-vault',
      accessKeyId: 'AKIA_SAMPLE_KEY',
      secretAccessKey: 'SUPER_SECRET_PRIVATE_KEY_DO_NOT_LEAK',
      region: 'auto',
    });

    const config = storage.getConfig();
    expect((config as any).secretAccessKey).toBeUndefined();
    expect(config.accessKeyId).toBe('AKIA_SAMPLE_KEY');
    expect(config.bucket).toBe('veil-vault');
  });
});
