import { describe, it, expect } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 13: Offline Message Queuing & Restart Persistence Recovery Tests', () => {
  it('OFFLINE RECOVERY: Enqueues messages while offline -> survives app restart -> flushes upon reconnection', async () => {
    const storageAdapter = new MemoryStorageAdapter();
    await storageAdapter.init();

    // =========================================================================
    // STEP 1: Application Instance 1 (Offline)
    // =========================================================================
    const vault1 = new SpaceVaultManager();
    const store1 = new EncryptedSpaceStore(storageAdapter);

    const envA = vault1.createSpace({ name: 'Space A', password: 'PasswordA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    await vault1.saveEnvelopeToStorage(envA, storageAdapter);

    const sessionA1 = vault1.unlockSpace('PasswordA123!', envA.spaceId);

    // NetworkManager pointed to offline URL
    const netManager1 = new NetworkManager(store1, {
      httpUrl: 'http://127.0.0.1:59999', // Dead offline port
    });

    const dummyMailboxB = 'b'.repeat(64);
    const msg1Payload = Buffer.from('Offline Message 1').toString('base64');
    const msg2Payload = Buffer.from('Offline Message 2').toString('base64');

    // Send while offline
    const queued1 = await netManager1.sendEnvelope(sessionA1, dummyMailboxB, msg1Payload);
    const queued2 = await netManager1.sendEnvelope(sessionA1, dummyMailboxB, msg2Payload);

    expect(queued1.status).toBe('QUEUED');
    expect(queued2.status).toBe('QUEUED');

    // Verify 2 items in outbound queue
    const pending1 = await netManager1.getQueue().listOutbound(sessionA1);
    expect(pending1).toHaveLength(2);

    // Close / Lock Instance 1
    vault1.lockAll();

    // =========================================================================
    // STEP 2: Start Relay Server
    // =========================================================================
    const server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const { port } = await server.start();

    // Allocate Mailbox B on relay
    const mbBRes = await fetch(`http://127.0.0.1:${port}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mbB = await mbBRes.json();

    // =========================================================================
    // STEP 3: Application Instance 2 (Restarting & Reconnecting)
    // =========================================================================
    const vault2 = new SpaceVaultManager();
    const store2 = new EncryptedSpaceStore(storageAdapter);
    await vault2.loadEnvelopesFromStorage(storageAdapter);

    const sessionA2 = vault2.unlockSpace('PasswordA123!', envA.spaceId);
    await store2.loadPartitionFromStorage(sessionA2);

    const netManager2 = new NetworkManager(store2, {
      httpUrl: `http://127.0.0.1:${port}`,
      wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
    });

    // Verify persistent queue survived restart
    const restoredQueue = await netManager2.getQueue().listOutbound(sessionA2);
    expect(restoredQueue).toHaveLength(2);

    // Update target mailbox to real mailbox B and flush
    restoredQueue[0].mailboxId = mbB.mailboxId;
    restoredQueue[1].mailboxId = mbB.mailboxId;
    await store2.setAsync(sessionA2, 'net_outbound_queue', restoredQueue);

    const flushedCount = await netManager2.flushOutboundQueue(sessionA2);
    expect(flushedCount).toBe(2);

    // Outbound queue is now empty
    const remainingQueue = await netManager2.getQueue().listOutbound(sessionA2);
    expect(remainingQueue).toHaveLength(0);

    // Verify relay received both envelopes
    const fetchRes = await fetch(`http://127.0.0.1:${port}/v1/envelopes/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailboxId: mbB.mailboxId,
        capabilityToken: mbB.capabilityToken,
      }),
    });
    const fetchBody = await fetchRes.json();
    expect(fetchBody.envelopes).toHaveLength(2);

    await server.stop();
  });
});
