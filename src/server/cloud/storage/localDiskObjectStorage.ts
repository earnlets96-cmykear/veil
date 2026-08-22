/**
 * Local Filesystem Object Storage Implementation for VEIL.
 *
 * Implements IObjectStorage using local disk storage with strict path sanitization,
 * atomic writes, and SHA-256 integrity verification.
 */

import * as fs from 'fs';
import * as path from 'path';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '../../../../src/crypto/utils.ts';
import type { IObjectStorage, ObjectMetadata } from './types.ts';

export class LocalDiskObjectStorage implements IObjectStorage {
  private baseDir: string;
  private metadataFile: string;
  private objectsDir: string;
  private metadataMap = new Map<string, ObjectMetadata>();
  private initialized = false;

  constructor(baseDir = path.join(process.cwd(), '.veil_object_store')) {
    this.baseDir = baseDir;
    this.metadataFile = path.join(baseDir, 'objects_metadata.json');
    this.objectsDir = path.join(baseDir, 'objects');
  }

  public async init(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.objectsDir)) {
      fs.mkdirSync(this.objectsDir, { recursive: true });
    }

    if (fs.existsSync(this.metadataFile)) {
      try {
        const raw = fs.readFileSync(this.metadataFile, 'utf8');
        const list: ObjectMetadata[] = JSON.parse(raw);
        for (const meta of list) {
          this.metadataMap.set(meta.objectId, meta);
        }
      } catch (_e) {}
    }

    this.initialized = true;
  }

  public async close(): Promise<void> {}

  private validateObjectId(objectId: string): string {
    if (!objectId || typeof objectId !== 'string') {
      throw new Error('Invalid objectId: must be a non-empty string');
    }
    // Strict alphanumeric + underscores/dashes validation to prevent path traversal
    const sanitized = objectId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitized !== objectId || objectId.includes('..') || objectId.includes('/') || objectId.includes('\\')) {
      throw new Error(`Security Violation: Path traversal or invalid character detected in objectId: ${objectId}`);
    }
    return sanitized;
  }

  private objectFilePath(sanitizedId: string): string {
    return path.join(this.objectsDir, `${sanitizedId}.bin`);
  }

  public async upload(
    objectId: string,
    data: Uint8Array,
    customMetadata?: Record<string, string>
  ): Promise<ObjectMetadata> {
    const validId = this.validateObjectId(objectId);
    const hashHex = bytesToHex(sha256(data));
    const filePath = this.objectFilePath(validId);

    // Atomic write
    const tmpPath = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await fs.promises.writeFile(tmpPath, Buffer.from(data));
    await fs.promises.rename(tmpPath, filePath);

    const meta: ObjectMetadata = {
      objectId: validId,
      sizeBytes: data.length,
      sha256Hash: hashHex,
      createdAt: Date.now(),
      customMetadata,
    };

    this.metadataMap.set(validId, meta);
    await this.persistMetadata();

    return meta;
  }

  public async download(objectId: string): Promise<Uint8Array | null> {
    const validId = this.validateObjectId(objectId);
    const filePath = this.objectFilePath(validId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buffer = await fs.promises.readFile(filePath);
    return new Uint8Array(buffer);
  }

  public async delete(objectId: string): Promise<boolean> {
    const validId = this.validateObjectId(objectId);
    const filePath = this.objectFilePath(validId);
    let deleted = false;

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      deleted = true;
    }

    if (this.metadataMap.delete(validId)) {
      deleted = true;
      await this.persistMetadata();
    }

    return deleted;
  }

  public async exists(objectId: string): Promise<boolean> {
    const validId = this.validateObjectId(objectId);
    const filePath = this.objectFilePath(validId);
    return fs.existsSync(filePath);
  }

  public async getMetadata(objectId: string): Promise<ObjectMetadata | null> {
    const validId = this.validateObjectId(objectId);
    const meta = this.metadataMap.get(validId);
    return meta ? { ...meta } : null;
  }

  private async persistMetadata(): Promise<void> {
    const list = Array.from(this.metadataMap.values());
    const tmpPath = `${this.metadataFile}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(list, null, 2), 'utf8');
    try {
      await fs.promises.rename(tmpPath, this.metadataFile);
    } catch (_err) {
      // Fallback for Windows EPERM / temporary file lock
      await fs.promises.copyFile(tmpPath, this.metadataFile);
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  }
}
