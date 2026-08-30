import { describe, expect, it } from 'vitest';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import {
  DeliveryReceiptPayload,
  ReadReceiptPayload,
  readReceiptManager,
} from '../src/messaging/readReceipts.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { UIMessage } from '../src/ui/app/types.ts';

function makePeer(name: string, password: string) {
  const vault = new SpaceVaultManager();
  const envelope = vault.createSpace({ name, password, kdfParams: FAST_TEST_KDF_PARAMS });
  const session = vault.unlockSpace(password, envelope.spaceId);
  const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
  const identities = new SpaceIdentityManager();
  const document = identities.createIdentity(session, store);
  const prekeys = new PrekeyManager(store, identities);
  prekeys.generateSignedPrekey(session);
  prekeys.generateOneTimePrekeys(session, 5);
  return {
    session,
    store,
    document,
    manager: new ConversationManager(store, identities, prekeys),
    bundle: prekeys.createPrekeyBundle(session),
  };
}

describe('Phase 45B: authenticated delivery and read receipts', () => {
  it('returns an encrypted delivery receipt only after the recipient decrypts and persists the message', async () => {
    const alice = makePeer('Alice', 'Alice-45B!');
    const bob = makePeer('Bob', 'Bob-45B!');

    const outgoing = await alice.manager.encryptAndPackWireMessage(
      alice.session,
      bob.bundle,
      'text or encrypted media summary'
    );
    const received = await bob.manager.processInboundWirePayload(bob.session, outgoing.wirePayloadBase64);

    expect(received.storedMessage.status).toBe('delivered');

    const receiptWire = await bob.manager.encryptAndPackReceipt(
      bob.session,
      alice.document,
      {
        type: 'DELIVERY_RECEIPT',
        conversationId: alice.document.identityId,
        messageId: outgoing.deliveryId,
        receivedAt: Date.now(),
      }
    );
    const receipt = await alice.manager.processInboundWirePayload(alice.session, receiptWire);

    expect(receipt.receipt).toMatchObject({
      type: 'DELIVERY_RECEIPT',
      messageId: outgoing.deliveryId,
      senderIdentityId: bob.document.identityId,
    });
  });

  it('advances only the acknowledged outgoing messages and persists delivery/read state for text, file, image, video, grouped media, and voice', async () => {
    const local = makePeer('Persistent local state', 'Persist-45B!');
    const peerId = 'peer-canonical-identity';
    const kinds = ['text', 'file', 'image', 'video', 'grouped-media', 'voice'];
    const messages: Record<string, UIMessage[]> = {
      [peerId]: kinds.map((kind, index) => ({
        id: `msg-${index}`,
        conversationId: peerId,
        senderId: 'self',
        text: kind,
        isOutgoing: true,
        timestamp: index,
        status: 'SENT_TO_RELAY',
      })),
    };
    const delivery: DeliveryReceiptPayload = {
      type: 'DELIVERY_RECEIPT',
      conversationId: peerId,
      messageId: 'msg-4',
      receivedAt: Date.now(),
    };

    const delivered = readReceiptManager.processInboundReceipt(delivery, messages, peerId);
    expect(delivered.updatedMessages[peerId].map((message) => message.status)).toEqual([
      'SENT_TO_RELAY',
      'SENT_TO_RELAY',
      'SENT_TO_RELAY',
      'SENT_TO_RELAY',
      'DELIVERED_TO_RECIPIENT',
      'SENT_TO_RELAY',
    ]);

    const read: ReadReceiptPayload = {
      type: 'READ_RECEIPT',
      conversationId: peerId,
      lastReadMessageId: 'msg-4',
      readerIdentityId: peerId,
      readAt: Date.now(),
    };
    const readResult = readReceiptManager.processInboundReceipt(read, delivered.updatedMessages, peerId);
    expect(readResult.updatedMessages[peerId].map((message) => message.status)).toEqual([
      'READ', 'READ', 'READ', 'READ', 'READ', 'SENT_TO_RELAY',
    ]);

    await local.store.setAsync(local.session, 'veil:ui:messages', readResult.updatedMessages);
    const persistedAfterRestart = await local.store.getAsync<Record<string, UIMessage[]>>(local.session, 'veil:ui:messages');
    expect(persistedAfterRestart).toBeDefined();
    expect(persistedAfterRestart![peerId][4].status).toBe('READ');
    expect(persistedAfterRestart![peerId][5].status).toBe('SENT_TO_RELAY');
  });

  it('rejects a receipt from another canonical identity, so downloading media cannot mark it as read', () => {
    const peerId = 'expected-peer';
    const messages: Record<string, UIMessage[]> = {
      [peerId]: [{
        id: 'media-message',
        conversationId: peerId,
        senderId: 'self',
        text: 'image',
        isOutgoing: true,
        timestamp: 1,
        status: 'DELIVERED_TO_RECIPIENT',
      }],
    };
    const forged: ReadReceiptPayload = {
      type: 'READ_RECEIPT',
      conversationId: peerId,
      lastReadMessageId: 'media-message',
      readerIdentityId: 'other-peer',
      readAt: Date.now(),
    };

    const result = readReceiptManager.processInboundReceipt(forged, messages, peerId);
    expect(result.didChange).toBe(false);
    expect(result.updatedMessages[peerId][0].status).toBe('DELIVERED_TO_RECIPIENT');
  });
});
