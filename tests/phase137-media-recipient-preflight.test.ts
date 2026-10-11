import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { resolveMediaRecipientProfile } from '../src/messaging/mediaRecipientPreflight.ts';

function makeProfile(username = 'media_peer') {
  const vault = new SpaceVaultManager();
  const envelope = vault.createSpace({ name: 'Peer', password: 'Pass!', kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace('Pass!', envelope.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const identities = new SpaceIdentityManager();
  const document = identities.createIdentity(session, store);
  const keys = identities.loadIdentity(session, store)!;
  const prekeys = new PrekeyManager(store, identities);
  prekeys.generateSignedPrekey(session);
  const profile = createSignedProfile(
    document.identityId,
    keys.signingPrivateKey,
    username,
    'Media Peer',
    'mailbox-media-peer',
    prekeys.createPrekeyBundle(session)
  );
  return { profile, session, identities };
}

describe('media recipient key preflight', () => {
  it('resolves a correctly signed profile for the selected identity', async () => {
    const { profile } = makeProfile();
    const directory = {
      getProfileByIdentity: vi.fn().mockResolvedValue(profile),
      getProfileByUsername: vi.fn(),
    };

    await expect(resolveMediaRecipientProfile(profile.identityId, null, directory)).resolves.toEqual(profile);
    expect(directory.getProfileByIdentity).toHaveBeenCalledWith(profile.identityId);
    expect(directory.getProfileByUsername).not.toHaveBeenCalled();
  });

  it('rejects tampered, mismatched, and signing-key-replaced directory profiles', async () => {
    const { profile } = makeProfile();
    const differentPeer = makeProfile('other_peer').profile;
    const directory = {
      getProfileByIdentity: vi.fn().mockResolvedValue({ ...profile, mailboxId: 'attacker-mailbox' }),
      getProfileByUsername: vi.fn().mockResolvedValue(differentPeer),
    };

    await expect(resolveMediaRecipientProfile(profile.identityId, {
      identityId: profile.identityId,
      signingPublicKey: differentPeer.prekeyBundle.identityDocument.signingPublicKey,
      accountUsername: profile.username,
      name: profile.displayName,
    }, directory)).resolves.toBeNull();
  });

  it('rejects a valid profile when its signing key differs from the contact pin', async () => {
    const { profile } = makeProfile();
    const otherPeer = makeProfile('other_peer').profile;
    const directory = {
      getProfileByIdentity: vi.fn().mockResolvedValue(profile),
      getProfileByUsername: vi.fn(),
    };

    await expect(resolveMediaRecipientProfile(profile.identityId, {
      identityId: profile.identityId,
      signingPublicKey: otherPeer.prekeyBundle.identityDocument.signingPublicKey,
    }, directory)).resolves.toBeNull();
  });

  it('uses username fallback only when the returned profile still matches the chosen identity', async () => {
    const { profile } = makeProfile();
    const directory = {
      getProfileByIdentity: vi.fn().mockResolvedValue(null),
      getProfileByUsername: vi.fn().mockResolvedValue(profile),
    };

    await expect(resolveMediaRecipientProfile(profile.identityId, {
      identityId: profile.identityId,
      accountUsername: profile.username,
      name: profile.displayName,
    }, directory)).resolves.toEqual(profile);
    expect(directory.getProfileByUsername).toHaveBeenCalledWith(profile.username);
  });

  it('preflights direct recipients before the composer dismisses selections or upload work starts', () => {
    const appState = fs.readFileSync(path.resolve('src/ui/app/AppState.tsx'), 'utf8');
    const sendAttachments = appState.slice(appState.indexOf('const sendAttachments ='), appState.indexOf('const sendAttachment ='));
    const preflight = sendAttachments.indexOf('resolveMediaRecipientProfile(');
    const uploadStarted = sendAttachments.indexOf('options?.onUploadStarted?.()');
    const worker = sendAttachments.indexOf('const uploadWorker = async');

    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(preflight).toBeLessThan(uploadStarted);
    expect(preflight).toBeLessThan(worker);
    expect(sendAttachments).toContain('if (!targetContact?.prekeyBundle && !hasActiveRatchet)');
  });
});
