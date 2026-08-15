import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxId, generateCapability } from '../src/transport/capability.ts';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { GroupStateManager } from '../src/group/groupState.ts';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { DeviceEnrollmentManager } from '../src/device/enrollment.ts';
import { RecoveryVault } from '../src/recovery/recoveryVault.ts';

import { LockManager } from '../src/privacy/lockManager.ts';
import { UIStateManager } from '../src/privacy/uiStateManager.ts';
import { MessagePadding } from '../src/privacy/padding.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { bytesToBase64, base64ToBytes, getRandomBytes } from '../src/crypto/utils.ts';

import { x25519, ed25519 } from '@noble/curves/ed25519.js';

describe('VEIL Phase 10: Complete End-to-End Release Candidate Lifecycle', () => {

  it('FULL SYSTEM INTEGRATION LIFECYCLE: From First-Run to Deletion', async () => {
    // =========================================================================
    // STEP 1: First-Run Space Creation & Credential-Selected Unlocking
    // =========================================================================
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();
    const uiState = new UIStateManager();
    const lockMgr = new LockManager(vault, uiState);

    const hMain = vault.createSpace({ name: 'Personal Main', password: 'PasswordMain123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const hPriv = vault.createSpace({ name: 'Classified Work', password: 'PasswordPriv456!', kdfParams: FAST_TEST_KDF_PARAMS });
    const hDecoy = vault.createSpace({ name: 'Casual Notes', password: 'PasswordDecoy789!', isDecoy: true, kdfParams: FAST_TEST_KDF_PARAMS });

    // Credential-selected unlocking
    const sMain = lockMgr.unlockSpace('PasswordMain123!', hMain.spaceId);
    const sPriv = lockMgr.unlockSpace('PasswordPriv456!', hPriv.spaceId);
    const sDecoy = lockMgr.unlockSpace('PasswordDecoy789!', hDecoy.spaceId);

    expect(sMain.spaceId).toBe(hMain.spaceId);
    expect(sPriv.spaceId).toBe(hPriv.spaceId);
    expect(sDecoy.spaceId).toBe(hDecoy.spaceId);

    // =========================================================================
    // STEP 2: Identity Generation & Cross-Space Independence
    // =========================================================================
    const docAlice = idMgr.createIdentity(sMain, store);
    const idAlice = idMgr.loadIdentity(sMain, store)!;

    const docBob = idMgr.createIdentity(sPriv, store);
    const idBob = idMgr.loadIdentity(sPriv, store)!;

    expect(docAlice.identityId).not.toBe(docBob.identityId);
    expect(docAlice.identityId).toHaveLength(64);
    expect(docAlice.fingerprint.split(' ')).toHaveLength(12);


    // =========================================================================
    // STEP 3: Blind Transport Mailboxes & Traffic Shaping
    // =========================================================================
    const server = new MockTransportServer();
    const mbAlice = generateMailboxId();
    const capAlice = generateCapability();
    await server.createMailbox(mbAlice, capAlice.verifier);

    const mbBob = generateMailboxId();
    const capBob = generateCapability();
    await server.createMailbox(mbBob, capBob.verifier);

    // =========================================================================
    // STEP 4: 1-to-1 End-to-End Encrypted Messaging (Double Ratchet)
    // =========================================================================
    const sharedSecret = getRandomBytes(32);
    const bobRatchetKeypair = generateKeyAgreementKeypair(getRandomBytes(32));

    const aliceSession = DoubleRatchetSession.initAlice(
      'sess-alice',
      docBob.identityId,
      docBob.signingPublicKey,
      docBob.keyAgreementPublicKey,
      sharedSecret,
      bobRatchetKeypair.publicKey
    );

    const bobSession = DoubleRatchetSession.initBob(
      'sess-bob',
      docAlice.identityId,
      docAlice.signingPublicKey,
      docAlice.keyAgreementPublicKey,
      sharedSecret,
      bobRatchetKeypair
    );

    // Alice sends message to Bob
    const plainMsg = 'Hello Bob, this is a verified release candidate message.';
    const padded = MessagePadding.padMessage(plainMsg);
    const msgEnvelope = aliceSession.ratchetEncrypt(padded);

    // Deliver via server blind mailbox
    await server.postEnvelope({
      envelopeId: 'env_e2e_01',
      mailboxId: mbBob,
      version: 1,
      payload: bytesToBase64(new TextEncoder().encode(JSON.stringify(msgEnvelope))),
      sizeClass: 'SMALL',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    const bobEnvelopes = await server.fetchEnvelopes(mbBob, capBob.capability);
    expect(bobEnvelopes.length).toBe(1);

    const receivedRaw = JSON.parse(new TextDecoder().decode(base64ToBytes(bobEnvelopes[0].payload)));
    const bobDecryptedPadded = bobSession.ratchetDecrypt(receivedRaw);
    const bobDecryptedPlain = MessagePadding.unpadMessage(bobDecryptedPadded);
    expect(new TextDecoder().decode(bobDecryptedPlain)).toBe(plainMsg);



    // =========================================================================
    // STEP 5: Multi-Party Group Messaging & Forward Secrecy on Departure
    // =========================================================================
    const { state: groupState } = GroupStateManager.createGroup(
      docAlice.identityId,
      docAlice.signingPublicKey,
      idAlice.signingPrivateKey,
      { name: 'Core Contributors' }
    );
    expect(groupState.epoch).toBe(1);

    // Add Bob to group
    GroupStateManager.addMember(
      groupState,
      docAlice.identityId,
      idAlice.signingPrivateKey,
      docBob.identityId,
      docBob.signingPublicKey
    );
    expect(groupState.members[docBob.identityId]).toBeDefined();

    // Remove Bob from group -> Epoch advances to 2, key rotates
    GroupStateManager.removeMember(
      groupState,
      docAlice.identityId,
      idAlice.signingPrivateKey,
      docBob.identityId
    );
    expect(groupState.epoch).toBe(2);
    expect(groupState.members[docBob.identityId]).toBeUndefined();

    // =========================================================================
    // STEP 6: 64 KiB Chunked Encrypted Media Transfer
    // =========================================================================
    const mediaPlain = new Uint8Array(120 * 1024); // 120 KB image
    mediaPlain.fill(0x77);

    const mediaPkg = MediaEncryptor.encryptMedia(mediaPlain, {
      filename: 'blueprint.png',
      mimeType: 'image/png',
      sizeBytes: mediaPlain.length,
    });
    expect(mediaPkg.chunks.length).toBe(2);

    const attachment = {
      mediaId: mediaPkg.mediaId,
      mediaKey: mediaPkg.mediaKey,
      plaintextDigest: mediaPkg.plaintextDigest,
      encryptedMetadata: mediaPkg.encryptedMetadata,
      metadataNonce: mediaPkg.metadataNonce,
      totalSize: mediaPkg.totalSize,
      chunkCount: mediaPkg.chunkCount,
      chunkSize: mediaPkg.chunkSize,
    };

    const decryptedMedia = MediaEncryptor.decryptMedia(attachment, mediaPkg.chunks);
    expect(decryptedMedia.plaintext).toEqual(mediaPlain);
    expect(decryptedMedia.metadata.filename).toBe('blueprint.png');

    // =========================================================================
    // STEP 7: Multi-Device SAS Enrollment
    // =========================================================================
    const { ticket, state: primaryEnrollState } = DeviceEnrollmentManager.createEnrollmentSession(
      'device_laptop_01',
      [{ session: sMain, name: 'Personal Main' }]
    );
    expect(ticket.selectedSpaceCount).toBe(1);

    const secEphemeralPriv = x25519.utils.randomPrivateKey();
    const secEphemeralPub = x25519.getPublicKey(secEphemeralPriv);
    const secDeviceSigningPriv = ed25519.utils.randomPrivateKey();
    const secDeviceSigningPub = ed25519.getPublicKey(secDeviceSigningPriv);
    const secDeviceKAPriv = x25519.utils.randomPrivateKey();
    const secDeviceKAPub = x25519.getPublicKey(secDeviceKAPriv);

    const secondaryDeviceRecord = {
      deviceId: 'device_tablet_02',
      deviceName: 'Alice iPad Pro',
      deviceSigningPub: bytesToBase64(secDeviceSigningPub),
      deviceKeyAgreementPub: bytesToBase64(secDeviceKAPub),
    };


    const primaryRes = DeviceEnrollmentManager.completePrimaryEnrollment(
      primaryEnrollState,
      secEphemeralPub,
      secondaryDeviceRecord,
      idAlice.signingPrivateKey
    );

    const secondaryRes = DeviceEnrollmentManager.receiveSecondaryEnrollment(
      secEphemeralPriv,
      primaryEnrollState.ephemeralPublicKey,
      primaryRes.encryptedTunnelPayload,
      primaryRes.nonce
    );

    // Mutual 6-digit SAS matches
    expect(primaryRes.sasCode).toBe(secondaryRes.sasCode);
    expect(primaryRes.sasCode).toMatch(/^\d{6}$/);
    expect(secondaryRes.payload.spaces[0].name).toBe('Personal Main');


    // =========================================================================
    // STEP 8: Zero-Knowledge BIP-39 Mnemonic Recovery
    // =========================================================================
    const mnemonic24 = RecoveryVault.exportMnemonicPhrase(sMain);
    expect(mnemonic24.split(' ').length).toBe(24);

    const newVault = new SpaceVaultManager();
    const restored = RecoveryVault.recoverSpaceFromMnemonic(
      mnemonic24,
      'Restored Space',
      'NewRestoredPassword123!',
      newVault,
      FAST_TEST_KDF_PARAMS
    );
    expect(restored.session.isActive()).toBe(true);

    // =========================================================================
    // STEP 9: Emergency Panic Lock
    // =========================================================================
    lockMgr.panicLock();

    // All sessions destroyed immediately
    expect(sMain.isActive()).toBe(false);
    expect(sPriv.isActive()).toBe(false);
    expect(sDecoy.isActive()).toBe(false);

    // Storage access with dead sessions throws
    expect(() => store.get(sMain, 'secret_key')).toThrow();

    // =========================================================================
    // STEP 10: Space Deletion & Invalidation
    // =========================================================================
    vault.deleteSpace(hMain.spaceId);
    expect(() => vault.unlockSpace('PasswordMain123!', hMain.spaceId)).toThrow();
  });
});

