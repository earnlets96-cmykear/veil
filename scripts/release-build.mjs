/**
 * VEIL Release Artifact & Integrity Manifest Generator.
 *
 * Scans production dist/ build output, generates cryptographic SHA-256 hashes,
 * and outputs release/v1.0.0/manifest.json and checksums.sha256.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const rootDir = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release', `v${version}`);

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Please run "npm run build" first.');
  process.exit(1);
}

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

function getFilesRecursively(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFilesRecursively(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const distFiles = getFilesRecursively(distDir);
const artifacts = [];
const checksumLines = [];

for (const file of distFiles) {
  const relPath = path.relative(distDir, file).replace(/\\/g, '/');
  const buffer = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const sizeBytes = buffer.length;

  artifacts.push({
    path: `dist/${relPath}`,
    sizeBytes,
    sha256: hash,
  });

  checksumLines.push(`${hash}  dist/${relPath}`);
}

const manifest = {
  releaseVersion: version,
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  totalArtifacts: artifacts.length,
  artifacts,
};

// Write manifest and checksums
fs.writeFileSync(path.join(releaseDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
fs.writeFileSync(path.join(releaseDir, 'checksums.sha256'), checksumLines.join('\n') + '\n', 'utf8');

console.log(`✅ VEIL v${version} Release Manifest generated successfully in ${releaseDir}`);
console.log(`📦 Total Artifacts: ${artifacts.length}`);
