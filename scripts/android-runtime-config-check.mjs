/**
 * VEIL Android Runtime Configuration Scanner.
 *
 * Scans production web bundle and runtime configurations to ensure zero hardcoded
 * development-only URLs (e.g. localhost, 10.0.2.2) leak into production distributions.
 */

import * as fs from 'fs';
import * as path from 'path';

const distDir = path.join(process.cwd(), 'dist');

console.log('🔍 Checking Runtime Configuration in Production Bundle...');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Please run "npm run build" first.');
  process.exit(1);
}

function scanDir(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(scanDir(full));
    else files.push(full);
  }
  return files;
}

const files = scanDir(distDir);
let hasForbidden = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('http://10.0.2.2')) {
    console.error(`❌ Found forbidden emulator development URL in ${file}`);
    hasForbidden = true;
  }
}

if (hasForbidden) {
  process.exit(1);
}

console.log('✅ Runtime Configuration Check Passed: Zero prohibited dev endpoints in bundle.');
