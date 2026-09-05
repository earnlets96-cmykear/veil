import { describe, it, expect, beforeEach } from 'vitest';
import { SpacePinManager } from '../src/privacy/pinManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('SpacePinManager — Multi-Space App Lock Gate & Collision Prevention', () => {
  let manager: SpacePinManager;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    manager = new SpacePinManager({
      ...FAST_TEST_KDF_PARAMS,
      salt: '',
    });
    manager.resetRegistry();
  });

  it('starts fresh with zero registered PINs', () => {
    expect(manager.hasRegisteredPins()).toBe(false);
    expect(manager.listRegisteredSpaces()).toEqual([]);
  });

  it('registers Space A with a 4-digit PIN and unlocks it silently', async () => {
    await manager.assignPinToSpace({
      spaceId: 'space-a-123',
      canonicalUsername: 'alice',
      spaceName: 'Personal',
      password: 'alice-secret-password',
      pin: '1234',
      accountId: 'acc-alice-01',
    });

    expect(manager.hasRegisteredPins()).toBe(true);
    const resolved = await manager.verifyAndResolvePin('1234');
    expect(resolved.spaceId).toBe('space-a-123');
    expect(resolved.username).toBe('alice');
    expect(resolved.password).toBe('alice-secret-password');
    expect(resolved.accountId).toBe('acc-alice-01');
  });

  it('registers Space B with a 6-digit PIN and independently unlocks both', async () => {
    await manager.assignPinToSpace({
      spaceId: 'space-a',
      canonicalUsername: 'alice',
      spaceName: 'Personal',
      password: 'pass-alice-xyz',
      pin: '1234',
    });

    await manager.assignPinToSpace({
      spaceId: 'space-b',
      canonicalUsername: 'bob',
      spaceName: 'Work',
      password: 'pass-bob-work',
      pin: '234567',
    });

    // 1234 resolves to Space A
    const resA = await manager.verifyAndResolvePin('1234');
    expect(resA.spaceId).toBe('space-a');
    expect(resA.username).toBe('alice');

    // 234567 resolves to Space B
    const resB = await manager.verifyAndResolvePin('234567');
    expect(resB.spaceId).toBe('space-b');
    expect(resB.username).toBe('bob');
  });

  it('ENFORCES PIN COLLISION RULE: rejects duplicate PIN assignment to another space', async () => {
    await manager.assignPinToSpace({
      spaceId: 'space-a',
      canonicalUsername: 'alice',
      spaceName: 'Personal',
      password: 'pass-a',
      pin: '1234',
    });

    // Attempting to assign 1234 to space-b must fail with generic unavailable message
    await expect(
      manager.assignPinToSpace({
        spaceId: 'space-b',
        canonicalUsername: 'bob',
        spaceName: 'Work',
        password: 'pass-b',
        pin: '1234',
      })
    ).rejects.toThrow('This PIN is unavailable. Please choose a different PIN.');

    // Availability check returns false
    const avail = await manager.isPinAvailable('1234', 'space-b');
    expect(avail).toBe(false);

    // But available for space-a itself (e.g. re-saving or updating metadata)
    const availSelf = await manager.isPinAvailable('1234', 'space-a');
    expect(availSelf).toBe(true);
  });

  it('ANTI-ENUMERATION: wrong PIN returns generic Incorrect PIN without leaking any space info', async () => {
    await manager.assignPinToSpace({
      spaceId: 'space-secret',
      canonicalUsername: 'whistleblower',
      spaceName: 'Classified',
      password: 'vault-password-omega',
      pin: '9876',
    });

    await expect(manager.verifyAndResolvePin('0000')).rejects.toThrow('Incorrect PIN');
    await expect(manager.verifyAndResolvePin('1111')).rejects.toThrow('Incorrect PIN');
  });

  it('allows changing a space PIN with verification of the current PIN', async () => {
    await manager.assignPinToSpace({
      spaceId: 'space-change',
      canonicalUsername: 'user1',
      spaceName: 'My Space',
      password: 'secret-pwd',
      pin: '1234',
    });

    // Wrong old PIN fails
    await expect(
      manager.changePin({
        spaceId: 'space-change',
        oldPin: '9999',
        newPin: '5678',
      })
    ).rejects.toThrow();

    // Correct old PIN succeeds
    await manager.changePin({
      spaceId: 'space-change',
      oldPin: '1234',
      newPin: '5678',
    });

    // Old PIN 1234 no longer works
    await expect(manager.verifyAndResolvePin('1234')).rejects.toThrow('Incorrect PIN');

    // New PIN 5678 resolves cleanly
    const res = await manager.verifyAndResolvePin('5678');
    expect(res.spaceId).toBe('space-change');
  });

  it('lists registered space metadata without exposing sensitive credentials or PINs', async () => {
    await manager.assignPinToSpace({
      spaceId: 'space-1',
      canonicalUsername: 'alice',
      spaceName: 'Personal Vault',
      password: 'password-a',
      pin: '1234',
    });

    await manager.assignPinToSpace({
      spaceId: 'space-2',
      canonicalUsername: 'bob',
      spaceName: 'Work Vault',
      password: 'password-b',
      pin: '654321',
    });

    const spaces = manager.listRegisteredSpaces();
    expect(spaces.length).toBe(2);
    expect(spaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          spaceId: 'space-1',
          canonicalUsername: 'alice',
          spaceName: 'Personal Vault',
          pinLength: 4,
        }),
        expect.objectContaining({
          spaceId: 'space-2',
          canonicalUsername: 'bob',
          spaceName: 'Work Vault',
          pinLength: 6,
        }),
      ])
    );

    // Verify raw storage contains zero plaintext PINs
    const rawStorage = typeof localStorage !== 'undefined' ? (localStorage.getItem('veil:device_pin_registry') || '') : '';
    expect(rawStorage).not.toContain('1234');
    expect(rawStorage).not.toContain('654321');
    expect(rawStorage).not.toContain('password-a');
    expect(rawStorage).not.toContain('password-b');
  });

  it('removes space cleanly from registry', async () => {
    await manager.assignPinToSpace({
      spaceId: 'space-del',
      canonicalUsername: 'temp',
      spaceName: 'Disposable',
      password: 'pwd',
      pin: '4321',
    });

    expect(manager.hasRegisteredPins()).toBe(true);
    manager.removeSpace('space-del');
    expect(manager.hasRegisteredPins()).toBe(false);
    await expect(manager.verifyAndResolvePin('4321')).rejects.toThrow('Incorrect PIN');
  });
});
