import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 21: Android Build & Native Container Validation', () => {
  it('ANDROID PROJECT STRUCTURE: All required native container files exist and are well-formed', () => {
    const rootDir = process.cwd();
    const manifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
    const capConfigPath = path.join(rootDir, 'capacitor.config.ts');

    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(gradlePath)).toBe(true);
    expect(fs.existsSync(capConfigPath)).toBe(true);

    const capConfig = fs.readFileSync(capConfigPath, 'utf8');
    expect(capConfig).toContain("appId: 'chat.veil.app'");
    expect(capConfig).toContain("cleartext: false");
  });
});
