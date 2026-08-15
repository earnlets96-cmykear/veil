import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { MailboxRecord, RelayEnvelope } from '../src/server/types.ts';

describe('VEIL Phase 15: Persistent File-Backed Relay Store Tests', () => {
  const testDir = path.join(process.cwd(), '.tmp_test_relay_store');
  let store: PersistentFileRelayStore;

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    store = new PersistentFileRelayStore(testDir);
    await store.init();
  });

  afterEach(async () => {
    await store.destroyStore();
  });

  it('CRASH & RESTART RECOVERY: Envelopes survive store re-initialization', async () => {
    const mbRecord: MailboxRecord = {
      mailboxId: 'mb_persistent_01',
      capabilityHash: 'cap_hash_abc',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      lastActiveAt: Date.now(),
    };
    await store.createMailbox(mbRecord);

    const envRecord: RelayEnvelope = {
      protocolVersion: 'v1',
      envelopeId: 'env_001',
      mailboxId: 'mb_persistent_01',
      payload: 'opaque_ciphertext_base64',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      sizeBytes: 100,
    };
    await store.saveEnvelope(envRecord);
    await store.close();

    // Re-instantiate from same directory (simulate server restart)
    const restartedStore = new PersistentFileRelayStore(testDir);
    await restartedStore.init();

    const retrievedMb = await restartedStore.getMailbox('mb_persistent_01');
    expect(retrievedMb).not.toBeNull();
    expect(retrievedMb?.capabilityHash).toBe('cap_hash_abc');

    const envelopes = await restartedStore.listEnvelopes('mb_persistent_01', 10);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0].envelopeId).toBe('env_001');
    expect(envelopes[0].payload).toBe('opaque_ciphertext_base64');

    await restartedStore.close();
  });
});
