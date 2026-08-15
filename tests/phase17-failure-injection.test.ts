import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { InvitationManager } from '../src/contacts/invitationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { bytesToBase64, randomBytes } from '../src/crypto/utils.ts';
import { IdentityDocument } from '../src/identity/document.ts';

describe('VEIL Phase 17: Real Failure Injection & Attack Resilience Tests', () => {
  it('TAMPERED CIPHERTEXT INJECTION: Modified Poly1305 tag or ciphertext causes strict AEAD decryption rejection', () => {
    const key = randomBytes(32);
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(plaintext, 'file.bin', 'application/octet-stream', key);

    // Corrupt the ciphertext of chunk 0
    const tamperedChunks = [{ ...chunks[0], ciphertext: 'AAAA' + chunks[0].ciphertext.slice(4) }];

    expect(() => {
      AttachmentPipeline.decryptAndReassemble(metadata, tamperedChunks, key);
    }).toThrow();
  });

  it('EXPIRED INVITATION INJECTION: Rejects invitations past their TTL', () => {
    const signKp = generateSigningKeypair(randomBytes(32));
    const kaKp = generateKeyAgreementKeypair(randomBytes(32));
    const doc: IdentityDocument = {
      version: 1,
      identityId: 'id_exp',
      signingPublicKey: bytesToBase64(signKp.publicKey),
      keyAgreementPublicKey: bytesToBase64(kaKp.publicKey),
      fingerprint: 'EXP-FP',
      createdAt: Date.now() - 100000,
      signature: 'sig',
    };

    // Expired invitation (-1000ms TTL)
    const inv = InvitationManager.createInvitation(doc, signKp.privateKey, 'OldContact', -1000);
    const str = InvitationManager.toShareableString(inv);

    expect(() => {
      InvitationManager.verifyAndParseInvitation(str);
    }).toThrow(/Invitation has expired/);
  });

  it('LOCKED SPACE STORAGE ACCESS: Attempting to read/write with a locked session immediately throws', async () => {
    const vault = new SpaceVaultManager();
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const store = new EncryptedSpaceStore(adapter);

    const env = vault.createSpace({ name: 'Vault', password: 'Password123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Password123!', env.spaceId);

    // Lock session
    session.destroy();

    expect(() => store.set(session, 'key1', { test: true })).toThrow(/locked or destroyed/);
  });
});
