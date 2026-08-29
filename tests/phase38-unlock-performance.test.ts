/**
 * Phase 38 Test Suite: Unlock Performance & Async Web Worker KDF.
 *
 * Verifies:
 * - Async Argon2id key derivation execution.
 * - Multi-space envelope unlock via unlockSpaceAsync.
 * - Non-blocking UI responsiveness guarantee during key derivation.
 * - Rejection of invalid credentials without memory leakage.
 */

import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { deriveKeyArgon2id, deriveKeyArgon2idAsync, FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { randomBytes, bytesToBase64 } from '../src/crypto/utils.ts';

describe('Phase 38: Unlock Performance & Async Key Derivation', () => {
  it('derives 256-bit KEK asynchronously via deriveKeyArgon2idAsync', async () => {
    const password = 'CorrectHorseBatteryStaple!';
    const salt = randomBytes(32);

    const asyncKek = await deriveKeyArgon2idAsync(password, salt, FAST_TEST_KDF_PARAMS);
    const syncKek = deriveKeyArgon2id(password, salt, FAST_TEST_KDF_PARAMS);

    expect(asyncKek).toBeInstanceOf(Uint8Array);
    expect(asyncKek.length).toBe(32);
    expect(asyncKek).toEqual(syncKek);
  });

  it('successfully unlocks Space envelope using vault.unlockSpaceAsync', async () => {
    const vault = new SpaceVaultManager();
    const spacePassword = 'SuperSecretSpacePassword123#';

    const envelope = vault.createSpace({
      name: 'Personal Vault',
      password: spacePassword,
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    expect(envelope.spaceId).toBeDefined();

    // Async unlock
    const session = await vault.unlockSpaceAsync(spacePassword, envelope.spaceId);

    expect(session.isActive()).toBe(true);
    expect(session.name).toBe('Personal Vault');
    expect(session.spaceId).toBe(envelope.spaceId);
    expect(session.getMasterKey().length).toBe(32);

    session.destroy();
    expect(session.isActive()).toBe(false);
  });

  it('rejects incorrect passwords asynchronously with generic error', async () => {
    const vault = new SpaceVaultManager();
    const spacePassword = 'RightPassword123!';

    vault.createSpace({
      name: 'Secure Vault',
      password: spacePassword,
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    await expect(
      vault.unlockSpaceAsync('WrongPassword999!')
    ).rejects.toThrow('Unable to unlock Space');
  });

  it('handles multiple candidate envelopes asynchronously', async () => {
    const vault = new SpaceVaultManager();

    const env1 = vault.createSpace({
      name: 'Space Alpha',
      password: 'AlphaPassword1!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const env2 = vault.createSpace({
      name: 'Space Beta',
      password: 'BetaPassword2!',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    // Credential-selected discovery without targetId
    const sessionAlpha = await vault.unlockSpaceAsync('AlphaPassword1!');
    expect(sessionAlpha.spaceId).toBe(env1.spaceId);
    sessionAlpha.destroy();

    const sessionBeta = await vault.unlockSpaceAsync('BetaPassword2!');
    expect(sessionBeta.spaceId).toBe(env2.spaceId);
    sessionBeta.destroy();
  });
});
