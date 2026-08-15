/**
 * VEIL Android Logcat Secret Leak Auditor.
 *
 * Scans an Android logcat dump or console log file for sensitive pattern leaks.
 * Usage: node scripts/android-log-audit.mjs [logfile_path]
 */

import * as fs from 'fs';

const logFile = process.argv[2];

if (!logFile || !fs.existsSync(logFile)) {
  console.log('ℹ️ No logcat capture provided. Run "adb logcat -d > logcat.txt" and supply the path to audit.');
  console.log('✅ Log Auditor tool ready for physical device verification.');
  process.exit(0);
}

const content = fs.readFileSync(logFile, 'utf8');

const forbiddenPatterns = [
  /-----BEGIN PRIVATE KEY-----/,
  /SpaceMasterKey/,
  /storageKey:/,
  /password:\s*"[^"]+"/,
  /mnemonic:\s*"[^"]+"/,
];

let leaksFound = 0;
for (const pattern of forbiddenPatterns) {
  if (pattern.test(content)) {
    console.error(`❌ SENSITIVE DATA LEAK DETECTED: Matched pattern ${pattern}`);
    leaksFound++;
  }
}

if (leaksFound > 0) {
  process.exit(1);
} else {
  console.log('✅ Android Logcat Audit Passed: 0 sensitive leaks found in log file.');
}
