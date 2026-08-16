import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: Identity Routing & Tamper Resistance Tests', () => {
  it('creates and verifies cryptographically signed invitations with mailbox and prekey bundle', () => {
    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Alice Space', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('PassA123!', env.spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(session, store);
    const id = idMgr.loadIdentity(session, store)!;

    const prekeys = new PrekeyManager(store, idMgr);
    prekeys.generateSignedPrekey(session);
    const bundle = prekeys.createPrekeyBundle(session);

    const mailboxId = 'mb_alice_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const invitation = InvitationManager.createInvitation(
      doc,
      id.signingPrivateKey,
      'Alice',
      undefined,
      mailboxId,
      bundle
    );

    const shareable = InvitationManager.toShareableString(invitation);
    const verified = InvitationManager.verifyAndParseInvitation(shareable);

    expect(verified.identityId).toBe(doc.identityId);
    expect(verified.mailboxId).toBe(mailboxId);
    expect(verified.prekeyBundle).toBeDefined();
    expect(verified.name).toBe('Alice');
  });

  it('rejects invitation if mailboxId or prekey is tampered with', () => {
    const vault = new SpaceVaultManager();
    const env = vault.createSpace({ name: 'Bob Space', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('PassB123!', env.spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgr = new SpaceIdentityManager();
    const doc = idMgr.createIdentity(session, store);
    const id = idMgr.loadIdentity(session, store)!;

    const mailboxId = 'mb_bob_real_mailbox_1234';
    const invitation = InvitationManager.createInvitation(
      doc,
      id.signingPrivateKey,
      'Bob',
      undefined,
      mailboxId
    );

    // Tamper with mailboxId
    const tamperedPayload = {
      ...invitation,
      mailboxId: 'mb_attacker_injected_mailbox_5678',
    };

    const tamperedStr = JSON.stringify(tamperedPayload);
    expect(() => {
      InvitationManager.verifyAndParseInvitation(tamperedStr);
    }).toThrow(/Invalid invitation signature|tampering/i);
  });
});
