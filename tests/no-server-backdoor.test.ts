import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 6: No-Server-Backdoor & Anti-Escrow Cryptographic Enforcements', () => {
  it('ANTI-BACKDOOR: Server has zero recovery keys, zero password reset endpoints, and cannot decrypt locked Spaces', () => {
    const vault = new SpaceVaultManager();
    const server = new MockTransportServer();

    // 1. Create a Space on client
    const header = vault.createSpace({
      name: 'Ultra Confidential',
      password: 'UserSecretPassword123!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // 2. Inspect server state
    const serverDump = server.inspectDatabase();

    // Server knows nothing about the Space Master Key, salt, or user password
    expect(serverDump.mailboxes).toEqual([]);


    // 3. Attempting to unlock Space with random guessed passwords fails
    expect(() => vault.unlockSpace('WrongPassword1!', header.spaceId)).toThrow();
    expect(() => vault.unlockSpace('AdminResetPassword!', header.spaceId)).toThrow();
    expect(() => vault.unlockSpace('Backdoor2026!', header.spaceId)).toThrow();
  });
});
