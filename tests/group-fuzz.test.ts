import { describe, it, expect } from 'vitest';
import { SenderKeySession } from '../src/group/senderKey.ts';
import { MediaEncryptor } from '../src/media/mediaEncryptor.ts';
import { getRandomBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { ed25519 } from '@noble/curves/ed25519.js';

describe('VEIL Phase 5: Group & Media Fuzz Testing', () => {
  it('should safely reject fuzzed and malformed group messages without crashing or exposing secrets', () => {
    const privKey = ed25519.utils.randomPrivateKey();
    const pubKey = ed25519.getPublicKey(privKey);

    const senderSession = new SenderKeySession('grp_fuzz', 1, 'id_fuzz_alice');

    // Fuzzed payload inputs
    const fuzzedInputs = [
      null,
      undefined,
      {},
      { header: null },
      { header: { version: 999 } },
      { header: { version: 1, groupId: 'wrong_grp', epoch: 1, senderIdentityId: 'id_fuzz_alice', sequenceNum: 0, signature: 'invalid' } },
      { header: { version: 1, groupId: 'grp_fuzz', epoch: 99, senderIdentityId: 'id_fuzz_alice', sequenceNum: 0, signature: '' } },
      { header: { version: 1, groupId: 'grp_fuzz', epoch: 1, senderIdentityId: 'id_fuzz_alice', sequenceNum: -5, signature: 'AAAA' }, nonce: 'BBBB', ciphertext: 'CCCC' },
      { header: { version: 1, groupId: 'grp_fuzz', epoch: 1, senderIdentityId: 'id_fuzz_alice', sequenceNum: 1000000, signature: bytesToBase64(getRandomBytes(64)) }, nonce: bytesToBase64(getRandomBytes(24)), ciphertext: bytesToBase64(getRandomBytes(50)) },
    ];

    for (const input of fuzzedInputs) {
      expect(() => senderSession.decryptMessage(input as any, pubKey)).toThrow();
    }
  });

  it('should safely reject fuzzed media descriptors and chunk arrays', () => {
    const validPlain = getRandomBytes(1024 * 10);
    const validPkg = MediaEncryptor.encryptMedia(validPlain, { filename: 'valid.txt', mimeType: 'text/plain', sizeBytes: validPlain.length });

    const fuzzedDescriptors = [
      { ...validPkg, chunkCount: 0 },
      { ...validPkg, chunkCount: -1 },
      { ...validPkg, chunkCount: 100 }, // claims 100 but only provides 1
      { ...validPkg, mediaKey: 'invalid_base64_!@#$' },
      { ...validPkg, plaintextDigest: 'invalid_hex' },
    ];

    for (const descriptor of fuzzedDescriptors) {
      expect(() => MediaEncryptor.decryptMedia(descriptor as any, validPkg.chunks)).toThrow();
    }
  });
});
