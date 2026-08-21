/**
 * VEIL Phase 30 Step 2: Inbound Voice-Message State Preservation Test.
 *
 * Proves that an inbound Double Ratchet wire message containing voice metadata
 * and replyTo metadata preserves both fields completely on the receiving client.
 */

import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import type { UIMessage } from '../src/ui/app/types.ts';

describe('VEIL Phase 30 Step 2: Inbound Voice-Message State Preservation', () => {
  it('preserves voice and replyTo metadata in inbound wire payload processing', async () => {
    // 1. Setup Alice (Sender) Space
    const vaultA = new SpaceVaultManager();
    const storageA = new MemoryAdapter();
    const storeA = new EncryptedSpaceStore(storageA);
    const idMgrA = new SpaceIdentityManager();
    const prekeysA = new PrekeyManager(storeA, idMgrA);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeysA);

    const headerA = vaultA.createSpace({ name: 'Alice', password: 'PassAlice123!', kdfParams: FAST_TEST_KDF_PARAMS });
    await vaultA.saveEnvelopeToStorage(headerA, storageA);
    const sessionA = vaultA.unlockSpace('PassAlice123!', headerA.spaceId);
    idMgrA.createIdentity(sessionA, storeA);
    prekeysA.generateSignedPrekey(sessionA);
    prekeysA.generateOneTimePrekeys(sessionA, 5);

    // 2. Setup Bob (Recipient) Space
    const vaultB = new SpaceVaultManager();
    const storageB = new MemoryAdapter();
    const storeB = new EncryptedSpaceStore(storageB);
    const idMgrB = new SpaceIdentityManager();
    const prekeysB = new PrekeyManager(storeB, idMgrB);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeysB);

    const headerB = vaultB.createSpace({ name: 'Bob', password: 'PassBob123!', kdfParams: FAST_TEST_KDF_PARAMS });
    await vaultB.saveEnvelopeToStorage(headerB, storageB);
    const sessionB = vaultB.unlockSpace('PassBob123!', headerB.spaceId);
    idMgrB.createIdentity(sessionB, storeB);
    prekeysB.generateSignedPrekey(sessionB);
    prekeysB.generateOneTimePrekeys(sessionB, 5);

    const bobBundle = prekeysB.createPrekeyBundle(sessionB);

    // 3. Alice creates and encrypts a voice message with replyTo metadata
    const voiceMeta = {
      durationSeconds: 14,
      sizeBytes: 32768,
      objectId: 'obj_voice_alice_98765',
      mimeType: 'audio/webm;codecs=opus',
      ciphertextHash: 'hash_abc123',
      encryptionKeyBase64: 'dGVzdEtleTEyMzQ1Njc4OWFiY2RlZg==',
      nonceBase64: 'dGVzdE5vbmNlMTI=',
    };

    const replyMeta = {
      messageId: 'msg_target_prev_001',
      senderName: 'Bob',
      text: 'Can you send a voice note?',
      attachmentType: undefined,
    };

    const { wirePayloadBase64 } = await convMgrA.encryptAndPackWireMessage(
      sessionA,
      bobBundle,
      '🎙️ Voice Message',
      undefined,
      replyMeta,
      voiceMeta
    );

    // 4. Bob processes the inbound wire payload
    const result = await convMgrB.processInboundWirePayload(sessionB, wirePayloadBase64);

    // 5. Construct UIMessage as done in AppState.tsx
    const { storedMessage, senderDoc, attachment, replyTo, voice } = result;
    const incomingMsg: UIMessage = {
      id: storedMessage.messageId,
      conversationId: storedMessage.conversationId,
      senderId: storedMessage.senderIdentityId,
      text: storedMessage.text,
      isOutgoing: false,
      timestamp: storedMessage.timestamp,
      status: 'DELIVERED_TO_RECIPIENT',
      attachment,
      replyTo,
      voice,
    };

    // 6. Verify UIMessage contains the complete voice and replyTo metadata
    expect(incomingMsg.voice).toBeDefined();
    expect(incomingMsg.voice?.durationSeconds).toBe(14);
    expect(incomingMsg.voice?.objectId).toBe('obj_voice_alice_98765');
    expect(incomingMsg.voice?.mimeType).toBe('audio/webm;codecs=opus');
    expect(incomingMsg.voice?.encryptionKeyBase64).toBe('dGVzdEtleTEyMzQ1Njc4OWFiY2RlZg==');
    expect(incomingMsg.voice?.nonceBase64).toBe('dGVzdE5vbmNlMTI=');

    expect(incomingMsg.replyTo).toBeDefined();
    expect(incomingMsg.replyTo?.messageId).toBe('msg_target_prev_001');
    expect(incomingMsg.replyTo?.senderName).toBe('Bob');
    expect(incomingMsg.replyTo?.text).toBe('Can you send a voice note?');
  });
});
