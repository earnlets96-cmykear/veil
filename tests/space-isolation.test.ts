import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { constantTimeEquals, base64ToBytes } from '../src/crypto/utils.ts';
import { decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';

describe('VEIL Phase 1: Multi-Space Cryptographic Isolation & Cross-Space Attack Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
  });

  describe('Cryptographic Key Material Independence', () => {
    it('should assign completely independent cryptographic material to Main Space and Private Space', () => {
      const mainEnv = vault.createSpace({
        name: 'Main Space',
        password: 'MainSpacePassword123!',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const privateEnv = vault.createSpace({
        name: 'Private Space',
        password: 'PrivateSpacePassword456!',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      // Salts must be distinct
      expect(mainEnv.kdfParams.salt).not.toBe(privateEnv.kdfParams.salt);

      const mainSession = vault.unlockSpace('MainSpacePassword123!');
      const privateSession = vault.unlockSpace('PrivateSpacePassword456!');

      const mainStorageKey = mainSession.getStorageKey();
      const privateStorageKey = privateSession.getStorageKey();

      const mainIdentitySeed = mainSession.getIdentitySeed();
      const privateIdentitySeed = privateSession.getIdentitySeed();

      // Storage keys and identity seeds must be mathematically distinct
      expect(constantTimeEquals(mainStorageKey, privateStorageKey)).toBe(false);
      expect(constantTimeEquals(mainIdentitySeed, privateIdentitySeed)).toBe(false);
    });
  });

  describe('Storage Partition Isolation & Cross-Space Attack Tests', () => {
    it('should allow active Space to write and read its own encrypted records', () => {
      vault.createSpace({
        name: 'Main Space',
        password: 'MainPassword',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const session = vault.unlockSpace('MainPassword');

      store.set(session, 'contacts', [{ id: '1', name: 'Alice' }]);
      store.set(session, 'settings', { theme: 'dark', notifications: true });

      const contacts = store.get<Array<{ id: string; name: string }>>(session, 'contacts');
      const settings = store.get<{ theme: string }>(session, 'settings');

      expect(contacts).toEqual([{ id: '1', name: 'Alice' }]);
      expect(settings?.theme).toBe('dark');
    });

    it('CROSS-SPACE ATTACK: Space B cannot decrypt raw ciphertext records from Space A', () => {
      const mainEnv = vault.createSpace({
        name: 'Main Space',
        password: 'MainPassword',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const privateEnv = vault.createSpace({
        name: 'Private Space',
        password: 'PrivatePassword',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const mainSession = vault.unlockSpace('MainPassword');
      const privateSession = vault.unlockSpace('PrivatePassword');

      // Main Space writes confidential message
      store.set(mainSession, 'secret_notes', 'Highly confidential Main Space plaintext');

      // Verify raw partition on disk is ciphertext
      const rawPartition = store.getRawPartition(mainEnv.spaceId);
      expect(rawPartition).toBeDefined();
      const record = rawPartition!.get('secret_notes')!;
      expect(record).toBeDefined();
      expect(record.ciphertext).not.toContain('Highly confidential');

      // Attempt to decrypt Main Space record using Private Space's StorageKey -> MUST FAIL
      const privateStorageKey = privateSession.getStorageKey();
      const nonce = base64ToBytes(record.nonce);
      const ciphertext = base64ToBytes(record.ciphertext);

      expect(() => decryptXChaCha20Poly1305(privateStorageKey, nonce, ciphertext)).toThrow(
        'Decryption failed: corrupted ciphertext or authentication tag mismatch'
      );
    });

    it('LOCKED SPACE ATTACK: Cannot access records when Space is locked', () => {
      const env = vault.createSpace({
        name: 'Protected Space',
        password: 'Password123',
        kdfParams: FAST_TEST_KDF_PARAMS,
      });

      const session = vault.unlockSpace('Password123');
      store.set(session, 'chat_history', ['msg 1', 'msg 2']);

      // Lock Space
      vault.lockSpace(env.spaceId);

      // Attempt to read or write using expired session -> MUST FAIL
      expect(() => store.get(session, 'chat_history')).toThrow(/locked or destroyed/);
      expect(() => store.set(session, 'chat_history', ['msg 3'])).toThrow(/locked or destroyed/);
    });
  });

  describe('100-Space Independence Scale Test', () => {
    it('should generate 100 distinct salts, 100 distinct envelopes, and 100 distinct storage keys', () => {
      const createdEnvelopes: string[] = [];
      const saltsSet = new Set<string>();
      const noncesSet = new Set<string>();
      const ciphertextsSet = new Set<string>();
      const storageKeysHex = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const singleVault = new SpaceVaultManager();
        const password = `SpacePassword_${i}_#Secure`;
        const env = singleVault.createSpace({
          name: `Space_${i}`,
          password,
          kdfParams: FAST_TEST_KDF_PARAMS,
        });

        createdEnvelopes.push(env.spaceId);
        saltsSet.add(env.kdfParams.salt);
        noncesSet.add(env.encryptedMasterKey.nonce);
        ciphertextsSet.add(env.encryptedMasterKey.ciphertext);

        // Unlock and collect derived storage key hex
        const session = singleVault.unlockSpace(password);
        const hexKey = Array.from(session.getStorageKey())
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        storageKeysHex.add(hexKey);
        singleVault.lockSpace(env.spaceId);
      }

      // Assert all 100 salts, nonces, ciphertexts, and storage keys are 100% distinct
      expect(saltsSet.size).toBe(100);
      expect(noncesSet.size).toBe(100);
      expect(ciphertextsSet.size).toBe(100);
      expect(storageKeysHex.size).toBe(100);
      expect(createdEnvelopes.length).toBe(100);
    });
  });
});
