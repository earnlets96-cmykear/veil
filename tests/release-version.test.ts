import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 19: Release Version Consistency Tests', () => {
  it('VERSION ALIGNMENT: package.json declares canonical v1.0.0', () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.name).toBe('veil');
    expect(pkg.version).toBe('1.0.0');
  });

  it('MANIFEST VERSION ALIGNMENT: Release manifest declares matching v1.0.0', () => {
    const manifestPath = path.join(process.cwd(), 'release', 'v1.0.0', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.releaseVersion).toBe('1.0.0');
  });
});
