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
  private onUnauthorizedHandler: (() => Promise<boolean>) | null = null;

  constructor(config: string | CloudClientConfig) {
    if (typeof config === 'string') {
      this.baseUrl = config.replace(/\/+$/, '');
      this.timeoutMs = 30000;
    } else {
      this.baseUrl = (config?.baseUrl || 'http://127.0.0.1:8787').replace(/\/+$/, '');
      this.timeoutMs = config?.requestTimeoutMs || 30000;
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setOnUnauthorized(handler: (() => Promise<boolean>) | null): void {
    this.onUnauthorizedHandler = handler;
  }

  public setSession(token: string | null, accountId: string | null, deviceId: string | null): void {
    this.sessionToken = token;
    this.accountId = accountId;
    this.deviceId = deviceId;
  }

  public hasAuthenticatedSession(): boolean {
    return !!(
      this.sessionToken &&
      /^[a-f0-9]{64}$/i.test(this.sessionToken) &&
      this.accountId &&
      this.deviceId
    );
  }

  public requireAuthenticatedSession(): void {
    if (!this.hasAuthenticatedSession()) {
      throw new Error('Authentication required before attachment request (Unauthorized)');
    }
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
    body?: any,
    timeoutOverrideMs?: number,
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    const isAttachmentRoute = path.includes('/attachments/');
    if (isAttachmentRoute && !this.hasAuthenticatedSession()) {
      if (retryCount === 0 && this.onUnauthorizedHandler) {
        try {
          const reauthed = await this.onUnauthorizedHandler();
          if (reauthed && this.hasAuthenticatedSession()) {
            return await this.request<T>(path, method, body, timeoutOverrideMs, retryCount + 1);
          }
        } catch (_e) {}
      }
      this.requireAuthenticatedSession();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutOverrideMs || this.timeoutMs);

    try {
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError' || controller.signal.aborted) {
          throw new Error(`Recovery server timed out after ${timeoutOverrideMs || this.timeoutMs}ms. Please try again.`);
        }
        if (
          fetchErr?.message?.includes('Failed to fetch') ||
          fetchErr?.message?.includes('NetworkError') ||
          fetchErr?.message?.includes('fetch failed') ||
          fetchErr?.message?.includes('Network request failed')
        ) {
          throw new Error(`Unable to connect to recovery server at ${this.baseUrl}. Please check your internet connection.`);
        }
        throw fetchErr;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && retryCount === 0 && this.onUnauthorizedHandler) {
          try {
            const reauthed = await this.onUnauthorizedHandler();
            if (reauthed) {
              return await this.request<T>(path, method, body, timeoutOverrideMs, retryCount + 1);
            }
          } catch (_reauthErr) {}
        }
        if (res.status === 401) {
          this.setSession(null, null, null);
          throw new Error(json.error || 'Invalid username or password');
        }
        if (res.status === 404) {
          throw new Error(json.error || 'Account or recovery vault not found on server');
        }
        if (res.status === 409) {
          throw new Error(json.error || 'Username is already registered. Please choose another username.');
        }
        if (res.status >= 500) {
          throw new Error(json.error || `Recovery server error (${res.status}). Please try again later.`);
        }
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
    const res = await this.request('/v1/account/register', 'POST', params, 60000);
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
    const res = await this.request('/v1/account/login', 'POST', params, 60000);
    this.setSession(res.session.sessionToken, res.account.accountId, res.device.deviceId);
    return res;
  }

  public async restoreAccount(params: {
    username: string;
    password: string;
    deviceId: string;
    deviceName?: string;
    deviceSigningPub?: string;
    deviceKeyAgreementPub?: string;
  }): Promise<{ account: any; device: any; session: any; recovery: RecoveryStateEntity | null }> {
    const res = await this.request('/v1/account/restore', 'POST', params, 60000);
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

  public async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.request('/v1/account/change-password', 'POST', { oldPassword, newPassword }, 60000);
  }

  public async changeUsername(newUsername: string): Promise<{ oldUsername: string; newUsername: string }> {
    return await this.request<{ oldUsername: string; newUsername: string }>('/v1/account/change-username', 'POST', { newUsername }, 15000);
  }

  public async listDevices(): Promise<DeviceEntity[]> {
    const res = await this.request<{ devices: DeviceEntity[] }>('/v1/account/devices', 'GET');
    return res.devices;
  }

  public async revokeDevice(deviceId: string): Promise<void> {
    await this.request('/v1/account/devices/revoke', 'POST', { deviceId });
  }

  public async setRecoveryVault(
    encryptedVaultBlob: string,
    kdfParams: any,
    expectedUpdatedAt?: number
  ): Promise<{ success: boolean; updatedAt?: number }> {
    return await this.request('/v1/account/recovery/vault/set', 'POST', { encryptedVaultBlob, kdfParams, expectedUpdatedAt }, 60000);
  }

  public async getRecoveryVault(): Promise<RecoveryStateEntity | null> {
    const res = await this.request<{ recovery: RecoveryStateEntity | null }>('/v1/account/recovery/vault/get', 'GET', undefined, 60000);
    return res.recovery;
  }

  public async getRecoveryHealth(): Promise<{ status: string; db: string; recoveryTable: string; queryLatencyMs?: number }> {
    return await this.request('/v1/account/recovery/health', 'GET', undefined, 10000);
  }

  // ===========================================================================
  // SPACES SYNC
  // ===========================================================================

  public async syncSpaces(spaces: CloudSpaceEntity[]): Promise<CloudSpaceEntity[]> {
    const res = await this.request<{ spaces: CloudSpaceEntity[] }>('/v1/cloud/spaces/sync', 'POST', { spaces }, 60000);
    return res.spaces;
  }

  public async listSpaces(): Promise<CloudSpaceEntity[]> {
    const res = await this.request<{ spaces: CloudSpaceEntity[] }>('/v1/cloud/spaces', 'GET', undefined, 60000);
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
    recipientAccountId?: string;
    recipientUsername?: string;
    recipientIdentityId?: string;
    groupId?: string;
    conversationId?: string;
    allowedAccounts?: string[];
  }): Promise<{ attachment: CloudAttachmentEntity }> {
    return await this.request('/v1/cloud/attachments/create', 'POST', params);
  }

  public async uploadAttachment(objectId: string, rawCiphertext: Uint8Array): Promise<void> {
    this.requireAuthenticatedSession();
    const timeoutMs = Math.max(180000, Math.ceil(rawCiphertext.length / 50000) * 1000);
    const computedHash = bytesToHex(sha256(rawCiphertext));

    // Try high-performance raw binary upload first
    let rawUploadSucceeded = false;
    if (this.sessionToken) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `${this.baseUrl}/v1/cloud/attachments/upload-raw?objectId=${encodeURIComponent(objectId)}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/octet-stream',
          'X-Object-Id': objectId,
          'X-Ciphertext-Hash': computedHash,
          'Authorization': `Bearer ${this.sessionToken}`,
        };
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: rawCiphertext as unknown as BodyInit,
          signal: controller.signal,
        });

        if (res.ok) {
          rawUploadSucceeded = true;
        } else if (res.status !== 404 && res.status !== 405) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Raw upload error HTTP ${res.status}: ${errText}`);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error(`Upload timed out after ${timeoutMs}ms. Please try again.`);
        }
        if (err?.message?.includes('Raw upload error')) {
          throw err;
        }
        // Fall back to JSON upload if network error or 404
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!rawUploadSucceeded) {
      // Fallback to standard base64 JSON upload
      const ciphertextBase64 = bytesToBase64(rawCiphertext);
      await this.request('/v1/cloud/attachments/upload', 'POST', { objectId, ciphertextBase64 }, timeoutMs);
    }
  }

  public async downloadAttachment(objectId: string): Promise<Uint8Array> {
    this.requireAuthenticatedSession();
    const timeoutMs = 180000;

    // Try raw binary download first
    if (this.sessionToken) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `${this.baseUrl}/v1/cloud/attachments/download-raw/${encodeURIComponent(objectId)}`;
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${this.sessionToken}`,
        };
        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const raw = new Uint8Array(buffer);
          const expectedHash = res.headers.get('x-ciphertext-hash');
          if (expectedHash) {
            const computedHash = bytesToHex(sha256(raw));
            if (computedHash !== expectedHash) {
              throw new Error('Attachment integrity error: downloaded ciphertext hash mismatch');
            }
          }
          return raw;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error(`Download timed out after ${timeoutMs}ms. Please try again.`);
        }
        // Fall back to JSON download
      } finally {
        clearTimeout(timeout);
      }
    }

    // Fallback to standard base64 JSON download
    const res = await this.request<{ ciphertextBase64: string; ciphertextHash: string }>(
      `/v1/cloud/attachments/download/${objectId}`,
      'GET',
      undefined,
      timeoutMs
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
