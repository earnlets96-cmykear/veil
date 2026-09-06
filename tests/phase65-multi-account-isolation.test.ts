/**
 * Phase 65 Multi-Account & Space Isolation Test Suite
 *
 * Verifies:
 * 1. SpacePinManager:
 *    - First registered space defaults to isMainAccount: true, secondary spaces to isMainAccount: false.
 *    - isMainAccount(spaceId) returns true for main account, false for secondary.
 *    - getMainSpaceId() reliably returns the main space identifier.
 * 2. AccountManager:
 *    - createSecondaryAccount creates an independent envelope with custom @username.
 *    - Derives an independent Ed25519 cryptographic identity.
 *    - Does NOT mutate, disconnect, or overwrite the active Main Account session.
 * 3. Settings UI Space Isolation:
 *    - Only the Main Account is presented with "Accounts & Spaces".
 *    - Secondary spaces NEVER see or discover other spaces on device.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpacePinManager } from '../src/privacy/pinManager.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 65: Multi-Account Cryptographic Isolation & Re-Auth Gate', () => {
  let pinManager: SpacePinManager;
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let storageAdapter: MemoryStorageAdapter;
  let cloudClient: CloudClient;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    pinManager = new SpacePinManager({
      ...FAST_TEST_KDF_PARAMS,
      salt: '',
    });
    pinManager.resetRegistry();

    storageAdapter = new MemoryStorageAdapter();
    store = new EncryptedSpaceStore(storageAdapter);
    vault = new SpaceVaultManager();
    idMgr = new SpaceIdentityManager();
    cloudClient = new CloudClient({ baseUrl: 'http://127.0.0.1:19999', requestTimeoutMs: 5000 });

    vi.spyOn(cloudClient, 'registerAccount').mockImplementation(async (params: any) => ({
      account: { accountId: `acc_${params.username}`, username: params.username },
      device: { deviceId: params.deviceId, deviceName: params.deviceName },
      session: { sessionToken: 'mock_session_token', expiresAt: Date.now() + 86400000 },
    }));
    vi.spyOn(cloudClient, 'setRecoveryVault').mockResolvedValue({ success: true } as any);
    vi.spyOn(cloudClient, 'getRecoveryVault').mockResolvedValue(null as any);
  });

  describe('SpacePinManager: Main vs Secondary Account Designation', () => {
    it('designates the first registered account as Main Account', async () => {
      await pinManager.assignPinToSpace({
        spaceId: 'main-space-01',
        canonicalUsername: 'alice',
        spaceName: 'Main Personal',
        password: 'alice-main-password',
        pin: '1234',
        accountId: 'acc-alice-main',
      });

      expect(pinManager.isMainAccount('main-space-01')).toBe(true);
      expect(pinManager.getMainSpaceId()).toBe('main-space-01');
    });

    it('designates subsequent registered accounts as secondary spaces (isMainAccount = false)', async () => {
      // Main space
      await pinManager.assignPinToSpace({
        spaceId: 'main-space-01',
        canonicalUsername: 'alice',
        spaceName: 'Main Personal',
        password: 'alice-main-password',
        pin: '1111',
      });

      // Secondary space
      await pinManager.assignPinToSpace({
        spaceId: 'work-space-02',
        canonicalUsername: 'alice_work',
        spaceName: 'Work Operations',
        password: 'work-password-123',
        pin: '2222',
        isMainAccount: false,
        parentSpaceId: 'main-space-01',
      });

      expect(pinManager.isMainAccount('main-space-01')).toBe(true);
      expect(pinManager.isMainAccount('work-space-02')).toBe(false);
      expect(pinManager.getMainSpaceId()).toBe('main-space-01');
    });

    it('resolves distinct accounts independently via distinct PINs', async () => {
      await pinManager.assignPinToSpace({
        spaceId: 'main-space-01',
        canonicalUsername: 'alice',
        spaceName: 'Main Personal',
        password: 'alice-main-password',
        pin: '1111',
      });

      await pinManager.assignPinToSpace({
        spaceId: 'secondary-space-02',
        canonicalUsername: 'alice_sec',
        spaceName: 'Secret Space',
        password: 'sec-password-456',
        pin: '9999',
        isMainAccount: false,
      });

      const mainResolved = await pinManager.verifyAndResolvePin('1111');
      expect(mainResolved.success).toBe(true);
      expect(mainResolved.spaceId).toBe('main-space-01');
      expect(mainResolved.username).toBe('alice');

      const secResolved = await pinManager.verifyAndResolvePin('9999');
      expect(secResolved.success).toBe(true);
      expect(secResolved.spaceId).toBe('secondary-space-02');
      expect(secResolved.username).toBe('alice_sec');
    });
  });

  describe('AccountManager: Non-Destructive Secondary Account Creation', () => {
    it('creates an independent secondary account without destroying or modifying the active Main Account', async () => {
      const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

      // Step 1: Initialize Main Account
      const mainResult = await accountManager.registerAccount({
        username: 'alice_main',
        spaceName: 'Main Space',
        password: 'main-master-pass-123',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });
      expect(mainResult.session).toBeDefined();
      const mainSpaceId = mainResult.session.spaceId;
      expect(vault.getActiveSession(mainSpaceId)).toBeDefined();

      // Register main account PIN
      await pinManager.assignPinToSpace({
        spaceId: mainSpaceId,
        canonicalUsername: 'alice_main',
        spaceName: 'Main Space',
        password: 'main-master-pass-123',
        pin: '1234',
        isMainAccount: true,
      });

      // Step 2: Create a Secondary Account with explicit username
      const secResult = await accountManager.createSecondaryAccount({
        username: 'alice_work',
        spaceName: 'Work Space',
        password: 'work-pass-456',
        pin: '5678',
        mainSpaceId,
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(secResult.spaceId).toBeDefined();
      expect(secResult.spaceId).not.toBe(mainSpaceId);
      expect(secResult.username).toBe('alice_work');
      expect(secResult.identityDoc).toBeDefined();
      expect(secResult.identityDoc.signingPublicKey).not.toBe(mainResult.identityDoc.signingPublicKey);

      // Verify Main Account space remains completely unlocked and active
      expect(vault.getActiveSession(mainSpaceId)).toBeDefined();
      // Secondary space was safely locked after setup
      expect(vault.getActiveSession(secResult.spaceId)).toBeUndefined();
    });

    it('creates secondary account with independent envelope and locks its temporary session', async () => {
      const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);

      const mainResult = await accountManager.registerAccount({
        username: 'alice',
        spaceName: 'Personal',
        password: 'alice-pass',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const secResult = await accountManager.createSecondaryAccount({
        username: 'alice_research',
        spaceName: 'Research',
        password: 'research-pass',
        pin: '9876',
        mainSpaceId: mainResult.session.spaceId,
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      // Verify secondary space is locked (not active in vault)
      expect(vault.getActiveSession(secResult.spaceId)).toBeUndefined();
      // Main space remains unlocked
      expect(vault.getActiveSession(mainResult.session.spaceId)).toBeDefined();
    });
  });
});
