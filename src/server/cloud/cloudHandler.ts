/**
 * Cloud API HTTP Request Handler for VEIL Cloud & Account Foundation.
 *
 * Implements REST endpoints for Account, Multi-Device, Encrypted Sync,
 * and Object Storage attachments with strict multi-tenant ownership enforcement.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { AccountService } from './accountService.ts';
import type { ICloudDatabase, CloudSpaceEntity, CloudMessageEntity, CloudAttachmentEntity } from './database/types.ts';
import type { IObjectStorage } from './storage/types.ts';
import { base64ToBytes, bytesToBase64, bytesToHex, randomBytes } from '../../crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

export class CloudHandler {
  private db: ICloudDatabase;
  private storage: IObjectStorage;
  private accountService: AccountService;

  constructor(db: ICloudDatabase, storage: IObjectStorage) {
    this.db = db;
    this.storage = storage;
    this.accountService = new AccountService(db);
  }

  public async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase();

    // 1. Account Public Endpoints
    if (pathname === '/v1/account/register' && method === 'POST') {
      await this.handleRegister(req, res);
      return true;
    }
    if (pathname === '/v1/account/login' && method === 'POST') {
      await this.handleLogin(req, res);
      return true;
    }
    if (pathname === '/v1/account/restore' && method === 'POST') {
      await this.handleRestore(req, res);
      return true;
    }
    if (pathname === '/v1/account/recovery/reset-password' && method === 'POST') {
      await this.handlePasswordReset(req, res);
      return true;
    }

    // 2. Authenticated Endpoints (require Bearer Token)
    if (pathname.startsWith('/v1/account/') || pathname.startsWith('/v1/cloud/')) {
      const auth = await this.authenticate(req, res);
      if (!auth) return true; // Response already sent

      const { account, device, session } = auth;

      // Account & Device endpoints
      if (pathname === '/v1/account/logout' && method === 'POST') {
        await this.accountService.logout(session.sessionId);
        this.sendJson(res, 200, { success: true });
        return true;
      }
      if (pathname === '/v1/account/devices' && method === 'GET') {
        const devices = await this.db.listDevices(account.accountId);
        this.sendJson(res, 200, { devices });
        return true;
      }
      if (pathname === '/v1/account/devices/revoke' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body?.deviceId) {
          this.sendJson(res, 400, { error: 'Missing deviceId' });
          return true;
        }
        await this.accountService.revokeDevice(account.accountId, body.deviceId);
        this.sendJson(res, 200, { success: true });
        return true;
      }
      if (pathname === '/v1/account/recovery/vault/set' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body?.encryptedVaultBlob || !body?.kdfParams) {
          this.sendJson(res, 400, { error: 'Missing encryptedVaultBlob or kdfParams' });
          return true;
        }
        await this.db.saveRecoveryState({
          accountId: account.accountId,
          recoveryId: `rec_${bytesToHex(randomBytes(8))}`,
          encryptedVaultBlob: body.encryptedVaultBlob,
          kdfParams: typeof body.kdfParams === 'string' ? body.kdfParams : JSON.stringify(body.kdfParams),
          updatedAt: Date.now(),
        });
        this.sendJson(res, 200, { success: true });
        return true;
      }
      if (pathname === '/v1/account/recovery/vault/get' && method === 'GET') {
        const rec = await this.db.getRecoveryState(account.accountId);
        this.sendJson(res, 200, { recovery: rec });
        return true;
      }

      // Cloud Space sync endpoints
      if (pathname === '/v1/cloud/spaces/sync' && method === 'POST') {
        await this.handleSpaceSync(req, res, account.accountId);
        return true;
      }
      if (pathname === '/v1/cloud/spaces' && method === 'GET') {
        const spaces = await this.db.listSpaces(account.accountId);
        this.sendJson(res, 200, { spaces });
        return true;
      }

      // Cloud Message push/pull/delete
      if (pathname === '/v1/cloud/messages/push' && method === 'POST') {
        await this.handleMessagePush(req, res, account.accountId, device.deviceId);
        return true;
      }
      if (pathname === '/v1/cloud/messages/pull' && method === 'POST') {
        await this.handleMessagePull(req, res, account.accountId);
        return true;
      }
      if (pathname === '/v1/cloud/messages/delete' && method === 'POST') {
        await this.handleMessageDelete(req, res, account.accountId);
        return true;
      }

      // Cloud Attachment endpoints
      if (pathname === '/v1/cloud/attachments/create' && method === 'POST') {
        await this.handleAttachmentCreate(req, res, account.accountId);
        return true;
      }
      if (pathname === '/v1/cloud/attachments/upload' && method === 'POST') {
        await this.handleAttachmentUpload(req, res, account.accountId);
        return true;
      }
      if (pathname.startsWith('/v1/cloud/attachments/download/') && method === 'GET') {
        const objectId = pathname.substring('/v1/cloud/attachments/download/'.length);
        await this.handleAttachmentDownload(req, res, account.accountId, objectId);
        return true;
      }
      if (pathname === '/v1/cloud/attachments/delete' && method === 'POST') {
        await this.handleAttachmentDelete(req, res, account.accountId);
        return true;
      }
    }

    return false; // Not a cloud handler route
  }

  // ===========================================================================
  // AUTHENTICATION HELPER
  // ===========================================================================

  private async authenticate(req: IncomingMessage, res: ServerResponse) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.sendJson(res, 401, { error: 'Unauthorized: missing or invalid Authorization header' });
      return null;
    }
    const token = authHeader.substring('Bearer '.length).trim();
    try {
      return await this.accountService.validateSession(token);
    } catch (err: any) {
      this.sendJson(res, 401, { error: err.message || 'Unauthorized' });
      return null;
    }
  }

  private async parseJsonBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 50 * 1024 * 1024) { // 50MB limit
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        if (!data) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', (err) => reject(err));
    });
  }

  private sendJson(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // ===========================================================================
  // ACCOUNT HANDLERS
  // ===========================================================================

  private async handleRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const result = await this.accountService.registerAccount({
        username: body.username,
        password: body.password,
        deviceId: body.deviceId,
        deviceName: body.deviceName,
        deviceSigningPub: body.deviceSigningPub,
        deviceKeyAgreementPub: body.deviceKeyAgreementPub,
        recoveryAnchor: body.recoveryAnchor,
      });
      this.sendJson(res, 201, result);
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const result = await this.accountService.loginAccount({
        username: body.username,
        password: body.password,
        deviceId: body.deviceId,
        deviceName: body.deviceName,
        deviceSigningPub: body.deviceSigningPub,
        deviceKeyAgreementPub: body.deviceKeyAgreementPub,
      });
      this.sendJson(res, 200, result);
    } catch (err: any) {
      this.sendJson(res, 401, { error: err.message });
    }
  }

  private async handleRestore(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const loginResult = await this.accountService.loginAccount({
        username: body.username,
        password: body.password,
        deviceId: body.deviceId,
        deviceName: body.deviceName,
        deviceSigningPub: body.deviceSigningPub,
        deviceKeyAgreementPub: body.deviceKeyAgreementPub,
      });

      const recovery = await this.db.getRecoveryState(loginResult.account.accountId);
      this.sendJson(res, 200, {
        ...loginResult,
        recovery,
      });
    } catch (err: any) {
      this.sendJson(res, 401, { error: err.message });
    }
  }

  private async handlePasswordReset(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      await this.accountService.resetPasswordWithRecoveryAnchor({
        username: body.username,
        recoveryAnchor: body.recoveryAnchor,
        newPassword: body.newPassword,
      });
      this.sendJson(res, 200, { success: true });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  // ===========================================================================
  // SPACE SYNC HANDLER
  // ===========================================================================

  private async handleSpaceSync(req: IncomingMessage, res: ServerResponse, accountId: string): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const spaces: CloudSpaceEntity[] = body.spaces || [];

      for (const sp of spaces) {
        // Enforce ownership
        if (sp.accountId && sp.accountId !== accountId) {
          return this.sendJson(res, 403, { error: 'Forbidden: space does not belong to account' });
        }
        sp.accountId = accountId;
        const existing = await this.db.getSpace(accountId, sp.spaceId);
        if (!existing || sp.version >= existing.version) {
          await this.db.saveSpace({
            ...sp,
            updatedAt: Date.now(),
          });
        }
      }

      const allUserSpaces = await this.db.listSpaces(accountId);
      this.sendJson(res, 200, { spaces: allUserSpaces });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  // ===========================================================================
  // MESSAGE HANDLERS
  // ===========================================================================

  private async handleMessagePush(
    req: IncomingMessage,
    res: ServerResponse,
    accountId: string,
    deviceId: string
  ): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const messages: CloudMessageEntity[] = body.messages || [];

      const acceptedIds: string[] = [];

      for (const msg of messages) {
        msg.accountId = accountId;
        msg.senderDeviceId = deviceId;
        const existing = await this.db.getMessage(accountId, msg.spaceId, msg.messageId);
        if (!existing || msg.version >= existing.version) {
          await this.db.saveMessage({
            ...msg,
            updatedAt: Date.now(),
          });
          acceptedIds.push(msg.messageId);
        }
      }

      this.sendJson(res, 200, { acceptedCount: acceptedIds.length, acceptedIds });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleMessagePull(req: IncomingMessage, res: ServerResponse, accountId: string): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const { spaceId, sinceVersion, limit } = body;

      if (!spaceId) {
        return this.sendJson(res, 400, { error: 'Missing spaceId' });
      }

      const messages = await this.db.listMessages(accountId, spaceId, {
        sinceVersion: sinceVersion ?? 0,
        limit: limit ?? 100,
      });

      this.sendJson(res, 200, { messages });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleMessageDelete(req: IncomingMessage, res: ServerResponse, accountId: string): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const { spaceId, messageId } = body;
      if (!spaceId || !messageId) {
        return this.sendJson(res, 400, { error: 'Missing spaceId or messageId' });
      }

      const existing = await this.db.getMessage(accountId, spaceId, messageId);
      if (!existing) {
        return this.sendJson(res, 404, { error: 'Message not found' });
      }

      await this.db.deleteMessage(accountId, spaceId, messageId);
      this.sendJson(res, 200, { success: true });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  // ===========================================================================
  // ATTACHMENT HANDLERS
  // ===========================================================================

  private async handleAttachmentCreate(req: IncomingMessage, res: ServerResponse, accountId: string): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const {
        attachmentId,
        spaceId,
        encryptedMetadata,
        ciphertextSize,
        ciphertextHash,
        chunkCount,
        chunkSize,
        recipientAccountId,
        recipientUsername,
        conversationId,
        allowedAccounts,
      } = body;

      if (!attachmentId || !spaceId || !ciphertextHash) {
        return this.sendJson(res, 400, { error: 'Missing required attachment fields' });
      }

      let metaPayload = encryptedMetadata || '';
      if (recipientAccountId || recipientUsername || conversationId || allowedAccounts) {
        let metaObj: any = {};
        if (encryptedMetadata) {
          try {
            metaObj = JSON.parse(encryptedMetadata);
          } catch (_e) {
            metaObj = { raw: encryptedMetadata };
          }
        }
        if (recipientAccountId) metaObj.recipientAccountId = recipientAccountId;
        if (recipientUsername) metaObj.recipientUsername = recipientUsername;
        if (conversationId) metaObj.conversationId = conversationId;
        if (allowedAccounts) metaObj.allowedAccounts = allowedAccounts;
        metaPayload = JSON.stringify(metaObj);
      }

      const objectId = `obj_${bytesToHex(randomBytes(16))}`;
      const record: CloudAttachmentEntity = {
        attachmentId,
        accountId,
        spaceId,
        objectId,
        encryptedMetadata: metaPayload,
        ciphertextSize: ciphertextSize || 0,
        ciphertextHash,
        encryptionVersion: 1,
        status: 'UPLOADING',
        chunkCount: chunkCount || 1,
        chunkSize: chunkSize || 64 * 1024,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.db.saveAttachment(record);
      this.sendJson(res, 201, { attachment: record });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleAttachmentUpload(req: IncomingMessage, res: ServerResponse, accountId: string): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const { objectId, ciphertextBase64 } = body;

      if (!objectId || !ciphertextBase64) {
        return this.sendJson(res, 400, { error: 'Missing objectId or ciphertextBase64' });
      }

      const attRecord = await this.db.getAttachmentByObjectId(objectId);
      if (!attRecord || attRecord.accountId !== accountId) {
        return this.sendJson(res, 404, { error: 'Attachment object not found or access denied' });
      }

      const rawCiphertext = base64ToBytes(ciphertextBase64);
      const computedHash = bytesToHex(sha256(rawCiphertext));

      if (computedHash !== attRecord.ciphertextHash) {
        return this.sendJson(res, 400, { error: 'Integrity verification failed: SHA-256 hash mismatch' });
      }

      await this.storage.upload(objectId, rawCiphertext);

      attRecord.status = 'COMMITTED';
      attRecord.updatedAt = Date.now();
      await this.db.saveAttachment(attRecord);

      this.sendJson(res, 200, { success: true, objectId, status: 'COMMITTED' });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleAttachmentDownload(
    req: IncomingMessage,
    res: ServerResponse,
    accountId: string,
    objectId: string
  ): Promise<void> {
    try {
      if (!accountId) {
        return this.sendJson(res, 401, { error: 'Unauthorized: authentication required' });
      }

      const attRecord = await this.db.getAttachmentByObjectId(objectId);
      if (!attRecord || attRecord.status === 'DELETED') {
        return this.sendJson(res, 404, { error: 'Attachment not found or deleted' });
      }

      if (attRecord.accountId !== accountId) {
        const requesterSpaces = await this.db.listSpaces(accountId);
        const hasSpaceAccess = requesterSpaces.some((s) => s.spaceId === attRecord.spaceId);

        let isRecipient = false;
        if (attRecord.encryptedMetadata) {
          try {
            const metaObj = JSON.parse(attRecord.encryptedMetadata);
            if (
              metaObj.recipientAccountId === accountId ||
              (Array.isArray(metaObj.allowedAccounts) && metaObj.allowedAccounts.includes(accountId))
            ) {
              isRecipient = true;
            } else if (metaObj.recipientUsername) {
              const reqAccount = await this.db.getAccountById(accountId);
              if (
                reqAccount &&
                reqAccount.username.toLowerCase().replace(/^@/, '') ===
                  metaObj.recipientUsername.toLowerCase().replace(/^@/, '')
              ) {
                isRecipient = true;
              }
            }
          } catch (_e) {}
        }

        if (!hasSpaceAccess && !isRecipient) {
          return this.sendJson(res, 404, { error: 'Attachment not found or access denied' });
        }
      }

      let data: Uint8Array | null = null;
      try {
        data = await this.storage.download(objectId);
      } catch (_e) {
        data = null;
      }

      if (!data) {
        return this.sendJson(res, 404, { error: 'Attachment not found or missing from storage' });
      }

      const base64Data = bytesToBase64(data);
      this.sendJson(res, 200, {
        attachmentId: attRecord.attachmentId,
        objectId,
        ciphertextHash: attRecord.ciphertextHash,
        ciphertextSize: data.length,
        ciphertextBase64: base64Data,
      });
    } catch (err: any) {
      this.sendJson(res, 500, { error: err.message || 'Internal server error' });
    }
  }

  private async handleAttachmentDelete(req: IncomingMessage, res: ServerResponse, accountId: string): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const { spaceId, attachmentId } = body;
      if (!spaceId || !attachmentId) {
        return this.sendJson(res, 400, { error: 'Missing spaceId or attachmentId' });
      }

      const record = await this.db.getAttachment(accountId, spaceId, attachmentId);
      if (!record || record.accountId !== accountId) {
        return this.sendJson(res, 404, { error: 'Attachment not found' });
      }

      await this.storage.delete(record.objectId);
      await this.db.deleteAttachment(accountId, spaceId, attachmentId);

      this.sendJson(res, 200, { success: true });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }
}
