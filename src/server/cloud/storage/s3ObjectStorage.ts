/**
 * S3-Compatible Cloud Object Storage Adapter for VEIL.
 *
 * Implements IObjectStorage using authentic AWS Signature Version 4 (SigV4)
 * REST requests compatible with AWS S3, MinIO, Cloudflare R2, and Google Cloud Storage.
 *
 * SECURITY & PRIVACY INVARIANTS:
 * - Pure TypeScript: Uses @noble/hashes for SigV4 HMAC-SHA256 calculation.
 * - Zero Credentials in Frontend: S3 credentials reside strictly on backend.
 * - Ciphertext Only: Only client-side encrypted blobs are transferred and stored.
 * - Strict Path Sanitization: Prevents directory traversal or ambiguous object keys.
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex } from '../../../../src/crypto/utils.ts';
import type { IObjectStorage, ObjectMetadata } from './types.ts';

export interface S3StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  pathStyle?: boolean;
  timeoutMs?: number;
}

export class S3ObjectStorage implements IObjectStorage {
  private config: S3StorageConfig;
  private isConfigured = false;
  private inMemoryFallback = new Map<string, { data: Uint8Array; meta: ObjectMetadata }>();
  private initialized = false;

  constructor(config?: Partial<S3StorageConfig>) {
    this.config = {
      endpoint: (config?.endpoint || process.env.OBJECT_STORAGE_ENDPOINT || process.env.S3_ENDPOINT || 'https://s3.amazonaws.com').replace(/\/+$/, ''),
      bucket: config?.bucket || process.env.OBJECT_STORAGE_BUCKET || process.env.S3_BUCKET || 'veil-attachments',
      accessKeyId: config?.accessKeyId || process.env.OBJECT_STORAGE_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: config?.secretAccessKey || process.env.OBJECT_STORAGE_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY || '',
      region: config?.region || process.env.OBJECT_STORAGE_REGION || process.env.S3_REGION || 'us-east-1',
      pathStyle: config?.pathStyle ?? true,
      timeoutMs: config?.timeoutMs || 15000,
    };

    if (this.config.accessKeyId && this.config.secretAccessKey) {
      this.isConfigured = true;
    }
  }

  public async init(): Promise<void> {
    this.initialized = true;
  }

  public async close(): Promise<void> {
    this.initialized = false;
  }

  public isLiveS3Configured(): boolean {
    return this.isConfigured;
  }

  public getConfig(): Readonly<Omit<S3StorageConfig, 'secretAccessKey'>> {
    const { secretAccessKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  private validateObjectId(objectId: string): string {
    if (!objectId || typeof objectId !== 'string') {
      throw new Error('Invalid objectId: must be a non-empty string');
    }
    const sanitized = objectId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitized !== objectId || objectId.includes('..') || objectId.includes('/') || objectId.includes('\\')) {
      throw new Error(`Security Violation: Path traversal or invalid character in S3 objectId: ${objectId}`);
    }
    return sanitized;
  }

  /**
   * Generates AWS Signature Version 4 Authorization Headers.
   */
  private generateSigV4Headers(
    method: string,
    canonicalPath: string,
    payloadBytes: Uint8Array,
    extraHeaders: Record<string, string> = {}
  ): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const url = new URL(this.config.endpoint);
    const host = url.host;

    const payloadHash = bytesToHex(sha256(payloadBytes));

    const headersToSign: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders,
    };

    // Sort headers alphabetically
    const sortedKeys = Object.keys(headersToSign).sort();
    const canonicalHeaders = sortedKeys.map((k) => `${k.toLowerCase()}:${headersToSign[k].trim()}\n`).join('');
    const signedHeaders = sortedKeys.map((k) => k.toLowerCase()).join(';');

    const canonicalRequest = [
      method.toUpperCase(),
      canonicalPath,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      bytesToHex(sha256(new TextEncoder().encode(canonicalRequest))),
    ].join('\n');

    // Key derivation: kSecret -> kDate -> kRegion -> kService -> kSigning
    const kDate = hmac(sha256, new TextEncoder().encode(`AWS4${this.config.secretAccessKey}`), new TextEncoder().encode(dateStamp));
    const kRegion = hmac(sha256, kDate, new TextEncoder().encode(this.config.region || 'us-east-1'));
    const kService = hmac(sha256, kRegion, new TextEncoder().encode('s3'));
    const kSigning = hmac(sha256, kService, new TextEncoder().encode('aws4_request'));

    const signature = bytesToHex(hmac(sha256, kSigning, new TextEncoder().encode(stringToSign)));

    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headersToSign,
      Authorization: authHeader,
    };
  }

  private getObjectPath(validId: string): string {
    if (this.config.pathStyle) {
      return `/${this.config.bucket}/${validId}`;
    }
    return `/${validId}`;
  }

  private getRequestUrl(validId: string): string {
    const path = this.getObjectPath(validId);
    return `${this.config.endpoint}${path}`;
  }

  public async upload(
    objectId: string,
    data: Uint8Array,
    customMetadata?: Record<string, string>
  ): Promise<ObjectMetadata> {
    const validId = this.validateObjectId(objectId);
    const hashHex = bytesToHex(sha256(data));
    const createdAt = Date.now();

    const meta: ObjectMetadata = {
      objectId: validId,
      sizeBytes: data.length,
      sha256Hash: hashHex,
      createdAt,
      customMetadata,
    };

    if (!this.isConfigured) {
      // In-memory / local fallback for development/test harness
      this.inMemoryFallback.set(validId, { data: new Uint8Array(data), meta });
      return meta;
    }

    const canonicalPath = this.getObjectPath(validId);
    const headers = this.generateSigV4Headers('PUT', canonicalPath, data, {
      'content-type': 'application/octet-stream',
      'content-length': String(data.length),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const url = this.getRequestUrl(validId);
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: data,
        signal: controller.signal,
      });

      if (!res.ok && res.status !== 200 && res.status !== 201) {
        const text = await res.text().catch(() => '');
        throw new Error(`S3 upload error HTTP ${res.status}: ${text}`);
      }

      this.inMemoryFallback.set(validId, { data: new Uint8Array(data), meta });
      return meta;
    } catch (err: any) {
      // If live endpoint fails in non-production, maintain in-memory fallback
      if (process.env.NODE_ENV !== 'production') {
        this.inMemoryFallback.set(validId, { data: new Uint8Array(data), meta });
        return meta;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async download(objectId: string): Promise<Uint8Array | null> {
    const validId = this.validateObjectId(objectId);

    if (!this.isConfigured) {
      const item = this.inMemoryFallback.get(validId);
      return item ? new Uint8Array(item.data) : null;
    }

    const canonicalPath = this.getObjectPath(validId);
    const emptyPayload = new Uint8Array(0);
    const headers = this.generateSigV4Headers('GET', canonicalPath, emptyPayload);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const url = this.getRequestUrl(validId);
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`S3 download error HTTP ${res.status}: ${text}`);
      }

      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      this.inMemoryFallback.set(validId, {
        data: bytes,
        meta: {
          objectId: validId,
          sizeBytes: bytes.length,
          sha256Hash: bytesToHex(sha256(bytes)),
          createdAt: Date.now(),
        },
      });
      return bytes;
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') {
        const fallback = this.inMemoryFallback.get(validId);
        return fallback ? new Uint8Array(fallback.data) : null;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async delete(objectId: string): Promise<boolean> {
    const validId = this.validateObjectId(objectId);
    this.inMemoryFallback.delete(validId);

    if (!this.isConfigured) {
      return true;
    }

    const canonicalPath = this.getObjectPath(validId);
    const emptyPayload = new Uint8Array(0);
    const headers = this.generateSigV4Headers('DELETE', canonicalPath, emptyPayload);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const url = this.getRequestUrl(validId);
      const res = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });

      return res.ok || res.status === 204 || res.status === 404;
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async exists(objectId: string): Promise<boolean> {
    const validId = this.validateObjectId(objectId);
    if (this.inMemoryFallback.has(validId)) return true;

    if (!this.isConfigured) return false;

    const canonicalPath = this.getObjectPath(validId);
    const emptyPayload = new Uint8Array(0);
    const headers = this.generateSigV4Headers('HEAD', canonicalPath, emptyPayload);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const url = this.getRequestUrl(validId);
      const res = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: controller.signal,
      });

      return res.status === 200;
    } catch (_e) {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async getMetadata(objectId: string): Promise<ObjectMetadata | null> {
    const validId = this.validateObjectId(objectId);
    const cached = this.inMemoryFallback.get(validId);
    if (cached) return { ...cached.meta };

    if (!this.isConfigured) return null;

    const canonicalPath = this.getObjectPath(validId);
    const emptyPayload = new Uint8Array(0);
    const headers = this.generateSigV4Headers('HEAD', canonicalPath, emptyPayload);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const url = this.getRequestUrl(validId);
      const res = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: controller.signal,
      });

      if (!res.ok) return null;

      const sizeBytes = parseInt(res.headers.get('content-length') || '0', 10);
      const etag = (res.headers.get('etag') || '').replace(/"/g, '');

      return {
        objectId: validId,
        sizeBytes,
        sha256Hash: etag,
        createdAt: Date.now(),
      };
    } catch (_e) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
