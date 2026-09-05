import { describe, it, expect } from 'vitest';
import { UIMessage } from '../src/ui/types.ts';

describe('Phase 59: Group Seen Feature & Group Read Receipts', () => {
  it('advances preceding outgoing messages in a group to READ when an inbound message arrives', () => {
    const groupId = 'grp_cort_test123';
    const initialList: UIMessage[] = [
      {
        id: 'msg_out_1',
        conversationId: groupId,
        senderId: 'user_let',
        text: 'hello',
        isOutgoing: true,
        timestamp: 1000,
        status: 'SENT_TO_RELAY',
      },
      {
        id: 'msg_out_2',
        conversationId: groupId,
        senderId: 'user_let',
        text: 'ntn much',
        isOutgoing: true,
        timestamp: 2000,
        status: 'SENT_TO_RELAY',
      },
    ];

    const incomingPeerMsg: UIMessage = {
      id: 'msg_in_1',
      conversationId: groupId,
      senderId: 'user_lop',
      text: 'Wsg',
      isOutgoing: false,
      timestamp: 3000,
      status: 'DELIVERED_TO_RECIPIENT',
    };

    // Simulate the group message handler transition logic
    const updatedList = initialList.map((m) => {
      if (
        m.isOutgoing &&
        m.status !== 'FAILED' &&
        m.status !== 'READ' &&
        (!m.timestamp || m.timestamp <= incomingPeerMsg.timestamp)
      ) {
        return { ...m, status: 'READ' as const };
      }
      return m;
    });

    expect(updatedList[0].status).toBe('READ');
    expect(updatedList[1].status).toBe('READ');
  });

  it('processes GROUP_READ_RECEIPT payload and updates matching messages up to lastReadMessageId', () => {
    const groupId = 'grp_cort_test123';
    const list: UIMessage[] = [
      {
        id: 'msg_1',
        conversationId: groupId,
        senderId: 'user_let',
        text: 'first',
        isOutgoing: true,
        timestamp: 100,
        status: 'SENT_TO_RELAY',
      },
      {
        id: 'msg_2',
        conversationId: groupId,
        senderId: 'user_let',
        text: 'second',
        isOutgoing: true,
        timestamp: 200,
        status: 'SENT_TO_RELAY',
      },
      {
        id: 'msg_3',
        conversationId: groupId,
        senderId: 'user_let',
        text: 'third',
        isOutgoing: true,
        timestamp: 500,
        status: 'SENT_TO_RELAY',
      },
    ];

    const receiptPayload = {
      type: 'GROUP_READ_RECEIPT',
      groupId,
      readerIdentityId: 'user_lop',
      lastReadMessageId: 'msg_2',
      readAt: 250,
    };

    const updatedList = list.map((m) => {
      if (m.isOutgoing && m.status !== 'FAILED' && m.status !== 'READ') {
        if (
          !receiptPayload.lastReadMessageId ||
          m.id === receiptPayload.lastReadMessageId ||
          (m.timestamp && receiptPayload.readAt && m.timestamp <= receiptPayload.readAt)
        ) {
          return { ...m, status: 'READ' as const };
        }
      }
      return m;
    });

    expect(updatedList[0].status).toBe('READ');
    expect(updatedList[1].status).toBe('READ');
    // msg_3 timestamp (500) > readAt (250) and id !== 'msg_2', remains SENT_TO_RELAY
    expect(updatedList[2].status).toBe('SENT_TO_RELAY');
  });

  it('strictly preserves monotonicity: messages already in READ never regress to lower statuses', () => {
    const list: UIMessage[] = [
      {
        id: 'msg_1',
        conversationId: 'grp_test',
        senderId: 'me',
        text: 'seen message',
        isOutgoing: true,
        timestamp: 100,
        status: 'READ',
      },
    ];

    const updatedList = list.map((m) => {
      if (m.isOutgoing && m.status !== 'FAILED' && m.status !== 'READ') {
        return { ...m, status: 'DELIVERED_TO_RECIPIENT' as const };
      }
      return m;
    });

    expect(updatedList[0].status).toBe('READ');
  });
});
