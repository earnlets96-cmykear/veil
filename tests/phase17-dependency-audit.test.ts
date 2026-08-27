import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 17: Dependency & Supply Chain Integrity Audit', () => {
  it('DEPENDENCY CONSTRAINTS: Only mature, audited noble crypto suites and react are used in production dependencies', () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const allowedProdDeps = [
      '@noble/ciphers',
      '@noble/curves',
      '@noble/hashes',
      'react',
      'react-dom',
      'ws',
      'pg',
      '@capacitor/filesystem',
      '@capacitor/share',
    ];

    const prodDeps = Object.keys(pkg.dependencies || {});
    for (const dep of prodDeps) {
      expect(allowedProdDeps).toContain(dep);
    }

    // Zero telemetry or commercial tracking libraries
    const allDeps = [...prodDeps, ...Object.keys(pkg.devDependencies || {})];
    for (const dep of allDeps) {
      expect(dep).not.toMatch(/analytics|tracking|telemetry|sentry|mixpanel|amplitude/i);
    }
  });
});
