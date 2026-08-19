/**
 * Production Backup & Restoration Module for VEIL.
 *
 * Implements backup and restore routines for the VEIL Database and Object Storage.
 *
 * SECURITY INVARIANT:
 * Backups operate purely on authenticated ciphertexts. Zero user data is decrypted.
 */

import * as fs from 'fs';
import * as path from 'path';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '../../crypto/utils.ts';
import { FileCloudDatabase } from './database/fileCloudDatabase.ts';
import { LocalDiskObjectStorage } from './storage/localDiskObjectStorage.ts';

const DEFAULT_BACKUP_DIR = path.join(process.cwd(), '.veil_backups');

export async function createBackup(outputFile?: string): Promise<string> {
  const dbDir = path.join(process.cwd(), '.veil_cloud_db');
  const objDir = path.join(process.cwd(), '.veil_object_store');

  if (!fs.existsSync(DEFAULT_BACKUP_DIR)) {
    fs.mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetPath = outputFile || path.join(DEFAULT_BACKUP_DIR, `veil_prod_backup_${timestamp}.json`);

  const db = new FileCloudDatabase(dbDir);
  await db.init();

  const storage = new LocalDiskObjectStorage(objDir);
  await storage.init();

  const backupData: {
    version: number;
    timestamp: number;
    isoDate: string;
    sourceDatabase: string;
    sourceObjectStore: string;
    files: Record<string, { content: string; sha256: string; sizeBytes: number }>;
  } = {
    version: 1,
    timestamp: Date.now(),
    isoDate: new Date().toISOString(),
    sourceDatabase: dbDir,
    sourceObjectStore: objDir,
    files: {},
  };

  // 1. Collect DB files
  if (fs.existsSync(dbDir)) {
    const scanDir = (dir: string, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        const rel = path.join(prefix, ent.name);
        if (ent.isDirectory()) {
          scanDir(full, rel);
        } else if (ent.isFile() && !ent.name.includes('.tmp.')) {
          const raw = fs.readFileSync(full);
          const hash = bytesToHex(sha256(raw));
          backupData.files[`db/${rel.replace(/\\/g, '/')}`] = {
            content: raw.toString('base64'),
            sha256: hash,
            sizeBytes: raw.length,
          };
        }
      }
    };
    scanDir(dbDir);
  }

  // 2. Collect Object files
  if (fs.existsSync(objDir)) {
    const scanObj = (dir: string, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        const rel = path.join(prefix, ent.name);
        if (ent.isDirectory()) {
          scanObj(full, rel);
        } else if (ent.isFile() && !ent.name.includes('.tmp.')) {
          const raw = fs.readFileSync(full);
          const hash = bytesToHex(sha256(raw));
          backupData.files[`objects/${rel.replace(/\\/g, '/')}`] = {
            content: raw.toString('base64'),
            sha256: hash,
            sizeBytes: raw.length,
          };
        }
      }
    };
    scanObj(objDir);
  }

  const rawJson = JSON.stringify(backupData, null, 2);
  fs.writeFileSync(targetPath, rawJson, 'utf8');

  return targetPath;
}

export async function restoreBackup(
  backupFile: string,
  targetDbDir?: string,
  targetObjDir?: string
): Promise<boolean> {
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const rawJson = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(rawJson);

  const destDbDir = targetDbDir || path.join(process.cwd(), '.veil_cloud_db');
  const destObjDir = targetObjDir || path.join(process.cwd(), '.veil_object_store');

  if (!fs.existsSync(destDbDir)) fs.mkdirSync(destDbDir, { recursive: true });
  if (!fs.existsSync(destObjDir)) fs.mkdirSync(destObjDir, { recursive: true });

  for (const [key, item] of Object.entries(backup.files as Record<string, any>)) {
    const raw = Buffer.from(item.content, 'base64');
    const computedHash = bytesToHex(sha256(raw));
    if (computedHash !== item.sha256) {
      throw new Error(`Integrity error: checksum mismatch for ${key}`);
    }

    let outPath = '';
    if (key.startsWith('db/')) {
      outPath = path.join(destDbDir, key.substring(3));
    } else if (key.startsWith('objects/')) {
      outPath = path.join(destObjDir, key.substring(8));
    }

    if (outPath) {
      const parent = path.dirname(outPath);
      if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
      fs.writeFileSync(outPath, raw);
    }
  }

  return true;
}
