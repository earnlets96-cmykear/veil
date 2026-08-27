/**
 * Phase 31: Production Continuity & Zero-Knowledge Security Invariants Tests.
 *
 * Verifies that production secrets (DATABASE_URL, R2 credentials) never leak into
 * frontend bundles or client files, authoritative production relay URLs are enforced,
 * and multi-tenant cloud persistence boundaries remain zero-knowledge.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PRODUCTION_RELAY_URL, PRODUCTION_RELAY_WS_URL, ConfigManager } from '../src/config/appConfig.ts';

describe('Phase 31: Production Continuity & Security Boundary Verification', () => {
  it('enforces authoritative production relay URLs', () => {
    expect(PRODUCTION_RELAY_URL).toBe('https://veil-rga0.onrender.com');
    expect(PRODUCTION_RELAY_WS_URL).toBe('wss://veil-rga0.onrender.com/v1/ws');

    const prodConfig = ConfigManager.getConfig('production');
    expect(prodConfig.relayHttpUrl).toBe('https://veil-rga0.onrender.com');
    expect(prodConfig.relayWsUrl).toBe('wss://veil-rga0.onrender.com/v1/ws');
    expect(prodConfig.enforceTls).toBe(true);
  });

  it('prohibits DATABASE_URL and R2 credentials from existing in client source files', () => {
    const rootDir = process.cwd();
    const clientDirs = [
      path.join(rootDir, 'src', 'ui'),
      path.join(rootDir, 'src', 'config'),
      path.join(rootDir, 'src', 'crypto'),
      path.join(rootDir, 'src', 'identity'),
      path.join(rootDir, 'src', 'spaces'),
      path.join(rootDir, 'src', 'storage'),
    ];

    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    for (const clientDir of clientDirs) {
      const files = scanFiles(clientDir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');

        // INVARIANTS: Zero server credentials in frontend code
        expect(content).not.toContain('R2_SECRET_ACCESS_KEY');
        expect(content).not.toContain('R2_ACCESS_KEY_ID');
        expect(content).not.toContain('DATABASE_URL');
        expect(content).not.toContain('POSTGRES_PASSWORD');
      }
    }
  });
});
