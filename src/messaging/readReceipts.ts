/**
 * Read Receipts Subsystem for VEIL E2EE Messaging.
 *
 * Implements:
 * - End-to-end encrypted delivery & read receipt notifications.
 * - Outgoing message status progression: QUEUED -> SENDING -> SENT_TO_RELAY -> DELIVERED_TO_RECIPIENT -> READ.
 * - Debounced batch read receipt dispatch upon conversation open.
 * - Local-first offline-tolerant delivery state persistence.
 */

import { UIMessage } from '../ui/app/types.ts';

export interface DeliveryReceiptPayload {
  type: 'DELIVERY_RECEIPT';
  conversationId: string;
  messageId: string;
  receivedAt: number;
}

export interface ReadReceiptPayload {
  type: 'READ_RECEIPT';
  conversationId: string;
  lastReadMessageId: string;
  readerIdentityId: string;
  readAt: number;
}

export type ReceiptPayload = DeliveryReceiptPayload | ReadReceiptPayload;

export class ReadReceiptManager {
  private pendingReceipts: Map<string, { conversationId: string; lastMessageId: string }> = new Map();
  private debounceTimer: any = null;

  /**
   * Schedules a read receipt to be sent to a peer for a conversation.
   * Debounces to avoid flooding when scrolling through multiple messages.
   */
  public scheduleReadReceipt(
    conversationId: string,
    lastMessageId: string,
    sendReceipt: (receipt: ReadReceiptPayload) => Promise<void>
  ): void {
    if (!conversationId || !lastMessageId) return;

    this.pendingReceipts.set(conversationId, {
      conversationId,
      lastMessageId,
    });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.flushPendingReceipts(sendReceipt);
    }, 400);
  }

  /**
   * Flushes all queued read receipts over the untrusted relay transport.
   */
  public async flushPendingReceipts(sendReceipt: (receipt: ReadReceiptPayload) => Promise<void>): Promise<void> {
    if (this.pendingReceipts.size === 0) return;

    const queue = Array.from(this.pendingReceipts.values());
    this.pendingReceipts.clear();

    for (const item of queue) {
      try {
        const payload: ReadReceiptPayload = {
          type: 'READ_RECEIPT',
          conversationId: item.conversationId,
          lastReadMessageId: item.lastMessageId,
          // This is replaced by the authenticated sender identity when the
          // encrypted receipt envelope is created.
          readerIdentityId: '',
          readAt: Date.now(),
        };
        await sendReceipt(payload);
      } catch (_e) {
        // Safe swallow: receipts will re-sync on next conversation open
      }
    }
  }

  /**
   * Processes an inbound read receipt payload and updates matching outgoing message statuses to 'READ'.
   */
  public processInboundReceipt(
    receipt: ReceiptPayload,
    messagesMap: Record<string, UIMessage[]>,
    authenticatedPeerId?: string
  ): { updatedMessages: Record<string, UIMessage[]>; didChange: boolean } {
    const { conversationId } = receipt;
    if (authenticatedPeerId && (
      conversationId !== authenticatedPeerId ||
      (receipt.type === 'READ_RECEIPT' && receipt.readerIdentityId !== authenticatedPeerId)
    )) {
      return { updatedMessages: messagesMap, didChange: false };
    }

    const targetKey = messagesMap[conversationId]
      ? conversationId
      : (receipt.type === 'READ_RECEIPT' && receipt.readerIdentityId && messagesMap[receipt.readerIdentityId]
          ? receipt.readerIdentityId
          : conversationId);

    const list = messagesMap[targetKey];
    if (!list || list.length === 0) return { updatedMessages: messagesMap, didChange: false };

    const receiptMessageId = receipt.type === 'READ_RECEIPT'
      ? receipt.lastReadMessageId
      : receipt.messageId;
    const receiptIndex = list.findIndex((message) => message.id === receiptMessageId);
    if (receiptIndex < 0) return { updatedMessages: messagesMap, didChange: false };

    let didChange = false;
    const nextList = list.map((message, index) => {
      const acknowledged = receipt.type === 'READ_RECEIPT'
        ? index <= receiptIndex
        : index === receiptIndex;
      if (!acknowledged || !message.isOutgoing || message.status === 'FAILED') return message;

      const nextStatus = receipt.type === 'READ_RECEIPT' ? 'READ' : 'DELIVERED_TO_RECIPIENT';
      if (message.status === nextStatus || (message.status === 'READ' && nextStatus !== 'READ')) return message;
      didChange = true;
      return { ...message, status: nextStatus };
    });

    const updatedMessages = didChange ? { ...messagesMap, [targetKey]: nextList } : messagesMap;
    return { updatedMessages, didChange };
  }
}

export const readReceiptManager = new ReadReceiptManager();
