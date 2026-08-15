/**
 * VEIL Android Build & Structure Verification Tool.
 *
 * Inspects Android project structure, build.gradle settings, and manifest declarations.
 */

import * as fs from 'fs';
import * as path from 'path';

const rootDir = process.cwd();
const androidAppDir = path.join(rootDir, 'android', 'app');
const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
const buildGradlePath = path.join(androidAppDir, 'build.gradle');

console.log('🔍 Running Android Build & Configuration Check...');

if (!fs.existsSync(manifestPath) || !fs.existsSync(buildGradlePath)) {
  console.error('❌ Android project files missing in android/app');
  process.exit(1);
}

const manifest = fs.readFileSync(manifestPath, 'utf8');
const gradle = fs.readFileSync(buildGradlePath, 'utf8');

// 1. Verify Package & Version
if (!gradle.includes('applicationId "chat.veil.app"')) {
  console.error('❌ applicationId mismatch in build.gradle');
  process.exit(1);
}

if (!manifest.includes('package="chat.veil.app"')) {
  console.error('❌ package declaration mismatch in AndroidManifest.xml');
  process.exit(1);
}

// 2. Check Security Policies
if (!manifest.includes('android:usesCleartextTraffic="false"')) {
  console.error('❌ usesCleartextTraffic must be explicitly false');
  process.exit(1);
}

if (!manifest.includes('android:allowBackup="false"')) {
  console.error('❌ allowBackup must be explicitly false');
  process.exit(1);
}

console.log('✅ Android Project Configuration & Security Invariants Verified!');
