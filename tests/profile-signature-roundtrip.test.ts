/**
 * Profile Signature Roundtrip & Anti-Tampering Test Suite
 *
 * Verifies that SignedProfileDocument documents remain 100% cryptographically valid
 * across creation, database persistence, updates, directory search, retrieval,
 * and contact request initiation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSignedProfile,
  verifySignedProfile,
  canonicalizeProfile,
  SignedProfileDocument,
} from '../src/identity/profile.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Profile Signature Roundtrip & Contact Request Verification', () => {
  const testDir = path.join(process.cwd(), '.veil_test_profile_roundtrip');
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let prekeyMgr: PrekeyManager;
  let contactMgr: ContactManager;
  let contactRequestMgr: ContactRequestManager;
  let netMgr: NetworkManager;

  // Alice
  let aliceSession: SpaceSession;
  let aliceDoc: any;
  let aliceId: any;
  let aliceProfile: SignedProfileDocument;

  // Bob
  let bobSession: SpaceSession;
  let bobDoc: any;
  let bobId: any;
  let bobProfile: SignedProfileDocument;

  const sampleAvatar = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoIAAgAAkA4JaQAA3AA/vv9AAA=';

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    prekeyMgr = new PrekeyManager(store, idMgr);
    contactMgr = new ContactManager(store);
    netMgr = new NetworkManager(store);
    contactRequestMgr = new ContactRequestManager(store, contactMgr, idMgr, netMgr);

    // Setup Alice Space
    aliceSession = new SpaceSession('space_alice', 'Alice Space', false, new Uint8Array(32).fill(1));
    aliceDoc = idMgr.createIdentity(aliceSession, store);
    aliceId = idMgr.loadIdentity(aliceSession, store);
    prekeyMgr.generateSignedPrekey(aliceSession);
    prekeyMgr.generateOneTimePrekeys(aliceSession, 10);
    const alicePrekeyBundle = prekeyMgr.createPrekeyBundle(aliceSession);

    aliceProfile = createSignedProfile(
      aliceDoc.identityId,
      aliceId.signingPrivateKey,
      'alice',
      'Alice Doe',
      'mailbox_alice_001',
      alicePrekeyBundle
    );

    // Setup Bob Space
    bobSession = new SpaceSession('space_bob', 'Bob Space', false, new Uint8Array(32).fill(2));
    bobDoc = idMgr.createIdentity(bobSession, store);
    bobId = idMgr.loadIdentity(bobSession, store);
    prekeyMgr.generateSignedPrekey(bobSession);
    prekeyMgr.generateOneTimePrekeys(bobSession, 10);
    const bobPrekeyBundle = prekeyMgr.createPrekeyBundle(bobSession);

    bobProfile = createSignedProfile(
      bobDoc.identityId,
      bobId.signingPrivateKey,
      'bob',
      'Bob Smith',
      'mailbox_bob_002',
      bobPrekeyBundle,
      sampleAvatar
    );
  });

  it('verifies newly created signed profiles immediately (with and without avatar)', () => {
    expect(verifySignedProfile(aliceProfile)).toBe(true);
    expect(verifySignedProfile(bobProfile)).toBe(true);
    expect(aliceProfile.avatar).toBeUndefined();
    expect(bobProfile.avatar).toBe(sampleAvatar);
  });

  it('maintains valid signatures through MemoryRelayStore roundtrip', async () => {
    const memStore = new MemoryRelayStore();
    await memStore.init();

    await memStore.registerProfile(aliceProfile);
    await memStore.registerProfile(bobProfile);

    const fetchedAlice = await memStore.getProfileByUsername('alice');
    const fetchedBob = await memStore.getProfileByUsername('bob');

    expect(fetchedAlice).not.toBeNull();
    expect(fetchedBob).not.toBeNull();

    expect(verifySignedProfile(fetchedAlice!)).toBe(true);
    expect(verifySignedProfile(fetchedBob!)).toBe(true);
  });

  it('maintains valid signatures through PersistentFileRelayStore roundtrip', async () => {
    const fileStore = new PersistentFileRelayStore(testDir);
    await fileStore.init();

    await fileStore.registerProfile(aliceProfile);
    await fileStore.registerProfile(bobProfile);

    const fetchedAlice = await fileStore.getProfileByUsername('alice');
    const fetchedBob = await fileStore.getProfileByUsername('bob');

    expect(fetchedAlice).not.toBeNull();
    expect(fetchedBob).not.toBeNull();

    expect(verifySignedProfile(fetchedAlice!)).toBe(true);
    expect(verifySignedProfile(fetchedBob!)).toBe(true);

    // Reopen store from disk to verify deserialization
    const reopenedStore = new PersistentFileRelayStore(testDir);
    await reopenedStore.init();

    const reopenedAlice = await reopenedStore.getProfileByUsername('alice');
    const reopenedBob = await reopenedStore.getProfileByUsername('bob');

    expect(verifySignedProfile(reopenedAlice!)).toBe(true);
    expect(verifySignedProfile(reopenedBob!)).toBe(true);
  });

  it('maintains valid signatures across profile updates / re-registrations (T1 -> T2 upsert simulation)', async () => {
    // 1. Initial registration at T1
    const t1Profile = bobProfile;
    expect(verifySignedProfile(t1Profile)).toBe(true);

    // 2. Simulated PostgreSQL directory_profiles row after INSERT
    const pgTable = new Map<string, any>();
    pgTable.set(t1Profile.username, {
      username: t1Profile.username,
      identityId: t1Profile.identityId,
      displayName: t1Profile.displayName,
      avatarUrl: t1Profile.avatar || null,
      signingPublicKey: t1Profile.signingPublicKey,
      keyAgreementPublicKey: t1Profile.keyAgreementPublicKey,
      mailboxId: t1Profile.mailboxId,
      prekeyBundleJson: JSON.stringify(t1Profile.prekeyBundle),
      signature: t1Profile.signature,
      createdAt: t1Profile.issuedAt,
      updatedAt: t1Profile.issuedAt,
    });

    // Advance time
    await new Promise((r) => setTimeout(r, 10));

    // 3. User updates profile at T2 (e.g. changes display name and avatar)
    const bobPrekeyBundle = prekeyMgr.createPrekeyBundle(bobSession);
    const t2Profile = createSignedProfile(
      bobDoc.identityId,
      bobId.signingPrivateKey,
      'bob',
      'Bob Smith (Updated)',
      'mailbox_bob_002',
      bobPrekeyBundle,
      'data:image/webp;base64,UPDATED_AVATAR'
    );
    expect(t2Profile.issuedAt).toBeGreaterThan(t1Profile.issuedAt);
    expect(verifySignedProfile(t2Profile)).toBe(true);

    // Simulated PostgreSQL ON CONFLICT DO UPDATE SET (with created_at = EXCLUDED.created_at fix)
    const existing = pgTable.get(t2Profile.username);
    existing.identityId = t2Profile.identityId;
    existing.displayName = t2Profile.displayName;
    existing.avatarUrl = t2Profile.avatar || null;
    existing.signingPublicKey = t2Profile.signingPublicKey;
    existing.keyAgreementPublicKey = t2Profile.keyAgreementPublicKey;
    existing.mailboxId = t2Profile.mailboxId;
    existing.prekeyBundleJson = JSON.stringify(t2Profile.prekeyBundle);
    existing.signature = t2Profile.signature;
    existing.createdAt = t2Profile.issuedAt; // Fixed: created_at syncs with new issuedAt
    existing.updatedAt = Date.now();

    // 4. Peer fetches updated profile
    const retrievedPgDoc: SignedProfileDocument = {
      version: 1,
      username: existing.username,
      identityId: existing.identityId,
      displayName: existing.displayName || undefined,
      avatar: existing.avatarUrl || undefined,
      avatarUrl: existing.avatarUrl || undefined,
      signingPublicKey: existing.signingPublicKey,
      keyAgreementPublicKey: existing.keyAgreementPublicKey,
      mailboxId: existing.mailboxId,
      prekeyBundle: JSON.parse(existing.prekeyBundleJson),
      signature: existing.signature,
      issuedAt: Number(existing.createdAt),
      createdAt: Number(existing.createdAt),
      updatedAt: Number(existing.updatedAt),
    };

    expect(verifySignedProfile(retrievedPgDoc)).toBe(true);
    expect(retrievedPgDoc.displayName).toBe('Bob Smith (Updated)');
  });

  it('allows sending contact requests to retrieved profiles without signature rejection', async () => {
    // Alice sends contact request to Bob's retrieved profile
    const req = await contactRequestMgr.sendContactRequest(
      aliceSession,
      aliceProfile,
      bobProfile,
      'Hey Bob, lets connect!'
    );

    expect(req).toBeDefined();
    expect(req.status).toBe('OUTGOING_PENDING');
    expect(req.peerIdentityId).toBe(bobProfile.identityId);
    expect(req.peerUsername).toBe('bob');
  });

  describe('Anti-Tampering Security Enforcements', () => {
    it('rejects tampered displayName', () => {
      const tampered = { ...bobProfile, displayName: 'Mallory Impersonating Bob' };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects tampered username', () => {
      const tampered = { ...bobProfile, username: 'bobby' };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects tampered avatar', () => {
      const tampered = { ...bobProfile, avatar: 'data:image/webp;base64,MALICIOUS_AVATAR' };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects tampered mailboxId', () => {
      const tampered = { ...bobProfile, mailboxId: 'mailbox_mallory_hijack' };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects tampered signingPublicKey in prekeyBundle', () => {
      const tampered: SignedProfileDocument = {
        ...bobProfile,
        prekeyBundle: {
          ...bobProfile.prekeyBundle,
          identityDocument: {
            ...bobProfile.prekeyBundle.identityDocument,
            signingPublicKey: bytesToBase64(new Uint8Array(32).fill(9)),
          },
        },
      };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects tampered prekeyBundle signedPrekey', () => {
      const tampered: SignedProfileDocument = {
        ...bobProfile,
        prekeyBundle: {
          ...bobProfile.prekeyBundle,
          signedPrekey: {
            ...bobProfile.prekeyBundle.signedPrekey,
            publicKey: bytesToBase64(new Uint8Array(32).fill(7)),
          },
        },
      };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects tampered signature bytes', () => {
      const tampered = {
        ...bobProfile,
        signature: bytesToBase64(new Uint8Array(64).fill(0xee)),
      };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects tampered issuedAt timestamp', () => {
      const tampered = {
        ...bobProfile,
        issuedAt: bobProfile.issuedAt + 5000,
      };
      expect(verifySignedProfile(tampered)).toBe(false);
    });

    it('rejects expired profile documents', () => {
      const expiredProfile = createSignedProfile(
        bobDoc.identityId,
        bobId.signingPrivateKey,
        'bob',
        'Bob Expired',
        'mailbox_bob_002',
        bobProfile.prekeyBundle,
        undefined,
        -10 // Expired 10 seconds ago
      );
      expect(verifySignedProfile(expiredProfile)).toBe(false);
    });
  });
});
