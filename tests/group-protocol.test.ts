import { describe, it, expect } from 'vitest';
import {
  kdfSenderChainStep,
  deriveGroupEpochKey,
  deriveGroupMetadataKey,
  canonicalizeGroupHeaderAAD,
  canonicalizeGroupAction,
  canonicalizeSenderKeyDistribution,
} from '../src/group/groupKdf.ts';
import { getRandomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 5: Group Protocol Core & KDF Tests', () => {
  it('should step sender chain key deterministically producing 32-byte message and next chain keys', () => {
    const chainKey = getRandomBytes(32);
    const step1 = kdfSenderChainStep(chainKey);

    expect(step1.nextChainKey.length).toBe(32);
    expect(step1.messageKey.length).toBe(32);
    expect(step1.nextChainKey).not.toEqual(step1.messageKey);
    expect(step1.nextChainKey).not.toEqual(chainKey);

    // Repeat with identical input produces identical output
    const step1Repeat = kdfSenderChainStep(chainKey);
    expect(step1Repeat.nextChainKey).toEqual(step1.nextChainKey);
    expect(step1Repeat.messageKey).toEqual(step1.messageKey);

    // Step 2 from step 1
    const step2 = kdfSenderChainStep(step1.nextChainKey);
    expect(step2.nextChainKey).not.toEqual(step1.nextChainKey);
    expect(step2.messageKey).not.toEqual(step1.messageKey);
  });

  it('should reject invalid chain key lengths in kdfSenderChainStep', () => {
    expect(() => kdfSenderChainStep(new Uint8Array(16))).toThrow(/Invalid chain key length/);
    expect(() => kdfSenderChainStep(new Uint8Array(64))).toThrow(/Invalid chain key length/);
  });

  it('should derive distinct epoch keys across different epochs', () => {
    const rootSecret = getRandomBytes(32);
    const epoch1Key = deriveGroupEpochKey(rootSecret, 1);
    const epoch2Key = deriveGroupEpochKey(rootSecret, 2);
    const epoch3Key = deriveGroupEpochKey(rootSecret, 3);

    expect(epoch1Key.length).toBe(32);
    expect(epoch2Key.length).toBe(32);
    expect(epoch3Key.length).toBe(32);

    expect(epoch1Key).not.toEqual(epoch2Key);
    expect(epoch2Key).not.toEqual(epoch3Key);
    expect(epoch1Key).not.toEqual(epoch3Key);
  });

  it('should derive distinct metadata key from epoch key', () => {
    const epochKey = getRandomBytes(32);
    const metaKey = deriveGroupMetadataKey(epochKey);

    expect(metaKey.length).toBe(32);
    expect(metaKey).not.toEqual(epochKey);
  });

  it('should canonicalize group header AAD deterministically', () => {
    const header = {
      version: 1 as const,
      groupId: 'grp_12345',
      epoch: 2,
      senderIdentityId: 'id_alice',
      sequenceNum: 5,
    };

    const bytes1 = canonicalizeGroupHeaderAAD(header);
    const bytes2 = canonicalizeGroupHeaderAAD(header);
    expect(bytes1).toEqual(bytes2);
    expect(new TextDecoder().decode(bytes1)).toBe(
      '{"version":1,"groupId":"grp_12345","epoch":2,"senderIdentityId":"id_alice","sequenceNum":5}'
    );
  });
});
