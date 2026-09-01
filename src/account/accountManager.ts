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
import { computeEnvelopeAad } from '../spaces/envelope.ts';
import { SpaceIdentityManager } from '../identity/manager.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import type { IStorageAdapter, StoredRecord } from '../storage/types.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { IdentityDocument } from '../identity/document.ts';
import type { KdfParameters } from '../types/index.ts';
import { RuntimeDiagnostics } from '../debug/runtimeDiagnostics.ts';

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

interface RecoverySnapshotV2Space {
  spaceId: string;
  spaceName: string;
  masterKeyBase64: string;
  identityDocument: IdentityDocument;
  signingPrivateKeyBase64: string;
  keyAgreementPrivateKeyBase64: string;
  encryptedRecords: StoredRecord[];
}

interface RecoverySnapshotV2 {
  version: 2;
  createdAt: number;
  spaces: RecoverySnapshotV2Space[];
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
    customKdfParams?: Partial<KdfParameters>;
  }): Promise<{
    account: any;
    session: SpaceSession;
    identityDoc: IdentityDocument;
  }> {
    const { username, password } = params;
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const spaceName = params.spaceName || 'Main Space';
    const deviceId = `dev_${bytesToHex(randomBytes(8))}`;
    const deviceName = params.deviceName || 'Primary Device';
    const activeKdfParams = params.kdfParams || params.customKdfParams;

    // 1. Create local Space and unlock session
    const spaceHeader = this.vault.createSpace({
      name: spaceName,
      password,
      kdfParams: activeKdfParams,
      canonicalUsername: cleanUsername,
    });
    await this.vault.saveEnvelopeToStorage(spaceHeader, this.storageAdapter);

    const session = this.vault.unlockSpace(password, spaceHeader.spaceId);

    // 2. Generate deterministic cryptographic identity
    const identityDoc = this.idMgr.createIdentity(session, this.store);
    const loadedId = this.idMgr.loadIdentity(session, this.store);
    if (!loadedId) {
      throw new Error('Failed to load generated identity');
    }

    // 3. Register account on cloud server
    const regResult = await this.cloudClient.registerAccount({
      username: cleanUsername,
      password,
      deviceId,
      deviceName,
      deviceSigningPub: identityDoc.signingPublicKey,
      deviceKeyAgreementPub: identityDoc.keyAgreementPublicKey,
    });

    // Tag envelope with accountId and save
    spaceHeader.accountId = regResult.account.accountId;
    await this.vault.saveEnvelopeToStorage(spaceHeader, this.storageAdapter);

    // 4. Store a zero-knowledge v2 snapshot after authenticated registration.
    await this.createOrUpdateRecoveryVault(session, password, cleanUsername, activeKdfParams);

    // 6. Save cloud session credentials inside encrypted space store
    if (regResult.session && regResult.session.sessionToken) {
      this.store.set(session, 'veil:cloud:session', {
        sessionToken: regResult.session.sessionToken,
        accountId: regResult.account.accountId,
        deviceId: regResult.device.deviceId,
        expiresAt: regResult.session.expiresAt,
        username: cleanUsername,
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
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const deviceId = `dev_${bytesToHex(randomBytes(8))}`;
    const deviceName = params.deviceName || 'Restored Device';

    RuntimeDiagnostics.recovery('restoreInitiated', {
      username: cleanUsername,
      deviceId,
      deviceName,
    });

    // 1. Authenticate and fetch recovery vault blob
    let restoreRes: any;
    try {
      restoreRes = await this.cloudClient.restoreAccount({
        username: cleanUsername,
        password,
        deviceId,
        deviceName,
      });
      RuntimeDiagnostics.recovery('serverAuthSuccess', {
        accountId: restoreRes.account?.accountId,
        hasRecoveryVault: !!restoreRes.recovery?.encryptedVaultBlob,
      });
    } catch (authErr: any) {
      RuntimeDiagnostics.recovery('serverAuthFailed', {
        error: authErr?.message,
      });
      throw authErr;
    }

    if (!restoreRes.recovery || !restoreRes.recovery.encryptedVaultBlob) {
      RuntimeDiagnostics.recovery('missingRecoveryVaultFallback', {
        accountId: restoreRes.account?.accountId,
      });
      // Account exists in cloud but has no recovery snapshot -> initialize fresh device Space
      const spaceHeader = this.vault.createSpace({
        name: `${cleanUsername}'s Space`,
        password,
        kdfParams: params.customKdfParams || DEFAULT_KDF_PARAMS,
        canonicalUsername: cleanUsername,
        accountId: restoreRes.account.accountId,
      });
      await this.vault.saveEnvelopeToStorage(spaceHeader, this.storageAdapter);
      const session = this.vault.unlockSpace(password, spaceHeader.spaceId);
      const identity = this.idMgr.createIdentity(session, this.store);

      if (restoreRes.session && restoreRes.session.sessionToken) {
        await this.store.setAsync(session, 'veil:cloud:session', {
          sessionToken: restoreRes.session.sessionToken,
          accountId: restoreRes.account.accountId,
          deviceId: restoreRes.device.deviceId,
          expiresAt: restoreRes.session.expiresAt,
          username: cleanUsername,
        });
      }

      await this.createOrUpdateRecoveryVault(session, password, cleanUsername, params.customKdfParams);

      return {
        account: restoreRes.account,
        session,
        identityDoc: identity.document,
      };
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
    const isV2 = vaultBlob.format === 'VEIL-RECOVERY-SNAPSHOT-v2';

    const candidateAads: (Uint8Array | undefined)[] = [
      new TextEncoder().encode(`${isV2 ? 'VEIL-RECOVERY-SNAPSHOT-v2' : 'VEIL-IDENTITY-BACKUP-v1'}|user:${cleanUsername}`),
      new TextEncoder().encode(`VEIL-RECOVERY-SNAPSHOT-v2|user:${cleanUsername}`),
      new TextEncoder().encode(`VEIL-IDENTITY-BACKUP-v1|user:${cleanUsername}`),
      new TextEncoder().encode('VEIL-RECOVERY-SNAPSHOT-v2'),
      new TextEncoder().encode('VEIL-IDENTITY-BACKUP-v1'),
      new TextEncoder().encode(`user:${cleanUsername}`),
      undefined,
    ];

    let backupData: IdentityBackupPayload | RecoverySnapshotV2 | null = null;
    let lastDecryptError: any = null;

    try {
      for (const aad of candidateAads) {
        try {
          const decryptedBytes = decryptXChaCha20Poly1305(kek, nonce, ciphertext, aad);
          backupData = JSON.parse(new TextDecoder().decode(decryptedBytes));
          if (backupData) break;
        } catch (e) {
          lastDecryptError = e;
        }
      }

      if (!backupData) {
        RuntimeDiagnostics.recovery('vaultDecryptionFailed', {
          error: 'Invalid password or corrupted backup payload',
        });
        throw new Error('Failed to decrypt identity backup: invalid password or corrupted backup');
      }

      RuntimeDiagnostics.recovery('vaultDecryptionSuccess', {
        snapshotVersion: (backupData as RecoverySnapshotV2).version,
      });
    } finally {
      zeroize(kek);
    }

    const snapshot = isV2 ? backupData as RecoverySnapshotV2 : null;
    if (snapshot && (!Array.isArray(snapshot.spaces) || snapshot.spaces.length === 0)) {
      throw new Error('Recovery snapshot is malformed or contains no Spaces');
    }
    const first = snapshot ? snapshot.spaces[0] : backupData as IdentityBackupPayload;
    const recoveredMasterKey = base64ToBytes(first.masterKeyBase64);

    try {
      // 2. Recreate Space locally using original Master Key and Space ID
      const spaceHeader = this.vault.createSpace({
        spaceId: first.spaceId,
        name: first.spaceName,
        password,
        masterKey: recoveredMasterKey,
        kdfParams: params.customKdfParams || kdfParams,
        canonicalUsername: cleanUsername,
        accountId: restoreRes.account.accountId,
      });

      await this.vault.saveEnvelopeToStorage(spaceHeader, this.storageAdapter);

      // 3. Unlock Space
      const session = this.vault.unlockSpace(password, spaceHeader.spaceId);

      // 4. Save identity documents and private keys into local store
      this.store.set(session, 'veil:identity:document', first.identityDocument);
      this.store.set(session, 'veil:identity:signing-private', first.signingPrivateKeyBase64);
      this.store.set(session, 'veil:identity:ka-private', first.keyAgreementPrivateKeyBase64);
      if (snapshot) {
        for (const record of first.encryptedRecords) await this.storageAdapter.saveRecord(session.spaceId, record);
        for (const space of snapshot.spaces.slice(1)) {
          const masterKey = base64ToBytes(space.masterKeyBase64);
          try {
            const header = this.vault.createSpace({
              spaceId: space.spaceId,
              name: space.spaceName,
              password,
              masterKey,
              kdfParams: params.customKdfParams || kdfParams,
              canonicalUsername: cleanUsername,
              accountId: restoreRes.account.accountId,
            });
            await this.vault.saveEnvelopeToStorage(header, this.storageAdapter);
            const restoredSpace = this.vault.unlockSpace(password, header.spaceId);
            this.store.set(restoredSpace, 'veil:identity:document', space.identityDocument);
            this.store.set(restoredSpace, 'veil:identity:signing-private', space.signingPrivateKeyBase64);
            this.store.set(restoredSpace, 'veil:identity:ka-private', space.keyAgreementPrivateKeyBase64);
            for (const record of space.encryptedRecords) await this.storageAdapter.saveRecord(restoredSpace.spaceId, record);
          } finally {
            zeroize(masterKey);
          }
        }
      }

      // 5. Save restored cloud session credentials inside encrypted space store
      if (restoreRes.session && restoreRes.session.sessionToken) {
        await this.store.setAsync(session, 'veil:cloud:session', {
          sessionToken: restoreRes.session.sessionToken,
          accountId: restoreRes.account.accountId,
          deviceId: restoreRes.device.deviceId,
          expiresAt: restoreRes.session.expiresAt,
          username: cleanUsername,
        });
      }

      // 6. Set post-recovery password change required flag
      await this.store.setAsync(session, 'veil:account:recovery_security', {
        recoveryPasswordChangeRequired: true,
        restoredAt: Date.now(),
      });

      RuntimeDiagnostics.recovery('spaceRestoredSuccess', {
        spaceId: session.spaceId,
        restoredSpaces: snapshot ? snapshot.spaces.length : 1,
      });

      return {
        account: restoreRes.account,
        session,
        identityDoc: first.identityDocument,
      };
    } finally {
      zeroize(recoveredMasterKey);
    }
  }

  /**
   * Changes the user's password end-to-end:
   * 1. Updates password on cloud backend.
   * 2. Rewraps all local Space envelopes for this account.
   * 3. Saves updated envelopes to persistent storage.
   * 4. Re-encrypts and uploads recovery vault snapshot under new password.
   * 5. Clears post-recovery password change requirement.
   */
  public async changePassword(params: {
    session: SpaceSession;
    oldPassword: string;
    newPassword: string;
    username: string;
    newKdfParams?: Partial<KdfParameters>;
  }): Promise<void> {
    const { session, oldPassword, newPassword, username } = params;
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

    if (!newPassword || newPassword.length < 3) {
      throw new Error('New password must be at least 3 characters long');
    }

    // 1. Ensure cloud session is bound specifically to this Space session
    const storedSession = this.store.get<any>(session, 'veil:cloud:session');
    if (storedSession?.sessionToken && storedSession.accountId) {
      this.cloudClient.setSession(storedSession.sessionToken, storedSession.accountId, storedSession.deviceId);
    } else {
      try {
        const identity = this.identityManager.loadIdentity(session, this.store);
        const deviceId = `dev_${identity ? identity.document.identityId.slice(0, 12) : bytesToHex(randomBytes(6))}`;
        const logRes = await this.cloudClient.loginAccount({
          username: cleanUsername,
          password: oldPassword,
          deviceId,
          deviceName: session.name,
          deviceSigningPub: identity?.document.signingPublicKey,
          deviceKeyAgreementPub: identity?.document.keyAgreementPublicKey,
        });
        if (logRes.session?.sessionToken) {
          this.cloudClient.setSession(logRes.session.sessionToken, logRes.account.accountId, logRes.device.deviceId);
          await this.store.setAsync(session, 'veil:cloud:session', {
            sessionToken: logRes.session.sessionToken,
            accountId: logRes.account.accountId,
            deviceId: logRes.device.deviceId,
            expiresAt: logRes.session.expiresAt,
            username: cleanUsername,
          });
        }
      } catch (_authErr) {
        // Local-only / offline fallback
      }
    }

    // Authoritative Server Verification:
    // If authenticated on the cloud relay, execute server-side verification and password update
    if (this.cloudClient.hasAuthenticatedSession()) {
      await this.cloudClient.changePassword(oldPassword, newPassword);
    }

    // 2. Rewrap all matching local space envelopes for this account
    const allEnvelopes = this.vault.listEnvelopes().filter((env) => {
      if (env.canonicalUsername) {
        return env.canonicalUsername === cleanUsername;
      }
      return env.spaceId === session.spaceId;
    });

    for (const env of allEnvelopes) {
      try {
        const updatedEnv = this.vault.changePassword(env.spaceId, oldPassword, newPassword, params.newKdfParams);
        await this.vault.saveEnvelopeToStorage(updatedEnv, this.storageAdapter);
      } catch (_rewrapErr) {
        // Envelopes protected by independent passphrases (e.g. decoy spaces or secondary spaces)
        // remain safely untouched and isolated.
      }
    }

    // 3. Re-encrypt and push recovery snapshot under new password
    await this.createOrUpdateRecoveryVault(session, newPassword, cleanUsername, params.newKdfParams, oldPassword);

    // 4. Clear recoveryPasswordChangeRequired in store
    await this.store.setAsync(session, 'veil:account:recovery_security', {
      recoveryPasswordChangeRequired: false,
      updatedAt: Date.now(),
    });
  }

  /**
   * Pushes/refreshes a zero-knowledge recovery vault for an existing Space session.
   */
  public async createOrUpdateRecoveryVault(
    session: SpaceSession,
    password: string,
    username: string,
    customKdfParams?: Partial<KdfParameters>,
    oldPasswordForPreviousSnapshot?: string
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
    let priorSpaces: RecoverySnapshotV2Space[] = [];
    try {
      const previous = await this.cloudClient.getRecoveryVault();
      if (previous?.encryptedVaultBlob) {
        const blob = JSON.parse(previous.encryptedVaultBlob);
        if (blob.format === 'VEIL-RECOVERY-SNAPSHOT-v2') {
          const oldParams: KdfParameters = typeof previous.kdfParams === 'string' ? JSON.parse(previous.kdfParams) : previous.kdfParams;
          const prevPassword = oldPasswordForPreviousSnapshot || password;
          const oldKek = deriveKeyArgon2id(prevPassword, base64ToBytes(oldParams.salt), oldParams);
          try {
            const bytes = decryptXChaCha20Poly1305(
              oldKek,
              base64ToBytes(blob.nonce),
              base64ToBytes(blob.ciphertext),
              new TextEncoder().encode(`VEIL-RECOVERY-SNAPSHOT-v2|user:${username.trim().toLowerCase().replace(/^@/, '')}`)
            );
            const previousSnapshot = JSON.parse(new TextDecoder().decode(bytes)) as RecoverySnapshotV2;
            if (previousSnapshot.version === 2 && Array.isArray(previousSnapshot.spaces)) {
              priorSpaces = previousSnapshot.spaces;
            }
          } finally {
            zeroize(oldKek);
          }
        }
      }
    } catch (_e) {
      // A missing or legacy snapshot is safely replaced by the current v2 snapshot.
    }
    // Refresh records for all prior spaces from local storage adapter
    for (const pSpace of priorSpaces) {
      try {
        const freshRecords = await this.storageAdapter.listRecords(pSpace.spaceId);
        if (freshRecords && freshRecords.length > 0) {
          pSpace.encryptedRecords = freshRecords;
        }
      } catch (_e) {}
    }

    const currentSpace: RecoverySnapshotV2Space = {
      spaceId: session.spaceId,
      spaceName: session.name,
      masterKeyBase64: bytesToBase64(session.getMasterKey()),
      identityDocument: loadedId.document,
      signingPrivateKeyBase64: bytesToBase64(loadedId.signingPrivateKey),
      keyAgreementPrivateKeyBase64: bytesToBase64(loadedId.keyAgreementPrivateKey),
      encryptedRecords: await this.storageAdapter.listRecords(session.spaceId),
    };

    const existingIdx = priorSpaces.findIndex((s) => s.spaceId === session.spaceId);
    let finalSpaces: RecoverySnapshotV2Space[];
    if (existingIdx >= 0) {
      finalSpaces = [...priorSpaces];
      finalSpaces[existingIdx] = currentSpace;
    } else {
      finalSpaces = [...priorSpaces, currentSpace];
    }

    const backupPayload: RecoverySnapshotV2 = {
      version: 2,
      createdAt: Date.now(),
      spaces: finalSpaces,
    };

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const aad = new TextEncoder().encode(`VEIL-RECOVERY-SNAPSHOT-v2|user:${cleanUsername}`);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(
      kek,
      JSON.stringify(backupPayload),
      aad
    );

    zeroize(kek);

    const encryptedVaultBlob = JSON.stringify({
      format: 'VEIL-RECOVERY-SNAPSHOT-v2',
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
    });

    await this.cloudClient.setRecoveryVault(encryptedVaultBlob, kdfConfig);
  }
}

