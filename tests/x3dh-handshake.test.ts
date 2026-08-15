import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { initiateX3DH, receiveX3DH } from '../src/ratchet/x3dh.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { base64ToBytes, constantTimeEquals } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: X3DH Initial Key Agreement Tests', () => {
  let vault: SpaceVaultManager;
  let storeAlice: EncryptedSpaceStore;
  let storeBob: EncryptedSpaceStore;
  let idMgr: SpaceIdentityManager;
  let prekeyMgrBob: PrekeyManager;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    storeAlice = new EncryptedSpaceStore();
    storeBob = new EncryptedSpaceStore();
    idMgr = new SpaceIdentityManager();
    prekeyMgrBob = new PrekeyManager(storeBob, idMgr);
  });

  it('X3DH HANDSHAKE: Alice and Bob derive identical shared master keys', () => {
    // 1. Setup Alice and Bob Spaces
    vault.createSpace({ name: 'Alice', password: 'PassAlice', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassBob', kdfParams: FAST_TEST_KDF_PARAMS });

    const aliceSess = vault.unlockSpace('PassAlice');
    const bobSess = vault.unlockSpace('PassBob');

    const aliceDoc = idMgr.createIdentity(aliceSess, storeAlice);
    const bobDoc = idMgr.createIdentity(bobSess, storeBob);

    // 2. Bob publishes PrekeyBundle (with OPK)
    prekeyMgrBob.generateOneTimePrekeys(bobSess, 5);
    const bobBundle = prekeyMgrBob.createPrekeyBundle(bobSess);

    // 3. Alice initiates X3DH
    const aliceIdentity = idMgr.loadIdentity(aliceSess, storeAlice)!;
    const { sharedMasterKey: aliceSK, header } = initiateX3DH(
      aliceIdentity.keyAgreementPrivateKey,
      bobBundle
    );

    // 4. Bob receives X3DH
    const bobIdentity = idMgr.loadIdentity(bobSess, storeBob)!;
    const bobSpkPriv = prekeyMgrBob.getSignedPrekeyPrivate(bobSess, header.signedPrekeyId)!;
    const bobOpkPriv = prekeyMgrBob.consumeOneTimePrekey(bobSess, header.oneTimePrekeyId!)!;
    const aliceIdentityPub = base64ToBytes(aliceDoc.keyAgreementPublicKey);

    const bobSK = receiveX3DH(
      bobIdentity.keyAgreementPrivateKey,
      bobSpkPriv,
      bobOpkPriv,
      aliceIdentityPub,
      header
    );

    // 5. Shared master secrets MUST be identical
    expect(aliceSK.length).toBe(32);
    expect(bobSK.length).toBe(32);
    expect(constantTimeEquals(aliceSK, bobSK)).toBe(true);
  });

  it('MITM ATTACK: rejects prekey bundle with tampered Signed Prekey signature', () => {
    vault.createSpace({ name: 'Alice', password: 'PassAlice', kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Bob', password: 'PassBob', kdfParams: FAST_TEST_KDF_PARAMS });

    const aliceSess = vault.unlockSpace('PassAlice');
    const bobSess = vault.unlockSpace('PassBob');

    idMgr.createIdentity(aliceSess, storeAlice);
    idMgr.createIdentity(bobSess, storeBob);
    const bobBundle = prekeyMgrBob.createPrekeyBundle(bobSess);

    // Tamper with SPK signature
    const sigBytes = base64ToBytes(bobBundle.signedPrekey.signature);
    sigBytes[5] ^= 0xFF;
    const tamperedBundle = {
      ...bobBundle,
      signedPrekey: {
        ...bobBundle.signedPrekey,
        signature: Buffer.from(sigBytes).toString('base64'),
      },
    };

    const aliceIdentity = idMgr.loadIdentity(aliceSess, storeAlice)!;
    expect(() => initiateX3DH(aliceIdentity.keyAgreementPrivateKey, tamperedBundle)).toThrow(
      /MITM detected/
    );
  });
});
