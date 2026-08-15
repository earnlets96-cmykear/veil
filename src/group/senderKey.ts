/**
 * Sender Key Session Manager for VEIL Group Messaging.
 *
 * Implements the sender key symmetric ratcheting state machine:
 * - O(1) symmetric outbound message encryption with XChaCha20-Poly1305.
 * - Out-of-order inbound message key buffering (bounded up to MAX_GROUP_SKIPPED_KEYS).
 * - Cryptographic sender authentication via Ed25519 signatures.
 * - Single-use message key zeroization.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha256.js';
import {
  kdfSenderChainStep,
  canonicalizeGroupHeaderAAD,
  canonicalizeSenderKeyDistribution,
} from './groupKdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { zeroize } from '../crypto/memory.ts';
import { bytesToBase64, base64ToBytes, getRandomBytes } from '../crypto/utils.ts';
import {
  GroupMessagePayload,
  GroupMessageHeader,
  SenderKeyDistributionMessage,
} from './types.ts';

export const MAX_GROUP_SKIPPED_KEYS = 500;

export interface SerializedSenderKeyState {
  groupId: string;
  epoch: number;
  myIdentityId: string;
  outbound: {
    chainKey: string;
    sequenceNum: number;
  };
  inbound: Record<
    string,
    {
      epoch: number;
      chainKey: string;
      sequenceNum: number;
      skippedKeys: Record<number, string>;
    }
  >;
}

export class SenderKeySession {
  public readonly groupId: string;
  public epoch: number;
  public readonly myIdentityId: string;

  private outboundChainKey: Uint8Array;
  private outboundSeq: number;

  // Inbound state per peer senderIdentityId
  private inboundChains = new Map<
    string,
    {
      epoch: number;
      chainKey: Uint8Array;
      sequenceNum: number;
      skippedKeys: Map<number, Uint8Array>;
    }
  >();

  // Replay prevention cache for seen messages (epoch:sender:seq)
  private seenMessages = new Set<string>();

  constructor(
    groupId: string,
    epoch: number,
    myIdentityId: string,
    initialOutboundChainKey?: Uint8Array,
    initialOutboundSeq = 0
  ) {
    this.groupId = groupId;
    this.epoch = epoch;
    this.myIdentityId = myIdentityId;
    this.outboundChainKey = initialOutboundChainKey ? new Uint8Array(initialOutboundChainKey) : getRandomBytes(32);
    this.outboundSeq = initialOutboundSeq;
  }

  /**
   * Resets or advances outbound sender key (used on new Epoch or key rotation).
   */
  public resetOutboundKey(newEpoch: number, newChainKey?: Uint8Array): void {
    if (newEpoch < this.epoch) {
      throw new Error(`Cannot rollback epoch from ${this.epoch} to ${newEpoch}`);
    }
    zeroize(this.outboundChainKey);
    this.epoch = newEpoch;
    this.outboundChainKey = newChainKey ? new Uint8Array(newChainKey) : getRandomBytes(32);
    this.outboundSeq = 0;
  }

  /**
   * Exports a signed SenderKeyDistributionMessage to share with group members.
   */
  public exportDistribution(signingPrivateKey: Uint8Array): SenderKeyDistributionMessage {
    const distPayload = {
      groupId: this.groupId,
      epoch: this.epoch,
      senderIdentityId: this.myIdentityId,
      chainKey: bytesToBase64(this.outboundChainKey),
      sequenceNum: this.outboundSeq,
    };

    const canonicalBytes = canonicalizeSenderKeyDistribution(distPayload);
    const digest = sha256(canonicalBytes);
    const signature = ed25519.sign(digest, signingPrivateKey);

    return {
      ...distPayload,
      signature: bytesToBase64(signature),
    };
  }

  /**
   * Imports a received SenderKeyDistributionMessage from a peer.
   */
  public processDistribution(
    dist: SenderKeyDistributionMessage,
    senderSigningPublicKey: Uint8Array
  ): void {
    if (dist.groupId !== this.groupId) {
      throw new Error(`Distribution groupId mismatch: expected ${this.groupId}, got ${dist.groupId}`);
    }
    if (dist.epoch < this.epoch) {
      throw new Error(`Ignoring stale distribution message for past epoch ${dist.epoch} (current: ${this.epoch})`);
    }

    // Verify Ed25519 signature
    const canonicalBytes = canonicalizeSenderKeyDistribution(dist);
    const digest = sha256(canonicalBytes);
    const isValid = ed25519.verify(base64ToBytes(dist.signature), digest, senderSigningPublicKey);
    if (!isValid) {
      throw new Error(`Invalid sender key distribution signature from ${dist.senderIdentityId}`);
    }

    const existing = this.inboundChains.get(dist.senderIdentityId);
    if (existing && existing.epoch > dist.epoch) {
      throw new Error(`Cannot rollback peer inbound state from epoch ${existing.epoch} to ${dist.epoch}`);
    }

    if (dist.epoch > this.epoch) {
      this.epoch = dist.epoch;
    }

    if (existing) {
      // Zeroize old chain key
      zeroize(existing.chainKey);
      for (const key of existing.skippedKeys.values()) {
        zeroize(key);
      }
    }


    this.inboundChains.set(dist.senderIdentityId, {
      epoch: dist.epoch,
      chainKey: base64ToBytes(dist.chainKey),
      sequenceNum: dist.sequenceNum,
      skippedKeys: new Map(),
    });
  }

  /**
   * Encrypts a message to the group using current outbound sender chain.
   */
  public encryptMessage(
    plaintext: string | Uint8Array,
    senderSigningPrivateKey: Uint8Array
  ): GroupMessagePayload {
    const { nextChainKey, messageKey } = kdfSenderChainStep(this.outboundChainKey);

    // Update outbound chain key
    zeroize(this.outboundChainKey);
    this.outboundChainKey = nextChainKey;
    const currentSeq = this.outboundSeq;
    this.outboundSeq += 1;

    const headerAAD: Omit<GroupMessageHeader, 'signature'> = {
      version: 1,
      groupId: this.groupId,
      epoch: this.epoch,
      senderIdentityId: this.myIdentityId,
      sequenceNum: currentSeq,
    };

    const aadBytes = canonicalizeGroupHeaderAAD(headerAAD);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(messageKey, plaintext, aadBytes);

    // Zeroize single-use message key
    zeroize(messageKey);

    // Sign (AAD + ciphertext) with Ed25519
    const toSign = new Uint8Array(aadBytes.length + ciphertext.length);
    toSign.set(aadBytes, 0);
    toSign.set(ciphertext, aadBytes.length);
    const digest = sha256(toSign);
    const signature = ed25519.sign(digest, senderSigningPrivateKey);

    const header: GroupMessageHeader = {
      ...headerAAD,
      signature: bytesToBase64(signature),
    };

    return {
      header,
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(ciphertext),
    };
  }

  /**
   * Decrypts an incoming group message from a peer.
   */
  public decryptMessage(
    payload: GroupMessagePayload,
    senderSigningPublicKey: Uint8Array
  ): Uint8Array {
    const { header, nonce, ciphertext } = payload;

    if (header.groupId !== this.groupId) {
      throw new Error(`Group ID mismatch: message belongs to ${header.groupId}, current group is ${this.groupId}`);
    }

    if (header.epoch !== this.epoch) {
      throw new Error(`Group epoch mismatch: message is for epoch ${header.epoch}, current epoch is ${this.epoch}`);
    }

    // Verify Ed25519 signature
    const aadBytes = canonicalizeGroupHeaderAAD(header);
    const ciphertextBytes = base64ToBytes(ciphertext);
    const toVerify = new Uint8Array(aadBytes.length + ciphertextBytes.length);
    toVerify.set(aadBytes, 0);
    toVerify.set(ciphertextBytes, aadBytes.length);
    const digest = sha256(toVerify);

    const isSigValid = ed25519.verify(
      base64ToBytes(header.signature),
      digest,
      senderSigningPublicKey
    );
    if (!isSigValid) {
      throw new Error(`Group message signature verification failed for sender ${header.senderIdentityId}`);
    }

    // Check replay cache
    const replayKey = `${header.epoch}:${header.senderIdentityId}:${header.sequenceNum}`;
    if (this.seenMessages.has(replayKey)) {
      throw new Error(`Replay detected: message ${replayKey} has already been processed`);
    }

    // Get inbound chain for sender
    const inbound = this.inboundChains.get(header.senderIdentityId);
    if (!inbound) {
      throw new Error(`No sender key session found for sender ${header.senderIdentityId} in epoch ${header.epoch}`);
    }

    let messageKey: Uint8Array | null = null;

    // Check skipped keys first
    if (inbound.skippedKeys.has(header.sequenceNum)) {
      messageKey = inbound.skippedKeys.get(header.sequenceNum)!;
      inbound.skippedKeys.delete(header.sequenceNum);
    } else if (header.sequenceNum < inbound.sequenceNum) {
      throw new Error(`Cannot decrypt old message seq ${header.sequenceNum} (chain has advanced past seq ${inbound.sequenceNum})`);
    } else {
      // Step chain forward to target sequence
      const distance = header.sequenceNum - inbound.sequenceNum;
      if (distance > MAX_GROUP_SKIPPED_KEYS) {
        throw new Error(`Sequence gap too large: ${distance} (max: ${MAX_GROUP_SKIPPED_KEYS})`);
      }

      while (inbound.sequenceNum < header.sequenceNum) {
        const step = kdfSenderChainStep(inbound.chainKey);
        zeroize(inbound.chainKey);
        inbound.chainKey = step.nextChainKey;

        // Store skipped key
        if (inbound.skippedKeys.size >= MAX_GROUP_SKIPPED_KEYS) {
          const oldestKey = inbound.skippedKeys.keys().next().value;
          if (oldestKey !== undefined) {
            const old = inbound.skippedKeys.get(oldestKey);
            if (old) zeroize(old);
            inbound.skippedKeys.delete(oldestKey);
          }
        }
        inbound.skippedKeys.set(inbound.sequenceNum, step.messageKey);
        inbound.sequenceNum += 1;
      }

      // Step one final time for current message
      const step = kdfSenderChainStep(inbound.chainKey);
      zeroize(inbound.chainKey);
      inbound.chainKey = step.nextChainKey;
      inbound.sequenceNum += 1;
      messageKey = step.messageKey;
    }

    try {
      const nonceBytes = base64ToBytes(nonce);
      const plaintext = decryptXChaCha20Poly1305(
        messageKey,
        nonceBytes,
        ciphertextBytes,
        aadBytes
      );
      this.seenMessages.add(replayKey);
      return plaintext;
    } finally {
      if (messageKey) {
        zeroize(messageKey);
      }
    }
  }

  /**
   * Serializes the SenderKeySession state for encrypted persistence.
   */
  public serialize(): SerializedSenderKeyState {
    const inboundObj: SerializedSenderKeyState['inbound'] = {};
    for (const [senderId, state] of this.inboundChains.entries()) {
      const skippedObj: Record<number, string> = {};
      for (const [seq, keyBytes] of state.skippedKeys.entries()) {
        skippedObj[seq] = bytesToBase64(keyBytes);
      }
      inboundObj[senderId] = {
        epoch: state.epoch,
        chainKey: bytesToBase64(state.chainKey),
        sequenceNum: state.sequenceNum,
        skippedKeys: skippedObj,
      };
    }

    return {
      groupId: this.groupId,
      epoch: this.epoch,
      myIdentityId: this.myIdentityId,
      outbound: {
        chainKey: bytesToBase64(this.outboundChainKey),
        sequenceNum: this.outboundSeq,
      },
      inbound: inboundObj,
    };
  }

  /**
   * Deserializes a persisted SenderKeySession state.
   */
  public static deserialize(data: SerializedSenderKeyState): SenderKeySession {
    const session = new SenderKeySession(
      data.groupId,
      data.epoch,
      data.myIdentityId,
      base64ToBytes(data.outbound.chainKey),
      data.outbound.sequenceNum
    );

    for (const [senderId, inState] of Object.entries(data.inbound)) {
      const skippedMap = new Map<number, Uint8Array>();
      for (const [seqStr, keyB64] of Object.entries(inState.skippedKeys)) {
        skippedMap.set(Number(seqStr), base64ToBytes(keyB64));
      }
      session.inboundChains.set(senderId, {
        epoch: inState.epoch,
        chainKey: base64ToBytes(inState.chainKey),
        sequenceNum: inState.sequenceNum,
        skippedKeys: skippedMap,
      });
    }

    return session;
  }
}
