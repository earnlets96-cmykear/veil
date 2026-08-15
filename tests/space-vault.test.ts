import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { constantTimeEquals } from '../src/crypto/utils.ts';

describe('VEIL Phase 1: SpaceVaultManager Lifecycle Tests', () => {
  let vault: SpaceVaultManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
  });

  describe('Space Creation & Credential-Selected Unlocking', () => {
    it('should create and unlock multiple distinct Spaces with different passwords (discovery & targeted)', () => {
      const mainEnv = vault.createSpace({
        name: 'Main Space',
        password: 'MainPassword123!',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const privateEnv = vault.createSpace({
        name: 'Private Space',
        password: 'PrivatePassword456!',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const decoyEnv = vault.createSpace({
        name: 'Decoy Space',
        password: 'DecoyPassword789!',
        isDecoy: true,
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(vault.listEnvelopes().length).toBe(3);

      // 1. Discovery Unlock Main Space (omitting spaceId)
      const mainSession = vault.unlockSpace('MainPassword123!');
      expect(mainSession.spaceId).toBe(mainEnv.spaceId);
      expect(mainSession.name).toBe('Main Space');
      expect(mainSession.isDecoy).toBe(false);
      expect(mainSession.isActive()).toBe(true);

      // 2. Targeted Unlock Private Space (providing spaceId for O(1) derivation)
      const privateSession = vault.unlockSpace('PrivatePassword456!', privateEnv.spaceId);
      expect(privateSession.spaceId).toBe(privateEnv.spaceId);
      expect(privateSession.name).toBe('Private Space');

      // 3. Targeted Unlock Decoy Space
      const decoySession = vault.unlockSpace('DecoyPassword789!', decoyEnv.spaceId);
      expect(decoySession.spaceId).toBe(decoyEnv.spaceId);
      expect(decoySession.name).toBe('Decoy Space');
      expect(decoySession.isDecoy).toBe(true);
    });

    it('should reject wrong passwords with a generic error', () => {
      vault.createSpace({
        name: 'Main Space',
        password: 'CorrectPassword123!',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(() => vault.unlockSpace('WrongPassword999!')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
    });

    it('should reject wrong password on targeted spaceId unlock', () => {
      const env = vault.createSpace({
        name: 'Target Space',
        password: 'RightPassword',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      expect(() => vault.unlockSpace('WrongPassword', env.spaceId)).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );
    });

    it('should reject empty passwords', () => {
      expect(() => vault.createSpace({ name: 'Test', password: '' })).toThrow('Password must not be empty');
      expect(() => vault.unlockSpace('')).toThrow('Unable to unlock Space: empty password');
    });
  });

  describe('Space Locking & Memory Destruction', () => {
    it('should destroy session and invalidate key access upon lockSpace()', () => {
      const env = vault.createSpace({
        name: 'Vault A',
        password: 'PasswordA',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const session = vault.unlockSpace('PasswordA');
      expect(session.isActive()).toBe(true);
      expect(session.getStorageKey().length).toBe(32);

      vault.lockSpace(env.spaceId);

      expect(session.isActive()).toBe(false);
      expect(vault.getActiveSession(env.spaceId)).toBeUndefined();
      expect(() => session.getStorageKey()).toThrow(/locked or destroyed/);
    });

    it('should lock all active sessions upon lockAll()', () => {
      const env1 = vault.createSpace({ name: 'Space 1', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
      const env2 = vault.createSpace({ name: 'Space 2', password: 'Pass2', kdfParams: FAST_TEST_KDF_PARAMS });

      const s1 = vault.unlockSpace('Pass1');
      const s2 = vault.unlockSpace('Pass2');

      expect(s1.isActive()).toBe(true);
      expect(s2.isActive()).toBe(true);

      vault.lockAll();

      expect(s1.isActive()).toBe(false);
      expect(s2.isActive()).toBe(false);
      expect(vault.getActiveSession(env1.spaceId)).toBeUndefined();
      expect(vault.getActiveSession(env2.spaceId)).toBeUndefined();
    });
  });

  describe('Transactional, Crash-Safe Password Change', () => {
    it('should rewrap SMK under new KEK with a fresh salt/AAD and reject old password', () => {
      const env = vault.createSpace({
        name: 'Secure Space',
        password: 'OriginalPassword123!',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      // Get original storage key
      const session1 = vault.unlockSpace('OriginalPassword123!');
      const originalStorageKey = new Uint8Array(session1.getStorageKey());
      vault.lockSpace(env.spaceId);

      // Change password
      const updatedEnv = vault.changePassword(
        env.spaceId,
        'OriginalPassword123!',
        'NewStrongPassword456!',
        FAST_TEST_KDF_PARAMS
      );

      expect(updatedEnv.kdfParams.salt).not.toBe(env.kdfParams.salt);
      expect(updatedEnv.encryptedMasterKey.nonce).not.toBe(env.encryptedMasterKey.nonce);

      // Old password must fail
      expect(() => vault.unlockSpace('OriginalPassword123!')).toThrow(
        'Unable to unlock Space: invalid credentials or corrupted envelope'
      );

      // New password must succeed and derive the exact same StorageKey
      const session2 = vault.unlockSpace('NewStrongPassword456!');
      expect(session2.spaceId).toBe(env.spaceId);
      expect(constantTimeEquals(session2.getStorageKey(), originalStorageKey)).toBe(true);
    });

    it('CRASH-SAFE ROLLBACK: should leave original envelope intact if password change fails', () => {
      const env = vault.createSpace({
        name: 'Rollback Space',
        password: 'ValidInitialPassword',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const initialEnvelopeSnapshot = JSON.stringify(vault.getEnvelope(env.spaceId));

      // Attempt password change with wrong old password -> must throw
      expect(() =>
        vault.changePassword(env.spaceId, 'WrongCurrentPassword', 'NewPassword', FAST_TEST_KDF_PARAMS)
      ).toThrow('Failed to change password: invalid current credentials');

      // Assert envelope was NOT corrupted, deleted, or partially modified
      const currentEnvelopeSnapshot = JSON.stringify(vault.getEnvelope(env.spaceId));
      expect(currentEnvelopeSnapshot).toBe(initialEnvelopeSnapshot);

      // Original password still unlocks cleanly
      const session = vault.unlockSpace('ValidInitialPassword');
      expect(session.isActive()).toBe(true);
    });
  });

  describe('Space Deletion', () => {
    it('should delete envelope and destroy active session', () => {
      const env = vault.createSpace({ name: 'Temp Space', password: 'TempPass', kdfParams: FAST_TEST_KDF_PARAMS });
      const session = vault.unlockSpace('TempPass');

      vault.deleteSpace(env.spaceId);

      expect(vault.getEnvelope(env.spaceId)).toBeUndefined();
      expect(vault.listEnvelopes().length).toBe(0);
      expect(session.isActive()).toBe(false);
      expect(() => vault.unlockSpace('TempPass')).toThrow();
    });
  });
});
