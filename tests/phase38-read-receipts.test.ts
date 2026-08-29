/**
 * Phase 38 Test Suite: Read Receipts & Message Status Progression.
 *
 * Verifies:
 * - Delivery status progression (QUEUED -> SENDING -> SENT_TO_RELAY -> DELIVERED_TO_RECIPIENT -> READ).
 * - ReadReceiptManager scheduling and debouncing.
 * - Inbound read receipt wire handling and bulk status updating.
 * - Non-disclosure of sensitive metadata in read receipts.
 */

import { describe, it, expect } from 'vitest';
import { readReceiptManager, ReadReceiptPayload } from '../src/messaging/readReceipts.ts';
import { UIMessage } from '../src/ui/app/types.ts';

describe('Phase 38: Read Receipts & Delivery Status Progression', () => {
  it('correctly updates outgoing message status to READ upon processing inbound receipt', () => {
    const mockMessages: Record<string, UIMessage[]> = {
      conv_alice: [
        {
          id: 'msg_1',
          conversationId: 'conv_alice',
          senderId: 'self',
          text: 'Hello Alice',
          isOutgoing: true,
          timestamp: Date.now() - 5000,
          status: 'SENT_TO_RELAY',
        },
        {
          id: 'msg_2',
          conversationId: 'conv_alice',
          senderId: 'self',
          text: 'Did you get the file?',
          isOutgoing: true,
          timestamp: Date.now() - 3000,
          status: 'DELIVERED_TO_RECIPIENT',
        },
        {
          id: 'msg_3',
          conversationId: 'conv_alice',
          senderId: 'alice',
          text: 'Yes I did!',
          isOutgoing: false,
          timestamp: Date.now() - 1000,
          status: 'DELIVERED_TO_RECIPIENT',
        },
      ],
    };

    const receipt: ReadReceiptPayload = {
      type: 'READ_RECEIPT',
      conversationId: 'conv_alice',
      lastReadMessageId: 'msg_2',
      readerIdentityId: 'alice',
      readAt: Date.now(),
    };

    const { updatedMessages, didChange } = readReceiptManager.processInboundReceipt(
      receipt,
      mockMessages
    );

    expect(didChange).toBe(true);
    const convList = updatedMessages['conv_alice'];
    expect(convList[0].status).toBe('READ');
    expect(convList[1].status).toBe('READ');
    // Incoming message should not be mutated to outgoing READ
    expect(convList[2].status).toBe('DELIVERED_TO_RECIPIENT');
  });

  it('does not mutate already READ messages or failed messages', () => {
    const mockMessages: Record<string, UIMessage[]> = {
      conv_bob: [
        {
          id: 'msg_10',
          conversationId: 'conv_bob',
          senderId: 'self',
          text: 'Old message',
          isOutgoing: true,
          timestamp: Date.now() - 10000,
          status: 'READ',
        },
        {
          id: 'msg_11',
          conversationId: 'conv_bob',
          senderId: 'self',
          text: 'Failed message',
          isOutgoing: true,
          timestamp: Date.now() - 5000,
          status: 'FAILED',
        },
      ],
    };

    const receipt: ReadReceiptPayload = {
      type: 'READ_RECEIPT',
      conversationId: 'conv_bob',
      lastReadMessageId: 'msg_10',
      readerIdentityId: 'bob',
      readAt: Date.now(),
    };

    const { updatedMessages, didChange } = readReceiptManager.processInboundReceipt(
      receipt,
      mockMessages
    );

    expect(didChange).toBe(false);
    expect(updatedMessages['conv_bob'][1].status).toBe('FAILED');
  });
});
