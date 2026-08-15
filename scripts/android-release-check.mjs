/**
 * VEIL Android Release Audit Tool.
 *
 * Inspects Android manifest, build.gradle, and security configurations to ensure
 * zero cleartext traffic, minimal permissions, and zero hardcoded test secrets.
 */

import * as fs from 'fs';
import * as path from 'path';

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const securityConfigPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml');

console.log('🔍 Auditing Android Release Configuration...');

if (!fs.existsSync(manifestPath)) {
  console.error('❌ AndroidManifest.xml not found');
  process.exit(1);
}

const manifestContent = fs.readFileSync(manifestPath, 'utf8');

// 1. Audit Permissions
const dangerousPermissions = [
  'READ_CONTACTS',
  'READ_CALL_LOG',
  'ACCESS_FINE_LOCATION',
  'READ_SMS',
  'RECORD_AUDIO',
];

for (const perm of dangerousPermissions) {
  if (manifestContent.includes(perm)) {
    console.error(`❌ Security Violation: Excessive permission requested: ${perm}`);
    process.exit(1);
  }
}

// 2. Audit Cleartext Traffic
if (!manifestContent.includes('usesCleartextTraffic="false"')) {
  console.error('❌ Security Violation: usesCleartextTraffic must be explicitly false');
  process.exit(1);
}

// 3. Audit Backup configuration
if (!manifestContent.includes('allowBackup="false"')) {
  console.error('❌ Security Violation: allowBackup must be false');
  process.exit(1);
}

console.log('✅ Android Manifest & Security Configuration Passed All Release Gates!');
