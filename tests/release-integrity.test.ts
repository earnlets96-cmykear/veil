import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('VEIL Phase 19: Release Integrity & Checksum Verification', () => {
  it('CHECKSUM VERIFICATION: All declared artifacts exist and match SHA-256 hashes', () => {
    const rootDir = process.cwd();
    const manifestPath = path.join(rootDir, 'release', 'v1.0.0', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.artifacts.length).toBeGreaterThan(0);

    for (const item of manifest.artifacts) {
      const filePath = path.join(rootDir, item.path);
      expect(fs.existsSync(filePath)).toBe(true);

      const buffer = fs.readFileSync(filePath);
      const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(computedHash).toBe(item.sha256);
      expect(buffer.length).toBe(item.sizeBytes);
    }
  });
});
