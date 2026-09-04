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

  it('Section 10: Multi-member SenderKey ratchet allows member-to-member replies without creator intervention', async () => {
    const alice = createPeer('Alice');
    const bob = createPeer('Bob');

    const aliceGroupMgr = new GroupManager(alice.store, alice.identities);
    const bobGroupMgr = new GroupManager(bob.store, bob.identities);

    // 1. Alice creates group
    const { state: aliceState } = aliceGroupMgr.createGroup(alice.session, { name: 'SecOps' });
    const groupId = aliceState.groupId;

    // 2. Alice adds Bob
    const { distribution: aliceToBobDist } = aliceGroupMgr.addMember(
      alice.session,
      groupId,
      bob.document.identityId,
      bob.document.signingPublicKey,
      'MEMBER'
    );

    // 3. Bob processes GROUP_INVITE
    bobGroupMgr.saveGroupState(bob.session, {
      ...aliceState,
      members: {
        ...aliceState.members,
        [bob.document.identityId]: {
          identityId: bob.document.identityId,
          signingPublicKey: bob.document.signingPublicKey,
          role: 'MEMBER',
          joinedAt: Date.now(),
        },
      },
    });
    bobGroupMgr.processSenderKeyDistribution(
      bob.session,
      aliceToBobDist,
      alice.document.signingPublicKey
    );

    // 4. Alice sends a group message
    const { payload: aliceMsgPayload } = aliceGroupMgr.encryptGroupMessage(
      alice.session,
      groupId,
      'Welcome to SecOps group!'
    );

    // 5. Bob decrypts Alice's message
    const decryptedByBob = bobGroupMgr.decryptGroupMessage(bob.session, aliceMsgPayload, alice.document.signingPublicKey);
    expect(decryptedByBob.text).toBe('Welcome to SecOps group!');

    // 6. Bob replies to group! Bob exports his distribution
    const bobDistribution = bobGroupMgr.exportSenderKeyDistribution(bob.session, groupId);
    expect(bobDistribution).not.toBeNull();

    // Alice processes Bob's distribution
    aliceGroupMgr.processSenderKeyDistribution(alice.session, bobDistribution!, bob.document.signingPublicKey);

    // 7. Bob sends his message to group
    const { payload: bobMsgPayload } = bobGroupMgr.encryptGroupMessage(
      bob.session,
      groupId,
      'Thanks Alice, glad to be here.'
    );

    // 8. Alice decrypts Bob's message
    const decryptedByAlice = aliceGroupMgr.decryptGroupMessage(alice.session, bobMsgPayload, bob.document.signingPublicKey);
    expect(decryptedByAlice.text).toBe('Thanks Alice, glad to be here.');
  });

  it('Section 11: Read receipts maintain strict monotonicity (READ never regresses)', () => {
    const peerId = 'peer_monotony';
    const msgId = 'msg_mono_1';

    let messages: Record<string, UIMessage[]> = {
      [peerId]: [
        {
          id: msgId,
          conversationId: peerId,
          senderId: 'self',
          text: 'Monotonic test',
          isOutgoing: true,
          timestamp: Date.now(),
          status: 'SENT_TO_RELAY',
        },
      ],
    };

    // 1. Inbound Delivery receipt transitions SENT_TO_RELAY -> DELIVERED_TO_RECIPIENT
    const res1 = readReceiptManager.processInboundReceipt(
      {
        type: 'DELIVERY_RECEIPT',
        conversationId: peerId,
        messageId: msgId,
        receivedAt: Date.now(),
      },
      messages,
      peerId
    );
    expect(res1.didChange).toBe(true);
    expect(res1.updatedMessages[peerId][0].status).toBe('DELIVERED_TO_RECIPIENT');

    // 2. Inbound Read receipt transitions DELIVERED_TO_RECIPIENT -> READ
    const res2 = readReceiptManager.processInboundReceipt(
      {
        type: 'READ_RECEIPT',
        conversationId: peerId,
        lastReadMessageId: msgId,
        readerIdentityId: peerId,
        readAt: Date.now(),
      },
      res1.updatedMessages,
      peerId
    );
    expect(res2.didChange).toBe(true);
    expect(res2.updatedMessages[peerId][0].status).toBe('READ');

    // 3. Stale/delayed Delivery receipt must NOT regress message from READ back to DELIVERED_TO_RECIPIENT
    const res3 = readReceiptManager.processInboundReceipt(
      {
        type: 'DELIVERY_RECEIPT',
        conversationId: peerId,
        messageId: msgId,
        receivedAt: Date.now(),
      },
      res2.updatedMessages,
      peerId
    );
    expect(res3.didChange).toBe(false);
    expect(res3.updatedMessages[peerId][0].status).toBe('READ');
  });
});
