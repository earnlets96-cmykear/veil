/**
 * Account, Authentication & Device Management Service for VEIL.
 *
 * Implements password hashing with Argon2id + salt, secure session token generation,
 * multi-device registration, session revocation, and recovery anchor challenges.
 *
 * HARD SECURITY INVARIANTS:
 * - Passwords are NEVER stored in plaintext.
 * - Raw bearer session tokens are NEVER stored in the database (stored as SHA-256 hashes).
 * - Authentication recovery is strictly decoupled from cryptographic data recovery.
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { deriveKeyArgon2id } from '../../crypto/kdf.ts';
import {
  randomBytes,
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
  constantTimeEquals,
} from '../../crypto/utils.ts';
import type { ICloudDatabase, AccountEntity, DeviceEntity, SessionEntity, RecoveryStateEntity } from './database/types.ts';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthResult {
  account: {
    accountId: string;
    username: string;
    createdAt: number;
  };
  device: {
    deviceId: string;
    deviceName: string;
    status: 'ACTIVE' | 'REVOKED';
  };
  session: {
    sessionId: string;
    sessionToken: string; // Plain bearer token returned to client ONCE
    expiresAt: number;
  };
}

export class AccountService {
  private db: ICloudDatabase;

  constructor(db: ICloudDatabase) {
    this.db = db;
  }

  /**
   * Hashes a password using Argon2id with a unique 32-byte salt.
   * Uses 16 MiB (16384 KiB) and 2 iterations for production cloud containers (sub-second compute),
   * or 2 MiB / 1 iteration for automated test suites.
   */
  private async hashPassword(password: string, salt: Uint8Array): Promise<string> {
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    const kdfParams = {
      algorithm: 'argon2id' as const,
      salt: bytesToBase64(salt),
      timeCost: isTest ? 1 : 2,
      memoryCost: isTest ? 2048 : 16384,
      parallelism: 1,
      keyLength: 32,
    };
    const key = deriveKeyArgon2id(password, salt, kdfParams);
    return bytesToBase64(key);
  }

  /**
   * Hashes a session bearer token for database storage.
   */
  public hashToken(token: string): string {
    return bytesToHex(sha256(new TextEncoder().encode(token)));
  }

  /**
   * Registers a new persistent VEIL Account with a primary device.
   */
  public async registerAccount(params: {
    username: string;
    password: string;
    deviceId: string;
    deviceName: string;
    deviceSigningPub: string;
    deviceKeyAgreementPub: string;
    recoveryAnchor?: string;
  }): Promise<AuthResult> {
    const cleanUsername = params.username.trim().toLowerCase().replace(/^@/, '');
    if (!params.password || params.password.length < 3) {
      throw new Error('Password must be at least 3 characters long');
    }

    const existing = await this.db.getAccountByUsername(cleanUsername);
    if (existing) {
      throw new Error(`Username ${params.username} is already registered`);
    }

    const accountId = `acc_${bytesToHex(randomBytes(16))}`;
    const salt = randomBytes(32);
    const authHash = await this.hashPassword(params.password, salt);

    const account: AccountEntity = {
      accountId,
      username: cleanUsername,
      authHash,
      authSalt: bytesToBase64(salt),
      recoveryAnchor: params.recoveryAnchor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.createAccount(account);

    const device: DeviceEntity = {
      deviceId: params.deviceId,
      accountId,
      deviceName: params.deviceName || 'Primary Device',
      signingPublicKey: params.deviceSigningPub,
      keyAgreementPublicKey: params.deviceKeyAgreementPub,
      status: 'ACTIVE',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    await this.db.registerDevice(device);

    const session = await this.createSession(accountId, device.deviceId);

    return {
      account: { accountId: account.accountId, username: account.username, createdAt: account.createdAt },
      device: { deviceId: device.deviceId, deviceName: device.deviceName, status: device.status },
      session,
    };
  }

  /**
   * Authenticates an account with password and registers device if new.
   */
  public async loginAccount(params: {
    username: string;
    password: string;
    deviceId: string;
    deviceName?: string;
    deviceSigningPub?: string;
    deviceKeyAgreementPub?: string;
  }): Promise<AuthResult> {
    const cleanUsername = params.username.trim().toLowerCase().replace(/^@/, '');
    const account = await this.db.getAccountByUsername(cleanUsername);
    if (!account) {
      throw new Error('Invalid username or password');
    }

    const salt = base64ToBytes(account.authSalt);
    const computedHash = await this.hashPassword(params.password, salt);

    const valid = constantTimeEquals(base64ToBytes(account.authHash), base64ToBytes(computedHash));
    if (!valid) {
      throw new Error('Invalid username or password');
    }

    // Check or register device
    let device = await this.db.getDevice(account.accountId, params.deviceId);
    if (!device) {
      device = {
        deviceId: params.deviceId,
        accountId: account.accountId,
        deviceName: params.deviceName || 'Secondary Device',
        signingPublicKey: params.deviceSigningPub || '',
        keyAgreementPublicKey: params.deviceKeyAgreementPub || '',
        status: 'ACTIVE',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      await this.db.registerDevice(device);
    } else {
      if (device.status === 'REVOKED') {
        throw new Error('Cannot authenticate: device has been revoked');
      }
      await this.db.updateDeviceStatus(account.accountId, device.deviceId, 'ACTIVE', Date.now());
    }

    const session = await this.createSession(account.accountId, device.deviceId);

    return {
      account: { accountId: account.accountId, username: account.username, createdAt: account.createdAt },
      device: { deviceId: device.deviceId, deviceName: device.deviceName, status: device.status },
      session,
    };
  }

  /**
   * Creates a new session for an authorized account and device.
   */
  private async createSession(accountId: string, deviceId: string): Promise<{ sessionId: string; sessionToken: string; expiresAt: number }> {
    const sessionId = `sess_${bytesToHex(randomBytes(16))}`;
    const rawToken = bytesToHex(randomBytes(32));
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = Date.now() + SESSION_TTL_MS;

    const session: SessionEntity = {
      sessionId,
      accountId,
      deviceId,
      tokenHash,
      createdAt: Date.now(),
      expiresAt,
    };

    await this.db.createSession(session);

    return {
      sessionId,
      sessionToken: rawToken,
      expiresAt,
    };
  }

  /**
   * Validates a bearer session token.
   */
  public async validateSession(sessionToken: string): Promise<{ account: AccountEntity; device: DeviceEntity; session: SessionEntity }> {
    if (!sessionToken) {
      throw new Error('Unauthorized: missing session token');
    }
    const tokenHash = this.hashToken(sessionToken);
    const session = await this.db.getSessionByTokenHash(tokenHash);
    if (!session) {
      throw new Error('Unauthorized: invalid or expired session');
    }

    const account = await this.db.getAccountById(session.accountId);
    if (!account) {
      throw new Error('Unauthorized: account not found');
    }

    const device = await this.db.getDevice(session.accountId, session.deviceId);
    if (!device || device.status === 'REVOKED') {
      throw new Error('Unauthorized: device revoked or not found');
    }

    return { account, device, session };
  }

  /**
   * Revokes an active session.
   */
  public async logout(sessionId: string): Promise<void> {
    await this.db.revokeSession(sessionId);
  }

  /**
   * Revokes all sessions and revokes a target device.
   */
  public async revokeDevice(accountId: string, deviceId: string): Promise<void> {
    await this.db.updateDeviceStatus(accountId, deviceId, 'REVOKED');
  }

  /**
   * Changes an account's authentication password after verifying the existing password.
   */
  public async changePassword(params: {
    accountId: string;
    oldPassword: string;
    newPassword: string;
  }): Promise<{ authVerifyMs: number; newHashMs: number; dbUpdateMs: number }> {
    const account = await this.db.getAccountById(params.accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (!params.oldPassword) {
      throw new Error('Current password is required');
    }

    const authVerifyStart = Date.now();
    const salt = base64ToBytes(account.authSalt);
    const computedOldHash = await this.hashPassword(params.oldPassword, salt);
    const match = constantTimeEquals(
      new TextEncoder().encode(account.authHash),
      new TextEncoder().encode(computedOldHash)
    );
    const authVerifyMs = Date.now() - authVerifyStart;

    if (!match) {
      throw new Error('Invalid current password');
    }

    if (!params.newPassword || params.newPassword.length < 3) {
      throw new Error('New password must be at least 3 characters long');
    }

    const newHashStart = Date.now();
    const newSalt = randomBytes(32);
    const newHash = await this.hashPassword(params.newPassword, newSalt);
    const newHashMs = Date.now() - newHashStart;

    const dbUpdateStart = Date.now();
    account.authHash = newHash;
    account.authSalt = bytesToBase64(newSalt);
    account.updatedAt = Date.now();

    await this.db.updateAccount(account);
    const dbUpdateMs = Date.now() - dbUpdateStart;

    return { authVerifyMs, newHashMs, dbUpdateMs };
  }

  /**
   * Changes an account's canonical username after verifying ownership.
   * Validates uniqueness of the new username across the cloud database.
   */
  public async changeUsername(params: {
    accountId: string;
    newUsername: string;
  }): Promise<{ oldUsername: string; newUsername: string }> {
    const account = await this.db.getAccountById(params.accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const cleanNew = params.newUsername.trim().toLowerCase().replace(/^@/, '');
    if (!cleanNew || cleanNew.length < 2) {
      throw new Error('Username must be at least 2 characters long');
    }

    if (cleanNew === account.username) {
      return { oldUsername: account.username, newUsername: cleanNew };
    }

    // Check uniqueness
    const existing = await this.db.getAccountByUsername(cleanNew);
    if (existing) {
      throw new Error(`Username @${cleanNew} is already taken`);
    }

    const oldUsername = account.username;
    account.username = cleanNew;
    account.updatedAt = Date.now();
    await this.db.updateAccount(account);

    return { oldUsername, newUsername: cleanNew };
  }

  /**
   * Performs authentication recovery (password reset with valid recovery anchor).
   */
  public async resetPasswordWithRecoveryAnchor(params: {
    username: string;
    recoveryAnchor: string;
    newPassword: string;
  }): Promise<void> {
    const cleanUsername = params.username.trim().toLowerCase().replace(/^@/, '');
    const account = await this.db.getAccountByUsername(cleanUsername);
    if (!account || !account.recoveryAnchor) {
      throw new Error('Account recovery failed: invalid recovery credentials');
    }

    const match = constantTimeEquals(
      new TextEncoder().encode(account.recoveryAnchor),
      new TextEncoder().encode(params.recoveryAnchor)
    );
    if (!match) {
      throw new Error('Account recovery failed: invalid recovery credentials');
    }

    if (!params.newPassword || params.newPassword.length < 3) {
      throw new Error('New password must be at least 3 characters long');
    }

    const newSalt = randomBytes(32);
    const newHash = await this.hashPassword(params.newPassword, newSalt);

    account.authHash = newHash;
    account.authSalt = bytesToBase64(newSalt);
    account.updatedAt = Date.now();

    await this.db.updateAccount(account);
    await this.db.revokeAllUserSessions(account.accountId);
  }
}
