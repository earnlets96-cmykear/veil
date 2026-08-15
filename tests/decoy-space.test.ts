import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { DecoyEnforcement } from '../src/privacy/decoyEnforcement.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 7: Decoy Space & Anti-Disclosure Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
  });

  it('DECOY SPACE: Functions as a real Space with independent SMK and identity', () => {
    // 1. Create Main Space and Decoy Space
    const mainHeader = vault.createSpace({ name: 'Personal', password: 'MainPassword!', isDecoy: false, kdfParams: FAST_TEST_KDF_PARAMS });
    const decoyHeader = vault.createSpace({ name: 'General', password: 'DecoyPassword!', isDecoy: true, kdfParams: FAST_TEST_KDF_PARAMS });

    const sessMain = vault.unlockSpace('MainPassword!', mainHeader.spaceId);
    const sessDecoy = vault.unlockSpace('DecoyPassword!', decoyHeader.spaceId);

    // 2. Validate decoy session
    expect(DecoyEnforcement.validateDecoySession(sessDecoy)).toBe(true);

    // 3. Verify cryptographic separation
    const mainMaster = sessMain.getMasterKey();
    const decoyMaster = sessDecoy.getMasterKey();
    expect(DecoyEnforcement.verifyCryptographicSeparation(mainMaster, decoyMaster)).toBe(true);

    // 4. Decoy Space can generate its own independent cryptographic identity
    const mainDoc = idMgr.createIdentity(sessMain, store);
    const decoyDoc = idMgr.createIdentity(sessDecoy, store);

    expect(decoyDoc.identityId).not.toBe(mainDoc.identityId);
    expect(decoyDoc.signingPublicKey).not.toBe(mainDoc.signingPublicKey);
    expect(decoyDoc.fingerprint).not.toBe(mainDoc.fingerprint);

    // 5. Anti-disclosure: Unlock screen reveals zero Space names or counts
    const unlockScreen = DecoyEnforcement.getPublicUnlockScreenState();
    expect(unlockScreen.showSpaceList).toBe(false);
    expect(unlockScreen.showSpaceNames).toBe(false);
  });

  it('ANTI-DISCLOSURE: Active Space view throws if multiple Space names are exposed', () => {
    const mainHeader = vault.createSpace({ name: 'Personal', password: 'Pass1', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessMain = vault.unlockSpace('Pass1', mainHeader.spaceId);

    // Allowed: displaying active Space's name
    expect(() => DecoyEnforcement.assertNoCrossSpaceDisclosure(sessMain, ['Personal'])).not.toThrow();

    // Violation: displaying multiple Space names
    expect(() => DecoyEnforcement.assertNoCrossSpaceDisclosure(sessMain, ['Personal', 'Private Vault'])).toThrow(/multiple Space names exposed/);

    // Violation: displaying a foreign Space name
    expect(() => DecoyEnforcement.assertNoCrossSpaceDisclosure(sessMain, ['Private Vault'])).toThrow(/exposed foreign Space name/);
  });
});
