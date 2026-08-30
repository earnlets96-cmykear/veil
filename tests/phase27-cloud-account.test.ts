/**
 * VEIL Phase 27: Persistent Cloud Account & Multi-Device Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';

describe('VEIL Phase 27: Cloud Account & Multi-Device Management', () => {
  let server: RelayServer;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;
  let serverUrl: string;
  let clientA: CloudClient;
  let clientB: CloudClient;

  beforeEach(async () => {
    cloudDb = new MemoryCloudDatabase();
    objectStorage = new LocalDiskObjectStorage();
    const relayStore = new MemoryRelayStore();

    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      relayStore,
      cloudDb,
      objectStorage
    );

    const addr = await server.start();
    serverUrl = `http://127.0.0.1:${addr.port}`;

    clientA = new CloudClient({ baseUrl: serverUrl });
    clientB = new CloudClient({ baseUrl: serverUrl });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('ACCOUNT REGISTRATION & LOGIN: Creates persistent account and issues session token', async () => {
    const regResult = await clientA.registerAccount({
      username: '@alice_cloud',
      password: 'SuperSecretPassword123!',
      deviceId: 'dev_laptop_1',
      deviceName: 'Alice Laptop',
      recoveryAnchor: 'anchor_secret_mnemonic_hash_123',
    });

    expect(regResult.account.username).toBe('alice_cloud');
    expect(regResult.account.accountId).toMatch(/^acc_/);
    expect(regResult.device.deviceId).toBe('dev_laptop_1');
    expect(regResult.session.sessionToken).toBeDefined();

    // Login from secondary client
    const loginResult = await clientB.loginAccount({
      username: '@alice_cloud',
      password: 'SuperSecretPassword123!',
      deviceId: 'dev_phone_2',
      deviceName: 'Alice Phone',
    });

    expect(loginResult.account.accountId).toBe(regResult.account.accountId);
    expect(loginResult.device.deviceId).toBe('dev_phone_2');
    expect(loginResult.session.sessionToken).toBeDefined();

    // Verify both devices listed
    const devices = await clientA.listDevices();
    expect(devices.length).toBe(2);
    expect(devices.map((d) => d.deviceId)).toContain('dev_laptop_1');
    expect(devices.map((d) => d.deviceId)).toContain('dev_phone_2');
  });

  it('AUTH REJECTION: Rejects invalid password, duplicate username, and revoked session', async () => {
    await clientA.registerAccount({
      username: '@bob_cloud',
      password: 'CorrectPassword123!',
      deviceId: 'dev_bob_1',
    });

    // 1. Duplicate username
    await expect(
      clientB.registerAccount({
        username: '@bob_cloud',
        password: 'OtherPassword123!',
        deviceId: 'dev_bob_2',
      })
    ).rejects.toThrow(/already registered/i);

    // 2. Invalid password
    await expect(
      clientB.loginAccount({
        username: '@bob_cloud',
        password: 'WrongPassword123!',
        deviceId: 'dev_bob_2',
      })
    ).rejects.toThrow(/invalid username or password/i);

    // 3. Logout / Session revocation
    await clientA.logout();
    await expect(clientA.listDevices()).rejects.toThrow(/unauthorized/i);
  });

  it('AUTHENTICATION RECOVERY: Resets password via recovery anchor challenge', async () => {
    await clientA.registerAccount({
      username: '@charlie_cloud',
      password: 'OldPassword123!',
      deviceId: 'dev_charlie_1',
      recoveryAnchor: 'anchor_challenge_token_999',
    });

    // Reset password using recovery endpoint
    const resetRes = await fetch(`${serverUrl}/v1/account/recovery/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '@charlie_cloud',
        recoveryAnchor: 'anchor_challenge_token_999',
        newPassword: 'NewBrandPassword456!',
      }),
    });
    expect(resetRes.status).toBe(200);

    // Old password fails
    await expect(
      clientB.loginAccount({
        username: '@charlie_cloud',
        password: 'OldPassword123!',
        deviceId: 'dev_charlie_2',
      })
    ).rejects.toThrow(/invalid username or password/i);

    // New password succeeds
    const newLogin = await clientB.loginAccount({
      username: '@charlie_cloud',
      password: 'NewBrandPassword456!',
      deviceId: 'dev_charlie_2',
    });
    expect(newLogin.session.sessionToken).toBeDefined();
  });

  it('CLIENT-ENCRYPTED RECOVERY VAULT: Stores and retrieves client-encrypted blob', async () => {
    await clientA.registerAccount({
      username: '@dave_cloud',
      password: 'DavePassword123!',
      deviceId: 'dev_dave_1',
    });

    const encryptedVaultPayload = 'BASE64_ENCRYPTED_CLIENT_VAULT_CIPHERTEXT_XYZ';
    const kdfParams = { algorithm: 'argon2id', iterations: 3 };

    await clientA.setRecoveryVault(encryptedVaultPayload, kdfParams);

    const retrieved = await clientA.getRecoveryVault();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.encryptedVaultBlob).toBe(encryptedVaultPayload);
  });
});
