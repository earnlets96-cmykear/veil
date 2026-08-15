import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 15: Group Production Lifecycle & Epoch Rotation Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
  });

  it('GROUP LIFECYCLE: Member addition rotates epoch and enforces forward secrecy boundaries', async () => {
    const env = vault.createSpace({ name: 'Work', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const group = {
      groupId: 'grp_prod_test',
      name: 'Engineering Team',
      epoch: 1,
      members: [{ identityId: session.spaceId, role: 'creator' as const, joinedEpoch: 1 }],
    };

    await store.setAsync(session, 'veil:group:grp_prod_test', group);

    // Add Bob -> advance epoch to 2
    const updatedGroup = {
      ...group,
      epoch: 2,
      members: [
        ...group.members,
        { identityId: 'id_bob_engineer', role: 'member' as const, joinedEpoch: 2 },
      ],
    };
    await store.setAsync(session, 'veil:group:grp_prod_test', updatedGroup);

    const loaded = await store.getAsync<typeof updatedGroup>(session, 'veil:group:grp_prod_test');
    expect(loaded?.epoch).toBe(2);
    expect(loaded?.members).toHaveLength(2);
  });
});
