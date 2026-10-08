import { describe, expect, it, vi } from 'vitest';
import { loadLocalSpaceSnapshot } from '../src/ui/app/loadLocalSpaceSnapshot.ts';
import { isPeerProfileForIdentity, resolvePeerProfileAvatar, resolvePeerProfileDocument } from '../src/ui/utils/avatarPresentation.ts';

describe('local unlock hydration and peer avatar selection', () => {
  it('starts every independent encrypted local read before awaiting any one of them', async () => {
    const session = { spaceId: 'space-test' } as any;
    const pendingReads = new Map<string, (value: unknown) => void>();
    const store = {
      getAsync: vi.fn((_session: unknown, key: string) => new Promise((resolve) => {
        pendingReads.set(key, resolve);
      })),
    };
    const contactManager = { listContacts: vi.fn(() => new Promise((resolve) => pendingReads.set('contacts', resolve))) };
    const requestManager = { listRequests: vi.fn(() => new Promise((resolve) => pendingReads.set('requests', resolve))) };

    const snapshotPromise = loadLocalSpaceSnapshot(session, store as any, contactManager as any, requestManager as any);

    expect(store.getAsync).toHaveBeenCalledTimes(6);
    expect(contactManager.listContacts).toHaveBeenCalledTimes(1);
    expect(requestManager.listRequests).toHaveBeenCalledTimes(1);

    for (const [key, resolve] of pendingReads) {
      if (key === 'veil:ui:messages') resolve({});
      else if (key === 'contacts' || key === 'requests') resolve([]);
      else resolve(null);
    }
    const snapshot = await snapshotPromise;
    expect(snapshot.contacts).toEqual([]);
    expect(snapshot.conversations).toEqual([]);
    expect(snapshot.messages).toEqual({});
  });

  it('uses the current fetched peer avatar ahead of a stale cached contact photo', () => {
    expect(resolvePeerProfileAvatar('new-profile.webp', 'old-contact.webp')).toBe('new-profile.webp');
    expect(resolvePeerProfileAvatar(undefined, 'contact.webp')).toBe('contact.webp');
  });

  it('does not reuse one peer profile after switching the profile viewer to another identity', () => {
    const cached = { key: 'identity-a|alice', document: { avatar: 'alice.webp' } };
    expect(resolvePeerProfileDocument(cached, 'identity-b|bob')).toBeNull();
    expect(resolvePeerProfileDocument(cached, 'identity-a|alice')).toEqual({ avatar: 'alice.webp' });
  });

  it('only accepts a fetched directory profile for the requested identity', () => {
    expect(isPeerProfileForIdentity({ identityId: 'identity-a' }, 'identity-a')).toBe(true);
    expect(isPeerProfileForIdentity({ identityId: 'identity-a' }, 'identity-b')).toBe(false);
  });
});
