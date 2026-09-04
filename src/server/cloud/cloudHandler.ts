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
    if (pathname === '/v1/account/recovery/health' && method === 'GET') {
      await this.handleRecoveryHealth(req, res);
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
      if (pathname === '/v1/account/change-password' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body?.oldPassword || !body?.newPassword) {
          this.sendJson(res, 400, { error: 'Missing oldPassword or newPassword' });
          return true;
        }
        const chgStart = Date.now();
        try {
          const timing = await this.accountService.changePassword({
            accountId: account.accountId,
            oldPassword: body.oldPassword,
            newPassword: body.newPassword,
          });
          const totalElapsed = Date.now() - chgStart;
          if (typeof console !== 'undefined') {
            console.log(
              `[VEIL-CLOUD] [CHANGE_PASSWORD] status=200 auth_verify_ms=${timing?.authVerifyMs ?? 0} new_password_hash_ms=${timing?.newHashMs ?? 0} db_update_ms=${timing?.dbUpdateMs ?? 0} total_ms=${totalElapsed}`
            );
          }
          this.sendJson(res, 200, { success: true });
        } catch (err: any) {
          const totalElapsed = Date.now() - chgStart;
          if (typeof console !== 'undefined') {
            console.log(`[VEIL-CLOUD] [CHANGE_PASSWORD] status=400 error="${err.message}" total_ms=${totalElapsed}`);
          }
          this.sendJson(res, 400, { error: err.message || 'Failed to change password' });
        }
        return true;
      }
      if (pathname === '/v1/account/change-username' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body?.newUsername) {
          this.sendJson(res, 400, { error: 'Missing newUsername' });
          return true;
        }
        try {
          const result = await this.accountService.changeUsername({
            accountId: account.accountId,
            newUsername: body.newUsername,
          });
          this.sendJson(res, 200, { success: true, oldUsername: result.oldUsername, newUsername: result.newUsername });
        } catch (err: any) {
          const status = err.message?.includes('already taken') ? 409 : 400;
          this.sendJson(res, status, { error: err.message || 'Failed to change username' });
        }
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

        if (body.expectedUpdatedAt !== undefined) {
          const current = await this.db.getRecoveryState(account.accountId);
          if (current && current.updatedAt !== body.expectedUpdatedAt) {
            this.sendJson(res, 409, {
              error: 'CONCURRENCY_CONFLICT',
              message: 'Recovery vault has been updated by another device.',
              currentUpdatedAt: current.updatedAt,
            });
            return true;
          }
        }

        const newUpdatedAt = Date.now();
        await this.db.saveRecoveryState({
          accountId: account.accountId,
          recoveryId: `rec_${bytesToHex(randomBytes(8))}`,
          encryptedVaultBlob: body.encryptedVaultBlob,
          kdfParams: typeof body.kdfParams === 'string' ? body.kdfParams : JSON.stringify(body.kdfParams),
          updatedAt: newUpdatedAt,
        });
        this.sendJson(res, 200, { success: true, updatedAt: newUpdatedAt });
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
      if ((pathname === '/v1/cloud/attachments/upload' || pathname === '/v1/cloud/attachments/upload-raw') && method === 'POST') {
        await this.handleAttachmentUpload(req, res, account.accountId);
        return true;
      }
      if (
        (pathname.startsWith('/v1/cloud/attachments/download-raw/') ||
          pathname.startsWith('/v1/cloud/attachments/raw/') ||
          pathname.startsWith('/api/cloud/attachments/download-raw/')) &&
        method === 'GET'
      ) {
        const prefix = pathname.startsWith('/v1/cloud/attachments/download-raw/')
          ? '/v1/cloud/attachments/download-raw/'
          : pathname.startsWith('/v1/cloud/attachments/raw/')
          ? '/v1/cloud/attachments/raw/'
          : '/api/cloud/attachments/download-raw/';
        const objectId = pathname.substring(prefix.length);
        await this.handleAttachmentDownloadRaw(req, res, account.accountId, objectId);
        return true;
      }
      const rawMatch = pathname.match(/^\/(?:v1|api)\/cloud\/attachments\/([^/]+)\/raw$/);
      if (rawMatch && method === 'GET') {
        const objectId = rawMatch[1];
        await this.handleAttachmentDownloadRaw(req, res, account.accountId, objectId);
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
    let token = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring('Bearer '.length).trim();
    } else {
      try {
        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const queryToken = parsedUrl.searchParams.get('token');
        if (queryToken) {
          token = queryToken.trim();
        }
      } catch (_e) {}
    }

    if (!token) {
      this.sendJson(res, 401, { error: 'Unauthorized: missing or invalid Authorization header' });
      return null;
    }
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
        if (data.length > 100 * 1024 * 1024) { // 100MB limit
          reject(new Error('Payload too large: exceeds 100MB limit'));
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

  private async parseRawBody(req: IncomingMessage, maxBytes = 100 * 1024 * 1024): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      req.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          reject(new Error(`Payload too large: exceeds maximum size limit of ${maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(new Uint8Array(Buffer.concat(chunks)));
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
    const startTime = Date.now();
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
      const elapsedMs = Date.now() - startTime;
      if (typeof console !== 'undefined') {
        console.log(`[VEIL-CLOUD] [REGISTER] status=201 elapsed=${elapsedMs}ms`);
      }
      this.sendJson(res, 201, result);
    } catch (err: any) {
      const elapsedMs = Date.now() - startTime;
      if (typeof console !== 'undefined') {
        console.log(`[VEIL-CLOUD] [REGISTER] status=400 error="${err.message}" elapsed=${elapsedMs}ms`);
      }
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
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
      const elapsedMs = Date.now() - startTime;
      if (typeof console !== 'undefined') {
        console.log(`[VEIL-CLOUD] [LOGIN] status=200 elapsed=${elapsedMs}ms`);
      }
      this.sendJson(res, 200, result);
    } catch (err: any) {
      const elapsedMs = Date.now() - startTime;
      if (typeof console !== 'undefined') {
        console.log(`[VEIL-CLOUD] [LOGIN] status=401 error="${err.message}" elapsed=${elapsedMs}ms`);
      }
      this.sendJson(res, 401, { error: err.message });
    }
  }

  private async handleRestore(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
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

      const dbStart = Date.now();
      const recovery = await this.db.getRecoveryState(loginResult.account.accountId);
      const dbLatencyMs = Date.now() - dbStart;
      const elapsedMs = Date.now() - startTime;

      const payload = {
        ...loginResult,
        recovery,
      };
      const payloadBytes = JSON.stringify(payload).length;

      if (typeof console !== 'undefined') {
        console.log(
          `[VEIL-CLOUD] [RESTORE] status=200 hasRecovery=${!!recovery?.encryptedVaultBlob} dbLatency=${dbLatencyMs}ms totalElapsed=${elapsedMs}ms bytes=${payloadBytes}`
        );
      }

      this.sendJson(res, 200, payload);
    } catch (err: any) {
      const elapsedMs = Date.now() - startTime;
      if (typeof console !== 'undefined') {
        console.log(`[VEIL-CLOUD] [RESTORE] status=401 error="${err.message}" elapsed=${elapsedMs}ms`);
      }
      this.sendJson(res, 401, { error: err.message });
    }
  }

  private async handleRecoveryHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    try {
      const dbStart = Date.now();
      await this.db.init();
      const dbLatencyMs = Date.now() - dbStart;
      this.sendJson(res, 200, {
        status: 'ok',
        database: 'connected',
        recoveryTable: 'connected',
        queryLatencyMs: dbLatencyMs,
        elapsedMs: Date.now() - startTime,
      });
    } catch (err: any) {
      this.sendJson(res, 500, {
        status: 'error',
        error: err.message || 'Database unreachable',
        elapsedMs: Date.now() - startTime,
      });
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

        // Auto-provision space record if not yet registered
        const spaceRecord = await this.db.getSpace(accountId, msg.spaceId);
        if (!spaceRecord) {
          await this.db.saveSpace({
            spaceId: msg.spaceId,
            accountId,
            encryptedHeader: 'auto_provisioned_v1',
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }

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
        recipientIdentityId,
        groupId,
        conversationId,
        allowedAccounts,
      } = body;

      if (!attachmentId || !spaceId || !ciphertextHash) {
        return this.sendJson(res, 400, { error: 'Missing required attachment fields' });
      }

      let metaPayload = encryptedMetadata || '';
      let metaObj: any = {};
      if (encryptedMetadata) {
        try {
          metaObj = JSON.parse(encryptedMetadata);
        } catch (_e) {
          metaObj = { raw: encryptedMetadata };
        }
      }

      let resolvedRecipientAccountId = recipientAccountId || metaObj.recipientAccountId;
      const targetUser = recipientUsername || metaObj.recipientUsername;
      if (!resolvedRecipientAccountId && targetUser) {
        try {
          const cleanUser = targetUser.toLowerCase().replace(/^@/, '').trim();
          const targetAcc = await this.db.getAccountByUsername(cleanUser);
          if (targetAcc) {
            resolvedRecipientAccountId = targetAcc.accountId;
          }
        } catch (_e) {}
      }

      const resolvedGroupId = groupId || metaObj.groupId;

      if (resolvedRecipientAccountId) metaObj.recipientAccountId = resolvedRecipientAccountId;
      if (targetUser) metaObj.recipientUsername = targetUser;
      if (recipientIdentityId || metaObj.recipientIdentityId) metaObj.recipientIdentityId = recipientIdentityId || metaObj.recipientIdentityId;
      if (resolvedGroupId) metaObj.groupId = resolvedGroupId;
      if (conversationId) metaObj.conversationId = conversationId;
      if (allowedAccounts) metaObj.allowedAccounts = allowedAccounts;
      metaPayload = JSON.stringify(metaObj);

      // Auto-provision space record if not yet registered on cloud backend
      const spaceRecord = await this.db.getSpace(accountId, spaceId);
      if (!spaceRecord) {
        await this.db.saveSpace({
          spaceId,
          accountId,
          encryptedHeader: 'auto_provisioned_v1',
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
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
      const resolvedConversationId = conversationId || metaObj.conversationId;

      if (resolvedRecipientAccountId) {
        (record as any).recipientAccountId = resolvedRecipientAccountId;
      }
      if (resolvedGroupId) {
        (record as any).groupId = resolvedGroupId;
      } else if (resolvedConversationId && resolvedConversationId.startsWith('grp_')) {
        (record as any).groupId = resolvedConversationId;
      }
      if (resolvedConversationId) {
        (record as any).conversationId = resolvedConversationId;
      }

      await this.db.saveAttachment(record);
      this.sendJson(res, 201, { attachment: record });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleAttachmentUpload(req: IncomingMessage, res: ServerResponse, accountId: string): Promise<void> {
    try {
      const contentType = (req.headers['content-type'] || '').toLowerCase();
      let objectId: string;
      let rawCiphertext: Uint8Array;

      if (contentType.includes('application/octet-stream') || req.url?.includes('upload-raw')) {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        objectId = (req.headers['x-object-id'] as string) || url.searchParams.get('objectId') || '';
        if (!objectId) {
          return this.sendJson(res, 400, { error: 'Missing objectId (via X-Object-Id header or ?objectId query param)' });
        }
        rawCiphertext = await this.parseRawBody(req, 100 * 1024 * 1024);
      } else {
        const body = await this.parseJsonBody(req);
        objectId = body.objectId;
        const ciphertextBase64 = body.ciphertextBase64;
        if (!objectId || !ciphertextBase64) {
          return this.sendJson(res, 400, { error: 'Missing objectId or ciphertextBase64' });
        }
        rawCiphertext = base64ToBytes(ciphertextBase64);
      }

      const attRecord = await this.db.getAttachmentByObjectId(objectId);
      if (!attRecord || attRecord.accountId !== accountId) {
        return this.sendJson(res, 404, { error: 'Attachment object not found or access denied' });
      }

      const computedHash = bytesToHex(sha256(rawCiphertext));

      if (computedHash !== attRecord.ciphertextHash) {
        return this.sendJson(res, 400, { error: 'Integrity verification failed: SHA-256 hash mismatch' });
      }

      await this.storage.upload(objectId, rawCiphertext);

      attRecord.status = 'COMMITTED';
      attRecord.ciphertextSize = rawCiphertext.length;
      attRecord.updatedAt = Date.now();
      await this.db.saveAttachment(attRecord);

      this.sendJson(res, 200, { success: true, objectId, status: 'COMMITTED' });
    } catch (err: any) {
      this.sendJson(res, 400, { error: err.message });
    }
  }

  private async handleAttachmentDownloadRaw(
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

        if ((attRecord as any).recipientAccountId === accountId) {
          isRecipient = true;
        }

        if ((attRecord as any).groupId || (attRecord as any).conversationId?.startsWith('grp_')) {
          isRecipient = true;
        }

        if (attRecord.encryptedMetadata) {
          try {
            const metaObj = JSON.parse(attRecord.encryptedMetadata);
            if (metaObj.groupId || metaObj.conversationId?.startsWith('grp_')) {
              isRecipient = true;
            } else if (
              metaObj.recipientAccountId === accountId ||
              (Array.isArray(metaObj.allowedAccounts) && metaObj.allowedAccounts.includes(accountId))
            ) {
              isRecipient = true;
            } else if (metaObj.recipientUsername || (attRecord as any).recipientUsername) {
              const targetUser = (metaObj.recipientUsername || (attRecord as any).recipientUsername)
                .toLowerCase()
                .replace(/^@/, '')
                .trim();
              const reqAccount = await this.db.getAccountById(accountId);
              if (
                reqAccount &&
                reqAccount.username.toLowerCase().replace(/^@/, '').trim() === targetUser
              ) {
                isRecipient = true;
              }
            } else if (metaObj.recipientIdentityId) {
              const reqAccount = await this.db.getAccountById(accountId);
              if (
                reqAccount &&
                (reqAccount.accountId === metaObj.recipientIdentityId ||
                  requesterSpaces.some((s) => s.spaceId === metaObj.recipientIdentityId))
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

      let mimeType = 'application/octet-stream';
      if (attRecord.encryptedMetadata) {
        try {
          const meta = JSON.parse(attRecord.encryptedMetadata);
          if (meta.mimeType) mimeType = meta.mimeType;
        } catch (_e) {}
      }

      const rangeHeader = req.headers.range;
      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const total = data.length;
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] && !isNaN(parseInt(parts[1], 10)) ? Math.min(parseInt(parts[1], 10), total - 1) : total - 1;

        if (start >= total || start > end) {
          res.writeHead(416, {
            'Content-Range': `bytes */${total}`,
            'Content-Type': mimeType,
          });
          res.end();
          return;
        }

        const chunk = data.slice(start, end + 1);
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunk.length),
          'Content-Type': mimeType,
          'X-Ciphertext-Hash': attRecord.ciphertextHash,
          'X-Attachment-Id': attRecord.attachmentId,
        });
        res.end(Buffer.from(chunk));
        return;
      }

      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': String(data.length),
        'Accept-Ranges': 'bytes',
        'X-Ciphertext-Hash': attRecord.ciphertextHash,
        'X-Attachment-Id': attRecord.attachmentId,
      });
      res.end(Buffer.from(data));
    } catch (err: any) {
      this.sendJson(res, 500, { error: err.message || 'Internal server error' });
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

        if ((attRecord as any).recipientAccountId === accountId) {
          isRecipient = true;
        }

        if ((attRecord as any).groupId || (attRecord as any).conversationId?.startsWith('grp_')) {
          isRecipient = true;
        }

        if (attRecord.encryptedMetadata) {
          try {
            const metaObj = JSON.parse(attRecord.encryptedMetadata);
            if (metaObj.groupId || metaObj.conversationId?.startsWith('grp_')) {
              isRecipient = true;
            } else if (
              metaObj.recipientAccountId === accountId ||
              (Array.isArray(metaObj.allowedAccounts) && metaObj.allowedAccounts.includes(accountId))
            ) {
              isRecipient = true;
            } else if (metaObj.recipientUsername || (attRecord as any).recipientUsername) {
              const targetUser = (metaObj.recipientUsername || (attRecord as any).recipientUsername)
                .toLowerCase()
                .replace(/^@/, '')
                .trim();
              const reqAccount = await this.db.getAccountById(accountId);
              if (
                reqAccount &&
                reqAccount.username.toLowerCase().replace(/^@/, '').trim() === targetUser
              ) {
                isRecipient = true;
              }
            } else if (metaObj.recipientIdentityId) {
              const reqAccount = await this.db.getAccountById(accountId);
              if (
                reqAccount &&
                (reqAccount.accountId === metaObj.recipientIdentityId ||
                  requesterSpaces.some((s) => s.spaceId === metaObj.recipientIdentityId))
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
