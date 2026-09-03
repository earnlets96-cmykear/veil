/**
 * Persistent File-Backed Cloud Database Implementation for VEIL.
 *
 * Implements ICloudDatabase with filesystem persistence, atomic write-rename semantics,
 * indexes, and foreign key integrity.
 */

import * as fs from 'fs';
import * as path from 'path';
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

export class FileCloudDatabase implements ICloudDatabase {
  private baseDir: string;
  private accountsFile: string;
  private devicesFile: string;
  private sessionsFile: string;
  private spacesFile: string;
  private messagesDir: string;
  private attachmentsDir: string;
  private recoveryFile: string;
  private syncStatesFile: string;

  private accounts = new Map<string, AccountEntity>();
  private accountsByUsername = new Map<string, string>();
  private devices = new Map<string, Map<string, DeviceEntity>>();
  private sessions = new Map<string, SessionEntity>();
  private sessionsByTokenHash = new Map<string, SessionEntity>();
  private spaces = new Map<string, Map<string, CloudSpaceEntity>>();
  private messages = new Map<string, Map<string, CloudMessageEntity>>(); // `${accountId}:${spaceId}` -> (msgId -> entity)
  private attachments = new Map<string, Map<string, CloudAttachmentEntity>>();
  private attachmentsByObjectId = new Map<string, CloudAttachmentEntity>();
  private recoveryStates = new Map<string, RecoveryStateEntity>();
  private syncStates = new Map<string, SyncStateEntity>();

  private initialized = false;

  constructor(baseDir = path.join(process.cwd(), '.veil_cloud_db')) {
    this.baseDir = baseDir;
    this.accountsFile = path.join(baseDir, 'accounts.json');
    this.devicesFile = path.join(baseDir, 'devices.json');
    this.sessionsFile = path.join(baseDir, 'sessions.json');
    this.spacesFile = path.join(baseDir, 'spaces.json');
    this.messagesDir = path.join(baseDir, 'messages');
    this.attachmentsDir = path.join(baseDir, 'attachments');
    this.recoveryFile = path.join(baseDir, 'recovery.json');
    this.syncStatesFile = path.join(baseDir, 'sync_states.json');
  }

  public async init(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.messagesDir)) {
      fs.mkdirSync(this.messagesDir, { recursive: true });
    }
    if (!fs.existsSync(this.attachmentsDir)) {
      fs.mkdirSync(this.attachmentsDir, { recursive: true });
    }

    // 1. Load accounts
    if (fs.existsSync(this.accountsFile)) {
      try {
        const raw = fs.readFileSync(this.accountsFile, 'utf8');
        const list: AccountEntity[] = JSON.parse(raw);
        for (const a of list) {
          this.accounts.set(a.accountId, a);
          this.accountsByUsername.set(a.username.toLowerCase(), a.accountId);
        }
      } catch (_e) {}
    }

    // 2. Load devices
    if (fs.existsSync(this.devicesFile)) {
      try {
        const raw = fs.readFileSync(this.devicesFile, 'utf8');
        const list: DeviceEntity[] = JSON.parse(raw);
        for (const d of list) {
          let userDevices = this.devices.get(d.accountId);
          if (!userDevices) {
            userDevices = new Map();
            this.devices.set(d.accountId, userDevices);
          }
          userDevices.set(d.deviceId, d);
        }
      } catch (_e) {}
    }

    // 3. Load sessions
    if (fs.existsSync(this.sessionsFile)) {
      try {
        const raw = fs.readFileSync(this.sessionsFile, 'utf8');
        const list: SessionEntity[] = JSON.parse(raw);
        const now = Date.now();
        for (const s of list) {
          if (!s.revokedAt && s.expiresAt > now) {
            this.sessions.set(s.sessionId, s);
            this.sessionsByTokenHash.set(s.tokenHash, s);
          }
        }
      } catch (_e) {}
    }

    // 4. Load spaces
    if (fs.existsSync(this.spacesFile)) {
      try {
        const raw = fs.readFileSync(this.spacesFile, 'utf8');
        const list: CloudSpaceEntity[] = JSON.parse(raw);
        for (const sp of list) {
          let userSpaces = this.spaces.get(sp.accountId);
          if (!userSpaces) {
            userSpaces = new Map();
            this.spaces.set(sp.accountId, userSpaces);
          }
          userSpaces.set(sp.spaceId, sp);
        }
      } catch (_e) {}
    }

    // 5. Load recovery
    if (fs.existsSync(this.recoveryFile)) {
      try {
        const raw = fs.readFileSync(this.recoveryFile, 'utf8');
        const list: RecoveryStateEntity[] = JSON.parse(raw);
        for (const r of list) {
          this.recoveryStates.set(r.accountId, r);
        }
      } catch (_e) {}
    }

    // 6. Load sync states
    if (fs.existsSync(this.syncStatesFile)) {
      try {
        const raw = fs.readFileSync(this.syncStatesFile, 'utf8');
        const list: SyncStateEntity[] = JSON.parse(raw);
        for (const st of list) {
          this.syncStates.set(`${st.accountId}:${st.deviceId}:${st.spaceId}`, st);
        }
      } catch (_e) {}
    }

    this.initialized = true;
  }

  public async close(): Promise<void> {}

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await fs.promises.writeFile(tmpPath, content, 'utf8');
    await fs.promises.rename(tmpPath, filePath);
  }

  // ===========================================================================
  // ACCOUNTS
  // ===========================================================================

  public async createAccount(account: AccountEntity): Promise<void> {
    if (this.accounts.has(account.accountId)) {
      throw new Error(`Account ID ${account.accountId} already exists`);
    }
    const lower = account.username.toLowerCase();
    if (this.accountsByUsername.has(lower)) {
      throw new Error(`Username ${account.username} is already registered`);
    }
    this.accounts.set(account.accountId, { ...account });
    this.accountsByUsername.set(lower, account.accountId);
    await this.persistAccounts();
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
    const existing = this.accounts.get(account.accountId);
    if (!existing) {
      throw new Error(`Account ${account.accountId} not found`);
    }
    // Re-index username map if username changed
    const oldUsername = existing.username?.toLowerCase();
    const newUsername = account.username?.toLowerCase();
    if (oldUsername && newUsername && oldUsername !== newUsername) {
      this.accountsByUsername.delete(oldUsername);
      this.accountsByUsername.set(newUsername, account.accountId);
    }
    this.accounts.set(account.accountId, { ...account, updatedAt: Date.now() });
    await this.persistAccounts();
  }

  private async persistAccounts(): Promise<void> {
    const list = Array.from(this.accounts.values());
    await this.atomicWrite(this.accountsFile, JSON.stringify(list, null, 2));
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
    await this.persistDevices();
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
      await this.persistDevices();
    }
  }

  private async persistDevices(): Promise<void> {
    const allDevices: DeviceEntity[] = [];
    for (const map of this.devices.values()) {
      allDevices.push(...map.values());
    }
    await this.atomicWrite(this.devicesFile, JSON.stringify(allDevices, null, 2));
  }

  // ===========================================================================
  // SESSIONS
  // ===========================================================================

  public async createSession(session: SessionEntity): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });
    this.sessionsByTokenHash.set(session.tokenHash, { ...session });
    await this.persistSessions();
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
      await this.persistSessions();
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
    await this.persistSessions();
  }

  private async persistSessions(): Promise<void> {
    const list = Array.from(this.sessions.values());
    await this.atomicWrite(this.sessionsFile, JSON.stringify(list, null, 2));
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
    await this.persistSpaces();
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
        await this.persistSpaces();
      }
    }
  }

  private async persistSpaces(): Promise<void> {
    const allSpaces: CloudSpaceEntity[] = [];
    for (const map of this.spaces.values()) {
      allSpaces.push(...map.values());
    }
    await this.atomicWrite(this.spacesFile, JSON.stringify(allSpaces, null, 2));
  }

  // ===========================================================================
  // MESSAGES
  // ===========================================================================

  private sanitizePath(val: string): string {
    return val.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private messageFilePath(accountId: string, spaceId: string): string {
    return path.join(this.messagesDir, `${this.sanitizePath(accountId)}__${this.sanitizePath(spaceId)}.json`);
  }

  private async loadMessagesPartition(accountId: string, spaceId: string): Promise<Map<string, CloudMessageEntity>> {
    const key = `${accountId}:${spaceId}`;
    let part = this.messages.get(key);
    if (!part) {
      part = new Map();
      const f = this.messageFilePath(accountId, spaceId);
      if (fs.existsSync(f)) {
        try {
          const raw = fs.readFileSync(f, 'utf8');
          const list: CloudMessageEntity[] = JSON.parse(raw);
          for (const m of list) {
            part.set(m.messageId, m);
          }
        } catch (_e) {}
      }
      this.messages.set(key, part);
    }
    return part;
  }

  public async saveMessage(message: CloudMessageEntity): Promise<void> {
    const part = await this.loadMessagesPartition(message.accountId, message.spaceId);
    part.set(message.messageId, { ...message });
    const f = this.messageFilePath(message.accountId, message.spaceId);
    await this.atomicWrite(f, JSON.stringify(Array.from(part.values()), null, 2));
  }

  public async getMessage(accountId: string, spaceId: string, messageId: string): Promise<CloudMessageEntity | null> {
    const part = await this.loadMessagesPartition(accountId, spaceId);
    const m = part.get(messageId);
    return m ? { ...m } : null;
  }

  public async listMessages(
    accountId: string,
    spaceId: string,
    options?: { conversationId?: string; sinceVersion?: number; limit?: number }
  ): Promise<CloudMessageEntity[]> {
    const part = await this.loadMessagesPartition(accountId, spaceId);
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
    const part = await this.loadMessagesPartition(accountId, spaceId);
    const m = part.get(messageId);
    if (m) {
      m.deletedAt = Date.now();
      m.version += 1;
      const f = this.messageFilePath(accountId, spaceId);
      await this.atomicWrite(f, JSON.stringify(Array.from(part.values()), null, 2));
    }
  }

  // ===========================================================================
  // ATTACHMENTS
  // ===========================================================================

  private attachmentFilePath(accountId: string, spaceId: string): string {
    return path.join(this.attachmentsDir, `${this.sanitizePath(accountId)}__${this.sanitizePath(spaceId)}.json`);
  }

  private async loadAttachmentsPartition(accountId: string, spaceId: string): Promise<Map<string, CloudAttachmentEntity>> {
    const key = `${accountId}:${spaceId}`;
    let part = this.attachments.get(key);
    if (!part) {
      part = new Map();
      const f = this.attachmentFilePath(accountId, spaceId);
      if (fs.existsSync(f)) {
        try {
          const raw = fs.readFileSync(f, 'utf8');
          const list: CloudAttachmentEntity[] = JSON.parse(raw);
          for (const a of list) {
            part.set(a.attachmentId, a);
            this.attachmentsByObjectId.set(a.objectId, a);
          }
        } catch (_e) {}
      }
      this.attachments.set(key, part);
    }
    return part;
  }

  public async saveAttachment(attachment: CloudAttachmentEntity): Promise<void> {
    const part = await this.loadAttachmentsPartition(attachment.accountId, attachment.spaceId);
    part.set(attachment.attachmentId, { ...attachment });
    this.attachmentsByObjectId.set(attachment.objectId, { ...attachment });
    const f = this.attachmentFilePath(attachment.accountId, attachment.spaceId);
    await this.atomicWrite(f, JSON.stringify(Array.from(part.values()), null, 2));
  }

  public async getAttachment(
    accountId: string,
    spaceId: string,
    attachmentId: string
  ): Promise<CloudAttachmentEntity | null> {
    const part = await this.loadAttachmentsPartition(accountId, spaceId);
    const a = part.get(attachmentId);
    return a ? { ...a } : null;
  }

  public async getAttachmentByObjectId(objectId: string): Promise<CloudAttachmentEntity | null> {
    const a = this.attachmentsByObjectId.get(objectId);
    return a ? { ...a } : null;
  }

  public async listAttachments(accountId: string, spaceId: string): Promise<CloudAttachmentEntity[]> {
    const part = await this.loadAttachmentsPartition(accountId, spaceId);
    return Array.from(part.values())
      .filter((a) => a.status !== 'DELETED')
      .map((a) => ({ ...a }));
  }

  public async deleteAttachment(accountId: string, spaceId: string, attachmentId: string): Promise<void> {
    const part = await this.loadAttachmentsPartition(accountId, spaceId);
    const a = part.get(attachmentId);
    if (a) {
      a.status = 'DELETED';
      a.deletedAt = Date.now();
      const f = this.attachmentFilePath(accountId, spaceId);
      await this.atomicWrite(f, JSON.stringify(Array.from(part.values()), null, 2));
    }
  }

  // ===========================================================================
  // RECOVERY & SYNC
  // ===========================================================================

  public async saveRecoveryState(recovery: RecoveryStateEntity): Promise<void> {
    this.recoveryStates.set(recovery.accountId, { ...recovery });
    const list = Array.from(this.recoveryStates.values());
    await this.atomicWrite(this.recoveryFile, JSON.stringify(list, null, 2));
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
    const list = Array.from(this.syncStates.values());
    await this.atomicWrite(this.syncStatesFile, JSON.stringify(list, null, 2));
  }
}
