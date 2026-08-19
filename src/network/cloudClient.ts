/**
 * Cloud HTTP Client for VEIL.
 *
 * Provides type-safe client methods to communicate with the VEIL Cloud Backend:
 * - Account registration, login, logout, and device management
 * - Client-side encrypted Space synchronization
 * - Client-side encrypted message push/pull/delete
 * - Client-side encrypted attachment upload/download/delete
 */

import type { CloudSpaceEntity, CloudMessageEntity, CloudAttachmentEntity, DeviceEntity, RecoveryStateEntity } from '../server/cloud/database/types.ts';
import { base64ToBytes, bytesToBase64, bytesToHex } from '../crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';

export interface CloudClientConfig {
  baseUrl: string; // e.g. "http://127.0.0.1:8787"
  requestTimeoutMs?: number;
}

export class CloudClient {
  private baseUrl: string;
  private timeoutMs: number;
  private sessionToken: string | null = null;
  private accountId: string | null = null;
  private deviceId: string | null = null;

  constructor(config: CloudClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.requestTimeoutMs || 10000;
  }

  public setSession(token: string | null, accountId: string | null, deviceId: string | null): void {
    this.sessionToken = token;
    this.accountId = accountId;
    this.deviceId = deviceId;
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public getAccountId(): string | null {
    return this.accountId;
  }

  public getDeviceId(): string | null {
    return this.deviceId;
  }

  private async request<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      return json as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===========================================================================
  // ACCOUNT & DEVICE APIS
  // ===========================================================================

  public async registerAccount(params: {
    username: string;
    password: string;
    deviceId: string;
    deviceName?: string;
    deviceSigningPub?: string;
    deviceKeyAgreementPub?: string;
    recoveryAnchor?: string;
  }): Promise<{ account: any; device: any; session: any }> {
    const res = await this.request('/v1/account/register', 'POST', params);
    this.setSession(res.session.sessionToken, res.account.accountId, res.device.deviceId);
    return res;
  }

  public async loginAccount(params: {
    username: string;
    password: string;
    deviceId: string;
    deviceName?: string;
    deviceSigningPub?: string;
    deviceKeyAgreementPub?: string;
  }): Promise<{ account: any; device: any; session: any }> {
    const res = await this.request('/v1/account/login', 'POST', params);
    this.setSession(res.session.sessionToken, res.account.accountId, res.device.deviceId);
    return res;
  }

  public async logout(): Promise<void> {
    if (this.sessionToken) {
      try {
        await this.request('/v1/account/logout', 'POST', {});
      } catch (_e) {}
    }
    this.setSession(null, null, null);
  }

  public async listDevices(): Promise<DeviceEntity[]> {
    const res = await this.request<{ devices: DeviceEntity[] }>('/v1/account/devices', 'GET');
    return res.devices;
  }

  public async revokeDevice(deviceId: string): Promise<void> {
    await this.request('/v1/account/devices/revoke', 'POST', { deviceId });
  }

  public async setRecoveryVault(encryptedVaultBlob: string, kdfParams: any): Promise<void> {
    await this.request('/v1/account/recovery/vault/set', 'POST', { encryptedVaultBlob, kdfParams });
  }

  public async getRecoveryVault(): Promise<RecoveryStateEntity | null> {
    const res = await this.request<{ recovery: RecoveryStateEntity | null }>('/v1/account/recovery/vault/get', 'GET');
    return res.recovery;
  }

  // ===========================================================================
  // SPACES SYNC
  // ===========================================================================

  public async syncSpaces(spaces: CloudSpaceEntity[]): Promise<CloudSpaceEntity[]> {
    const res = await this.request<{ spaces: CloudSpaceEntity[] }>('/v1/cloud/spaces/sync', 'POST', { spaces });
    return res.spaces;
  }

  public async listSpaces(): Promise<CloudSpaceEntity[]> {
    const res = await this.request<{ spaces: CloudSpaceEntity[] }>('/v1/cloud/spaces', 'GET');
    return res.spaces;
  }

  // ===========================================================================
  // MESSAGES PUSH / PULL / DELETE
  // ===========================================================================

  public async pushMessages(messages: CloudMessageEntity[]): Promise<{ acceptedCount: number; acceptedIds: string[] }> {
    return await this.request('/v1/cloud/messages/push', 'POST', { messages });
  }

  public async pullMessages(spaceId: string, sinceVersion = 0, limit = 100): Promise<CloudMessageEntity[]> {
    const res = await this.request<{ messages: CloudMessageEntity[] }>('/v1/cloud/messages/pull', 'POST', {
      spaceId,
      sinceVersion,
      limit,
    });
    return res.messages;
  }

  public async deleteMessage(spaceId: string, messageId: string): Promise<void> {
    await this.request('/v1/cloud/messages/delete', 'POST', { spaceId, messageId });
  }

  // ===========================================================================
  // ATTACHMENTS
  // ===========================================================================

  public async createAttachment(params: {
    attachmentId: string;
    spaceId: string;
    encryptedMetadata?: string;
    ciphertextSize: number;
    ciphertextHash: string;
    chunkCount?: number;
    chunkSize?: number;
  }): Promise<{ attachment: CloudAttachmentEntity }> {
    return await this.request('/v1/cloud/attachments/create', 'POST', params);
  }

  public async uploadAttachment(objectId: string, rawCiphertext: Uint8Array): Promise<void> {
    const ciphertextBase64 = bytesToBase64(rawCiphertext);
    await this.request('/v1/cloud/attachments/upload', 'POST', { objectId, ciphertextBase64 });
  }

  public async downloadAttachment(objectId: string): Promise<Uint8Array> {
    const res = await this.request<{ ciphertextBase64: string; ciphertextHash: string }>(
      `/v1/cloud/attachments/download/${objectId}`,
      'GET'
    );
    const raw = base64ToBytes(res.ciphertextBase64);
    const computedHash = bytesToHex(sha256(raw));
    if (computedHash !== res.ciphertextHash) {
      throw new Error(`Attachment integrity error: downloaded ciphertext hash mismatch`);
    }
    return raw;
  }

  public async deleteAttachment(spaceId: string, attachmentId: string): Promise<void> {
    await this.request('/v1/cloud/attachments/delete', 'POST', { spaceId, attachmentId });
  }
}
