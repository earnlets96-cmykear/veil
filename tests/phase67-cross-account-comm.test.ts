import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { ContactManager } from '../src/contacts/contactManager.ts';
import { ContactRequestManager } from '../src/contacts/contactRequestManager.ts';
import { verifySignedProfile } from '../src/identity/profile.ts';
import { spacePinManager } from '../src/privacy/pinManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { sign } from '../src/identity/signing.ts';

describe('Phase 67: Cross-Account Communication (A ↔ B) & Cryptographic Provisioning', () => {
  let server: RelayServer;
  let relayPort: number;
  let vault: SpaceVaultManager;
  let idMgr: SpaceIdentityManager;
  let memoryAdapter: MemoryAdapter;
  let store: EncryptedSpaceStore;
  let netManager: NetworkManager;
  let prekeyManager: PrekeyManager;
  let contactManager: ContactManager;
  let contactRequestManager: ContactRequestManager;
  let accountManager: AccountManager;
  let mockCloudClient: any;
  let mockDirectoryClient: any;
  let directoryMap: Map<string, any>;

  beforeEach(async () => {
    spacePinManager.setKdfParams(FAST_TEST_KDF_PARAMS);
    server = new RelayServer({ port: 0, host: '127.0.0.1', logLevel: 'none' });
    const sRes = await server.start();
    relayPort = sRes.port;

    const storeMap = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storeMap.get(k) || null,
      setItem: (k: string, v: string) => storeMap.set(k, v),
      removeItem: (k: string) => storeMap.delete(k),
      clear: () => storeMap.clear(),
      get length() { return storeMap.size; },
      key: (_i: number) => null,
    };

    vault = new SpaceVaultManager();
    idMgr = new SpaceIdentityManager();
    memoryAdapter = new MemoryAdapter();
    store = new EncryptedSpaceStore(memoryAdapter);
    netManager = new NetworkManager(store, {
      httpUrl: `http://127.0.0.1:${relayPort}`,
      wsUrl: `ws://127.0.0.1:${relayPort}/v1/ws`,
    });
    prekeyManager = new PrekeyManager(store, idMgr);
    contactManager = new ContactManager(store);
    contactRequestManager = new ContactRequestManager(store, contactManager, idMgr, netManager);

    directoryMap = new Map();
    mockDirectoryClient = {
      registerProfile: async (profile: any) => {
        directoryMap.set(profile.username.toLowerCase(), profile);
      },
      getProfileByUsername: async (username: string) => {
        return directoryMap.get(username.toLowerCase()) || null;
      },
      searchProfiles: async (q: string) => {
        const res: any[] = [];
        for (const [u, p] of directoryMap.entries()) {
          if (u.includes(q.toLowerCase())) res.push(p);
        }
        return res;
      },
    };

    mockCloudClient = {
      registerAccount: async (p: any) => ({
        account: { accountId: `acc_${p.username}` },
        session: { sessionToken: `tok_${p.username}`, expiresAt: Date.now() + 86400000 },
        device: { deviceId: p.deviceId },
      }),
      setRecoveryVault: async () => ({ success: true }),
      getSessionToken: () => 'mock_token',
      getAccountId: () => 'mock_acc',
      getDeviceId: () => 'mock_dev',
    };

    accountManager = new AccountManager(
      mockCloudClient,
      vault,
      idMgr,
      store,
      memoryAdapter,
      netManager,
      prekeyManager,
      mockDirectoryClient
    );
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('provisions secondary account with valid signed profile and directory registration', async () => {
    // 1. Register Account A (Main Account)
    const { session: sessionA } = await accountManager.registerAccount({
      username: 'alice',
      password: 'AlicePassword123!',
      spaceName: 'Alice Primary Space',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const bindingA = await netManager.getOrCreateMailbox(sessionA);
    prekeyManager.generateSignedPrekey(sessionA);
    prekeyManager.generateOneTimePrekeys(sessionA, 5);
    const prekeyBundleA = prekeyManager.createPrekeyBundle(sessionA);
    const idDocA = idMgr.loadIdentity(sessionA, store)!;

    const { createSignedProfile } = await import('../src/identity/profile.ts');
    const profileA = createSignedProfile(
      idDocA.document.identityId,
      idDocA.signingPrivateKey,
      'alice',
      'Alice Primary',
      bindingA.mailboxId,
      prekeyBundleA
    );
    await mockDirectoryClient.registerProfile(profileA);
    await store.setAsync(sessionA, 'veil:user:profile', profileA);

    // 2. Create Account B as Secondary Account
    const secondaryResult = await accountManager.createSecondaryAccount({
      username: 'bob_work',
      password: 'BobWorkPassword456!',
      spaceName: 'Bob Work Space',
      pin: '654321',
      mainSpaceId: sessionA.spaceId,
      kdfParams: FAST_TEST_KDF_PARAMS,
      netManager,
      prekeyManager,
      directoryClient: mockDirectoryClient,
    });

    expect(secondaryResult.spaceId).toBeDefined();
    expect(secondaryResult.username).toBe('bob_work');

    // 3. Verify Account B profile in Directory
    const bInDir = await mockDirectoryClient.getProfileByUsername('bob_work');
    expect(bInDir).not.toBeNull();
    expect(bInDir.username).toBe('bob_work');
    expect(bInDir.mailboxId).toBeDefined();
    expect(bInDir.mailboxId).not.toBe('');
    expect(bInDir.prekeyBundle).toBeDefined();

    // 4. Verify Account B profile signature validity
    const isProfileBValid = verifySignedProfile(bInDir);
    expect(isProfileBValid).toBe(true);

    // 5. Verify Account B PIN wrapping includes masterKey for instant unlock
    const pinResB = await spacePinManager.verifyAndResolvePin('654321');
    expect(pinResB.success).toBe(true);
    expect(pinResB.spaceId).toBe(secondaryResult.spaceId);
    expect(pinResB.masterKey).toBeDefined();

    // Fast unlock Account B
    const sessionB = vault.unlockSpaceWithMasterKey(secondaryResult.spaceId, base64ToBytes(pinResB.masterKey!));
    expect(sessionB.isActive()).toBe(true);

    // 6. Test Cross-Account Contact Request from A to B
    const sentReq = await contactRequestManager.sendContactRequest(
      sessionA,
      profileA,
      bInDir,
      'Hello Bob Work, connecting from Alice!'
    );

    expect(sentReq).toBeDefined();
    expect(sentReq.status).toBe('OUTGOING_PENDING');
    expect(sentReq.peerUsername).toBe('bob_work');

    // 7. Verify Account B can receive and validate the inbound request
    const canonicalReq = JSON.stringify({
      requestId: sentReq.requestId,
      senderIdentityId: profileA.identityId,
      targetIdentityId: bInDir.identityId,
      sentAt: sentReq.createdAt,
    });
    const sigBytes = sign(idDocA.signingPrivateKey, new TextEncoder().encode(canonicalReq));
    const signature = bytesToBase64(sigBytes);

    const wireRequest = {
      type: 'CONTACT_REQUEST' as const,
      requestId: sentReq.requestId,
      senderProfile: profileA,
      greeting: 'Hello Bob Work, connecting from Alice!',
      sentAt: sentReq.createdAt,
      signature,
    };

    // Verify inbound request signature verification passes
    const receivedReq = await contactRequestManager.handleInboundRequest(sessionB, wireRequest);
    expect(receivedReq).not.toBeNull();
    expect(receivedReq!.peerUsername).toBe('alice');
    expect(receivedReq!.status).toBe('INCOMING_PENDING');

    // 8. Account B accepts request
    const acceptedRequest = await contactRequestManager.acceptRequest(sessionB, sentReq.requestId, bInDir);
    expect(acceptedRequest).toBeDefined();
    expect(acceptedRequest.status).toBe('ACCEPTED');
    expect(acceptedRequest.peerUsername).toBe('alice');

    // Clean up sessions
    sessionA.destroy();
    sessionB.destroy();
  });
});
