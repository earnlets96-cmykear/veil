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

function createTestPeer(name: string, password: string) {
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

describe('Phase 53: Seen / Read Double-Check Regression Suite', () => {
  describe('1. Message Status Progression & Double-Check UI Mapping', () => {
    it('progresses outgoing message: SENT_TO_RELAY -> DELIVERED_TO_RECIPIENT -> READ', () => {
      const peerId = 'peer_bob_identity_123';
      const messagesMap: Record<string, UIMessage[]> = {
        [peerId]: [
          {
            id: 'msg_1',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Hello Bob!',
            isOutgoing: true,
            timestamp: Date.now(),
            status: 'SENT_TO_RELAY',
          },
        ],
      };

      // Step 1: Delivery Receipt arrives
      const deliveryReceipt: DeliveryReceiptPayload = {
        type: 'DELIVERY_RECEIPT',
        conversationId: peerId,
        messageId: 'msg_1',
        receivedAt: Date.now(),
      };

      const resDelivered = readReceiptManager.processInboundReceipt(deliveryReceipt, messagesMap, peerId);
      expect(resDelivered.didChange).toBe(true);
      expect(resDelivered.updatedMessages[peerId][0].status).toBe('DELIVERED_TO_RECIPIENT');

      // Step 2: Read Receipt arrives
      const readReceipt: ReadReceiptPayload = {
        type: 'READ_RECEIPT',
        conversationId: peerId,
        lastReadMessageId: 'msg_1',
        readerIdentityId: peerId,
        readAt: Date.now(),
      };

      const resRead = readReceiptManager.processInboundReceipt(readReceipt, resDelivered.updatedMessages, peerId);
      expect(resRead.didChange).toBe(true);
      expect(resRead.updatedMessages[peerId][0].status).toBe('READ');
    });

    it('acknowledges all earlier messages in a batch up to lastReadMessageId', () => {
      const peerId = 'peer_bob_identity_123';
      const messagesMap: Record<string, UIMessage[]> = {
        [peerId]: [
          {
            id: 'msg_1',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Message 1',
            isOutgoing: true,
            timestamp: 1000,
            status: 'SENT_TO_RELAY',
          },
          {
            id: 'msg_2',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Message 2',
            isOutgoing: true,
            timestamp: 2000,
            status: 'DELIVERED_TO_RECIPIENT',
          },
          {
            id: 'msg_3',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Message 3',
            isOutgoing: true,
            timestamp: 3000,
            status: 'SENT_TO_RELAY',
          },
          {
            id: 'msg_4',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Message 4 (unread)',
            isOutgoing: true,
            timestamp: 4000,
            status: 'SENT_TO_RELAY',
          },
        ],
      };

      const readReceipt: ReadReceiptPayload = {
        type: 'READ_RECEIPT',
        conversationId: peerId,
        lastReadMessageId: 'msg_3',
        readerIdentityId: peerId,
        readAt: Date.now(),
      };

      const res = readReceiptManager.processInboundReceipt(readReceipt, messagesMap, peerId);
      expect(res.didChange).toBe(true);

      const updated = res.updatedMessages[peerId];
      expect(updated[0].status).toBe('READ');
      expect(updated[1].status).toBe('READ');
      expect(updated[2].status).toBe('READ');
      expect(updated[3].status).toBe('SENT_TO_RELAY'); // Still unread
    });
  });

  describe('2. Strict Monotonicity & Anti-Regression Invariant', () => {
    it('never regresses a READ message back to DELIVERED_TO_RECIPIENT on delayed delivery receipt', () => {
      const peerId = 'peer_bob_identity_123';
      const messagesMap: Record<string, UIMessage[]> = {
        [peerId]: [
          {
            id: 'msg_1',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Already read message',
            isOutgoing: true,
            timestamp: Date.now(),
            status: 'READ',
          },
        ],
      };

      // Delayed out-of-order delivery receipt arriving after read receipt
      const delayedDelivery: DeliveryReceiptPayload = {
        type: 'DELIVERY_RECEIPT',
        conversationId: peerId,
        messageId: 'msg_1',
        receivedAt: Date.now(),
      };

      const res = readReceiptManager.processInboundReceipt(delayedDelivery, messagesMap, peerId);
      expect(res.didChange).toBe(false);
      expect(res.updatedMessages[peerId][0].status).toBe('READ'); // Must remain READ
    });

    it('never alters incoming messages or failed messages', () => {
      const peerId = 'peer_bob_identity_123';
      const messagesMap: Record<string, UIMessage[]> = {
        [peerId]: [
          {
            id: 'inbound_1',
            conversationId: peerId,
            senderId: peerId,
            text: 'Incoming from Bob',
            isOutgoing: false,
            timestamp: 1000,
            status: 'DELIVERED_TO_RECIPIENT',
          },
          {
            id: 'failed_1',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Failed outgoing',
            isOutgoing: true,
            timestamp: 2000,
            status: 'FAILED',
          },
        ],
      };

      const readReceipt: ReadReceiptPayload = {
        type: 'READ_RECEIPT',
        conversationId: peerId,
        lastReadMessageId: 'failed_1',
        readerIdentityId: peerId,
        readAt: Date.now(),
      };

      const res = readReceiptManager.processInboundReceipt(readReceipt, messagesMap, peerId);
      expect(res.updatedMessages[peerId][0].status).toBe('DELIVERED_TO_RECIPIENT');
      expect(res.updatedMessages[peerId][1].status).toBe('FAILED');
    });
  });

  describe('3. Peer Authentication & Anti-Spoofing Isolation', () => {
    it('rejects forged read receipt when readerIdentityId does not match authenticated peer', () => {
      const peerId = 'peer_bob_identity_123';
      const attackerId = 'peer_mallory_attacker_666';

      const messagesMap: Record<string, UIMessage[]> = {
        [peerId]: [
          {
            id: 'msg_1',
            conversationId: peerId,
            senderId: 'alice_self',
            text: 'Secret to Bob',
            isOutgoing: true,
            timestamp: Date.now(),
            status: 'SENT_TO_RELAY',
          },
        ],
      };

      // Mallory claims to acknowledge Bob's conversation
      const forgedReceipt: ReadReceiptPayload = {
        type: 'READ_RECEIPT',
        conversationId: peerId,
        lastReadMessageId: 'msg_1',
        readerIdentityId: peerId, // Claiming to be Bob
        readAt: Date.now(),
      };

      // Arrives authenticated from Mallory's transport channel
      const res = readReceiptManager.processInboundReceipt(forgedReceipt, messagesMap, attackerId);
      expect(res.didChange).toBe(false);
      expect(res.updatedMessages[peerId][0].status).toBe('SENT_TO_RELAY');
    });

    it('resolves conversation correctly even when keyed by alias/username or found by message ID', () => {
      const bobIdentity = 'id_bob_555';
      const bobUsername = '@bob_the_builder';

      const messagesMap: Record<string, UIMessage[]> = {
        [bobUsername]: [
          {
            id: 'msg_unique_xyz',
            conversationId: bobUsername,
            senderId: 'alice_self',
            text: 'Hey Bob!',
            isOutgoing: true,
            timestamp: Date.now(),
            status: 'SENT_TO_RELAY',
          },
        ],
      };

      const readReceipt: ReadReceiptPayload = {
        type: 'READ_RECEIPT',
        conversationId: bobIdentity,
        lastReadMessageId: 'msg_unique_xyz',
        readerIdentityId: bobIdentity,
        readAt: Date.now(),
      };

      // Inbound receipt authenticated as bobIdentity
      const res = readReceiptManager.processInboundReceipt(readReceipt, messagesMap, bobIdentity);
      expect(res.didChange).toBe(true);
      expect(res.updatedMessages[bobUsername][0].status).toBe('READ');
    });
  });

  describe('4. End-to-End Encrypted Wire Flow (Double Ratchet Roundtrip)', () => {
    it('encrypts and delivers read receipt over Double Ratchet, advances status, and creates NO timeline ghost message', async () => {
      const alice = createTestPeer('Alice', 'AlicePassword123!');
      const bob = createTestPeer('Bob', 'BobPassword123!');

      // Alice sends message to Bob
      const outgoing = await alice.manager.encryptAndPackWireMessage(
        alice.session,
        bob.bundle,
        'Secret message for Bob'
      );

      // Bob decrypts and stores message
      const bobReceived = await bob.manager.processInboundWirePayload(bob.session, outgoing.wirePayloadBase64);
      expect(bobReceived.storedMessage.text).toBe('Secret message for Bob');

      // Bob marks as read and encrypts read receipt back to Alice
      const readReceiptWire = await bob.manager.encryptAndPackReceipt(bob.session, alice.document, {
        type: 'READ_RECEIPT',
        conversationId: alice.document.identityId,
        lastReadMessageId: outgoing.deliveryId,
        readerIdentityId: bob.document.identityId,
        readAt: Date.now(),
      });

      // Alice receives encrypted receipt
      const aliceReceived = await alice.manager.processInboundWirePayload(alice.session, readReceiptWire);
      expect(aliceReceived.receipt).toBeDefined();
      expect(aliceReceived.receipt?.type).toBe('READ_RECEIPT');
      expect(aliceReceived.receipt?.senderIdentityId).toBe(bob.document.identityId);

      // Alice local messages map has outgoing message
      const aliceMessages: Record<string, UIMessage[]> = {
        [bob.document.identityId]: [
          {
            id: outgoing.deliveryId,
            conversationId: bob.document.identityId,
            senderId: alice.document.identityId,
            text: 'Secret message for Bob',
            isOutgoing: true,
            timestamp: Date.now(),
            status: 'SENT_TO_RELAY',
          },
        ],
      };

      const updateResult = readReceiptManager.processInboundReceipt(
        aliceReceived.receipt!,
        aliceMessages,
        aliceReceived.senderDoc.identityId
      );

      expect(updateResult.didChange).toBe(true);
      expect(updateResult.updatedMessages[bob.document.identityId][0].status).toBe('READ');

      // Crucial privacy invariant: Message history in store does NOT contain receipt row
      const aliceStored = alice.manager.getMessages(alice.session, bob.document.identityId);
      expect(aliceStored.some((m) => m.text.includes('READ_RECEIPT'))).toBe(false);
    });
  });
});
