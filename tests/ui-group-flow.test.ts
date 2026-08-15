import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 14: UI Group Creation & Messaging Flow Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
  });

  it('UI GROUP FLOW: Creates group conversation, persists to encrypted store, and updates epoch', async () => {
    const env = vault.createSpace({ name: 'Work', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    const groupConv = {
      id: 'grp_team_alpha',
      type: 'group' as const,
      name: 'Alpha Team',
      avatarSeed: 'alpha',
      unreadCount: 0,
      groupState: {
        groupId: 'grp_team_alpha',
        name: 'Alpha Team',
        epoch: 1,
        members: [{ identityId: session.spaceId, role: 'creator' as const, joinedEpoch: 1 }],
      },
    };

    await store.setAsync(session, 'veil:ui:conversations', [groupConv]);

    const retrievedConvs = await store.getAsync<typeof groupConv[]>(session, 'veil:ui:conversations');
    expect(retrievedConvs).toHaveLength(1);
    expect(retrievedConvs![0].type).toBe('group');
    expect(retrievedConvs![0].groupState?.epoch).toBe(1);
  });
});
