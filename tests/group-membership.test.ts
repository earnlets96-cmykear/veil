import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { GroupStateManager } from '../src/group/groupState.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 5: Group Membership & Role Hierarchy Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('should enforce role hierarchy and permissions for creator, admin, and member', () => {
    vault.createSpace({ name: 'Creator', password: 'PassCreator', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Member1', password: 'PassMember1', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Member2', password: 'PassMember2', kdfParams: FAST_TEST_KDF_PARAMS });

    const sessCreator = vault.unlockSpace('PassCreator');
    const sessM1 = vault.unlockSpace('PassMember1');
    const sessM2 = vault.unlockSpace('PassMember2');

    const docCreator = idMgr.createIdentity(sessCreator, store);
    const idCreator = idMgr.loadIdentity(sessCreator, store)!;

    const docM1 = idMgr.createIdentity(sessM1, store);
    const idM1 = idMgr.loadIdentity(sessM1, store)!;

    const docM2 = idMgr.createIdentity(sessM2, store);

    // 1. Creator creates group
    const { state } = GroupStateManager.createGroup(
      docCreator.identityId,
      docCreator.signingPublicKey,
      idCreator.signingPrivateKey,
      { name: 'Core Team' }
    );

    // 2. Creator adds Member1 as MEMBER
    GroupStateManager.addMember(
      state,
      docCreator.identityId,
      idCreator.signingPrivateKey,
      docM1.identityId,
      docM1.signingPublicKey,
      'MEMBER'
    );
    expect(state.members[docM1.identityId].role).toBe('MEMBER');

    // 3. Member1 (role MEMBER) attempts to add Member2 -> REJECTED
    expect(() =>
      GroupStateManager.addMember(
        state,
        docM1.identityId,
        idM1.signingPrivateKey,
        docM2.identityId,
        docM2.signingPublicKey,
        'MEMBER'
      )
    ).toThrow(/Unauthorized/);

    // 4. Creator promotes Member1 to ADMIN
    GroupStateManager.updateRole(
      state,
      docCreator.identityId,
      idCreator.signingPrivateKey,
      docM1.identityId,
      'ADMIN'
    );
    expect(state.members[docM1.identityId].role).toBe('ADMIN');

    // 5. Member1 (now ADMIN) successfully adds Member2
    GroupStateManager.addMember(
      state,
      docM1.identityId,
      idM1.signingPrivateKey,
      docM2.identityId,
      docM2.signingPublicKey,
      'MEMBER'
    );
    expect(state.members[docM2.identityId]).toBeDefined();

    // 6. Admin attempts to remove Creator -> REJECTED
    expect(() =>
      GroupStateManager.removeMember(
        state,
        docM1.identityId,
        idM1.signingPrivateKey,
        docCreator.identityId
      )
    ).toThrow(/Cannot remove the group CREATOR/);
  });
});
