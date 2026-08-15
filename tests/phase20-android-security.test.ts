import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 20: Android Security & Configuration Audit', () => {
  it('ANDROID MANIFEST SECURITY: Verifies allowBackup is false and usesCleartextTraffic is false', () => {
    const manifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = fs.readFileSync(manifestPath, 'utf8');
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('android.permission.INTERNET');
  });

  it('NETWORK SECURITY CONFIG: Ensures cleartext traffic is disabled in XML configuration', () => {
    const netConfigPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml');
    expect(fs.existsSync(netConfigPath)).toBe(true);

    const netConfig = fs.readFileSync(netConfigPath, 'utf8');
    expect(netConfig).toContain('cleartextTrafficPermitted="false"');
  });
});
