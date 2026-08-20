/**
 * Phase 29 Test Suite: Message Replies & Quoted Message Payloads
 *
 * Validates:
 * 1. Packaging replyTo metadata inside authenticated Double Ratchet wire payload.
 * 2. Unpacking replyTo metadata upon decryption by recipient.
 * 3. Preserving quoted text, referenced messageId, and sender context across E2EE.
 */

import { describe, it, expect } from 'vitest';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryAdapter } from '../src/storage/memoryAdapter.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 29: Message Replies & Quoting Over Double Ratchet', () => {
  it('encrypts and unpacks replyTo metadata across Alice and Bob', async () => {
    // Alice setup
    const storageA = new MemoryAdapter();
    const vaultA = new SpaceVaultManager();
    const storeA = new EncryptedSpaceStore(storageA);
    const idMgrA = new SpaceIdentityManager();
    const prekeyMgrA = new PrekeyManager(storeA, idMgrA);
    const convMgrA = new ConversationManager(storeA, idMgrA, prekeyMgrA);

    const spaceA = vaultA.createSpace({ name: 'Alice Space', password: 'PassA', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vaultA.unlockSpace('PassA', spaceA.spaceId);
    idMgrA.createIdentity(sessionA, storeA);
    const bundleA = prekeyMgrA.generatePrekeyBundle(sessionA);

    // Bob setup
    const storageB = new MemoryAdapter();
    const vaultB = new SpaceVaultManager();
    const storeB = new EncryptedSpaceStore(storageB);
    const idMgrB = new SpaceIdentityManager();
    const prekeyMgrB = new PrekeyManager(storeB, idMgrB);
    const convMgrB = new ConversationManager(storeB, idMgrB, prekeyMgrB);

    const spaceB = vaultB.createSpace({ name: 'Bob Space', password: 'PassB', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionB = vaultB.unlockSpace('PassB', spaceB.spaceId);
    idMgrB.createIdentity(sessionB, storeB);
    const bundleB = prekeyMgrB.generatePrekeyBundle(sessionB);

    // 1. Alice sends initial message to Bob
    const { wirePayloadBase64: payload1 } = await convMgrA.encryptAndPackWireMessage(
      sessionA,
      bundleB,
      'Hello Bob, are you available today?'
    );

    const res1 = await convMgrB.processInboundWirePayload(sessionB, payload1);
    expect(res1.storedMessage.text).toBe('Hello Bob, are you available today?');
    const originalMessageId = res1.storedMessage.messageId;

    // 2. Bob replies to Alice's message
    const replyMeta = {
      messageId: originalMessageId,
      senderName: 'Alice',
      text: 'Hello Bob, are you available today?',
    };

    const { wirePayloadBase64: payload2 } = await convMgrB.encryptAndPackWireMessage(
      sessionB,
      bundleA,
      'Yes, I am available at 3 PM.',
      undefined,
      replyMeta
    );

    // 3. Alice receives and unpacks Bob's reply
    const res2 = await convMgrA.processInboundWirePayload(sessionA, payload2);

    expect(res2.storedMessage.text).toBe('Yes, I am available at 3 PM.');
    expect(res2.replyTo).toBeDefined();
    expect(res2.replyTo.messageId).toBe(originalMessageId);
    expect(res2.replyTo.senderName).toBe('Alice');
    expect(res2.replyTo.text).toBe('Hello Bob, are you available today?');
  });
});
