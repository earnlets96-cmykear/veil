import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeDiagnostics } from '../src/debug/runtimeDiagnostics.ts';
import { CloudClient } from '../src/network/cloudClient.ts';

const forbidden = [
  'TEST_PASSWORD_SECRET',
  'TEST_SESSION_TOKEN',
  'TEST_MASTER_KEY',
  'TEST_PRIVATE_KEY',
  'TEST_RECOVERY_SECRET',
  'TEST_ACCOUNT_IDENTIFIER',
  'blob:TEST_LOCAL_URL',
];

describe('Phase 45A: sensitive diagnostic redaction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();
  });

  it('recursively redacts sensitive values from history and console output', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    RuntimeDiagnostics.setEnabled(true);
    RuntimeDiagnostics.clearHistory();

    RuntimeDiagnostics.recovery('test', {
      nested: {
        password: 'TEST_PASSWORD_SECRET',
        sessionToken: 'TEST_SESSION_TOKEN',
        masterKey: 'TEST_MASTER_KEY',
        privateKey: 'TEST_PRIVATE_KEY',
        recoverySecret: 'TEST_RECOVERY_SECRET',
        accountId: 'TEST_ACCOUNT_IDENTIFIER',
        blobUrl: 'blob:TEST_LOCAL_URL',
      },
    });

    const output = [
      JSON.stringify(RuntimeDiagnostics.getHistory()),
      ...consoleSpy.mock.calls.map((call) => call.map(String).join(' ')),
    ].join('\n');

    for (const secret of forbidden) expect(output).not.toContain(secret);
  });

  it('does not log session identifiers when CloudClient state changes', () => {
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    new CloudClient('https://relay.example.test').setSession('a'.repeat(64), 'TEST_ACCOUNT_IDENTIFIER', 'device');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
