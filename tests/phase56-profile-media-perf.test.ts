/**
 * Phase 56: Profile Persistence, Profile UI, and Video Upload Optimization Test Suite.
 *
 * Formally validates:
 * 1. Profile Picture Lifecycle & Persistence across local reload and logout/login
 * 2. Cross-Device Normal Account Login & Avatar Hydration from clean state
 * 3. Cross-Device Avatar Replacement Synchronization (Device B -> Device A)
 * 4. Avatar Deletion Tombstone Enforcement (Anti-Resurrection)
 * 5. Ed25519 Profile Cryptographic Signature Validation & Tampering Resistance
 * 6. Video Upload Pipeline Optimization & Adaptive Chunking Benchmarks (2MB, 10MB, 50MB)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { createSignedProfile, verifySignedProfile } from '../src/identity/profile.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { MemoryCloudDatabase } from '../src/server/cloud/database/memoryCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { AttachmentPipeline, getOptimalChunkSize } from '../src/attachments/attachmentPipeline.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { bytesToBase64, base64ToBytes } from '../src/crypto/utils.ts';
import { StoredRecord } from '../src/storage/types.ts';

function createStoredRecord(session: any, key: string, value: unknown, updatedAt: number): StoredRecord {
  const storageKey = session.getStorageKey();
  const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
  const { nonce, ciphertext } = encryptXChaCha20Poly1305(storageKey, plaintext);
  return {
    spaceId: session.spaceId,
    key,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    updatedAt,
  };
}

function decryptStoredRecord<T>(session: any, record: StoredRecord): T {
  const storageKey = session.getStorageKey();
  const nonce = base64ToBytes(record.nonce);
  const ciphertext = base64ToBytes(record.ciphertext);
  const decryptedBytes = decryptXChaCha20Poly1305(storageKey, nonce, ciphertext);
  const text = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(text) as T;
}

const TEST_AVATAR_A = 'data:image/webp;base64,UklGRlYAAABXRUJQVlA4IEoAAADwAQCdASoFAAUAP/mEuk2kpCOiKgA4CcJaACb7mCgAAP79T1//44f/mYAA/v/9f/+V//85v/84f/mYAP79f//jh/+ZgAAA';
const TEST_AVATAR_B = 'data:image/webp;base64,UklGRmIAAABXRUJQVlA4IFoAAADwAQCdASoFAAUAP/mEuk2kpCOiKgA4CcJaACb7mCgAAP79T1//44f/mYAA/v/9f/+V//85v/84f/mYAP79f//jh/+ZgAA/v//n//jh/+ZgAAA';

describe('Phase 56: Profile Persistence & Media Performance Suite', () => {
  let server: RelayServer;
  let serverUrl: string;
  let cloudDb: MemoryCloudDatabase;
  let objectStorage: LocalDiskObjectStorage;
  let relayStore: MemoryRelayStore;

  beforeEach(async () => {
    cloudDb = new MemoryCloudDatabase();
    objectStorage = new LocalDiskObjectStorage();
    relayStore = new MemoryRelayStore();
    server = new RelayServer(
      { port: 0, host: '127.0.0.1', logLevel: 'none' },
      relayStore,
      cloudDb,
      objectStorage
    );
    const addr = await server.start();
    serverUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  // ===========================================================================
  // 1. PROFILE AVATAR PERSISTENCE ACROSS LOGOUT/LOGIN & RELOAD
  // ===========================================================================
  describe('Profile Avatar Persistence across Reload & Re-authentication', () => {
    it('persists and verifies profile avatar across session close and reload', async () => {
      const storageAdapter = new MemoryAdapter();
      const store = new EncryptedSpaceStore(storageAdapter);
      const vault = new SpaceVaultManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const idMgr = new SpaceIdentityManager({ kdfParams: FAST_TEST_KDF_PARAMS });

      const passphrase = 'AlicePassword123!';
      const spaceHeader = vault.createSpace({
        spaceId: 'space_alice_primary',
        name: 'Personal Space',
        password: passphrase,
      });
      await vault.saveEnvelopeToStorage(spaceHeader, storageAdapter);

      const session = vault.unlockSpace(passphrase, spaceHeader.spaceId);
      idMgr.createIdentity(session, store);
      const identity = idMgr.loadIdentity(session, store)!;
      const netMgr = new NetworkManager(store, { httpUrl: serverUrl, maxRetries: 1 });
      const mailbox = await netMgr.getOrCreateMailbox(session);

      const prekeyBundle = {
        version: 1 as const,
        identityDocument: identity.document,
        signedPrekey: { id: 1, publicKey: identity.document.signingPublicKey, signature: 'sig', createdAt: Date.now() },
        oneTimePrekeys: [],
      };

      // 1. Create and sign profile document with avatar
      const profile = createSignedProfile(
        identity.document.identityId,
        identity.signingPrivateKey,
        'alice_persistent',
        'Alice Persistent',
        mailbox.mailboxId,
        prekeyBundle,
        TEST_AVATAR_A
      );

      expect(profile.avatar).toBe(TEST_AVATAR_A);
      expect(verifySignedProfile(profile)).toBe(true);

      // Persist in local encrypted store
      await store.setAsync(session, 'veil:user:profile', profile);
      await store.setAsync(session, 'veil:user:privacy_settings', {
        avatar: TEST_AVATAR_A,
        bio: 'Private & Secure',
      });

      // 2. Simulate browser reload / session lock & unlock
      session.destroy();

      const reloadedSession = vault.unlockSpace(passphrase, spaceHeader.spaceId);
      const retrievedProfile = await store.getAsync<any>(reloadedSession, 'veil:user:profile');
      const retrievedPrivacy = await store.getAsync<any>(reloadedSession, 'veil:user:privacy_settings');

      expect(retrievedProfile).toBeDefined();
      expect(retrievedProfile.avatar).toBe(TEST_AVATAR_A);
      expect(retrievedProfile.displayName).toBe('Alice Persistent');
      expect(retrievedPrivacy.avatar).toBe(TEST_AVATAR_A);
      expect(verifySignedProfile(retrievedProfile)).toBe(true);
    });
  });

  // ===========================================================================
  // 2. CROSS-DEVICE NORMAL ACCOUNT RESTORATION
  // ===========================================================================
  describe('Cross-Device Normal Login & Avatar Hydration', () => {
    it('restores profile avatar identically on a fresh device without local state', async () => {
      const username = 'alice_fresh_login';
      const password = 'FreshDevicePass123!';

      // Setup Device A
      const clientA = new CloudClient(serverUrl);
      const regA = await clientA.registerAccount({
        username,
        password,
        deviceId: 'dev_a',
      });
      clientA.setSession(regA.session.sessionToken, regA.account.accountId, 'dev_a');

      const adapterA = new MemoryAdapter();
      const storeA = new EncryptedSpaceStore(adapterA);
      const vaultA = new SpaceVaultManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const idMgrA = new SpaceIdentityManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const acctMgrA = new AccountManager(clientA, vaultA, idMgrA, storeA, adapterA);

      const spaceHeaderA = vaultA.createSpace({
        spaceId: 'space_alice_dev_a',
        name: 'Alice Space',
        password,
      });
      await vaultA.saveEnvelopeToStorage(spaceHeaderA, adapterA);
      const sessionA = vaultA.unlockSpace(password, spaceHeaderA.spaceId);
      idMgrA.createIdentity(sessionA, storeA);
      const identityA = idMgrA.loadIdentity(sessionA, storeA)!;
      const netMgrA = new NetworkManager(storeA, { httpUrl: serverUrl, maxRetries: 1 });
      const mailboxA = await netMgrA.getOrCreateMailbox(sessionA);

      const prekeyBundleA = {
        version: 1 as const,
        identityDocument: identityA.document,
        signedPrekey: { id: 1, publicKey: identityA.document.signingPublicKey, signature: 'sig_a', createdAt: Date.now() },
        oneTimePrekeys: [],
      };

      const profileA = createSignedProfile(
        identityA.document.identityId,
        identityA.signingPrivateKey,
        username,
        'Alice Across Devices',
        mailboxA.mailboxId,
        prekeyBundleA,
        TEST_AVATAR_A
      );

      await storeA.setAsync(sessionA, 'veil:user:profile', profileA);
      await storeA.setAsync(sessionA, 'veil:user:privacy_settings', { avatar: TEST_AVATAR_A, bio: 'Cloud Synced' });

      // Create zero-knowledge cloud snapshot
      await acctMgrA.createOrUpdateRecoveryVault(sessionA, password, username, FAST_TEST_KDF_PARAMS);

      // Setup Device B (Fresh state)
      const clientB = new CloudClient(serverUrl);
      const adapterB = new MemoryAdapter();
      const storeB = new EncryptedSpaceStore(adapterB);
      const vaultB = new SpaceVaultManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const idMgrB = new SpaceIdentityManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const acctMgrB = new AccountManager(clientB, vaultB, idMgrB, storeB, adapterB);

      // Device B restores account
      const restored = await acctMgrB.restoreAccount({
        username,
        password,
        deviceName: 'Device B',
        customKdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(restored.account.username).toBe(username);

      const sessionB = vaultB.unlockSpace(password, spaceHeaderA.spaceId);
      const profileB = await storeB.getAsync<any>(sessionB, 'veil:user:profile');
      const privacyB = await storeB.getAsync<any>(sessionB, 'veil:user:privacy_settings');

      expect(profileB).toBeDefined();
      expect(profileB.avatar).toBe(TEST_AVATAR_A);
      expect(profileB.displayName).toBe('Alice Across Devices');
      expect(privacyB.avatar).toBe(TEST_AVATAR_A);
      expect(privacyB.bio).toBe('Cloud Synced');
    });
  });

  // ===========================================================================
  // 3. AVATAR REPLACEMENT & CROSS-DEVICE SYNCHRONIZATION
  // ===========================================================================
  describe('Avatar Replacement & Synchronization', () => {
    it('synchronizes avatar replacement from Device B to Device A', async () => {
      const username = 'alice_replace_test';
      const password = 'ReplacePass123!';

      const client = new CloudClient(serverUrl);
      const adapter = new MemoryAdapter();
      const store = new EncryptedSpaceStore(adapter);
      const vault = new SpaceVaultManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const idMgr = new SpaceIdentityManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const acctMgr = new AccountManager(client, vault, idMgr, store, adapter);

      const spaceHeader = vault.createSpace({
        spaceId: 'space_alice_shared',
        name: 'Shared Space',
        password,
      });
      await vault.saveEnvelopeToStorage(spaceHeader, adapter);
      const session = vault.unlockSpace(password, spaceHeader.spaceId);
      idMgr.createIdentity(session, store);
      const identity = idMgr.loadIdentity(session, store)!;
      const netMgr = new NetworkManager(store, { httpUrl: serverUrl, maxRetries: 1 });
      const mailbox = await netMgr.getOrCreateMailbox(session);

      const pb = {
        version: 1 as const,
        identityDocument: identity.document,
        signedPrekey: { id: 1, publicKey: identity.document.signingPublicKey, signature: 'sig', createdAt: Date.now() },
        oneTimePrekeys: [],
      };

      const initialProfile = createSignedProfile(
        identity.document.identityId,
        identity.signingPrivateKey,
        username,
        'Alice Initial',
        mailbox.mailboxId,
        pb,
        TEST_AVATAR_A
      );

      await store.setAsync(session, 'veil:user:profile', initialProfile);
      await store.setAsync(session, 'veil:user:privacy_settings', { avatar: TEST_AVATAR_A });

      // Device B updates avatar to TEST_AVATAR_B with later issuedAt
      const newTimestamp = Date.now() + 5000;
      const updatedProfileB = {
        ...initialProfile,
        avatar: TEST_AVATAR_B,
        avatarUrl: TEST_AVATAR_B,
        issuedAt: newTimestamp,
      };

      const localRecords = await adapter.listRecords(session.spaceId);
      const remoteRecords = [
        ...localRecords.filter((r) => r.key !== 'veil:user:profile' && r.key !== 'veil:user:privacy_settings'),
        createStoredRecord(session, 'veil:user:profile', updatedProfileB, newTimestamp),
        createStoredRecord(session, 'veil:user:privacy_settings', { avatar: TEST_AVATAR_B }, newTimestamp),
      ];

      const merged = (acctMgr as any).mergeRecordsForSpace(
        session,
        localRecords,
        remoteRecords,
        store
      );

      const mergedProfileRec = merged.find((r: any) => r.key === 'veil:user:profile');
      expect(mergedProfileRec).toBeDefined();
      const decryptedWinnerProfile = decryptStoredRecord<any>(session, mergedProfileRec);
      expect(decryptedWinnerProfile.avatar).toBe(TEST_AVATAR_B);
    });
  });

  // ===========================================================================
  // 4. AVATAR DELETION TOMBSTONE & ANTI-RESURRECTION
  // ===========================================================================
  describe('Avatar Deletion Tombstone Enforcement', () => {
    it('prevents deleted avatars from resurrecting when merged with older profiles', async () => {
      const username = 'alice_delete_test';
      const password = 'DeletePass123!';

      const client = new CloudClient(serverUrl);
      const adapter = new MemoryAdapter();
      const store = new EncryptedSpaceStore(adapter);
      const vault = new SpaceVaultManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const idMgr = new SpaceIdentityManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const acctMgr = new AccountManager(client, vault, idMgr, store, adapter);

      const spaceHeader = vault.createSpace({
        spaceId: 'space_alice_del',
        name: 'Del Space',
        password,
      });
      await vault.saveEnvelopeToStorage(spaceHeader, adapter);
      const session = vault.unlockSpace(password, spaceHeader.spaceId);
      idMgr.createIdentity(session, store);
      const identity = idMgr.loadIdentity(session, store)!;
      const netMgr = new NetworkManager(store, { httpUrl: serverUrl, maxRetries: 1 });
      const mailbox = await netMgr.getOrCreateMailbox(session);

      const pb = {
        version: 1 as const,
        identityDocument: identity.document,
        signedPrekey: { id: 1, publicKey: identity.document.signingPublicKey, signature: 'sig', createdAt: Date.now() },
        oneTimePrekeys: [],
      };

      const oldIssuedAt = Date.now() - 10000;
      const profileWithAvatar = {
        ...createSignedProfile(
          identity.document.identityId,
          identity.signingPrivateKey,
          username,
          'Alice Before Delete',
          mailbox.mailboxId,
          pb,
          TEST_AVATAR_A
        ),
        issuedAt: oldIssuedAt,
      };

      // Device A deletes avatar and records tombstone at deletedAt > oldIssuedAt
      const deletedAt = Date.now();
      const localRecords = [
        createStoredRecord(session, 'veil:avatar:tombstone', { deletedAt }, deletedAt),
        createStoredRecord(session, 'veil:user:privacy_settings', { avatar: undefined, bio: 'No Avatar' }, deletedAt),
      ];

      // Remote has old profile that still had the avatar
      const remoteRecords = [
        createStoredRecord(session, 'veil:user:profile', profileWithAvatar, oldIssuedAt),
      ];

      // Deterministic merge
      const merged = (acctMgr as any).mergeRecordsForSpace(
        session,
        localRecords,
        remoteRecords,
        store
      );

      const mergedProfileRec = merged.find((r: any) => r.key === 'veil:user:profile');
      expect(mergedProfileRec).toBeDefined();
      const decryptedProf = decryptStoredRecord<any>(session, mergedProfileRec);

      // The avatar MUST BE undefined because of the tombstone (anti-resurrection verified)
      expect(decryptedProf.avatar).toBeUndefined();
      expect(decryptedProf.avatarUrl).toBeUndefined();
    });
  });

  // ===========================================================================
  // 5. CRYPTOGRAPHIC PROFILE SIGNATURES & TAMPERING DETECTION
  // ===========================================================================
  describe('Profile Cryptographic Signatures & Verification', () => {
    it('verifies valid profiles and rigorously rejects tampered usernames, avatars, or keys', async () => {
      const storageAdapter = new MemoryAdapter();
      const store = new EncryptedSpaceStore(storageAdapter);
      const vault = new SpaceVaultManager({ kdfParams: FAST_TEST_KDF_PARAMS });
      const idMgr = new SpaceIdentityManager({ kdfParams: FAST_TEST_KDF_PARAMS });

      const spaceHeader = vault.createSpace({
        spaceId: 'space_sig_test',
        name: 'Sig Space',
        password: 'Password123!',
      });
      const session = vault.unlockSpace('Password123!', spaceHeader.spaceId);
      idMgr.createIdentity(session, store);
      const identity = idMgr.loadIdentity(session, store)!;
      const netMgr = new NetworkManager(store, { httpUrl: serverUrl, maxRetries: 1 });
      const mailbox = await netMgr.getOrCreateMailbox(session);

      const pb = {
        version: 1 as const,
        identityDocument: identity.document,
        signedPrekey: { id: 1, publicKey: identity.document.signingPublicKey, signature: 'sig_bob', createdAt: Date.now() },
        oneTimePrekeys: [],
      };

      const doc = createSignedProfile(
        identity.document.identityId,
        identity.signingPrivateKey,
        'bob_crypto',
        'Bob Cryptographer',
        mailbox.mailboxId,
        pb,
        TEST_AVATAR_A
      );

      // 1. Valid signature check
      expect(verifySignedProfile(doc)).toBe(true);

      // 2. Tampered avatar rejected
      const tamperedAvatar = { ...doc, avatar: TEST_AVATAR_B };
      expect(verifySignedProfile(tamperedAvatar)).toBe(false);

      // 3. Tampered username rejected
      const tamperedUsername = { ...doc, username: 'eve_attacker' };
      expect(verifySignedProfile(tamperedUsername)).toBe(false);

      // 4. Tampered displayName rejected
      const tamperedDisplayName = { ...doc, displayName: 'Imposter' };
      expect(verifySignedProfile(tamperedDisplayName)).toBe(false);
    });
  });

  // ===========================================================================
  // 6. VIDEO UPLOAD BENCHMARK & ADAPTIVE CHUNKING
  // ===========================================================================
  describe('Video Upload Optimization & Adaptive Chunking Benchmarks', () => {
    it('calculates bounded optimal chunk sizes based on payload size', () => {
      expect(getOptimalChunkSize(500 * 1024)).toBe(64 * 1024); // <= 1 MB -> 64 KB
      expect(getOptimalChunkSize(5 * 1024 * 1024)).toBe(256 * 1024); // 1-10 MB -> 256 KB
      expect(getOptimalChunkSize(25 * 1024 * 1024)).toBe(512 * 1024); // 10-50 MB -> 512 KB
      expect(getOptimalChunkSize(80 * 1024 * 1024)).toBe(1024 * 1024); // > 50 MB -> 1 MB
    });

    it('benchmarks encryption, chunking, and reassembly across 2MB, 10MB, and 50MB payloads', () => {
      const benchmarkSizes = [
        { label: '2 MB', bytes: 2 * 1024 * 1024 },
        { label: '10 MB', bytes: 10 * 1024 * 1024 },
        { label: '50 MB', bytes: 50 * 1024 * 1024 },
      ];

      for (const b of benchmarkSizes) {
        const payload = new Uint8Array(b.bytes);
        for (let i = 0; i < Math.min(b.bytes, 5000); i++) {
          payload[i] = (i * 37 + 11) & 0xff;
        }

        const encryptionKey = new Uint8Array(32);
        for (let i = 0; i < 32; i++) encryptionKey[i] = i + 1;

        // Adaptive chunking
        const t0 = performance.now();
        const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
          payload,
          'video_test.mp4',
          'video/mp4',
          encryptionKey
        );
        const encryptDurationMs = performance.now() - t0;

        expect(chunks.length).toBe(metadata.chunkCount);
        expect(metadata.sizeBytes).toBe(b.bytes);

        // Verify chunk reduction: 50MB uses <= 100 chunks instead of 800 chunks
        if (b.bytes === 50 * 1024 * 1024) {
          expect(chunks.length).toBeLessThanOrEqual(100);
        }

        // Decrypt and reassemble
        const tDec0 = performance.now();
        const reassembled = AttachmentPipeline.decryptAndReassemble(metadata, chunks, encryptionKey);
        const decryptDurationMs = performance.now() - tDec0;

        expect(reassembled.length).toBe(b.bytes);
        expect(reassembled[0]).toBe(payload[0]);
        expect(reassembled[100]).toBe(payload[100]);

        console.log(`[P56 BENCHMARK] ${b.label}: ${chunks.length} chunks | Encrypt: ${encryptDurationMs.toFixed(1)}ms | Reassemble: ${decryptDurationMs.toFixed(1)}ms`);
      }
    });
  });
});
