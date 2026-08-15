import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { EncryptedInbox } from '../src/transport/inbox.ts';
import { createTransportEnvelope } from '../src/transport/envelope.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 3: Replay Protection & Deduplication Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let inbox: EncryptedInbox;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    inbox = new EncryptedInbox(store);
  });

  it('should accept first delivery of an envelope and reject duplicate replays', () => {
    vault.createSpace({ name: 'Main', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass');

    const env = createTransportEnvelope({
      mailboxId: 'target-mb-1',
      payload: 'PAYLOAD_1',
      sizeClass: 'SMALL',
    });

    // 1st delivery
    const firstRes = inbox.receiveEnvelope(session, env);
    expect(firstRes.accepted).toBe(true);
    expect(firstRes.duplicate).toBe(false);
    expect(inbox.listEnvelopes(session).length).toBe(1);

    // 2nd delivery (Replay / Duplicate Retry)
    const replayRes = inbox.receiveEnvelope(session, env);
    expect(replayRes.accepted).toBe(false);
    expect(replayRes.duplicate).toBe(true);

    // Inbox size must remain 1 (no duplicate insertion)
    expect(inbox.listEnvelopes(session).length).toBe(1);
  });

  it('should persist processed envelope IDs across lock/unlock cycles', () => {
    const envSpace = vault.createSpace({ name: 'Main', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session1 = vault.unlockSpace('Pass');

    const env = createTransportEnvelope({
      mailboxId: 'target-mb-1',
      payload: 'PAYLOAD_1',
      sizeClass: 'SMALL',
    });

    inbox.receiveEnvelope(session1, env);
    vault.lockSpace(envSpace.spaceId);

    // Re-unlock
    const session2 = vault.unlockSpace('Pass');
    expect(inbox.hasProcessed(session2, env.envelopeId)).toBe(true);

    // Replaying after re-unlocking should still be rejected as duplicate
    const replayRes = inbox.receiveEnvelope(session2, env);
    expect(replayRes.accepted).toBe(false);
    expect(replayRes.duplicate).toBe(true);
  });
});
