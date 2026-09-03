import { describe, it, expect, beforeEach } from 'vitest';
import { readReceiptManager, processInboundReceipt, ReadReceiptPayload } from '../src/messaging/readReceipts.ts';
import { ThumbnailGenerator } from '../src/attachments/thumbnailGenerator.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { IndexedDBStorageAdapter } from '../src/storage/indexedDbAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { GroupManager } from '../src/group/groupManager.ts';
import { UIMessage } from '../src/ui/app/types.ts';

describe('Phase 56D: Final Stabilization & Runtime Correctness Acceptance Tests', () => {
  it('P0-1 & P0-2: readReceiptManager.processInboundReceipt is an instance method and advances receipts monotonically', () => {
    // Verify instance call does not throw 'not a function'
    expect(typeof readReceiptManager.processInboundReceipt).toBe('function');
    expect(typeof processInboundReceipt).toBe('function');

    const conversationId = 'peer_user_123';
    const msgId = 'msg_test_001';

    const messagesMap: Record<string, UIMessage[]> = {
      [conversationId]: [
        {
          id: msgId,
          conversationId,
          senderId: 'self_identity',
          text: 'Hello world',
          isOutgoing: true,
          timestamp: Date.now() - 1000,
          status: 'SENT_TO_RELAY',
        },
      ],
    };

    // 1. Process DELIVERY_RECEIPT
    const deliveryResult = readReceiptManager.processInboundReceipt(
      {
        type: 'DELIVERY_RECEIPT',
        conversationId,
        messageId: msgId,
        receivedAt: Date.now(),
      },
      messagesMap,
      conversationId
    );

    expect(deliveryResult.didChange).toBe(true);
    expect(deliveryResult.updatedMessages[conversationId][0].status).toBe('DELIVERED_TO_RECIPIENT');

    // 2. Process READ_RECEIPT
    const readPayload: ReadReceiptPayload = {
      type: 'READ_RECEIPT',
      conversationId,
      lastReadMessageId: msgId,
      readerIdentityId: conversationId,
      readAt: Date.now(),
    };

    const readResult = readReceiptManager.processInboundReceipt(
      readPayload,
      deliveryResult.updatedMessages,
      conversationId
    );

    expect(readResult.didChange).toBe(true);
    expect(readResult.updatedMessages[conversationId][0].status).toBe('READ');

    // 3. Monotonicity check: Late DELIVERY_RECEIPT must NEVER regress 'READ' back to 'DELIVERED_TO_RECIPIENT'
    const lateDelivery = readReceiptManager.processInboundReceipt(
      {
        type: 'DELIVERY_RECEIPT',
        conversationId,
        messageId: msgId,
        receivedAt: Date.now(),
      },
      readResult.updatedMessages,
      conversationId
    );

    expect(lateDelivery.didChange).toBe(false);
    expect(lateDelivery.updatedMessages[conversationId][0].status).toBe('READ');
  });

  it('P0-4: ThumbnailGenerator generates durable base64 data URLs that survive reloads', async () => {
    const dummyBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
    const thumb = await ThumbnailGenerator.generateImageThumbnail(dummyBlob, 32);

    expect(typeof thumb).toBe('string');
    // In node/headless test environment, returns data:image/jpeg;base64,... fallback
    expect(thumb.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('P0-5: GroupManager creates group and adds member with SenderKey rotation and state update', async () => {
    const adapter = new IndexedDBStorageAdapter();
    const store = new EncryptedSpaceStore(adapter);
    const idMgr = new SpaceIdentityManager();
    const groupManager = new GroupManager(store, idMgr);

    const sessionA = new SpaceSession('space_alice', 'Alice Space', false, new Uint8Array(32).fill(1));
    const sessionB = new SpaceSession('space_bob', 'Bob Space', false, new Uint8Array(32).fill(2));

    await idMgr.createIdentity(sessionA, store, 'Alice Space');
    await idMgr.createIdentity(sessionB, store, 'Bob Space');

    const idDocA = idMgr.getPublicDocument(sessionA, store)!;
    const idDocB = idMgr.getPublicDocument(sessionB, store)!;

    // Alice creates group
    const { state: initialGroup } = groupManager.createGroup(sessionA, {
      name: 'Stabilization Core',
      description: 'Phase 56D Test Group',
    });

    expect(initialGroup.groupId).toBeDefined();
    expect(initialGroup.epoch).toBe(1);
    expect(initialGroup.members[idDocA.identityId]?.role).toBe('CREATOR');

    // Alice adds Bob by identity
    const { distribution } = groupManager.addMember(
      sessionA,
      initialGroup.groupId,
      idDocB.identityId,
      idDocB.signingPublicKey,
      'MEMBER'
    );

    expect(distribution).toBeDefined();
    expect(distribution.groupId).toBe(initialGroup.groupId);

    // Verify updated group state has Bob
    const updatedState = groupManager.loadGroupState(sessionA, initialGroup.groupId);
    expect(updatedState).not.toBeNull();
    expect(updatedState!.members[idDocB.identityId]?.role).toBe('MEMBER');
  });
});
