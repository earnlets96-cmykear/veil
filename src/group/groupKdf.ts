/**
 * Group Cryptographic Key Derivation Functions (KDFs) & Canonicalizers for VEIL.
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha256.js';
import { GroupMessageHeader, GroupAction, SenderKeyDistributionMessage } from './types.ts';

export const DOMAIN_GROUP_EPOCH = new TextEncoder().encode('veil-v1-group-epoch');
export const DOMAIN_GROUP_METADATA = new TextEncoder().encode('veil-v1-group-metadata');
export const CONSTANT_GROUP_MSG_KEY = new TextEncoder().encode('veil-v1-group-msg-key-step');
export const CONSTANT_GROUP_CHAIN_STEP = new TextEncoder().encode('veil-v1-group-chain-step');

export interface GroupChainStepResult {
  nextChainKey: Uint8Array; // 32 bytes
  messageKey: Uint8Array;   // 32 bytes
}

/**
 * Steps the Sender Key symmetric chain forward by one iteration:
 * - messageKey = HMAC-SHA256(chainKey, CONSTANT_GROUP_MSG_KEY)
 * - nextChainKey = HMAC-SHA256(chainKey, CONSTANT_GROUP_CHAIN_STEP)
 */
export function kdfSenderChainStep(chainKey: Uint8Array): GroupChainStepResult {
  if (chainKey.length !== 32) {
    throw new Error(`Invalid chain key length: expected 32 bytes, got ${chainKey.length}`);
  }

  const messageKey = hmac(sha256, chainKey, CONSTANT_GROUP_MSG_KEY);
  const nextChainKey = hmac(sha256, chainKey, CONSTANT_GROUP_CHAIN_STEP);

  return { nextChainKey, messageKey };
}

/**
 * Derives an Epoch Master Key from a root group master secret and epoch number via HKDF-SHA256.
 */
export function deriveGroupEpochKey(groupMasterSecret: Uint8Array, epoch: number): Uint8Array {
  if (groupMasterSecret.length !== 32) {
    throw new Error(`Invalid group master secret length: expected 32 bytes, got ${groupMasterSecret.length}`);
  }
  const epochSalt = new TextEncoder().encode(`epoch-${epoch}`);
  return hkdf(sha256, groupMasterSecret, epochSalt, DOMAIN_GROUP_EPOCH, 32);
}

/**
 * Derives a symmetric key for encrypting group metadata from an epoch key.
 */
export function deriveGroupMetadataKey(epochKey: Uint8Array): Uint8Array {
  if (epochKey.length !== 32) {
    throw new Error(`Invalid epoch key length: expected 32 bytes, got ${epochKey.length}`);
  }
  return hkdf(sha256, epochKey, new Uint8Array(0), DOMAIN_GROUP_METADATA, 32);
}

/**
 * Produces canonical byte representation of a GroupMessageHeader for AAD authentication.
 */
export function canonicalizeGroupHeaderAAD(header: Omit<GroupMessageHeader, 'signature'>): Uint8Array {
  const canonical = JSON.stringify({
    version: header.version,
    groupId: header.groupId,
    epoch: header.epoch,
    senderIdentityId: header.senderIdentityId,
    sequenceNum: header.sequenceNum,
  });
  return new TextEncoder().encode(canonical);
}

/**
 * Produces canonical byte representation of a GroupAction for Ed25519 signing/verification.
 */
export function canonicalizeGroupAction(action: Omit<GroupAction, 'signature'>): Uint8Array {
  const canonical = JSON.stringify({
    actionId: action.actionId,
    groupId: action.groupId,
    epoch: action.epoch,
    actionType: action.actionType,
    actorIdentityId: action.actorIdentityId,
    targetIdentityId: action.targetIdentityId || null,
    newRole: action.newRole || null,
    encryptedMetadataPayload: action.encryptedMetadataPayload || null,
    timestamp: action.timestamp,
  });
  return new TextEncoder().encode(canonical);
}

/**
 * Produces canonical byte representation of a SenderKeyDistributionMessage for Ed25519 signing/verification.
 */
export function canonicalizeSenderKeyDistribution(dist: Omit<SenderKeyDistributionMessage, 'signature'>): Uint8Array {
  const canonical = JSON.stringify({
    groupId: dist.groupId,
    epoch: dist.epoch,
    senderIdentityId: dist.senderIdentityId,
    chainKey: dist.chainKey,
    sequenceNum: dist.sequenceNum,
  });
  return new TextEncoder().encode(canonical);
}
