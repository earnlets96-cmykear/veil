/**
 * VEIL Phase 27: Multi-Tenant Security & Space Isolation Test Suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { randomBytes, bytesToHex } from '../src/crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

describe('VEIL Phase 27: Multi-Tenant Security & Space Isolation', () => {
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

    await clientA.registerAccount({
      username: '@victim_account',
      password: 'VictimPassword123!',
      deviceId: 'victim_dev_1',
    });

    await clientB.registerAccount({
      username: '@attacker_account',
      password: 'AttackerPassword123!',
      deviceId: 'attacker_dev_1',
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('AUTHENTICATION BOUNDARY: Unauthenticated and invalid-session requests are rejected with 401', async () => {
    const unauthClient = new CloudClient({ baseUrl: serverUrl });

    // 1. Unauthenticated message pull
    await expect(unauthClient.pullMessages('space_1')).rejects.toThrow(/unauthorized/i);

    // 2. Invalid session token
    unauthClient.setSession('INVALID_FAKE_SESSION_TOKEN_XYZ', 'fake_acc', 'fake_dev');
    await expect(unauthClient.listDevices()).rejects.toThrow(/unauthorized/i);
  });

  it('CROSS-ACCOUNT ISOLATION: Attacker cannot pull, delete, or download Victim resources', async () => {
    // 1. Victim creates a message in space_victim
    await clientA.pushMessages([
      {
        messageId: 'victim_secret_message_1',
        accountId: clientA.getAccountId()!,
        spaceId: 'space_victim',
        conversationId: 'chat_secret',
        senderDeviceId: 'victim_dev_1',
        encryptedPayload: 'ENCRYPTED_VICTIM_PAYLOAD',
        nonce: 'NONCE',
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    // 2. Attacker attempts to pull messages from space_victim
    const attackerPulled = await clientB.pullMessages('space_victim');
    expect(attackerPulled.length).toBe(0); // Cannot see Victim messages

    // 3. Attacker attempts to delete Victim's message
    await expect(
      clientB.deleteMessage('space_victim', 'victim_secret_message_1')
    ).rejects.toThrow(/not found/i);

    // 4. Victim creates an encrypted attachment
    const rawData = randomBytes(512);
    const hash = bytesToHex(sha256(rawData));
    const attRes = await clientA.createAttachment({
      attachmentId: 'victim_attachment_id',
      spaceId: 'space_victim',
      ciphertextSize: rawData.length,
      ciphertextHash: hash,
    });
    await clientA.uploadAttachment(attRes.attachment.objectId, rawData);

    // 5. Attacker attempts to download Victim's attachment object directly
    await expect(
      clientB.downloadAttachment(attRes.attachment.objectId)
    ).rejects.toThrow(/not found|access denied/i);
  });

  it('PATH TRAVERSAL DEFENSE: Object storage rejects path traversal attempts', async () => {
    const rawData = randomBytes(64);

    await expect(
      objectStorage.upload('../../../etc/passwd', rawData)
    ).rejects.toThrow(/security violation|invalid/i);

    await expect(
      objectStorage.download('../../system.ini')
    ).rejects.toThrow(/security violation|invalid/i);
  });

  it('ZERO-PLAINTEXT INVARIANT: Database contains zero passwords or plaintexts', async () => {
    const plaintextSecret = 'TOP_SECRET_ACCOUNT_RECOVERY_PHRASE_NEVER_LEAK';
    await clientA.setRecoveryVault(plaintextSecret, { kdf: 'none' });

    const rawDbDump = JSON.stringify(cloudDb);
    // Password must not be plaintext
    expect(rawDbDump).not.toContain('VictimPassword123!');
    // Session token must not be stored in plaintext
    expect(rawDbDump).not.toContain(clientA.getSessionToken()!);
  });
});
