/**
 * Read Receipts Subsystem for VEIL E2EE Messaging.
 *
 * Implements:
 * - End-to-end encrypted delivery & read receipt notifications.
 * - Outgoing message status progression: QUEUED -> SENDING -> SENT_TO_RELAY -> DELIVERED_TO_RECIPIENT -> READ.
 * - Debounced batch read receipt dispatch upon conversation open.
 * - Local-first offline-tolerant delivery state persistence.
 */

import { UIMessage, DeliveryStatus } from '../ui/app/types.ts';

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
  private pendingReceipts: Map<
    string,
    { conversationId: string; lastMessageId: string; readerIdentityId?: string; sendReceipt?: (receipt: ReadReceiptPayload) => Promise<void> }
  > = new Map();
  private debounceTimer: any = null;

  /**
   * Schedules a read receipt to be sent to a peer for a conversation.
   * Debounces to avoid flooding when scrolling through multiple messages.
   */
  public scheduleReadReceipt(
    conversationId: string,
    lastMessageId: string,
    sendReceipt: (receipt: ReadReceiptPayload) => Promise<void>,
    readerIdentityId?: string
  ): void {
    if (!conversationId || !lastMessageId) return;

    this.pendingReceipts.set(conversationId, {
      conversationId,
      lastMessageId,
      readerIdentityId,
      sendReceipt,
    });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.flushPendingReceipts(sendReceipt);
    }, 300);
  }

  /**
   * Flushes all queued read receipts over the untrusted relay transport.
   */
  public async flushPendingReceipts(fallbackSender?: (receipt: ReadReceiptPayload) => Promise<void>): Promise<void> {
    if (this.pendingReceipts.size === 0) return;

    const queue = Array.from(this.pendingReceipts.values());
    this.pendingReceipts.clear();

    for (const item of queue) {
      const sender = item.sendReceipt || fallbackSender;
      if (!sender) continue;
      try {
        const payload: ReadReceiptPayload = {
          type: 'READ_RECEIPT',
          conversationId: item.conversationId,
          lastReadMessageId: item.lastMessageId,
          readerIdentityId: item.readerIdentityId || '',
          readAt: Date.now(),
        };
        await sender(payload);
      } catch (_e) {
        // If network send failed (e.g. offline), retain in queue to retry
        this.pendingReceipts.set(item.conversationId, item);
      }
    }
  }

  /**
   * Processes an inbound read/delivery receipt payload and updates matching outgoing message statuses.
   */
  public processInboundReceipt(
    arg1: any,
    arg2: any,
    authenticatedPeerId?: string
  ): { updatedMessages: Record<string, UIMessage[]>; didChange: boolean } {
    let receipt: ReceiptPayload;
    let messagesMap: Record<string, UIMessage[]>;

    if (arg1 && typeof arg1.type === 'string') {
      receipt = arg1;
      messagesMap = arg2;
    } else if (arg2 && typeof arg2.type === 'string') {
      receipt = arg2;
      messagesMap = arg1;
    } else {
      return { updatedMessages: arg1 || {}, didChange: false };
    }

    // 1. Authenticate peer attribution
    // If authenticatedPeerId is provided, the sender of the encrypted payload must match the expected reader/recipient
    if (authenticatedPeerId) {
      if (receipt.type === 'READ_RECEIPT' && receipt.readerIdentityId && receipt.readerIdentityId !== authenticatedPeerId) {
        return { updatedMessages: messagesMap, didChange: false };
      }
    }

    // 2. Identify candidate conversation keys in messagesMap.
    const receiptMessageId = receipt.type === 'READ_RECEIPT'
      ? receipt.lastReadMessageId
      : receipt.messageId;

    const candidateKeys = [
      authenticatedPeerId,
      receipt.type === 'READ_RECEIPT' ? receipt.readerIdentityId : undefined,
      receipt.conversationId,
    ].filter(Boolean) as string[];

    const keysToUpdate = new Set<string>();
    for (const k of candidateKeys) {
      if (messagesMap[k] && messagesMap[k].length > 0) {
        keysToUpdate.add(k);
      }
    }
    if (receiptMessageId) {
      for (const k of Object.keys(messagesMap)) {
        if (messagesMap[k]?.some((m) => m.id === receiptMessageId)) {
          keysToUpdate.add(k);
        }
      }
    }

    if (keysToUpdate.size === 0) {
      return { updatedMessages: messagesMap, didChange: false };
    }

    let didChange = false;
    const updatedMessages = { ...messagesMap };

    for (const key of keysToUpdate) {
      const list = messagesMap[key];
      if (!list || list.length === 0) continue;

      const receiptIndex = receiptMessageId ? list.findIndex((m) => m.id === receiptMessageId) : list.length - 1;
      if (receiptIndex < 0) continue;

      let keyChanged = false;
      const nextList = list.map((message, index) => {
        const acknowledged = receipt.type === 'READ_RECEIPT'
          ? index <= receiptIndex
          : index === receiptIndex;
        if (!acknowledged || !message.isOutgoing || message.status === 'FAILED') return message;

        const nextStatus: DeliveryStatus = receipt.type === 'READ_RECEIPT' ? 'READ' : 'DELIVERED_TO_RECIPIENT';

        // Strict monotonicity: A message already in 'READ' status MUST NEVER regress
        if (message.status === nextStatus) return message;
        if (message.status === 'READ' && nextStatus !== 'READ') return message;

        keyChanged = true;
        didChange = true;
        return { ...message, status: nextStatus };
      });

      if (keyChanged) {
        updatedMessages[key] = nextList;
      }
    }

    return { updatedMessages: didChange ? updatedMessages : messagesMap, didChange };
  }
}

export const readReceiptManager = new ReadReceiptManager();
export const processInboundReceipt = (
  arg1: any,
  arg2: any,
  authenticatedPeerId?: string
) => readReceiptManager.processInboundReceipt(arg1, arg2, authenticatedPeerId);
export const scheduleReadReceipt = (
  conversationId: string,
  lastMessageId: string,
  sendReceipt: (receipt: ReadReceiptPayload) => Promise<void>,
  readerIdentityId?: string
) => readReceiptManager.scheduleReadReceipt(conversationId, lastMessageId, sendReceipt, readerIdentityId);
export const flushPendingReceipts = (
  fallbackSender?: (receipt: ReadReceiptPayload) => Promise<void>
) => readReceiptManager.flushPendingReceipts(fallbackSender);

