import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 19: Release Artifact Security Scan', () => {
  it('ZERO EMBEDDED SECRETS: Production dist/ contains no hardcoded private keys or test passwords', () => {
    const distDir = path.join(process.cwd(), 'dist');
    expect(fs.existsSync(distDir)).toBe(true);

    function scanFiles(dir: string): string[] {
      let files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files = files.concat(scanFiles(full));
        else files.push(full);
      }
      return files;
    }

    const files = scanFiles(distDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');

      // Ensure no raw private key strings or test secrets
      expect(content).not.toContain('-----BEGIN PRIVATE KEY-----');
      expect(content).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
      expect(content).not.toContain('SuperSecretMessagePlaintext');
    }
  });
});
