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

import { deriveKeyArgon2id, DEFAULT_KDF_PARAMS, FAST_TEST_KDF_PARAMS } from '../crypto/kdf.ts';
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
    allowFreshSpaceCreation?: boolean;
    isEmergencyRecovery?: boolean;
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
      if (!params.allowFreshSpaceCreation) {
        throw new Error('Account has no encrypted identity backup on cloud server');
      }
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
        identityDoc: identity,
      };
    }

    const recoveryRecord = restoreRes.recovery || restoreRes.recoveryVault;
    const kdfParams: KdfParameters =
      typeof recoveryRecord.kdfParams === 'string'
        ? JSON.parse(recoveryRecord.kdfParams)
        : recoveryRecord.kdfParams;

    const vaultBlob =
      typeof recoveryRecord.encryptedVaultBlob === 'string'
        ? JSON.parse(recoveryRecord.encryptedVaultBlob)
        : recoveryRecord;

    const blobBytes = base64ToBytes(vaultBlob.ciphertext || vaultBlob.encryptedBlob || '');
    const nonceBytes = base64ToBytes(vaultBlob.nonce || '');
    const rawSalt = kdfParams?.salt || vaultBlob.salt;
    const saltBytes = typeof rawSalt === 'string' ? base64ToBytes(rawSalt) : new Uint8Array(16);

    // Derive KEK from password and vault salt
    const kek = deriveKeyArgon2id(
      password,
      saltBytes,
      params.customKdfParams || kdfParams
    );

    let backupData: IdentityBackupPayload | RecoverySnapshotV2 | null = null;
    let isV2 = false;

    try {
      // Universal multi-format AAD fallback decryption
      const candidateAads: (Uint8Array | undefined)[] = [
        new TextEncoder().encode(`VEIL-RECOVERY-SNAPSHOT-v2|user:${cleanUsername}`),
        new TextEncoder().encode(`VEIL-IDENTITY-BACKUP-v1|user:${cleanUsername}`),
        new TextEncoder().encode('VEIL-RECOVERY-SNAPSHOT-v2'),
        new TextEncoder().encode('VEIL-IDENTITY-BACKUP-v1'),
        new TextEncoder().encode(`user:${cleanUsername}`),
        undefined,
      ];

      for (const aad of candidateAads) {
        try {
          const decryptedBytes = decryptXChaCha20Poly1305(kek, nonceBytes, blobBytes, aad);
          const parsed = JSON.parse(new TextDecoder().decode(decryptedBytes));
          if (parsed && typeof parsed === 'object') {
            backupData = parsed;
            if ((parsed as RecoverySnapshotV2).version === 2 && Array.isArray((parsed as RecoverySnapshotV2).spaces)) {
              isV2 = true;
            }
            break;
          }
        } catch (_ignore) {}
      }

      // Final fallback for legacy single JSON without AAD
      if (!backupData) {
        try {
          const decryptedBytes = decryptXChaCha20Poly1305(kek, nonceBytes, blobBytes);
          const parsed = JSON.parse(new TextDecoder().decode(decryptedBytes));
          if (parsed && typeof parsed === 'object') {
            backupData = parsed;
            if ((parsed as RecoverySnapshotV2).version === 2 && Array.isArray((parsed as RecoverySnapshotV2).spaces)) {
              isV2 = true;
            }
          }
        } catch (_ignore) {}
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
        for (const record of (first as RecoverySnapshotV2Space).encryptedRecords || []) {
          await this.storageAdapter.saveRecord(session.spaceId, record);
        }
        await this.store.loadPartitionFromStorage(session);

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
            for (const record of space.encryptedRecords) {
              await this.storageAdapter.saveRecord(restoredSpace.spaceId, record);
            }
            await this.store.loadPartitionFromStorage(restoredSpace);
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

      // 6. Set post-recovery security flag ONLY if explicit emergency recovery
      await this.store.setAsync(session, 'veil:account:recovery_security', {
        recoveryPasswordChangeRequired: !!params.isEmergencyRecovery,
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
    customKdfParams?: Partial<KdfParameters>;
  }): Promise<void> {
    const { session, oldPassword, newPassword, username } = params;
    const effectiveKdf = params.newKdfParams || params.customKdfParams;
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
        const identity = this.idMgr.loadIdentity(session, this.store);
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
        }
      } catch (_authErr) {}
    }

    await this.cloudClient.changePassword(oldPassword, newPassword);

    // 2. Rewrap and update all local Space envelopes bound to this account
    const allEnvelopes = this.vault.listEnvelopes().filter((env) => {
      if (env.canonicalUsername) {
        return env.canonicalUsername === cleanUsername;
      }
      return env.spaceId === session.spaceId;
    });

    for (const env of allEnvelopes) {
      try {
        const updatedEnv = this.vault.changePassword(env.spaceId, oldPassword, newPassword, effectiveKdf);
        await this.vault.saveEnvelopeToStorage(updatedEnv, this.storageAdapter);
      } catch (_rewrapErr) {
        // Envelopes protected by independent passphrases (e.g. decoy spaces or secondary spaces)
        // remain safely untouched and isolated.
      }
    }

    // 3. Re-encrypt and push recovery snapshot under new password
    await this.createOrUpdateRecoveryVault(session, newPassword, cleanUsername, effectiveKdf, oldPassword);

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

    const existingIdx = priorSpaces.findIndex((s) => s.spaceId === session.spaceId);
    let remoteRecordsForSessionSpace: StoredRecord[] = [];
    if (existingIdx >= 0) {
      remoteRecordsForSessionSpace = priorSpaces[existingIdx].encryptedRecords || [];
    }

    // Refresh records for any other prior spaces from local storage adapter if present
    for (const pSpace of priorSpaces) {
      if (pSpace.spaceId === session.spaceId) continue;
      try {
        const freshRecords = await this.storageAdapter.listRecords(pSpace.spaceId);
        if (freshRecords && freshRecords.length > 0) {
          pSpace.encryptedRecords = freshRecords;
        }
      } catch (_e) {}
    }

    // Perform deterministic deep merge between local records and remote snapshot records
    const localRecords = await this.storageAdapter.listRecords(session.spaceId);
    let finalMergedRecords = localRecords;

    if (remoteRecordsForSessionSpace.length > 0) {
      finalMergedRecords = this.mergeRecordsForSpace(session, localRecords, remoteRecordsForSessionSpace);

      // Persist merged records locally into storage adapter and in-memory store
      for (const rec of finalMergedRecords) {
        await this.storageAdapter.saveRecord(session.spaceId, rec);
      }
      try {
        await this.store.loadPartitionFromStorage(session);
      } catch (_e) {}
    }

    const currentSpace: RecoverySnapshotV2Space = {
      spaceId: session.spaceId,
      spaceName: session.name,
      masterKeyBase64: bytesToBase64(session.getMasterKey()),
      identityDocument: loadedId.document,
      signingPrivateKeyBase64: bytesToBase64(loadedId.signingPrivateKey),
      keyAgreementPrivateKeyBase64: bytesToBase64(loadedId.keyAgreementPrivateKey),
      encryptedRecords: finalMergedRecords,
    };

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

  /**
   * Deterministically merges local and remote encrypted partition records for a Space.
   * Ensures message status monotonicity, applies tombstones (anti-resurrection),
   * and merges conversations, contacts, mute settings, blocklists, and profiles.
   */
  private mergeRecordsForSpace(
    session: SpaceSession,
    localRecords: StoredRecord[],
    remoteRecords: StoredRecord[]
  ): StoredRecord[] {
    const storageKey = session.getStorageKey();
    const localMap = new Map<string, StoredRecord>(localRecords.map((r) => [r.key, r]));
    const remoteMap = new Map<string, StoredRecord>(remoteRecords.map((r) => [r.key, r]));
    const allKeys = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
    const mergedRecords: StoredRecord[] = [];

    const decryptRec = <T>(rec: StoredRecord): T | null => {
      try {
        const nonce = base64ToBytes(rec.nonce);
        const ciphertext = base64ToBytes(rec.ciphertext);
        const bytes = decryptXChaCha20Poly1305(storageKey, nonce, ciphertext);
        const text = new TextDecoder().decode(bytes);
        try {
          return JSON.parse(text) as T;
        } catch {
          return text as unknown as T;
        }
      } catch {
        return null;
      }
    };

    const encryptRec = (key: string, val: unknown, updatedAt: number): StoredRecord => {
      const text = typeof val === 'string' ? val : JSON.stringify(val);
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(storageKey, text);
      return {
        spaceId: session.spaceId,
        key,
        nonce: bytesToBase64(nonce),
        ciphertext: bytesToBase64(ciphertext),
        updatedAt,
      };
    };

    // 1. Gather all tombstones from local and remote
    const localTombstonesRec = localMap.get('veil:ui:deleted_messages');
    const remoteTombstonesRec = remoteMap.get('veil:ui:deleted_messages');
    const localTombstones = (localTombstonesRec ? decryptRec<any[]>(localTombstonesRec) : null) || [];
    const remoteTombstones = (remoteTombstonesRec ? decryptRec<any[]>(remoteTombstonesRec) : null) || [];
    const tombstoneMap = new Map<string, number>();

    for (const t of [...localTombstones, ...remoteTombstones]) {
      if (t?.messageId) {
        const existing = tombstoneMap.get(t.messageId) || 0;
        tombstoneMap.set(t.messageId, Math.max(existing, Number(t.deletedAt) || 0));
      }
    }

    const mergedTombstonesList = Array.from(tombstoneMap.entries()).map(([messageId, deletedAt]) => ({
      messageId,
      deletedAt,
    }));

    // Gather avatar deletion tombstone from local and remote
    const localAvatarTombstoneRec = localMap.get('veil:avatar:tombstone');
    const remoteAvatarTombstoneRec = remoteMap.get('veil:avatar:tombstone');
    let avatarTombstoneDeletedAt = 0;
    if (localAvatarTombstoneRec) {
      const t = decryptRec<{ deletedAt: number }>(localAvatarTombstoneRec);
      if (t?.deletedAt) avatarTombstoneDeletedAt = Math.max(avatarTombstoneDeletedAt, Number(t.deletedAt) || 0);
    }
    if (remoteAvatarTombstoneRec) {
      const t = decryptRec<{ deletedAt: number }>(remoteAvatarTombstoneRec);
      if (t?.deletedAt) avatarTombstoneDeletedAt = Math.max(avatarTombstoneDeletedAt, Number(t.deletedAt) || 0);
    }

    // Status ranking for strict forward monotonicity
    const statusRank: Record<string, number> = {
      FAILED: 0,
      QUEUED: 1,
      SENDING: 2,
      SENT_TO_RELAY: 3,
      DELIVERED: 4,
      DELIVERED_TO_RECIPIENT: 4,
      READ: 5,
    };

    for (const key of allKeys) {
      if (key === 'veil:ui:deleted_messages') {
        mergedRecords.push(
          encryptRec(key, mergedTombstonesList, Date.now())
        );
        continue;
      }

      if (key === 'veil:avatar:tombstone') {
        if (avatarTombstoneDeletedAt > 0) {
          mergedRecords.push(
            encryptRec(key, { deletedAt: avatarTombstoneDeletedAt }, Date.now())
          );
        }
        continue;
      }

      const localRec = localMap.get(key);
      const remoteRec = remoteMap.get(key);

      if (!remoteRec && localRec) {
        if (key === 'veil:user:profile' && avatarTombstoneDeletedAt > 0) {
          const prof = decryptRec<any>(localRec);
          if (prof && avatarTombstoneDeletedAt >= (Number(prof.issuedAt) || 0)) {
            mergedRecords.push(encryptRec(key, { ...prof, avatar: undefined, avatarUrl: undefined }, localRec.updatedAt));
            continue;
          }
        }
        mergedRecords.push(localRec);
        continue;
      }
      if (!localRec && remoteRec) {
        if (key === 'veil:user:profile' && avatarTombstoneDeletedAt > 0) {
          const prof = decryptRec<any>(remoteRec);
          if (prof && avatarTombstoneDeletedAt >= (Number(prof.issuedAt) || 0)) {
            mergedRecords.push(encryptRec(key, { ...prof, avatar: undefined, avatarUrl: undefined }, remoteRec.updatedAt));
            continue;
          }
        }
        mergedRecords.push(remoteRec);
        continue;
      }

      if (localRec && remoteRec) {
        if (key === 'veil:ui:messages') {
          const localMessages = decryptRec<Record<string, any[]>>(localRec) || {};
          const remoteMessages = decryptRec<Record<string, any[]>>(remoteRec) || {};
          const allConvIds = Array.from(new Set([...Object.keys(localMessages), ...Object.keys(remoteMessages)]));
          const mergedMessages: Record<string, any[]> = {};

          for (const convId of allConvIds) {
            const lList = localMessages[convId] || [];
            const rList = remoteMessages[convId] || [];
            const msgMap = new Map<string, any>();

            for (const m of [...lList, ...rList]) {
              if (!m?.id) continue;
              // If deleted via tombstone, skip it entirely (anti-resurrection)
              if (tombstoneMap.has(m.id)) {
                continue;
              }

              const existing = msgMap.get(m.id);
              if (!existing) {
                msgMap.set(m.id, m);
              } else {
                const lRank = statusRank[existing.status] ?? 0;
                const rRank = statusRank[m.status] ?? 0;
                const winnerStatus = rRank >= lRank ? m.status : existing.status;

                const mergedMsg = {
                  ...existing,
                  ...m,
                  status: winnerStatus,
                  attachment: m.attachment || existing.attachment,
                  attachments: m.attachments || existing.attachments,
                  voice: m.voice || existing.voice,
                  replyTo: m.replyTo || existing.replyTo,
                };
                msgMap.set(m.id, mergedMsg);
              }
            }

            const sorted = Array.from(msgMap.values()).sort(
              (a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)
            );
            mergedMessages[convId] = sorted;
          }

          mergedRecords.push(
            encryptRec(key, mergedMessages, Math.max(localRec.updatedAt, remoteRec.updatedAt, Date.now()))
          );
        } else if (key === 'veil:ui:conversations') {
          const localConvs = decryptRec<any[]>(localRec) || [];
          const remoteConvs = decryptRec<any[]>(remoteRec) || [];
          const convMap = new Map<string, any>();

          for (const c of [...localConvs, ...remoteConvs]) {
            if (!c?.id) continue;
            const existing = convMap.get(c.id);
            if (!existing) {
              convMap.set(c.id, c);
            } else {
              const keepNew = (Number(c.timestamp) || 0) >= (Number(existing.timestamp) || 0);
              convMap.set(c.id, {
                ...existing,
                ...c,
                lastMessage: keepNew ? (c.lastMessage ?? existing.lastMessage) : (existing.lastMessage ?? c.lastMessage),
                timestamp: Math.max(Number(existing.timestamp) || 0, Number(c.timestamp) || 0),
                unreadCount: keepNew ? (c.unreadCount ?? existing.unreadCount) : (existing.unreadCount ?? c.unreadCount),
                avatar: c.avatar || existing.avatar,
                name: c.name || existing.name,
              });
            }
          }

          mergedRecords.push(
            encryptRec(key, Array.from(convMap.values()), Math.max(localRec.updatedAt, remoteRec.updatedAt, Date.now()))
          );
        } else if (key === 'veil:contacts:list') {
          const localContacts = decryptRec<any[]>(localRec) || [];
          const remoteContacts = decryptRec<any[]>(remoteRec) || [];
          const contactMap = new Map<string, any>();

          for (const ct of [...localContacts, ...remoteContacts]) {
            if (!ct?.identityId) continue;
            const existing = contactMap.get(ct.identityId);
            if (!existing) {
              contactMap.set(ct.identityId, ct);
            } else {
              const isVerified = existing.verificationStatus === 'VERIFIED' || ct.verificationStatus === 'VERIFIED';
              const isBlocked = existing.status === 'BLOCKED' || ct.status === 'BLOCKED';
              contactMap.set(ct.identityId, {
                ...existing,
                ...ct,
                verificationStatus: isVerified ? 'VERIFIED' : (ct.verificationStatus || existing.verificationStatus),
                status: isBlocked ? 'BLOCKED' : (ct.status || existing.status),
                avatar: ct.avatar || existing.avatar,
                name: ct.name || existing.name,
              });
            }
          }

          mergedRecords.push(
            encryptRec(key, Array.from(contactMap.values()), Math.max(localRec.updatedAt, remoteRec.updatedAt, Date.now()))
          );
        } else if (key === 'veil:contacts:mute_settings') {
          const localMute = decryptRec<Record<string, boolean>>(localRec) || {};
          const remoteMute = decryptRec<Record<string, boolean>>(remoteRec) || {};
          const mergedMute = { ...remoteMute, ...localMute };
          mergedRecords.push(
            encryptRec(key, mergedMute, Math.max(localRec.updatedAt, remoteRec.updatedAt, Date.now()))
          );
        } else if (key === 'veil:blocklist:list') {
          const localBlock = decryptRec<string[]>(localRec) || [];
          const remoteBlock = decryptRec<string[]>(remoteRec) || [];
          const mergedBlock = Array.from(new Set([...localBlock, ...remoteBlock]));
          mergedRecords.push(
            encryptRec(key, mergedBlock, Math.max(localRec.updatedAt, remoteRec.updatedAt, Date.now()))
          );
        } else if (key === 'veil:user:profile') {
          const localProf = decryptRec<any>(localRec);
          const remoteProf = decryptRec<any>(remoteRec);
          let winner = ((Number(localProf?.issuedAt) || 0) >= (Number(remoteProf?.issuedAt) || 0)) ? localProf : remoteProf;

          // If avatar was explicitly deleted by tombstone at or after winner's issuedAt, ensure it stays deleted
          if (avatarTombstoneDeletedAt && avatarTombstoneDeletedAt >= (Number(winner?.issuedAt) || 0)) {
            if (winner) {
              winner = { ...winner, avatar: undefined, avatarUrl: undefined };
            }
          } else if (!winner?.avatar && (localProf?.avatar || remoteProf?.avatar)) {
            // Neither device deleted avatar, but an offline re-keying produced an empty avatar profile
            const fallbackAvatar = localProf?.avatar || remoteProf?.avatar;
            winner = { ...winner, avatar: fallbackAvatar, avatarUrl: fallbackAvatar };
          }
          mergedRecords.push(
            encryptRec(key, winner, Math.max(localRec.updatedAt, remoteRec.updatedAt, Date.now()))
          );
        } else if (key === 'veil:user:privacy_settings') {
          const localPriv = decryptRec<any>(localRec) || {};
          const remotePriv = decryptRec<any>(remoteRec) || {};
          const isDeleted = avatarTombstoneDeletedAt > 0 && avatarTombstoneDeletedAt >= Math.max(localRec.updatedAt, remoteRec.updatedAt);
          const mergedPriv = {
            ...remotePriv,
            ...localPriv,
            avatar: isDeleted ? undefined : (localPriv.avatar || remotePriv.avatar),
            bio: localPriv.bio || remotePriv.bio,
            phoneNumber: localPriv.phoneNumber || remotePriv.phoneNumber,
          };
          mergedRecords.push(
            encryptRec(key, mergedPriv, Math.max(localRec.updatedAt, remoteRec.updatedAt, Date.now()))
          );
        } else {
          const winnerRec = localRec.updatedAt >= remoteRec.updatedAt ? localRec : remoteRec;
          mergedRecords.push(winnerRec);
        }
      }
    }

    return mergedRecords;
  }
}

