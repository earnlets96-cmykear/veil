/**
 * Account Manager & Zero-Knowledge Identity Recovery for VEIL.
 *
 * Implements client-side account registration, authentication, device management,
 * and zero-knowledge encrypted identity backup/restore.
 *
 * HARD SECURITY INVARIANTS:
 * - Zero Plaintext Keys to Server: Server never receives password, Master Key, or private keys.
 * - Recovery Key Derivation: Argon2id KDF derives recovery KEK client-side.
 * - Identity Continuity: Restored accounts recreate the identical Space Master Key,
 *   yielding the exact same Ed25519 identityId byte-for-byte.
 */

import { deriveKeyArgon2id, FAST_TEST_KDF_PARAMS } from '../crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes, bytesToHex, randomBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import type { CloudClient } from '../network/cloudClient.ts';
import { SpaceVaultManager } from '../spaces/vault.ts';
import { SpaceIdentityManager } from '../identity/manager.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import type { IStorageAdapter } from '../storage/indexedDbAdapter.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { IdentityDocument } from '../identity/document.ts';
import type { KdfParameters } from '../types/index.ts';

export interface IdentityBackupPayload {
  version: 1;
  spaceId: string;
  spaceName: string;
  masterKeyBase64: string;
  identityDocument: IdentityDocument;
  signingPrivateKeyBase64: string;
  keyAgreementPrivateKeyBase64: string;
  createdAt: number;
}

export class AccountManager {
  private cloudClient: CloudClient;
  private vault: SpaceVaultManager;
  private idMgr: SpaceIdentityManager;
  private store: EncryptedSpaceStore;
  private storageAdapter: IStorageAdapter;

  constructor(
    cloudClient: CloudClient,
    vault: SpaceVaultManager,
    idMgr: SpaceIdentityManager,
    store: EncryptedSpaceStore,
    storageAdapter: IStorageAdapter
  ) {
    this.cloudClient = cloudClient;
    this.vault = vault;
    this.idMgr = idMgr;
    this.store = store;
    this.storageAdapter = storageAdapter;
  }

  /**
   * Registers a new account, generates deterministic cryptographic identity,
   * creates zero-knowledge encrypted cloud backup, and initializes local space.
   */
  public async registerAccount(params: {
    username: string;
    password: string;
    spaceName?: string;
    deviceName?: string;
    kdfParams?: Partial<KdfParameters>;
  }): Promise<{
    account: any;
    session: SpaceSession;
    identityDoc: IdentityDocument;
  }> {
    const { username, password } = params;
    const spaceName = params.spaceName || 'Main Space';
    const deviceId = `dev_${bytesToHex(randomBytes(8))}`;
    const deviceName = params.deviceName || 'Primary Device';

    // 1. Create local Space and unlock session
    const spaceHeader = this.vault.createSpace({
      name: spaceName,
      password,
      kdfParams: params.kdfParams,
    });
    await this.vault.saveEnvelopeToStorage(spaceHeader, this.storageAdapter);

    const session = this.vault.unlockSpace(password, spaceHeader.spaceId);

    // 2. Generate deterministic cryptographic identity
    const identityDoc = this.idMgr.createIdentity(session, this.store);
    const loadedId = this.idMgr.loadIdentity(session, this.store);
    if (!loadedId) {
      throw new Error('Failed to load generated identity');
    }

    // 3. Create zero-knowledge encrypted identity backup
    const salt = randomBytes(32);
    const kdfConfig: KdfParameters = {
      algorithm: 'argon2id',
      salt: bytesToBase64(salt),
      timeCost: params.kdfParams?.timeCost ?? 3,
      memoryCost: params.kdfParams?.memoryCost ?? 65536,
      parallelism: params.kdfParams?.parallelism ?? 1,
      keyLength: 32,
    };

    const kek = deriveKeyArgon2id(password, salt, kdfConfig);
    const masterKey = session.getMasterKey();

    const backupPayload: IdentityBackupPayload = {
      version: 1,
      spaceId: session.spaceId,
      spaceName,
      masterKeyBase64: bytesToBase64(masterKey),
      identityDocument: identityDoc,
      signingPrivateKeyBase64: bytesToBase64(loadedId.signingPrivateKey),
      keyAgreementPrivateKeyBase64: bytesToBase64(loadedId.keyAgreementPrivateKey),
      createdAt: Date.now(),
    };

    const aad = new TextEncoder().encode(`VEIL-IDENTITY-BACKUP-v1|user:${username.toLowerCase()}`);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(
      kek,
      JSON.stringify(backupPayload),
      aad
    );

    zeroize(kek);

    const encryptedVaultBlob = JSON.stringify({
      format: 'VEIL-IDENTITY-BACKUP-v1',
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
    });

    // 4. Register account on cloud server
    const regResult = await this.cloudClient.registerAccount({
      username,
      password,
      deviceId,
      deviceName,
      deviceSigningPub: identityDoc.signingPublicKey,
      deviceKeyAgreementPub: identityDoc.keyAgreementPublicKey,
    });

    // 5. Store zero-knowledge backup blob on cloud server
    await this.cloudClient.setRecoveryVault(encryptedVaultBlob, kdfConfig);

    // 6. Save cloud session credentials inside encrypted space store
    if (regResult.session && regResult.session.sessionToken) {
      this.store.set(session, 'veil:cloud:session', {
        sessionToken: regResult.session.sessionToken,
        accountId: regResult.account.accountId,
        deviceId: regResult.device.deviceId,
        expiresAt: regResult.session.expiresAt,
        username: username.toLowerCase(),
      });
    }

    return {
      account: regResult.account,
      session,
      identityDoc,
    };
  }

  /**
   * Restores an existing account on a fresh device / reinstalled app.
   * Authenticates with server, downloads encrypted identity backup, decrypts locally,
   * and recreates the EXACT same Space Master Key & Ed25519 identityId.
   */
  public async restoreAccount(params: {
    username: string;
    password: string;
    deviceName?: string;
    customKdfParams?: Partial<KdfParameters>;
  }): Promise<{
    account: any;
    session: SpaceSession;
    identityDoc: IdentityDocument;
  }> {
    const { username, password } = params;
    const deviceId = `dev_${bytesToHex(randomBytes(8))}`;
    const deviceName = params.deviceName || 'Restored Device';

    // 1. Authenticate and fetch recovery vault blob
    const restoreRes = await this.cloudClient.restoreAccount({
      username,
      password,
      deviceId,
      deviceName,
    });

    if (!restoreRes.recovery || !restoreRes.recovery.encryptedVaultBlob) {
      throw new Error('Account has no encrypted identity backup on cloud server');
    }

    const recoveryRecord = restoreRes.recovery;
    const kdfParams: KdfParameters =
      typeof recoveryRecord.kdfParams === 'string'
        ? JSON.parse(recoveryRecord.kdfParams)
        : recoveryRecord.kdfParams;

    const vaultBlob = JSON.parse(recoveryRecord.encryptedVaultBlob);
    const salt = base64ToBytes(kdfParams.salt);
    const kek = deriveKeyArgon2id(password, salt, kdfParams);

    const nonce = base64ToBytes(vaultBlob.nonce);
    const ciphertext = base64ToBytes(vaultBlob.ciphertext);
    const aad = new TextEncoder().encode(`VEIL-IDENTITY-BACKUP-v1|user:${username.toLowerCase()}`);

    let backupData: IdentityBackupPayload;
    try {
      const decryptedBytes = decryptXChaCha20Poly1305(kek, nonce, ciphertext, aad);
      backupData = JSON.parse(new TextDecoder().decode(decryptedBytes));
    } catch (_e) {
      throw new Error('Failed to decrypt identity backup: invalid password or corrupted backup');
    } finally {
      zeroize(kek);
    }

    const recoveredMasterKey = base64ToBytes(backupData.masterKeyBase64);

    try {
      // 2. Recreate Space locally using original Master Key and Space ID
      const spaceHeader = this.vault.createSpace({
        spaceId: backupData.spaceId,
        name: backupData.spaceName,
        password,
        masterKey: recoveredMasterKey,
        kdfParams: params.customKdfParams || kdfParams,
      });

      await this.vault.saveEnvelopeToStorage(spaceHeader, this.storageAdapter);

      // 3. Unlock Space
      const session = this.vault.unlockSpace(password, spaceHeader.spaceId);

      // 4. Save identity documents and private keys into local store
      this.store.set(session, 'veil:identity:document', backupData.identityDocument);
      this.store.set(session, 'veil:identity:signing-private', backupData.signingPrivateKeyBase64);
      this.store.set(session, 'veil:identity:ka-private', backupData.keyAgreementPrivateKeyBase64);

      // 5. Save restored cloud session credentials inside encrypted space store
      if (restoreRes.session && restoreRes.session.sessionToken) {
        this.store.set(session, 'veil:cloud:session', {
          sessionToken: restoreRes.session.sessionToken,
          accountId: restoreRes.account.accountId,
          deviceId: restoreRes.device.deviceId,
          expiresAt: restoreRes.session.expiresAt,
          username: username.toLowerCase(),
        });
      }

      return {
        account: restoreRes.account,
        session,
        identityDoc: backupData.identityDocument,
      };
    } finally {
      zeroize(recoveredMasterKey);
    }
  }

  /**
   * Pushes/refreshes a zero-knowledge recovery vault for an existing Space session.
   */
  public async createOrUpdateRecoveryVault(
    session: SpaceSession,
    password: string,
    username: string,
    customKdfParams?: Partial<KdfParameters>
  ): Promise<void> {
    const loadedId = this.idMgr.loadIdentity(session, this.store);
    if (!loadedId) {
      throw new Error('No identity loaded for Space session');
    }

    const salt = randomBytes(32);
    const kdfConfig: KdfParameters = {
      algorithm: 'argon2id',
      salt: bytesToBase64(salt),
      timeCost: customKdfParams?.timeCost ?? 3,
      memoryCost: customKdfParams?.memoryCost ?? 65536,
      parallelism: customKdfParams?.parallelism ?? 1,
      keyLength: 32,
    };

    const kek = deriveKeyArgon2id(password, salt, kdfConfig);
    const masterKey = session.getMasterKey();

    const backupPayload: IdentityBackupPayload = {
      version: 1,
      spaceId: session.spaceId,
      spaceName: session.name,
      masterKeyBase64: bytesToBase64(masterKey),
      identityDocument: loadedId.document,
      signingPrivateKeyBase64: bytesToBase64(loadedId.signingPrivateKey),
      keyAgreementPrivateKeyBase64: bytesToBase64(loadedId.keyAgreementPrivateKey),
      createdAt: Date.now(),
    };

    const aad = new TextEncoder().encode(`VEIL-IDENTITY-BACKUP-v1|user:${username.toLowerCase()}`);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(
      kek,
      JSON.stringify(backupPayload),
      aad
    );

    zeroize(kek);

    const encryptedVaultBlob = JSON.stringify({
      format: 'VEIL-IDENTITY-BACKUP-v1',
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
    });

    await this.cloudClient.setRecoveryVault(encryptedVaultBlob, kdfConfig);
  }
}

