import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 17: Security & Plaintext Leakage Audit Tests', () => {
  it('STORAGE AUDIT: Confirms zero unencrypted master keys, passwords, or plaintexts in database adapter', async () => {
    const { MemoryStorageAdapter } = await import('../src/storage/memoryAdapter.ts');
    const { SpaceVaultManager } = await import('../src/spaces/vault.ts');
    const { EncryptedSpaceStore } = await import('../src/storage/spaceStore.ts');
    const { FAST_TEST_KDF_PARAMS } = await import('../src/crypto/kdf.ts');

    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore(adapter);

    const env = vault.createSpace({ name: 'SecurityAuditSpace', password: 'SecretPassword999!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('SecretPassword999!', env.spaceId);

    await store.setAsync(session, 'audit_key', { confidential: 'SuperSecretMessagePlaintext' });

    // Inspect raw adapter storage representation
    const rawRecords = await adapter.listRecords(session.spaceId);
    const rawSerialized = JSON.stringify(rawRecords);

    // Verify raw persisted bytes contain ZERO plaintext fragments
    expect(rawSerialized).not.toContain('SuperSecretMessagePlaintext');
    expect(rawSerialized).not.toContain('SecretPassword999!');
    expect(rawSerialized).not.toContain('SecurityAuditSpace');
  });

  it('SOURCE AUDIT: Verifies absence of debugger statements across all source files', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const files: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          files.push(full);
        }
      }
    }
    scanDir(srcDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/\bdebugger\b/);
    }
  });
});
