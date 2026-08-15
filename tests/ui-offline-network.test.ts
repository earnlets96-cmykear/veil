import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 14: UI Offline Network Mode Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let netManager: NetworkManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    netManager = new NetworkManager(store, {
      httpUrl: 'http://127.0.0.1:59999', // Unreachable port to simulate offline state
    });
  });

  it('OFFLINE OUTBOUND DISPLAY: Queues messages locally when offline with QUEUED status', async () => {
    const env = vault.createSpace({ name: 'Personal', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const queued = await netManager.sendEnvelope(session, 'peer_mailbox_target', 'Offline Payload');
    expect(queued.status).toBe('QUEUED');

    // Stored in persistent queue
    const pending = await netManager.getQueue().listOutbound(session);
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toBe('Offline Payload');
  });
});
