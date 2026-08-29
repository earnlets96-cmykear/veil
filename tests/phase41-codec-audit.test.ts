import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function findFilesRecursive(dir: string, ext = '.ts'): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFilesRecursive(filePath, ext));
    } else if (filePath.endsWith(ext) || filePath.endsWith('.tsx')) {
      results.push(filePath);
    }
  }
  return results;
}

describe('Phase 41: Repository-Wide Codec Hardening Audit', () => {
  it('guarantees zero direct atob() or btoa() browser primitives exist under src/', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const sourceFiles = findFilesRecursive(srcDir);

    expect(sourceFiles.length).toBeGreaterThan(20);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Exclude comments and documentation mentions
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

        if (/\batob\s*\(/.test(line) && !line.includes('// allowed-test-shim')) {
          violations.push({ file: path.relative(srcDir, filePath), line: index + 1, content: trimmed });
        }
        if (/\bbtoa\s*\(/.test(line) && !line.includes('// allowed-test-shim')) {
          violations.push({ file: path.relative(srcDir, filePath), line: index + 1, content: trimmed });
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
