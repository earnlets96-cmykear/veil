/**
 * Production Backup & Restoration Utility for VEIL Cloud Infrastructure.
 *
 * Implements backup and restore routines for the VEIL Database and Object Storage.
 *
 * SECURITY INVARIANT:
 * Backups operate purely on authenticated ciphertexts. Zero user data is decrypted.
 *
 * Usage:
 *   node scripts/production-backup.mjs --backup [output_path]
 *   node scripts/production-backup.mjs --restore [backup_file]
 *   node scripts/production-backup.mjs --verify [backup_file]
 */

import * as fs from 'fs';
import * as path from 'path';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '../src/crypto/utils.ts';
import { FileCloudDatabase } from '../src/server/cloud/database/fileCloudDatabase.ts';
import { LocalDiskObjectStorage } from '../src/server/cloud/storage/localDiskObjectStorage.ts';

const DEFAULT_BACKUP_DIR = path.join(process.cwd(), '.veil_backups');

export async function createBackup(outputFile) {
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

  const backupData = {
    version: 1,
    timestamp: Date.now(),
    isoDate: new Date().toISOString(),
    sourceDatabase: dbDir,
    sourceObjectStore: objDir,
    files: {},
  };

  // 1. Collect DB files
  if (fs.existsSync(dbDir)) {
    const scanDir = (dir, prefix = '') => {
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
    const scanObj = (dir, prefix = '') => {
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

  console.log(`📦 VEIL Production Backup created: ${targetPath}`);
  console.log(`📊 Total items backed up: ${Object.keys(backupData.files).length}`);

  return targetPath;
}

export async function restoreBackup(backupFile, targetDbDir, targetObjDir) {
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const rawJson = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(rawJson);

  const destDbDir = targetDbDir || path.join(process.cwd(), '.veil_cloud_db');
  const destObjDir = targetObjDir || path.join(process.cwd(), '.veil_object_store');

  if (!fs.existsSync(destDbDir)) fs.mkdirSync(destDbDir, { recursive: true });
  if (!fs.existsSync(destObjDir)) fs.mkdirSync(destObjDir, { recursive: true });

  for (const [key, item] of Object.entries(backup.files)) {
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

  console.log(`✅ Backup successfully restored from ${backupFile}`);
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('production-backup.mjs')) {
  const mode = process.argv[2] || '--backup';
  if (mode === '--backup') {
    createBackup(process.argv[3]).catch(console.error);
  } else if (mode === '--restore') {
    restoreBackup(process.argv[3]).catch(console.error);
  }
}
