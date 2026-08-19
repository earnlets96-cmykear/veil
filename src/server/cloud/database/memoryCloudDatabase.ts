/**
 * In-Memory Cloud Database Implementation for VEIL.
 *
 * Implements ICloudDatabase with in-memory Map indexes and strict ownership enforcement.
 */

import type {
  ICloudDatabase,
  AccountEntity,
  DeviceEntity,
  SessionEntity,
  CloudSpaceEntity,
  CloudMessageEntity,
  CloudAttachmentEntity,
  SyncStateEntity,
  RecoveryStateEntity,
} from './types.ts';

export class MemoryCloudDatabase implements ICloudDatabase {
  private accounts = new Map<string, AccountEntity>(); // accountId -> AccountEntity
  private accountsByUsername = new Map<string, string>(); // username -> accountId
  private devices = new Map<string, Map<string, DeviceEntity>>(); // accountId -> (deviceId -> DeviceEntity)
  private sessions = new Map<string, SessionEntity>(); // sessionId -> SessionEntity
  private sessionsByTokenHash = new Map<string, SessionEntity>(); // tokenHash -> SessionEntity
  private spaces = new Map<string, Map<string, CloudSpaceEntity>>(); // accountId -> (spaceId -> CloudSpaceEntity)
  private messages = new Map<string, Map<string, CloudMessageEntity>>(); // `${accountId}:${spaceId}` -> (messageId -> CloudMessageEntity)
  private attachments = new Map<string, Map<string, CloudAttachmentEntity>>(); // `${accountId}:${spaceId}` -> (attachmentId -> CloudAttachmentEntity)
  private attachmentsByObjectId = new Map<string, CloudAttachmentEntity>(); // objectId -> CloudAttachmentEntity
  private syncStates = new Map<string, SyncStateEntity>(); // `${accountId}:${deviceId}:${spaceId}` -> SyncStateEntity
  private recoveryStates = new Map<string, RecoveryStateEntity>(); // accountId -> RecoveryStateEntity

  public async init(): Promise<void> {}
  public async close(): Promise<void> {}

  // ===========================================================================
  // ACCOUNTS
  // ===========================================================================

  public async createAccount(account: AccountEntity): Promise<void> {
    if (this.accounts.has(account.accountId)) {
      throw new Error(`Account ID ${account.accountId} already exists`);
    }
    const lowerUsername = account.username.toLowerCase();
    if (this.accountsByUsername.has(lowerUsername)) {
      throw new Error(`Username ${account.username} is already registered`);
    }
    this.accounts.set(account.accountId, { ...account });
    this.accountsByUsername.set(lowerUsername, account.accountId);
  }

  public async getAccountById(accountId: string): Promise<AccountEntity | null> {
    const acc = this.accounts.get(accountId);
    return acc ? { ...acc } : null;
  }

  public async getAccountByUsername(username: string): Promise<AccountEntity | null> {
    const accountId = this.accountsByUsername.get(username.toLowerCase());
    if (!accountId) return null;
    return this.getAccountById(accountId);
  }

  public async updateAccount(account: AccountEntity): Promise<void> {
    if (!this.accounts.has(account.accountId)) {
      throw new Error(`Account ${account.accountId} not found`);
    }
    this.accounts.set(account.accountId, { ...account, updatedAt: Date.now() });
  }

  // ===========================================================================
  // DEVICES
  // ===========================================================================

  public async registerDevice(device: DeviceEntity): Promise<void> {
    let userDevices = this.devices.get(device.accountId);
    if (!userDevices) {
      userDevices = new Map();
      this.devices.set(device.accountId, userDevices);
    }
    userDevices.set(device.deviceId, { ...device });
  }

  public async getDevice(accountId: string, deviceId: string): Promise<DeviceEntity | null> {
    const userDevices = this.devices.get(accountId);
    if (!userDevices) return null;
    const d = userDevices.get(deviceId);
    return d ? { ...d } : null;
  }

  public async listDevices(accountId: string): Promise<DeviceEntity[]> {
    const userDevices = this.devices.get(accountId);
    if (!userDevices) return [];
    return Array.from(userDevices.values()).map((d) => ({ ...d }));
  }

  public async updateDeviceStatus(
    accountId: string,
    deviceId: string,
    status: 'ACTIVE' | 'REVOKED',
    lastSeenAt?: number
  ): Promise<void> {
    const userDevices = this.devices.get(accountId);
    if (!userDevices) return;
    const d = userDevices.get(deviceId);
    if (d) {
      d.status = status;
      if (lastSeenAt) d.lastSeenAt = lastSeenAt;
    }
  }

  // ===========================================================================
  // SESSIONS
  // ===========================================================================

  public async createSession(session: SessionEntity): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });
    this.sessionsByTokenHash.set(session.tokenHash, { ...session });
  }

  public async getSession(sessionId: string): Promise<SessionEntity | null> {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : null;
  }

  public async getSessionByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    const s = this.sessionsByTokenHash.get(tokenHash);
    if (!s) return null;
    if (s.revokedAt || s.expiresAt < Date.now()) return null;
    return { ...s };
  }

  public async revokeSession(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.revokedAt = Date.now();
      this.sessionsByTokenHash.delete(s.tokenHash);
    }
  }

  public async revokeAllUserSessions(accountId: string): Promise<void> {
    const now = Date.now();
    for (const s of this.sessions.values()) {
      if (s.accountId === accountId) {
        s.revokedAt = now;
        this.sessionsByTokenHash.delete(s.tokenHash);
      }
    }
  }

  // ===========================================================================
  // SPACES
  // ===========================================================================

  public async saveSpace(space: CloudSpaceEntity): Promise<void> {
    let userSpaces = this.spaces.get(space.accountId);
    if (!userSpaces) {
      userSpaces = new Map();
      this.spaces.set(space.accountId, userSpaces);
    }
    userSpaces.set(space.spaceId, { ...space });
  }

  public async getSpace(accountId: string, spaceId: string): Promise<CloudSpaceEntity | null> {
    const userSpaces = this.spaces.get(accountId);
    if (!userSpaces) return null;
    const sp = userSpaces.get(spaceId);
    return sp ? { ...sp } : null;
  }

  public async listSpaces(accountId: string): Promise<CloudSpaceEntity[]> {
    const userSpaces = this.spaces.get(accountId);
    if (!userSpaces) return [];
    return Array.from(userSpaces.values())
      .filter((s) => !s.deletedAt)
      .map((s) => ({ ...s }));
  }

  public async deleteSpace(accountId: string, spaceId: string): Promise<void> {
    const userSpaces = this.spaces.get(accountId);
    if (userSpaces) {
      const sp = userSpaces.get(spaceId);
      if (sp) {
        sp.deletedAt = Date.now();
        sp.version += 1;
      }
    }
  }

  // ===========================================================================
  // MESSAGES
  // ===========================================================================

  private messagePartitionKey(accountId: string, spaceId: string): string {
    return `${accountId}:${spaceId}`;
  }

  public async saveMessage(message: CloudMessageEntity): Promise<void> {
    const key = this.messagePartitionKey(message.accountId, message.spaceId);
    let part = this.messages.get(key);
    if (!part) {
      part = new Map();
      this.messages.set(key, part);
    }
    part.set(message.messageId, { ...message });
  }

  public async getMessage(accountId: string, spaceId: string, messageId: string): Promise<CloudMessageEntity | null> {
    const key = this.messagePartitionKey(accountId, spaceId);
    const part = this.messages.get(key);
    if (!part) return null;
    const m = part.get(messageId);
    return m ? { ...m } : null;
  }

  public async listMessages(
    accountId: string,
    spaceId: string,
    options?: { conversationId?: string; sinceVersion?: number; limit?: number }
  ): Promise<CloudMessageEntity[]> {
    const key = this.messagePartitionKey(accountId, spaceId);
    const part = this.messages.get(key);
    if (!part) return [];

    let list = Array.from(part.values());

    if (options?.conversationId) {
      list = list.filter((m) => m.conversationId === options.conversationId);
    }
    if (options?.sinceVersion !== undefined) {
      list = list.filter((m) => m.version > options.sinceVersion!);
    }

    list.sort((a, b) => a.version - b.version);

    if (options?.limit && options.limit > 0) {
      list = list.slice(0, options.limit);
    }

    return list.map((m) => ({ ...m }));
  }

  public async deleteMessage(accountId: string, spaceId: string, messageId: string): Promise<void> {
    const key = this.messagePartitionKey(accountId, spaceId);
    const part = this.messages.get(key);
    if (part) {
      const m = part.get(messageId);
      if (m) {
        m.deletedAt = Date.now();
        m.version += 1;
      }
    }
  }

  // ===========================================================================
  // ATTACHMENTS
  // ===========================================================================

  public async saveAttachment(attachment: CloudAttachmentEntity): Promise<void> {
    const key = this.messagePartitionKey(attachment.accountId, attachment.spaceId);
    let part = this.attachments.get(key);
    if (!part) {
      part = new Map();
      this.attachments.set(key, part);
    }
    part.set(attachment.attachmentId, { ...attachment });
    this.attachmentsByObjectId.set(attachment.objectId, { ...attachment });
  }

  public async getAttachment(
    accountId: string,
    spaceId: string,
    attachmentId: string
  ): Promise<CloudAttachmentEntity | null> {
    const key = this.messagePartitionKey(accountId, spaceId);
    const part = this.attachments.get(key);
    if (!part) return null;
    const a = part.get(attachmentId);
    return a ? { ...a } : null;
  }

  public async getAttachmentByObjectId(objectId: string): Promise<CloudAttachmentEntity | null> {
    const a = this.attachmentsByObjectId.get(objectId);
    return a ? { ...a } : null;
  }

  public async listAttachments(accountId: string, spaceId: string): Promise<CloudAttachmentEntity[]> {
    const key = this.messagePartitionKey(accountId, spaceId);
    const part = this.attachments.get(key);
    if (!part) return [];
    return Array.from(part.values())
      .filter((a) => a.status !== 'DELETED')
      .map((a) => ({ ...a }));
  }

  public async deleteAttachment(accountId: string, spaceId: string, attachmentId: string): Promise<void> {
    const key = this.messagePartitionKey(accountId, spaceId);
    const part = this.attachments.get(key);
    if (part) {
      const a = part.get(attachmentId);
      if (a) {
        a.status = 'DELETED';
        a.deletedAt = Date.now();
      }
    }
  }

  // ===========================================================================
  // RECOVERY & SYNC STATES
  // ===========================================================================

  public async saveRecoveryState(recovery: RecoveryStateEntity): Promise<void> {
    this.recoveryStates.set(recovery.accountId, { ...recovery });
  }

  public async getRecoveryState(accountId: string): Promise<RecoveryStateEntity | null> {
    const r = this.recoveryStates.get(accountId);
    return r ? { ...r } : null;
  }

  public async getSyncCursor(accountId: string, deviceId: string, spaceId: string): Promise<number> {
    const key = `${accountId}:${deviceId}:${spaceId}`;
    const s = this.syncStates.get(key);
    return s ? s.lastSyncCursor : 0;
  }

  public async updateSyncCursor(
    accountId: string,
    deviceId: string,
    spaceId: string,
    cursor: number
  ): Promise<void> {
    const key = `${accountId}:${deviceId}:${spaceId}`;
    this.syncStates.set(key, {
      accountId,
      deviceId,
      spaceId,
      lastSyncCursor: cursor,
      updatedAt: Date.now(),
    });
  }
}
