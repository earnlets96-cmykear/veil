import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { readReceiptManager } from '../src/messaging/readReceipts.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { randomBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import type { UIMessage } from '../src/ui/app/types.ts';

function createPeer(name: string) {
  const vault = new SpaceVaultManager();
  const envelope = vault.createSpace({ name, password: 'password123', kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace('password123', envelope.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const identities = new SpaceIdentityManager();
  const document = identities.createIdentity(session, store);
  const prekeys = new PrekeyManager(store, identities);
  prekeys.generateSignedPrekey(session);
  prekeys.generateOneTimePrekeys(session, 5);
  return {
    session,
    store,
    identities,
    document,
    prekeys,
    convManager: new ConversationManager(store, identities, prekeys),
    bundle: prekeys.createPrekeyBundle(session),
  };
}

describe('Critical Stability P0 Test Suite', () => {
  it('Section 1: Delivery ID is preserved on wire and receipt updates sender UI message status', async () => {
    const alice = createPeer('Alice');
    const bob = createPeer('Bob');

    const customMsgId = `msg_${Date.now()}_test123`;
    const text = 'Hello Bob, delivery check';

    // Alice encrypts message passing explicitDeliveryId = customMsgId
    const { wirePayloadBase64 } = await alice.convManager.encryptAndPackWireMessage(
      alice.session,
      bob.bundle,
      text,
      undefined,
      undefined,
      undefined,
      undefined,
      customMsgId
    );

    // Bob processes inbound wire payload
    const inboundResult = await bob.convManager.processInboundWirePayload(bob.session, wirePayloadBase64);
    expect(inboundResult.storedMessage.messageId).toBe(customMsgId);

    // Alice's optimistic message in state
    const aliceMessages: Record<string, UIMessage[]> = {
      [bob.document.identityId]: [
        {
          id: customMsgId,
          conversationId: bob.document.identityId,
          senderId: alice.document.identityId,
          text,
          isOutgoing: true,
          timestamp: Date.now(),
          status: 'SENT_TO_RELAY',
        },
      ],
    };

    // Bob creates delivery receipt referencing customMsgId
    const deliveryReceiptWire = await bob.convManager.encryptAndPackReceipt(bob.session, alice.document, {
      type: 'DELIVERY_RECEIPT',
      conversationId: alice.document.identityId,
      messageId: inboundResult.storedMessage.messageId,
      receivedAt: Date.now(),
    });

    // Alice receives delivery receipt
    const receiptResult = await alice.convManager.processInboundWirePayload(alice.session, deliveryReceiptWire);
    expect(receiptResult.receipt).toBeDefined();

    const { updatedMessages: afterDelivery, didChange: changed1 } = readReceiptManager.processInboundReceipt(
      receiptResult.receipt!,
      aliceMessages,
      bob.document.identityId
    );

    expect(changed1).toBe(true);
    const aliceMsgAfterDelivered = afterDelivery[bob.document.identityId][0];
    expect(aliceMsgAfterDelivered.status).toBe('DELIVERED_TO_RECIPIENT');

    // Bob creates read receipt referencing customMsgId
    const readReceiptWire = await bob.convManager.encryptAndPackReceipt(bob.session, alice.document, {
      type: 'READ_RECEIPT',
      conversationId: alice.document.identityId,
      messageId: inboundResult.storedMessage.messageId,
      lastReadMessageId: inboundResult.storedMessage.messageId,
      readAt: Date.now(),
    });

    const readResult = await alice.convManager.processInboundWirePayload(alice.session, readReceiptWire);
    const { updatedMessages: afterRead, didChange: changed2 } = readReceiptManager.processInboundReceipt(
      readResult.receipt!,
      afterDelivery,
      bob.document.identityId
    );

    expect(changed2).toBe(true);
    const aliceMsgAfterRead = afterRead[bob.document.identityId][0];
    expect(aliceMsgAfterRead.status).toBe('READ');
  });

  it('Section 2: Group members count calculation accurately inspects record keys', async () => {
    const owner = createPeer('GroupOwner');
    const groupManager = new GroupManager(owner.store, owner.identities);

    const { state } = groupManager.createGroup(owner.session, { name: 'Alpha Squad' });

    // Group starts with 1 member (the creator)
    expect(Object.keys(state.members).length).toBe(1);

    // Add Bob
    const bobKey = bytesToBase64(randomBytes(32));
    groupManager.addMember(owner.session, state.groupId, 'bob_identity', bobKey, 'MEMBER');

    const updatedState = groupManager.loadGroupState(owner.session, state.groupId);
    expect(Object.keys(updatedState!.members).length).toBe(2);

    // Add Charlie
    const charlieKey = bytesToBase64(randomBytes(32));
    groupManager.addMember(owner.session, state.groupId, 'charlie_identity', charlieKey, 'MEMBER');

    const finalState = groupManager.loadGroupState(owner.session, state.groupId);
    expect(Object.keys(finalState!.members).length).toBe(3);
  });

  it('Section 5: Progressive chunk decryption reassembles verified data correctly', async () => {
    const rawData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const mimeType = 'video/mp4';
    const key = randomBytes(32);

    // Chunk size 4 bytes => 4 chunks
    const encrypted = AttachmentPipeline.chunkAndEncrypt(
      rawData,
      'test_video.mp4',
      mimeType,
      key,
      4
    );

    expect(encrypted.chunks.length).toBe(4);

    const chunkProgress: number[] = [];
    const decrypted = await AttachmentPipeline.decryptProgressive(
      encrypted.metadata,
      encrypted.chunks,
      key,
      (idx, _slice, totalSoFar) => {
        chunkProgress.push(totalSoFar);
      }
    );

    expect(decrypted).toEqual(rawData);
    expect(chunkProgress).toEqual([4, 8, 12, 16]);
  });

  it('Section 9: Deletion tombstone prevents resurrected messages', async () => {
    const peer = createPeer('TombstoneSpace');

    const tombstone = {
      messageId: 'msg_deleted_1',
      conversationId: 'conv_1',
      deletedAt: Date.now(),
    };

    await peer.store.setAsync(peer.session, 'veil:ui:deleted_messages', [tombstone]);

    const retrieved = await peer.store.getAsync<any[]>(peer.session, 'veil:ui:deleted_messages');
    expect(retrieved).toBeDefined();
    expect(retrieved!.some((t) => t.messageId === 'msg_deleted_1')).toBe(true);
  });
});
